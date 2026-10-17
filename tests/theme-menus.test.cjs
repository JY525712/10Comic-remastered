const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { chromium, openComic } = require('./helpers/browser.cjs')
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function colors(locator) {
  return locator.evaluate(element => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, image: style.backgroundImage, color: style.color, border: style.borderTopColor, shadow: style.boxShadow }
  })
}

test('white theme dropdown selection, hover and radio marks use the active palette', async () => {
  for (const theme of ['cloud', 'aurora']) {
    const { page, context } = await openComic(browser, { settings: { themePreset: theme } })
    try {
      await page.locator('[data-tab="settings"]').click()
      await page.locator('#ten-default-mode-trigger').click()
      const selected = page.locator('#ten-default-mode-menu .is-selected')
      const selection = await colors(selected)
      const rgba = selection.background.match(/[\d.]+/g).map(Number)
      assert.equal(rgba[3] ?? 1, 1, `${theme} selected item must have its own light background: ${JSON.stringify(selection)}`)
      assert.equal(selection.image, 'none', `${theme} must not inherit the cyan-purple gradient`)
      assert.ok(rgba[2] > rgba[0], `${theme} has the wrong selection color`)
      const mark = await selected.locator('.ten-mode-option-mark').evaluate(element => getComputedStyle(element).boxShadow)
      assert.equal(mark.includes('7, 18, 34'), false, `${theme} radio mark retains the dark theme inset`)
      await page.locator('[data-default-mode="1"]').hover()
      // Finish the real CSS transition before reading its target color.
      await page.locator('[data-default-mode="1"]').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
      const hover = await colors(page.locator('[data-default-mode="1"]'))
      const channels = hover.background.match(/[\d.]+/g).map(Number)
      assert.equal(channels[3] ?? 1, 1, `${theme} hover still uses the shared cyan wash`)
      assert.ok(channels[2] > channels[0])
      await page.locator('[data-default-mode="1"]').click()
      assert.equal(await page.evaluate(() => window.__gmValues.downType), 1)
      assert.equal(await page.locator('#ten-default-mode-menu').isVisible(), false)
    } finally { await context.close() }
  }
})

test('download and search dropdowns update their selection and hover palettes with every theme', async () => {
  const { page, context, errors } = await openComic(browser)
  try {
    await page.locator('[data-tab="settings"]').click()
    await page.locator('#ten-theme-settings > summary').click()
    const backgrounds = []
    for (const theme of ['titanium', 'cloud', 'obsidian', 'carbon', 'mist', 'aurora']) {
      await page.locator(`[data-theme-choice="${theme}"]`).click()
      await page.locator('#ten-default-mode-trigger').click()
      const selected = page.locator('#ten-default-mode-menu .is-selected')
      const download = await colors(selected)
      const contrasts = await selected.evaluate(element => {
        const light = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0)
        const bg = light(getComputedStyle(element).backgroundColor)
        return ['strong', 'small'].map(selector => {
          const fg = light(getComputedStyle(element.querySelector(selector)).color)
          return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)
        })
      })
      for (const contrast of contrasts) assert.ok(contrast >= 4.5, `${theme} menu text contrast ${contrast}`)
      backgrounds.push(download.background)
      await page.locator('#ten-default-mode-trigger').click()
      await page.locator('[data-tab="sites"]').click()
      await page.locator('#ten-search-site-trigger').click()
      const search = await colors(page.locator('.ten-search-site-option.is-selected'))
      assert.equal(search.background, download.background, `${theme} menus must use the same active palette`)
      await page.locator('.ten-search-site-option:not(.is-selected):not(:disabled)').first().hover()
      await page.locator('.ten-search-site-option:hover').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
      const hover = await colors(page.locator('.ten-search-site-option:hover'))
      assert.notEqual(hover.background, 'rgba(0, 0, 0, 0)', `${theme} search hover is missing`)
      await page.locator('.ten-search-site-option.is-selected').click()
      assert.equal(await page.locator('#ten-search-site-menu').isVisible(), false)
      await page.locator('[data-tab="settings"]').click()
    }
    assert.equal(new Set(backgrounds).size, 6, 'all six menus must have a distinct theme palette')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})

test('the old purple theme restores as obsidian gold while preserving appearance settings', async () => {
  const { page, context } = await openComic(browser, { settings: { themePreset: 'expressive', appearanceAxes: { density: 'compact', shape: 'round', motion: 'calm' } } })
  try {
    assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), 'obsidian')
    assert.equal(await page.locator('#ten-comic-root').getAttribute('data-density'), 'compact')
    assert.equal(await page.locator('#ten-comic-root').getAttribute('data-shape'), 'round')
    assert.equal(await page.locator('#ten-comic-root').getAttribute('data-motion'), 'calm')
    assert.equal(await page.locator('[data-theme-choice="expressive"]').count(), 0)
  } finally { await context.close() }
})
