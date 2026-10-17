const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { chromium, openComic, root } = require('../tests/helpers/browser.cjs')
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

async function main() {
  const before = path.join(root, 'dist/verification/before-runtime-794d7e4.user.js')
  fs.mkdirSync(path.dirname(before), { recursive: true })
  if (!fs.existsSync(before)) fs.writeFileSync(before, execFileSync('git', ['show', '794d7e4:10漫画—重制版.user.js'], { cwd: root, maxBuffer: 2 * 1024 * 1024 }))
  if (hash(before) !== '5258dc195d67f9c45c0071bd37f1a907c3a5d8c62f835f8f1c90394f16794044') throw new Error('Runtime benchmark baseline does not match published commit 794d7e4')
  const after = path.join(root, '10漫画—重制版.user.js')
  const report = { before: hash(before), sha256: hash(after), chapters: [], history: [], tasks: [] }
  const browser = await chromium.launch({ headless: true })
  try {
    for (const [version, sourcePath] of [['before', before], ['after', after]]) {
      for (const count of [300, 3000, 10000]) {
        const { page, context } = await openComic(browser, { sourcePath, count })
        try {
          const blockingMs = await page.evaluate(() => {
            const start = performance.now()
            document.querySelector('#ten-load-chapters').click()
            return performance.now() - start
          })
          await page.waitForFunction(count => {
            const list = document.querySelector('#ten-chapter-list')
            return list.children.length === count && list.getAttribute('aria-busy') !== 'true'
          }, count)
          const clicks = await page.evaluate(count => {
            const list = document.querySelector('#ten-chapter-list')
            const targets = [10, .8, .2, .65, .1, .45, .3].map((n, index) => list.children[index ? Math.floor(n * count) : n].querySelector('input'))
            const times = []
            for (let run = 0; run < 3; run++) for (const checkbox of targets) {
              const start = performance.now()
              checkbox.click()
              times.push(performance.now() - start)
            }
            return times
          }, count)
          report.chapters.push({ version, count, initialBlockingMs: blockingMs, clickMedianMs: median(clicks), clickMaxMs: Math.max(...clicks) })
        } finally { await context.close() }
      }
      const history = Array.from({ length: 500 }, (_, index) => ({ id: 1000 - index, comicName: '基准漫画', downChapterName: `章节${1000 - index}`, status: 'completed', durationMs: 1000, completedAt: '2026-01-01T00:00:00Z' }))
      const { page, context } = await openComic(browser, { sourcePath, count: 1, history, settings: { historyLimit: 500 } })
      try {
        await page.locator('[data-tab="tasks"]').click()
        const results = await page.evaluate(() => {
          const list = document.querySelector('#ten-history'), times = [], added = [], preserved = []
          const stable = document.querySelector('[data-delete-history="750"]').closest('.ten-history-card')
          const observer = new MutationObserver(() => {})
          observer.observe(list, { childList: true, subtree: true })
          for (let iteration = 0; iteration < 7; iteration++) {
            document.querySelector('[data-tab="sites"]').click()
            const records = JSON.parse(localStorage.getItem('ylComicDownHistory'))
            records.unshift({ id: 2000 + iteration, comicName: '基准漫画', downChapterName: `新章节${iteration}`, status: 'completed' })
            localStorage.setItem('ylComicDownHistory', JSON.stringify(records))
            observer.takeRecords()
            const start = performance.now()
            document.querySelector('[data-tab="tasks"]').click()
            times.push(performance.now() - start)
            added.push(observer.takeRecords().reduce((sum, record) => sum + record.addedNodes.length, 0))
            preserved.push(stable.isConnected)
          }
          observer.disconnect()
          return { times, added, preserved }
        })
        report.history.push({ version, medianMs: median(results.times), addedNodes: results.added, retainedCard: results.preserved.every(Boolean) })
      } finally { await context.close() }
      const pendingTasks = Array.from({ length: 1001 }, (_, index) => ({ originHost: 'comic.test', comicName: '基准漫画', chapterName: `等待章节${index}`, downChapterName: `等待章节${index}`, url: `https://comic.test/chapter/${index + 1}`, readtype: 1, downType: 0 }))
      const queued = await openComic(browser, { sourcePath, count: 1, requestDelay: -1, settings: { pendingTasks, maxChapterNum: 1 } })
      try {
        await queued.page.locator('[data-tab="tasks"]').click()
        await queued.page.locator('#ten-recovery-restore').click()
        await queued.page.locator('[data-worker-card]').waitFor()
        const result = await queued.page.evaluate(() => {
          let waitingMaps = 0, timers = 0
          const map = Array.prototype.map, timeout = window.setTimeout, times = []
          Array.prototype.map = function(...args) {
            if (this.length >= 1000 && typeof this[0]?.downChapterName === 'string') waitingMaps++
            return map.apply(this, args)
          }
          window.setTimeout = function(callback, wait, ...args) {
            if (wait === 750) timers++
            return timeout(callback, wait, ...args)
          }
          try {
            for (let index = 0; index < 12; index++) {
              const start = performance.now()
              document.querySelector('[data-task-toggle]').click()
              times.push(performance.now() - start)
            }
          } finally { Array.prototype.map = map; window.setTimeout = timeout }
          return { medianMs: [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)], waitingMaps, additionalPersistTimers: timers }
        })
        report.tasks.push({ version, ...result })
      } finally { await queued.context.close() }
    }
    const file = path.join(root, 'dist/verification/runtime-benchmark.json')
    fs.writeFileSync(file, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
