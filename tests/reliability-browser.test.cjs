const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { chromium, openComic } = require('./helpers/browser.cjs')
const fs = require('node:fs')
const path = require('node:path')
const { root } = require('./helpers/browser.cjs')
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })
async function enqueue(page) {
  await page.locator('[data-tab="chapters"]').click()
  if (await page.locator('#ten-load-chapters').isVisible()) await page.locator('#ten-load-chapters').click()
  await page.locator('#ten-select-all').click()
  await page.locator('#ten-download-selected').click()
}
test('active and completed duplicates can be skipped, or explicitly downloaded again', async () => {
  const { page, context } = await openComic(browser, { count: 1, requestDelay: -1 })
  try {
    await enqueue(page)
    await page.locator('[data-worker-card]').waitFor()
    await enqueue(page)
    await page.locator('#ten-confirm').waitFor({ state: 'visible' })
    assert.match(await page.locator('#ten-confirm-message').textContent(), /重复/)
    await page.locator('#ten-confirm-cancel').click()
    assert.equal(await page.locator('#ten-waiting-tasks .ten-task-card').count(), 0)
    await page.evaluate(() => window.__releaseRequests())
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]')[0]?.status === 'completed')
    await enqueue(page)
    await page.locator('#ten-confirm').waitFor({ state: 'visible' })
    await page.locator('#ten-confirm-ok').click()
    await page.waitForFunction(() => window.__saved.length === 4)
  } finally { await context.close() }
})
for (const mode of [0, 1, 2]) test(`mode ${mode} reports processed, successful and written pages separately`, async () => {
  const { page, context } = await openComic(browser, { count: 1, settings: { downType: mode } })
  try {
    await enqueue(page)
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]')[0]?.status === 'completed')
    const result = await page.evaluate(() => JSON.parse(localStorage.getItem('ylComicDownHistory'))[0])
    assert.equal(result.processedNum, 2); assert.equal(result.successNum, 2); assert.equal(result.failedNum, 0); assert.equal(result.writtenNum, 2)
  } finally { await context.close() }
})
test('generic MIME images remain usable for stitching and history records retain output-mode distinctions', async () => {
  const { page, context } = await openComic(browser, { count: 1, settings: { downType: 2 } })
  try {
    const { pixel } = require('./helpers/browser.cjs')
    await context.route('https://img.test/**', route => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: pixel }))
    await enqueue(page)
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]').length === 1)
    const record = await page.evaluate(() => JSON.parse(localStorage.getItem('ylComicDownHistory'))[0])
    assert.equal(record.status, 'completed'); assert.equal(record.writtenNum, 2); assert.equal(record.successNum, 2); assert.equal(record.failedNum, 0)
    await page.evaluate(() => { const record = JSON.parse(localStorage.getItem('ylComicDownHistory'))[0]; const other = structuredClone(record); other.id++; other.task.downType = 0; localStorage.setItem('ylComicDownHistory', JSON.stringify([record,other])) })
    await page.locator('[data-tab="sites"]').click(); await page.locator('[data-tab="tasks"]').click()
    assert.equal(await page.locator('.ten-history-card').count(), 2)
  } finally { await context.close() }
})
test('narrow history cards keep their result counts on a readable separate line', async () => {
  const record = { id: 1, comicName: '漫画', downChapterName: '长章节', status: 'completed', completedAt: '2026-10-20T12:00:00Z', durationMs: 60000, flowUsed: '兼容流程', processedNum: 10000, successNum: 9999, failedNum: 1, writtenNum: 9999 }
  const { page, context } = await openComic(browser, { count: 1, viewport: { width: 320, height: 568 }, history: [record] })
  try {
    await page.locator('[data-tab="tasks"]').click()
    const geometry = await page.locator('.ten-history-card').evaluate(card => {
      const meta = card.querySelector('.ten-task-meta'), counts = [...card.querySelectorAll('*')].find(node => node.childElementCount === 0 && node.textContent.startsWith('成功取图'))
      return { countsTop: counts.getBoundingClientRect().top, metadataBottom: meta.getBoundingClientRect().bottom }
    })
    assert.ok(geometry.countsTop >= geometry.metadataBottom - 1, 'the added counters crowd the timing/flow/status row')
  } finally { await context.close() }
})
test('a storage write failure leaves completed history visible and the next chapter can finish', async () => {
  const { page, context } = await openComic(browser, { count: 2, settings: { maxChapterNum: 1 } })
  try {
    await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'ylComicDownHistory') throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, key, value) } })
    await enqueue(page)
    await page.waitForFunction(() => window.__saved.length === 4)
    await page.locator('[data-worker-card]').waitFor({ state: 'detached' })
    assert.equal(await page.locator('.ten-history-card').count(), 2)
    assert.match(await page.locator('#ten-history').textContent(), /成功.*2/)
  } finally { await context.close() }
})
test('history edits made during a quota error do not hide later records after storage recovers', async () => {
  const { page, context } = await openComic(browser, { count: 2, settings: { maxChapterNum: 1 } })
  try {
    await page.evaluate(() => { window.__quota = true; const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'ylComicDownHistory' && window.__quota) throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, key, value) } })
    await page.locator('#ten-load-chapters').click(); await page.locator('#ten-chapter-list [data-index="0"] input').check(); await page.locator('#ten-download-selected').click()
    await page.locator('.ten-history-card').waitFor({ state: 'attached' })
    await page.locator('[data-task-group="history"] .ten-task-title-button').click()
    await page.locator('.ten-history-card [data-delete-history]').click(); await page.locator('#ten-confirm-ok').click()
    assert.equal(await page.locator('.ten-history-card').count(), 0)
    await page.evaluate(() => { window.__quota = false })
    await page.locator('[data-tab="chapters"]').click(); await page.locator('#ten-chapter-list [data-index="1"] input').check(); await page.locator('#ten-download-selected').click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]').length === 1)
    assert.equal(await page.locator('.ten-history-card').count(), 1)
  } finally { await context.close() }
})
test('two real tabs keep independent checkpoints and only recover the tab that has closed', async () => {
  const { page: a, context } = await openComic(browser, { count: 2, requestDelay: -1, settings: { maxChapterNum: 1 } })
  try {
    const share = () => {
      const prefix = '__test_shared_gm:'
      window.GM_getValue = (key, fallback) => { const text = localStorage.getItem(prefix + key); return text === null ? fallback : JSON.parse(text) }
      window.GM_setValue = (key, value) => localStorage.setItem(prefix + key, JSON.stringify(value))
      window.GM_deleteValue = key => localStorage.removeItem(prefix + key)
      window.GM_listValues = () => Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length))
    }
    await a.evaluate(() => { for (const [key,value] of Object.entries(window.__gmValues)) localStorage.setItem('__test_shared_gm:' + key, JSON.stringify(value, (_,item) => typeof item === 'function' ? item.toString() : item)) })
    await a.evaluate(share); await context.addInitScript(share)
    await a.locator('#ten-load-chapters').click(); await a.locator('#ten-chapter-list [data-index="0"] input').check(); await a.locator('#ten-download-selected').click()
    await a.waitForFunction(() => GM_listValues().filter(key => key.startsWith('pendingTasks.session.')).length === 1)
    const b = await context.newPage(); await b.goto('https://comic.test/title'); await b.evaluate(share)
    await b.addScriptTag({ content: fs.readFileSync(process.env.USERSCRIPT_PATH || path.join(root, '10漫画—重制版.user.js'), 'utf8') })
    await b.locator('#ten-panel.is-open').waitFor()
    assert.equal(await b.locator('#ten-recovery').isVisible(), false)
    await b.locator('#ten-load-chapters').click(); await b.locator('#ten-chapter-list [data-index="1"] input').check(); await b.locator('#ten-download-selected').click()
    await b.waitForFunction(() => GM_listValues().filter(key => key.startsWith('pendingTasks.session.')).length === 2)
    const snapshots = await b.evaluate(() => GM_listValues().filter(key => key.startsWith('pendingTasks.session.')).map(key => GM_getValue(key).tasks))
    assert.equal(snapshots.length, 2); assert.ok(snapshots.every(tasks => tasks.length === 1))
    await a.close()
    await b.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await b.waitForFunction(() => document.querySelector('#ten-recovery-count').textContent === '1 个任务可恢复')
    await b.locator('#ten-recovery-restore').click()
    await b.waitForFunction(() => document.querySelectorAll('#ten-waiting-tasks .ten-task-card').length === 1)
    await b.evaluate(() => window.__releaseRequests())
    await b.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]').length === 2)
    const state = await b.evaluate(() => ({ saved: window.__saved, history: JSON.parse(localStorage.getItem('ylComicDownHistory')) }))
    assert.equal(state.saved.length, 4, JSON.stringify(state.history))
  } finally { await context.close() }
})
