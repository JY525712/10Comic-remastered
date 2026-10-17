const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { chromium, openComic, root } = require('../tests/helpers/browser.cjs')

async function main() {
  const directory = path.join(root, 'dist/verification')
  fs.mkdirSync(directory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const checks = []
  try {
    for (const theme of ['cloud', 'garden', 'liquid']) {
      for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
        const { page, context, errors } = await openComic(browser, { count: 8, requestDelay: -1, viewport, settings: { themePreset: theme, effectLevel: 1, appLoadDefault: { isShowUI: true, rightSize: 125 } } })
        try {
          await page.locator('#ten-load-chapters').click()
          await page.locator('#ten-chapter-list [data-index="0"] input').click()
          await page.locator('#ten-chapter-list [data-index="1"] input').click()
          await page.locator('#ten-download-selected').click()
          await page.locator('[data-worker-card]').first().waitFor()
          for (const tab of ['sites', 'chapters', 'tasks', 'settings']) {
            await page.locator(`[data-tab="${tab}"]`).click()
            const geometry = await page.locator('#ten-panel').evaluate(element => {
              const rect = element.getBoundingClientRect(), view = element.querySelector('.ten-view.is-active')
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: view.clientWidth, scrollWidth: view.scrollWidth }
            })
            assert.ok(geometry.left >= -1 && geometry.top >= -1 && geometry.right <= viewport.width + 1 && geometry.bottom <= viewport.height + 1, JSON.stringify({ theme, tab, viewport, geometry }))
            assert.ok(geometry.scrollWidth <= geometry.width + 2, `${theme} ${tab} overflows ${viewport.width}`)
            await page.screenshot({ animations: 'disabled', path: path.join(directory, `${theme}-${viewport.width}-${tab}.png`) })
            checks.push({ theme, viewport, tab, geometry })
          }
          await page.locator('#ten-theme-settings > summary').click()
          assert.equal(await page.locator('.ten-view.is-active').evaluate(view => view.scrollWidth <= view.clientWidth + 2), true)
          await page.screenshot({ animations: 'disabled', path: path.join(directory, `${theme}-${viewport.width}-presets.png`) })
          await page.locator('#ten-rule-editor-card > summary').click()
          await page.locator('#ten-rule-guide-open').click()
          await page.locator('.ten-rule-guide-dialog button').first().waitFor({ state: 'visible' })
          await page.screenshot({ animations: 'disabled', path: path.join(directory, `${theme}-${viewport.width}-guide.png`) })
          await page.keyboard.press('Escape')
          assert.equal(await page.locator('#ten-rule-guide').getAttribute('aria-hidden'), 'true')
          assert.deepEqual(errors, [])
        } finally { await context.close() }
      }
      // The preview uses only the real settings panel against a quiet page.
      const { page, context } = await openComic(browser, { settings: { themePreset: theme }, count: 1 })
      await page.locator('[data-tab="settings"]').click()
      await page.locator('#ten-panel').screenshot({ animations: 'disabled', path: path.join(directory, `${theme}-preview.png`) })
      await context.close()
    }
    const panels = ['cloud', 'garden'].map((theme, index) => {
      const image = fs.readFileSync(path.join(directory, `${theme}-preview.png`)).toString('base64')
      return `<section><h2>${index === 0 ? '云白浮雕' : '晴白庭院'}</h2><p>${index === 0 ? '柔白拟态 · 轻盈触感' : '暖白留光 · 鼠尾草绿'}</p><img src="data:image/png;base64,${image}" alt="${theme}"></section>`
    }).join('')
    const preview = await browser.newPage({ viewport: { width: 960, height: 920 } })
    await preview.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;box-sizing:border-box;background:#e8eef7;font-family:'Microsoft YaHei',sans-serif;color:#203451;display:flex;gap:24px;justify-content:center}section{width:430px}h2{font-size:21px;margin:0 0 6px}p{font-size:12px;color:#53647a;margin:0 0 15px}img{width:430px;display:block}</style>${panels}`)
    await preview.screenshot({ path: path.join(directory, 'white-themes-preview.png') })
    await preview.close()
    fs.writeFileSync(path.join(directory, 'light-themes-report.json'), JSON.stringify({ sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, '10漫画—重制版.user.js'))).digest('hex'), checks }, null, 2))
    console.log(`PASS ${checks.length} light-theme viewport/view checks, plus preset and guide states`)
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
