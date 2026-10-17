const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test, before, after } = require('node:test')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default
const { chromium, openComic, root } = require('./helpers/browser.cjs')
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

function functions(file, names, globals) {
  const found = {}
  traverse(parser.parse(fs.readFileSync(path.join(root, file), 'utf8')), { FunctionDeclaration(p) {
    if (names.includes(p.node.id.name)) found[p.node.id.name] = generate(p.node).code
  } })
  for (const name of names) assert.ok(found[name], `missing production function ${name}`)
  return vm.runInNewContext(`${Object.values(found).join('\n')};({${names.join(',')}})`, globals)
}

test('single selection and Shift selection only visit affected chapter rows', async () => {
  const { page, context } = await openComic(browser, { count: 300 })
  try {
    await page.locator('#ten-load-chapters').click()
    const result = await page.evaluate(() => {
      const list = document.querySelector('#ten-chapter-list'), untouched = list.children[200]
      let visits = 0
      const toggle = untouched.classList.toggle.bind(untouched.classList)
      untouched.classList.toggle = (...args) => { visits++; return toggle(...args) }
      list.children[2].querySelector('input').click()
      list.children[5].querySelector('input').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
      return { visits, selected: list.querySelectorAll('input:checked').length, untouchedSelected: untouched.querySelector('input').checked }
    })
    assert.equal(result.visits, 0, 'selecting four chapters must not traverse unrelated rows')
    assert.equal(result.selected, 4)
    assert.equal(result.untouchedSelected, false)
  } finally { await context.close() }
})

test('large chapter loading yields early and retains selections made before the last batch', async () => {
  const { page, context } = await openComic(browser, { count: 3000 })
  try {
    const firstBatch = await page.evaluate(() => {
      document.querySelector('#ten-load-chapters').click()
      const count = document.querySelector('#ten-chapter-list').children.length
      document.querySelector('#ten-select-all').click()
      return count
    })
    assert.ok(firstBatch > 0 && firstBatch < 3000, `the initial click blocks until all ${firstBatch} rows are built`)
    await page.waitForFunction(() => document.querySelectorAll('#ten-chapter-list input:checked').length === 3000)
    assert.equal(await page.locator('#ten-chapter-list [data-index="2999"]').count(), 1)
    await page.locator('#ten-clear-select').click()
    assert.equal(await page.locator('#ten-chapter-list input:checked').count(), 0)
  } finally { await context.close() }
})

test('reload during a chapter batch completes with the full list instead of clearing it', async () => {
  const { page, context } = await openComic(browser, { count: 3000 })
  try {
    const rows = await page.evaluate(() => {
      document.querySelector('#ten-load-chapters').click()
      document.querySelector('#ten-reload-chapters').click()
      return document.querySelector('#ten-chapter-list').children.length
    })
    assert.ok(rows > 0, 'reload cleared the list while the active load prevents a replacement')
    await page.waitForFunction(() => document.querySelector('#ten-load-chapters').disabled === false && document.querySelector('#ten-chapter-list').getAttribute('aria-busy') === 'false')
    assert.equal(await page.locator('#ten-chapter-list > div').count(), 3000)
    await page.locator('#ten-select-all').click()
    assert.equal(await page.locator('#ten-chapter-list input:checked').count(), 3000)
  } finally { await context.close() }
})

test('hidden task refreshes do not enumerate the waiting queue', () => {
  const waiting = Array.from({ length: 1000 }, (_, index) => ({ url: `/chapter/${index}` }))
  let scans = 0
  waiting.map = (...args) => { scans++; return Array.prototype.map.apply(waiting, args) }
  const { renderTasks } = functions('src/userscript/ui/tasks.js', ['renderTasks'], {
    state: { ready: true, visible: false, queue: { worker: [], list: waiting } },
    syncMiniTaskBar(active, count) { assert.equal(count, 1000) }
  })
  for (let index = 0; index < 30; index++) renderTasks()
  assert.equal(scans, 0)
})

test('adding a history record reuses existing history cards', async () => {
  const history = [2, 1].map(id => ({ id, comicName: '漫画', downChapterName: `第${id}话`, status: 'completed', completedAt: '2026-01-01T00:00:00Z' }))
  const { page, context } = await openComic(browser, { history })
  try {
    await page.locator('[data-tab="tasks"]').click()
    await page.evaluate(() => {
      window.__oldHistoryCard = document.querySelector('[data-delete-history="1"]').closest('.ten-history-card')
      const records = JSON.parse(localStorage.getItem('ylComicDownHistory'))
      records.unshift({ id: 3, comicName: '漫画', downChapterName: '第3话', status: 'completed' })
      localStorage.setItem('ylComicDownHistory', JSON.stringify(records))
    })
    await page.locator('[data-tab="sites"]').click()
    await page.locator('[data-tab="tasks"]').click()
    assert.equal(await page.evaluate(() => window.__oldHistoryCard === document.querySelector('[data-delete-history="1"]').closest('.ten-history-card')), true)
    assert.equal(await page.locator('.ten-history-card').count(), 3)
  } finally { await context.close() }
})

test('waiting queue reorder, remove and undo preserve task order and unaffected cards', async () => {
  const { page, context } = await openComic(browser, { count: 5, requestDelay: -1, settings: { maxChapterNum: 1 } })
  try {
    await page.locator('#ten-load-chapters').click()
    await page.locator('#ten-select-all').click()
    await page.locator('#ten-download-selected').click()
    await page.locator('#ten-waiting-tasks .ten-task-card').nth(3).waitFor()
    const names = () => page.locator('#ten-waiting-tasks .ten-task-title').allTextContents()
    const initial = await names()
    await page.evaluate(() => { window.__waitingTail = document.querySelector('#ten-waiting-tasks').lastElementChild })
    await page.locator('#ten-waiting-tasks [data-task-action="waiting-up"]').nth(1).click()
    assert.deepEqual(await names(), [initial[1], initial[0], initial[2], initial[3]])
    assert.equal(await page.evaluate(() => window.__waitingTail === document.querySelector('#ten-waiting-tasks').lastElementChild), true)
    await page.locator('#ten-waiting-tasks [data-task-action="cancel-waiting"]').first().click()
    assert.deepEqual(await names(), [initial[0], initial[2], initial[3]])
    await page.locator('#ten-toast-action').click()
    assert.deepEqual(await names(), [initial[1], initial[0], initial[2], initial[3]])
  } finally { await context.close() }
})

test('reordering during a large render cancels obsolete batches and keeps all chapters', async () => {
  const { page, context } = await openComic(browser, { count: 3000 })
  try {
    await page.evaluate(() => {
      document.querySelector('#ten-load-chapters').click()
      document.querySelector('#ten-reverse-list').click()
    })
    await page.waitForFunction(() => document.querySelector('#ten-chapter-list').getAttribute('aria-busy') === 'false')
    assert.equal(await page.locator('#ten-chapter-list > div').count(), 3000)
    assert.match(await page.locator('#ten-chapter-list .ten-name').first().textContent(), /第 3000 话/)
    assert.match(await page.locator('#ten-chapter-list .ten-name').last().textContent(), /第 1 话/)
    await page.locator('#ten-chapter-list [data-index="0"] input').check()
    assert.equal(await page.locator('#ten-chapter-list input:checked').count(), 1)
  } finally { await context.close() }
})

function persistenceHarness() {
  let now = 0, id = 0, progress = 0
  const timers = new Map(), writes = [], store = { pendingTasks: [] }
  const state = { persistTimer: null, queue: { pendingTasks: () => [{ url: 'https://comic.test/1', comicName: '漫画', chapterName: '章节', resumeCompleted: progress }] }, recoveryTasks: [] }
  const api = functions('src/userscript/modules/ui.js', ['taskHost', 'uniqueTaskSnapshots', 'scheduleTaskPersist', 'persistQueueState', 'handlePageHide'], {
    state, PENDING_TASKS_KEY: 'pendingTasks', URL, window: { location: { hostname: 'comic.test', href: 'https://comic.test/1' } },
    safeGet: key => structuredClone(store[key]),
    configModule: { po(key, value) { store[key] = structuredClone(value); writes.push(structuredClone(value)) } },
    setTimeout(callback, wait) { timers.set(++id, { callback, deadline: now + wait }); return id },
    clearTimeout(timer) { timers.delete(timer) }
  })
  return { api, writes, setProgress(value) { progress = value }, tick(ms) {
    const end = now + ms
    while (true) {
      const due = [...timers].filter(([, timer]) => timer.deadline <= end).sort((a, b) => a[1].deadline - b[1].deadline)[0]
      if (!due) break
      timers.delete(due[0]); now = due[1].deadline; due[1].callback()
    }
    now = end
  } }
}

test('continuous task progress still checkpoints within 750ms', () => {
  const h = persistenceHarness()
  h.api.scheduleTaskPersist()
  for (let index = 1; index <= 3; index++) {
    h.tick(250); h.setProgress(index); h.api.scheduleTaskPersist()
  }
  assert.equal(h.writes.length, 1, 'progress updates keep postponing the checkpoint indefinitely')
  h.api.handlePageHide()
  assert.equal(h.writes.at(-1)[0].resumeCompleted, 3)
})

test('unchanged task snapshots do not write storage again', () => {
  const h = persistenceHarness()
  h.api.scheduleTaskPersist(); h.tick(750)
  h.api.scheduleTaskPersist(); h.tick(750)
  assert.equal(h.writes.length, 1)
})
