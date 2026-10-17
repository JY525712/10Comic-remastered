const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { chromium, openComic } = require('./helpers/browser.cjs')
let browser
const themes = ['aurora', 'cloud', 'obsidian', 'carbon', 'titanium']
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function minimize(page) {
  await page.locator('#ten-close').click()
  await page.evaluate(() => window.__menus.find(menu => menu.label.includes('显示/隐藏')).action())
  const launcher = page.locator('#ten-comic-launcher')
  await launcher.waitFor({ state: 'visible' })
  await launcher.evaluate(element => Promise.all(element.getAnimations().filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished)))
  return launcher
}

test('five minimized launchers have distinct moving effects while their labels stay stable and keyboard opening still works', async () => {
  const names = []
  for (const theme of themes) {
    const { page, context } = await openComic(browser, { settings: { themePreset: theme, effectLevel: 2 } })
    try {
      const launcher = await minimize(page)
      const style = await launcher.evaluate(element => {
        const effect = getComputedStyle(element, '::before')
        return { name: effect.animationName, display: effect.display, state: effect.animationPlayState }
      })
      assert.ok(style.name.startsWith('ten-launcher-fx-'), `${theme} lacks its new minimized effect: ${JSON.stringify(style)}`)
      assert.notEqual(style.display, 'none')
      assert.equal(style.state, 'running')
      names.push(style.name)
      const motion = await launcher.evaluate(element => {
        const animation = element.getAnimations({ subtree: true }).find(animation => animation.animationName?.startsWith('ten-launcher-fx-'))
        animation.pause()
        animation.currentTime = 0
        const read = () => {
          const style = getComputedStyle(element, '::before'), label = element.querySelector('span').getBoundingClientRect()
          return { effect: [style.transform, style.opacity].join('|'), label: [label.x, label.y, label.width, label.height] }
        }
        const start = read()
        animation.currentTime = animation.effect.getTiming().duration * .45
        return { start, end: read() }
      })
      assert.notEqual(motion.start.effect, motion.end.effect, `${theme} is static despite its animation declaration`)
      assert.deepEqual(motion.start.label, motion.end.label, `${theme} rotates or moves the readable label`)
      await launcher.press('Enter')
      await page.locator('#ten-panel.is-open').waitFor()
      assert.equal(await launcher.evaluate(element => getComputedStyle(element, '::before').animationPlayState), 'paused')
    } finally { await context.close() }
  }
  assert.equal(new Set(names).size, themes.length)
})

test('light launcher effects run more slowly than standard effects for every changed theme', async () => {
  for (const theme of themes) {
    const durations = []
    for (const level of [1, 2]) {
      const { page, context } = await openComic(browser, { settings: { themePreset: theme, effectLevel: level } })
      try {
        const launcher = await minimize(page)
        durations.push(await launcher.evaluate(element => parseFloat(getComputedStyle(element, '::before').animationDuration)))
      } finally { await context.close() }
    }
    assert.ok(durations[0] > durations[1] && durations[1] >= 4, `${theme} ignores the effect strength setting: ${durations}`)
  }
})

test('new launcher motion respects disabled effects, calm motion and the system reduced-motion preference', async () => {
  for (const theme of themes) {
    for (const mode of ['off', 'calm', 'reduced']) {
      const { page, context } = await openComic(browser, { reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference', settings: { themePreset: theme, effectLevel: mode === 'off' ? 0 : 2, appearanceAxes: { motion: mode === 'calm' ? 'calm' : 'standard' } } })
      try {
        const launcher = await minimize(page)
        const effect = await launcher.evaluate(element => getComputedStyle(element, '::before').animationName)
        assert.equal(effect, 'none', `${theme} keeps animating in ${mode} mode`)
        await launcher.click()
        assert.equal(await page.locator('#ten-panel').getAttribute('aria-hidden'), 'false')
      } finally { await context.close() }
    }
  }
})

test('launcher animation pauses when the page becomes hidden and resumes on return', async () => {
  const { page, context } = await openComic(browser, { settings: { themePreset: 'carbon', effectLevel: 2 } })
  try {
    const launcher = await minimize(page)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    assert.equal(await launcher.evaluate(element => getComputedStyle(element, '::before').animationPlayState), 'paused')
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    assert.equal(await launcher.evaluate(element => getComputedStyle(element, '::before').animationPlayState), 'running')
  } finally { await context.close() }
})

test('the mist launcher retains its original palette, shape, label and animation', async () => {
  const snapshots = []
  for (const baseline of [true, false]) {
    const { page, context } = await openComic(browser, { baseline, settings: { themePreset: 'mist', effectLevel: 2 } })
    try {
      const launcher = await minimize(page)
      snapshots.push(await launcher.evaluate(element => {
        const style = getComputedStyle(element), before = getComputedStyle(element, '::before')
        return { text: element.textContent, color: style.color, background: style.backgroundImage, border: style.borderColor, radius: style.borderRadius, shadow: style.boxShadow, effect: before.animationName, duration: before.animationDuration, layer: before.backgroundImage, opacity: before.opacity }
      }))
    } finally { await context.close() }
  }
  assert.deepEqual(snapshots[1], snapshots[0])
})
