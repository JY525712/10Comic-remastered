const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { chromium, openComic } = require('./helpers/browser.cjs')
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

test('preset list replaces the two removed themes with two new white themes', async () => {
  const { page, context } = await openComic(browser)
  try {
    await page.locator('[data-tab="settings"]').click()
    await page.locator('#ten-theme-settings > summary').click()
    const presets = await page.locator('[data-theme-choice]').evaluateAll(elements => elements.map(element => ({ key: element.dataset.themeChoice, name: element.querySelector('strong').textContent })))
    assert.deepEqual(presets.map(preset => preset.key), ['glass', 'mist', 'cloud', 'expressive', 'carbon', 'paper'])
    assert.equal(presets.find(preset => preset.key === 'cloud').name, '云白浮雕')
    assert.equal(presets.find(preset => preset.key === 'paper').name, '纸白蓝图')
    assert.equal(presets.some(preset => ['白瓷简章', '墨竹书斋'].includes(preset.name)), false)
  } finally { await context.close() }
})

test('old saved theme choices map to the new white presets without losing appearance settings', async () => {
  for (const [oldTheme, theme] of [['porcelain', 'cloud'], ['ink', 'paper']]) {
    const { page, context } = await openComic(browser, { settings: { themePreset: oldTheme, appearanceAxes: { density: 'compact', shape: 'round', motion: 'calm' } } })
    try {
      assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), theme)
      assert.equal(await page.locator(`[data-theme-choice="${theme}"]`).getAttribute('aria-pressed'), 'true')
      assert.equal(await page.locator('#ten-comic-root').getAttribute('data-density'), 'compact')
      assert.equal(await page.locator('#ten-comic-root').getAttribute('data-shape'), 'round')
    } finally { await context.close() }
  }
})

test('both white themes have opaque light surfaces and readable text throughout the interface', async () => {
  for (const theme of ['cloud', 'paper']) {
    const { page, context, errors } = await openComic(browser, { settings: { themePreset: theme } })
    try {
      assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), theme)
      await page.locator('[data-tab="settings"]').click()
      await page.locator('#ten-theme-settings > summary').click()
      const readings = await page.evaluate(() => {
        const rgb = value => (value.match(/[\d.]+/g) || []).map(Number)
        const luminance = value => rgb(value).slice(0, 3).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0)
        return ['#ten-panel', '.ten-settings-card', '#ten-hotkey', '#ten-rule-name', '#ten-default-mode-menu', '.ten-confirm-dialog', '.ten-diagnostic-dialog', '#ten-search-panel', '#ten-diagnostic-content'].map(selector => {
          const element = document.querySelector(selector), style = getComputedStyle(element)
          const light = luminance(style.backgroundColor), dark = luminance(style.color)
          return { selector, alpha: rgb(style.backgroundColor)[3] ?? 1, light, contrast: (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05) }
        })
      })
      for (const reading of readings) {
        assert.ok(reading.alpha >= .98, `${theme} ${reading.selector} must have an opaque background`)
        assert.ok(reading.light >= .8, `${theme} ${reading.selector} is not light: ${reading.light}`)
        assert.ok(reading.contrast >= 4.5, `${theme} ${reading.selector} text contrast ${reading.contrast}`)
      }
      for (const tab of ['sites', 'chapters', 'tasks', 'settings']) {
        await page.locator(`[data-tab="${tab}"]`).click()
        assert.equal(await page.locator('.ten-view.is-active').evaluate(view => view.scrollWidth <= view.clientWidth + 2), true)
      }
      assert.deepEqual(errors, [])
    } finally { await context.close() }
  }
})

test('new preset choices save correctly and preserve the independent shape controls', async () => {
  const { page, context } = await openComic(browser, { settings: { themePreset: 'cloud' } })
  try {
    assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), 'cloud')
    await page.locator('[data-tab="settings"]').click()
    await page.locator('#ten-theme-settings > summary').click()
    const shadows = []
    for (const theme of ['paper', 'cloud']) {
      await page.locator(`[data-theme-choice="${theme}"]`).click()
      assert.equal(await page.evaluate(() => window.__gmValues.themePreset), theme)
      shadows.push(await page.locator('#ten-backup-export').evaluate(element => getComputedStyle(element).boxShadow))
    }
    assert.notEqual(shadows[0], shadows[1], 'the two new component combinations must look different')
    await page.locator('[data-appearance-axis="shape"][data-appearance-value="sharp"]').click()
    const sharp = await page.locator('#ten-panel').evaluate(element => parseFloat(getComputedStyle(element).borderTopLeftRadius))
    await page.locator('[data-appearance-axis="shape"][data-appearance-value="round"]').click()
    const round = await page.locator('#ten-panel').evaluate(element => parseFloat(getComputedStyle(element).borderTopLeftRadius))
    assert.ok(round > sharp)
    assert.equal(await page.locator('#ten-download-settings').evaluate(element => element.open), true)
    assert.equal(await page.locator('#ten-rule-editor-card').evaluate(element => element.open), false)
  } finally { await context.close() }
})

test('white theme help sections remain light inside the modal', async () => {
  for (const theme of ['cloud', 'paper']) {
    const { page, context } = await openComic(browser, { settings: { themePreset: theme } })
    try {
      await page.locator('[data-tab="settings"]').click()
      await page.locator('#ten-rule-editor-card > summary').click()
      await page.locator('#ten-rule-guide-open').click()
      const surface = await page.locator('.ten-rule-guide-content section').first().evaluate(element => getComputedStyle(element).backgroundColor)
      const channels = surface.match(/[\d.]+/g).map(Number)
      assert.ok((channels[3] ?? 1) >= .98, `${theme} help section needs an opaque light surface: ${surface}`)
      assert.ok(Math.min(...channels.slice(0, 3)) >= 230, `${theme} help section is not white: ${surface}`)
    } finally { await context.close() }
  }
})

test('narrow white task cards keep titles readable and speed text contrasting', async () => {
  for (const theme of ['cloud', 'paper']) {
    const { page, context } = await openComic(browser, { count: 2, requestDelay: -1, viewport: { width: 320, height: 568 }, settings: { themePreset: theme, appLoadDefault: { isShowUI: true, rightSize: 125 } } })
    try {
      await page.locator('#ten-load-chapters').click()
      await page.locator('#ten-chapter-list [data-index="0"] input').click()
      await page.locator('#ten-download-selected').click()
      await page.locator('[data-worker-card]').waitFor()
      const metrics = await page.evaluate(() => {
        const header = document.querySelector('[data-task-group="active"] .ten-task-title-button > span')
        const title = document.querySelector('[data-task-title]')
        const speed = document.querySelector('[data-task-speed]')
        const luminance = color => (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
        const fg = luminance(getComputedStyle(speed).color), bg = luminance(getComputedStyle(speed.closest('[data-worker-card]')).backgroundColor)
        return { headerHeight: header.getBoundingClientRect().height, line: parseFloat(getComputedStyle(header).lineHeight), titleWidth: title.getBoundingClientRect().width, contrast: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) }
      })
      assert.ok(metrics.headerHeight <= metrics.line * 1.6, `${theme} title wraps into a vertical strip: ${JSON.stringify(metrics)}`)
      assert.ok(metrics.titleWidth >= 120, `${theme} chapter title is squeezed by action buttons: ${JSON.stringify(metrics)}`)
      assert.ok(metrics.contrast >= 4.5, `${theme} speed text is unreadable: ${JSON.stringify(metrics)}`)
    } finally { await context.close() }
  }
})
