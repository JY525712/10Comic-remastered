const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { chromium, openComic, root } = require('../tests/helpers/browser.cjs')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report = { sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, '10漫画—重制版.user.js'))).digest('hex'), count: 3000, runs: [] }
  try {
    for (const baseline of [true, false]) {
      const { page, context } = await openComic(browser, { baseline, count: report.count })
      try {
        await page.locator('#ten-load-chapters').click()
        const measurement = await page.evaluate(() => {
          const list = document.getElementById('ten-chapter-list')
          const observer = new MutationObserver(() => {})
          observer.observe(list, { childList: true, subtree: true })
          const milliseconds = [], nodesAdded = []
          for (const index of [10, 2500, 100, 2000, 50, 1500, 500]) {
            observer.takeRecords()
            const start = performance.now()
            list.querySelector(`[data-index="${index}"] input`).click()
            milliseconds.push(performance.now() - start)
            nodesAdded.push(observer.takeRecords().reduce((sum, record) => sum + record.addedNodes.length, 0))
          }
          observer.disconnect()
          return { milliseconds, nodesAdded, rows: list.children.length }
        })
        report.runs.push({ version: baseline ? '2.0.11' : 'optimized', ...measurement })
      } finally { await context.close() }
    }
    const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
    report.summary = report.runs.map(run => ({ version: run.version, medianMs: median(run.milliseconds), totalNodesAdded: run.nodesAdded.reduce((a, b) => a + b, 0) }))
    fs.mkdirSync(path.join(root, 'dist/verification'), { recursive: true })
    fs.writeFileSync(path.join(root, 'dist/verification/chapter-benchmark.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report.summary))
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
