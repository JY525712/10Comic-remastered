const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { chromium, openComic } = require('./helpers/browser.cjs')
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

test('the selected three designs replace the right presets and migrate all saved predecessors', async () => {
  for (const [oldTheme, theme] of [['glass', 'aurora'], ['liquid', 'obsidian'], ['expressive', 'obsidian'], ['garden', 'titanium'], ['paper', 'titanium'], ['ink', 'titanium']]) {
    const { page, context } = await openComic(browser, { settings: { themePreset: oldTheme, appearanceAxes: { shape: 'round', density: 'compact', motion: 'calm' } } })
    try {
      assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), theme)
      assert.equal(await page.locator(`[data-theme-choice="${theme}"]`).getAttribute('aria-pressed'), 'true')
      assert.deepEqual(await page.locator('#ten-comic-root').evaluate(element => [element.dataset.shape, element.dataset.density, element.dataset.motion]), ['round', 'compact', 'calm'])
    } finally { await context.close() }
  }
})

test('the warm and cool dark themes cover settings and help with readable dark surfaces', async () => {
  for (const theme of ['obsidian', 'titanium']) {
    const { page, context, errors } = await openComic(browser, { settings: { themePreset: theme } })
    try {
      assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), theme)
      if (theme === 'obsidian') {
        const badges = await page.locator('.ten-site-kind, .ten-task-count').evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundColor.match(/[\d.]+/g).map(Number)))
        for (const rgba of badges) assert.ok(rgba[0] > rgba[2], `warm badges retain a cyan background: ${rgba}`)
        const residues = await page.locator('#ten-comic-root').evaluate(root => [...new Set([...root.querySelectorAll('*')].flatMap(element => {
          const style = getComputedStyle(element)
          return ['backgroundColor', 'backgroundImage', 'borderTopColor', 'boxShadow'].some(property => /95, 246, 255|156, 108, 255/.test(style[property])) ? [element.id || element.className || element.tagName] : []
        }))])
        assert.deepEqual(residues, [], 'warm theme components must not inherit the old cyan/violet states')
      }
      await page.locator('[data-tab="settings"]').click()
      await page.locator('#ten-rule-editor-card > summary').click()
      await page.locator('#ten-rule-guide-open').click()
      const surfaces = await page.evaluate(() => {
        const luminance = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
        return ['#ten-panel', '#ten-download-settings', '#ten-hotkey', '#ten-rule-name', '.ten-rule-guide-content section', '.ten-rule-guide-dialog', '#ten-diagnostic-content'].map(selector => {
          const style = getComputedStyle(document.querySelector(selector))
          const bg = luminance(style.backgroundColor), fg = luminance(style.color)
          return { selector, bg, alpha: Number(style.backgroundColor.match(/[\d.]+/g)[3] ?? 1), contrast: (Math.max(bg, fg) + .05) / (Math.min(bg, fg) + .05) }
        })
      })
      for (const surface of surfaces) {
        assert.ok(surface.alpha >= .98 && surface.bg < .12, `${theme} has an unthemed surface: ${JSON.stringify(surface)}`)
        assert.ok(surface.contrast >= 4.5, `${theme} unreadable text: ${JSON.stringify(surface)}`)
      }
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
})

test('new button feedback has hover and press states and respects disabled effects and reduced motion', async () => {
  for (const theme of ['aurora', 'obsidian', 'titanium']) {
    for (const reduced of [false, true]) {
      const { page, context } = await openComic(browser, { reducedMotion: reduced ? 'reduce' : 'no-preference', settings: { themePreset: theme, effectLevel: 2 } })
      try {
        assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), theme)
        await page.locator('[data-tab="settings"]').click()
        const button = page.locator('#ten-default-mode-trigger')
        await button.hover()
        await button.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
        const hover = await button.evaluate(element => getComputedStyle(element).transform)
        if (reduced) assert.equal(hover, 'none')
        else assert.notEqual(hover, 'none', `${theme} lacks hover feedback`)
        await page.mouse.down()
        await button.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
        const pressed = await button.evaluate(element => getComputedStyle(element).transform)
        if (reduced) assert.equal(pressed, 'none')
        else assert.notEqual(pressed, hover, `${theme} lacks press feedback`)
        await page.mouse.up()
        assert.equal(await button.getAttribute('aria-expanded'), 'true')
        await button.click()
        await page.locator('#ten-theme-settings > summary').click()
        await page.locator('[data-effect-level="0"]').click()
        await button.hover()
        const off = await button.evaluate(element => ({ transform: getComputedStyle(element).transform, sheen: getComputedStyle(element, '::before').opacity }))
        assert.equal(off.transform, 'none')
        assert.equal(Number(off.sheen), 0)
      } finally { await context.close() }
    }
  }
})

test('dropdown options remain reachable at narrow and landscape sizes with 125 percent scaling', async () => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const { page, context } = await openComic(browser, { viewport, settings: { themePreset: 'obsidian', appLoadDefault: { isShowUI: true, rightSize: 125 } } })
    try {
      await page.locator('[data-tab="settings"]').click()
      await page.locator('#ten-default-mode-trigger').click()
      await page.locator('#ten-default-mode-menu').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
      const bounds = await page.locator('#ten-default-mode-menu').evaluate(element => {
        const rect = element.getBoundingClientRect(), view = element.closest('.ten-view').getBoundingClientRect()
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, view }
      })
      assert.ok(bounds.left >= bounds.view.left && bounds.right <= bounds.view.right && bounds.top >= bounds.view.top && bounds.bottom <= bounds.view.bottom, `${viewport.width} menu is clipped: ${JSON.stringify(bounds)}`)
      for (const mode of [0, 1, 2]) {
        const option = page.locator(`[data-default-mode="${mode}"]`)
        await option.scrollIntoViewIfNeeded()
        assert.equal(await option.evaluate(element => {
          const rect = element.getBoundingClientRect()
          return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
        }), true, `${viewport.width} option ${mode} cannot be reached`)
      }
      await page.locator('[data-default-mode="2"]').click()
      assert.equal(await page.evaluate(() => window.__gmValues.downType), 2)
    } finally { await context.close() }
  }
})

test('decorative highlights cannot scroll the button label or its settings panel', async () => {
  for (const theme of ['aurora', 'obsidian', 'titanium']) {
    const { page, context } = await openComic(browser, { settings: { themePreset: theme, effectLevel: 1 } })
    try {
      await page.locator('#ten-panel').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
      await page.locator('[data-tab="settings"]').click()
      const button = page.locator('#ten-default-mode-trigger')
      // Locator actions may scroll an animated target before dispatching any
      // pointer event. Use real pointer coordinates to test application focus.
      const rect = await button.boundingBox()
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
      await button.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
      const labelShift = await button.evaluate(element => {
        const label = element.querySelector('#ten-default-mode-label')
        const before = label.getBoundingClientRect().left
        element.scrollLeft = 10000
        return label.getBoundingClientRect().left - before
      })
      assert.equal(labelShift, 0, `${theme} makes its decorative highlight a scrollable container`)
      const before = await page.locator('.ten-view.is-active').evaluate(element => element.scrollTop)
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2)
      await page.locator('#ten-default-mode-menu').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)))
      assert.equal(await page.locator('.ten-view.is-active').evaluate(element => element.scrollTop), before, `${theme} focus scrolls the clipped highlight into view`)
    } finally { await context.close() }
  }
})
