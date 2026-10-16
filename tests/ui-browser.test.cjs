const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { chromium, openComic } = require('./helpers/browser.cjs')
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function openRuleSettings(page) {
  const group = page.locator('details#ten-rule-editor-card')
  if (await group.count() && !await group.evaluate(element => element.open)) await group.locator(':scope > summary').click()
}

test('selecting a chapter preserves its DOM node, keyboard focus and list scroll', async () => {
  const { page, context, errors } = await openComic(browser, { baseline: process.env.TEST_BASELINE === '1' })
  try {
    await page.locator('#ten-load-chapters').click()
    await page.locator('#ten-chapter-list [data-index="299"]').waitFor({ state: 'attached' })
    const result = await page.evaluate(() => {
      const list = document.getElementById('ten-chapter-list')
      const row = list.querySelector('[data-index="30"]')
      const checkbox = row.querySelector('input')
      checkbox.focus()
      const scroller = list.closest(".ten-view")
      scroller.scrollTop = 800
      const scroll = scroller.scrollTop
      checkbox.click()
      return { sameRow: row === list.querySelector('[data-index="30"]'), focused: document.activeElement === checkbox, scroll, after: scroller.scrollTop, checked: list.querySelector('[data-index="30"] input').checked }
    })
    assert.equal(result.checked, true)
    assert.equal(result.sameRow, true, 'selecting one row must not replace every chapter DOM node')
    assert.equal(result.focused, true)
    assert.ok(result.scroll > 0)
    assert.equal(result.after, result.scroll)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})

test('Shift selection, deselection, editing and reversal preserve chapter identity', async () => {
  const { page, context } = await openComic(browser, { count: 12 })
  try {
    await page.locator('#ten-load-chapters').click()
    await page.locator('#ten-chapter-list [data-index="2"] input').click()
    await page.locator('#ten-chapter-list [data-index="5"] input').click({ modifiers: ['Shift'] })
    assert.equal(await page.locator('#ten-chapter-list input:checked').count(), 4)
    await page.locator('#ten-chapter-list [data-index="3"] input').press('Space')
    assert.equal(await page.locator('#ten-chapter-list input:checked').count(), 3)
    await page.locator('#ten-edit-list').click()
    const name = page.locator('#ten-chapter-list [data-index="2"] .ten-chapter-name')
    await name.fill('自定义章节名')
    await name.press('Tab')
    assert.equal(await page.locator('#ten-chapter-list input[type=checkbox]:checked').count(), 3)
    await page.locator('#ten-reverse-list').click()
    assert.equal(await page.locator('#ten-chapter-list [data-index="9"] .ten-chapter-name').inputValue(), '自定义章节名')
    await page.locator('#ten-edit-list').click()
    assert.equal(await page.locator('#ten-chapter-list [data-index="9"] .ten-name').textContent(), '自定义章节名')
  } finally { await context.close() }
})

test('confirmation keeps Tab within the dialog and restores the trigger on Escape', async () => {
  const { page, context } = await openComic(browser, { baseline: process.env.TEST_BASELINE === '1' })
  try {
    await page.locator('[data-tab="settings"]').click()
    await page.locator('#ten-reset').click()
    await page.locator('#ten-confirm-ok').focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ten-confirm-cancel')
    await page.keyboard.press('Shift+Tab')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ten-confirm-ok')
    await page.keyboard.press('Escape')
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ten-reset')
    assert.equal(await page.locator('#ten-confirm').getAttribute('aria-hidden'), 'true')
  } finally { await context.close() }
})

test('guide close restores keyboard focus and hidden panels leave the tab order', async () => {
  const { page, context } = await openComic(browser, { baseline: process.env.TEST_BASELINE === '1' })
  try {
    await page.locator('[data-tab="settings"]').click()
    await openRuleSettings(page)
    await page.locator('#ten-rule-guide-open').click()
    await page.locator('.ten-rule-guide-dialog > [data-rule-guide-close]').click()
    assert.equal(await page.evaluate(() => document.activeElement.id), 'ten-rule-guide-open')
    await page.locator('#ten-close').click()
    assert.equal(await page.locator('#ten-panel').evaluate(element => element.inert), true)
  } finally { await context.close() }
})

test('unsupported pages defer storage initialization and still offer the rule editor', async () => {
  const { page, context, errors } = await openComic(browser, { supported: false, baseline: process.env.TEST_BASELINE === '1' })
  try {
    assert.equal(await page.evaluate(() => window.__gmValues.version), undefined)
    assert.equal(await page.locator('#ten-comic-root').count(), 0)
    await page.evaluate(() => window.__menus.find(menu => menu.label.includes('添加自定义规则')).action())
    await page.locator('#ten-panel.is-open').waitFor()
    assert.equal(await page.locator('#ten-rule-domain').inputValue(), 'comic.test')
    assert.equal(await page.locator('#ten-rule-name').isVisible(), true)
    assert.equal(await page.locator('.ten-view.is-active').getAttribute('data-view'), 'settings')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})

test('userscript CSS does not restyle a host-page control with the same class', async () => {
  const { page, context } = await openComic(browser, { baseline: process.env.TEST_BASELINE === '1' })
  try {
    const unchanged = await page.evaluate(() => {
      const button = document.getElementById('outside')
      const before = getComputedStyle(button).padding
      button.className = 'ten-btn'
      return before === getComputedStyle(button).padding
    })
    assert.equal(unchanged, true, 'all component selectors must be scoped to the userscript root')
  } finally { await context.close() }
})

test('an imported search template still returns selectable results', async () => {
  const rule = { domain: 'comic.test', homepage: 'https://comic.test/', webName: '搜索夹具', comicNameCss: '#fixture-title', chapterCss: '#fixture-chapters', readtype: 1, getImgs: 'async function(){return []}', searchTemplate_1: { search_add_url: 'search?q=', alllist_dom_css: '#fixture-results', minlist_dom_css: '.fixture-result', namelink_index: 1, img_src: 'src' } }
  const { page, context } = await openComic(browser, { settings: { userWebInfo: [rule] } })
  try {
    await page.locator('[data-tab="sites"]').click()
    await page.locator('.ten-source [data-source="1"]').click()
    await page.locator('#ten-search-input').fill('测试漫画')
    await page.locator('#ten-search-btn').click()
    await page.locator('#ten-search-results .ten-result').waitFor()
    assert.equal(await page.locator('.ten-result > span').textContent(), '搜索结果漫画')
    assert.equal(await page.locator('.ten-result').getAttribute('data-url'), 'https://comic.test/series/1')
    await page.locator('#ten-search-close').click()
    assert.equal(await page.locator('#ten-search-panel').getAttribute('aria-hidden'), 'true')
  } finally { await context.close() }
})

test('rule templates, visual picking, validation and saving keep their existing flow', async () => {
  const { page, context, errors } = await openComic(browser)
  try {
    await page.locator('[data-tab="settings"]').click()
    await openRuleSettings(page)
    await page.locator('[data-rule-pick="title"]').click()
    await page.locator('#fixture-title').click()
    assert.equal(await page.locator('#ten-rule-title-selector').inputValue(), '#fixture-title')
    await page.locator('#ten-rule-name').fill('新规则')
    await page.locator('#ten-rule-domain').fill('new.test')
    await page.locator('#ten-rule-chapter-selector').fill('#fixture-chapters')
    await page.locator('#ten-rule-template-library > summary').click()
    await page.locator('[data-rule-template="lazy"]').click()
    await page.locator('#ten-rule-test').click()
    assert.ok((await page.locator('#ten-rule-test-result').textContent()).includes('300'))
    await page.locator('#ten-rule-save').click()
    assert.equal(await page.evaluate(() => window.__gmValues.userWebInfo.find(rule => rule.webName === '新规则').domain), 'new.test')
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})

test('decorative animations pause while the panel is hidden without pausing queue state', async () => {
  const { page, context } = await openComic(browser, { count: 1, requestDelay: -1, settings: { effectLevel: 2 } })
  try {
    await page.locator('#ten-load-chapters').click()
    await page.locator('#ten-chapter-list [data-index="0"] input').click()
    await page.locator('#ten-download-selected').click()
    await page.locator('#ten-close').click()
    assert.equal(await page.locator('#ten-particle-field i').first().evaluate(element => getComputedStyle(element).animationPlayState), 'paused')
    await page.evaluate(() => window.__releaseRequests())
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]')[0]?.status === 'completed')
    assert.equal(await page.evaluate(() => window.__saved.length), 2)
    await page.evaluate(() => window.__menus.find(menu => menu.label.includes('显示/隐藏')).action())
    await page.locator('#ten-comic-launcher').click()
    assert.equal(await page.locator('#ten-particle-field i').first().evaluate(element => getComputedStyle(element).animationPlayState), 'running')
  } finally { await context.close() }
})

test('recreating a root removed by the host page discards obsolete modal focus targets', async () => {
  const { page, context } = await openComic(browser)
  try {
    await page.locator('[data-tab="settings"]').click()
    await openRuleSettings(page)
    await page.locator('#ten-rule-guide-open').click()
    await page.evaluate(() => {
      document.getElementById('ten-comic-root').remove()
      window.__menus.find(menu => menu.label.includes('显示/隐藏')).action()
    })
    await openRuleSettings(page)
    await page.locator('#ten-rule-guide-open').click()
    await page.locator('.ten-rule-guide-dialog button').first().waitFor({ state: 'visible' })
    await page.locator('.ten-rule-guide-dialog > [data-rule-guide-close]').focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('.ten-rule-guide-dialog').evaluate(dialog => dialog.querySelector('button') === document.activeElement), true)
  } finally { await context.close() }
})

test('an initially closed panel is outside keyboard navigation until opened', async () => {
  const { page, context } = await openComic(browser, { settings: { appLoadDefault: { isShowUI: false } } })
  try {
    assert.equal(await page.locator('#ten-panel').evaluate(element => element.inert), true)
    await page.evaluate(() => window.__menus.find(menu => menu.label.includes('显示/隐藏')).action())
    await page.locator('#ten-comic-launcher').click()
    assert.equal(await page.locator('#ten-panel').evaluate(element => element.inert), false)
  } finally { await context.close() }
})

test('resizing from a narrow drawer to desktop restores the options and releases modal focus', async () => {
  const { page, context } = await openComic(browser, { viewport: { width: 390, height: 844 } })
  try {
    await page.locator('#ten-toggle-options').click()
    await page.locator('.ten-mobile-drawer-sheet').waitFor({ state: 'visible' })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.waitForFunction(() => document.getElementById('ten-mobile-drawer').getAttribute('aria-hidden') === 'true', null, { timeout: 1500 })
    assert.equal(await page.locator('#ten-options').evaluate(element => !!element.closest('#ten-mobile-drawer')), false)
    await page.locator('#ten-toggle-options').click()
    assert.equal(await page.locator('#ten-options').evaluate(element => element.classList.contains('is-open')), true)
    await page.locator('#ten-options input').first().focus()
    assert.equal(await page.locator('#ten-options').evaluate(element => element.contains(document.activeElement)), true)
  } finally { await context.close() }
})

test('scoping styles preserves the palettes of the unchanged original themes', async () => {
  const original = [], optimized = []
  for (const theme of ['glass', 'mist', 'expressive', 'carbon']) {
    for (const baseline of [true, false]) {
      const { page, context } = await openComic(browser, { baseline, count: 1, settings: { themePreset: theme } })
      try {
        await page.locator('[data-tab="settings"]').click()
        if (await page.locator('#ten-theme-settings').count()) await page.locator('#ten-theme-settings > summary').click()
        const palette = await page.evaluate(() => ['.ten-settings-card', '.ten-settings-card .ten-card-title', '.ten-setting > label'].map(selector => {
          const style = getComputedStyle(document.querySelector(selector))
          return { selector, color: style.color, backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage }
        }))
        ;(baseline ? original : optimized).push({ theme, palette })
      } finally { await context.close() }
    }
  }
  assert.deepEqual(optimized, original, 'adding a root scope must not make component rules override theme palettes')
})
