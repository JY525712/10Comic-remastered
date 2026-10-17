const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { chromium, openComic, root } = require('../tests/helpers/browser.cjs')

async function main() {
  const directory = path.join(root, 'dist/verification')
  fs.mkdirSync(directory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const report = []
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 640, height: 400 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
      const { page, context, errors } = await openComic(browser, { viewport, requestDelay: -1, settings: { appLoadDefault: { isShowUI: true, rightSize: 125 }, effectLevel: 1 } })
      try {
        await page.locator('#ten-load-chapters').click()
        await page.locator('#ten-chapter-list [data-index="0"] input').click()
        await page.locator('#ten-chapter-list [data-index="1"] input').click()
        await page.locator('#ten-download-selected').click()
        await page.locator('[data-worker-card]').first().waitFor()
        for (const tab of ['sites', 'chapters', 'tasks', 'settings']) {
          await page.locator(`[data-tab="${tab}"]`).click()
          await page.locator('#ten-panel').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {}))))
          const geometry = await page.locator('#ten-panel').evaluate(element => {
            const rect = element.getBoundingClientRect()
            const view = element.querySelector('.ten-view.is-active')
            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewWidth: view.clientWidth, viewScrollWidth: view.scrollWidth, viewHeight: view.clientHeight }
          })
          assert.ok(geometry.left >= -1 && geometry.right <= viewport.width + 1 && geometry.top >= -1 && geometry.bottom <= viewport.height + 1, `clipped panel ${viewport.width}x${viewport.height}/${tab}: ${JSON.stringify(geometry)}`)
          assert.ok(geometry.viewHeight >= 80, `unusable content height ${JSON.stringify(geometry)}`)
          assert.ok(geometry.viewScrollWidth <= geometry.viewWidth + 2, `horizontal overflow ${viewport.width}/${tab}: ${JSON.stringify(geometry)}`)
          await page.screenshot({ animations: 'disabled', path: path.join(directory, `${viewport.width}x${viewport.height}-${tab}.png`) })
          if (tab === 'settings') {
            assert.equal(await page.locator('#ten-download-settings').evaluate(element => element.open), true)
            await page.locator('#ten-download-settings > summary').click()
            assert.equal(await page.locator('#ten-max-chapters').isVisible(), false)
            await page.screenshot({ animations: 'disabled', path: path.join(directory, `${viewport.width}x${viewport.height}-settings-all-collapsed.png`) })
            await page.locator('#ten-download-settings > summary').click()
            for (const id of ['ten-theme-settings', 'ten-rule-editor-card']) {
              await page.locator(`#${id} > summary`).click()
              const fits = await page.locator('.ten-view.is-active').evaluate(view => view.scrollWidth <= view.clientWidth + 2)
              assert.equal(fits, true, `expanded ${id} overflows ${viewport.width}`)
              await page.screenshot({ animations: 'disabled', path: path.join(directory, `${viewport.width}x${viewport.height}-${id}-expanded.png`) })
              await page.locator(`#${id} > summary`).click()
            }
          }
          report.push({ viewport, tab, geometry })
        }
        if (viewport.width <= 560) {
          await page.locator('[data-tab="chapters"]').click()
          await page.locator('#ten-toggle-options').click()
          await page.locator('.ten-mobile-drawer-sheet').waitFor({ state: 'visible' })
          await page.keyboard.press('Escape')
          assert.equal(await page.locator('#ten-mobile-drawer').getAttribute('aria-hidden'), 'true')
          assert.equal(await page.evaluate(() => document.activeElement.id), 'ten-toggle-options')
        }
        assert.deepEqual(errors, [])
      } finally { await context.close() }
    }
    for (const theme of ['glass', 'mist', 'cloud', 'liquid', 'carbon', 'garden']) {
      const { page, context } = await openComic(browser, { settings: { themePreset: theme } })
      try {
        await page.locator('[data-tab="settings"]').click()
        await page.locator('#ten-theme-settings > summary').click()
        assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), theme)
        await page.screenshot({ animations: 'disabled', path: path.join(directory, `theme-${theme}.png`) })
        report.push({ theme })
      } finally { await context.close() }
    }
    const { page, context } = await openComic(browser, { reducedMotion: 'reduce', settings: { effectLevel: 2 } })
    assert.equal(await page.locator('#ten-particle-field').evaluate(element => getComputedStyle(element).display), 'none')
    report.push({ reducedMotion: 'particles hidden' })
    await context.close()
    const artifact = fs.readFileSync(path.join(root, '10漫画—重制版.user.js'))
    fs.writeFileSync(path.join(directory, 'browser-report.json'), JSON.stringify({ sha256: crypto.createHash('sha256').update(artifact).digest('hex'), checks: report }, null, 2))
    console.log(`PASS ${report.length} viewport/theme/motion checks; screenshots: ${directory}`)
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
