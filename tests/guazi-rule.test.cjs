const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { loadAdapters } = require('./helpers/adapters.cjs')
const { chromium, openComic, pixel } = require('./helpers/browser.cjs')

let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })
function adapter() {
  const result = loadAdapters().rules.find(rule => rule.webName === '瓜子漫画')
  assert.ok(result, '瓜子漫画 must be available without importing custom rules')
  return result
}

test('Guazi is built in on both hostnames and preserves explicit custom preference', () => {
  adapter()
  const custom = [{ domain: 'guazimanhua.com', webName: '已有自定义瓜子', imageCss: 'img' }]
  const { api } = loadAdapters({ config: { cF: () => custom }, globals: { window: {} } })
  for (const host of ['guazimanhua.com', 'www.guazimanhua.com']) {
    assert.equal(api.HL('https://' + host + '/comic.php?id=26470').webName, '瓜子漫画')
  }
  assert.equal(api.HL('https://guazimanhua.com.example.test/'), null)
  custom[0].preferCustom = true
  assert.equal(api.HL('https://www.guazimanhua.com/').webName, '已有自定义瓜子')
  assert.equal(custom.length, 1)
})

test('Guazi reads only reader images, preserving relative URLs, lazy addresses and query strings', async () => {
  const rule = adapter(), page = await browser.newPage()
  try {
    const urls = await page.evaluate(async ({ rule, parser }) => {
      const html = '<img src="https://img.test/cover.png"><section data-reader-images>' +
        '<img class="reading-image" src="/images/1.png?token=a%2Fb&amp;n=1">' +
        '<img class="reading-image" data-original="https://img.test/2.png" src="/loading.gif">' +
        '<img class="reading-image" src="https://img.test/2.png">' +
        '<img class="advertisement" src="https://img.test/ad.png"></section>'
      return await Function('return (' + parser + ')')().call(rule, html, { url: 'https://www.guazimanhua.com/chapter.php?id=1' })
    }, { rule: JSON.parse(JSON.stringify(rule)), parser: rule.getImgs.toString() })
    assert.deepEqual(urls, ['https://www.guazimanhua.com/images/1.png?token=a%2Fb&n=1', 'https://img.test/2.png'])
  } finally { await page.close() }
})

test('Guazi loads a single directory and downloads through the built-in flow with no custom rules', async () => {
  adapter()
  const html = '<h1 id="cinema-title">瓜子测试作品</h1>' +
    '<div data-mobile-chapter-list><a href="/chapter.php?id=1">移动端重复目录</a></div>' +
    '<div data-chapter-list><a href="/chapter.php?id=1">第1话</a><a href="/chapter.php?id=2">第2话</a><a href="/comic.php?id=1">返回作品</a></div>'
  const { page, context, errors } = await openComic(browser, { url: 'https://www.guazimanhua.com/comic.php?id=1', html, settings: { userWebInfo: [] } })
  try {
    await context.route('https://www.guazimanhua.com/chapter.php?id=1', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<section data-reader-images><img class="reading-image" src="https://img.test/1.png"><img class="reading-image" src="https://img.test/2.png"></section>' }))
    await page.locator('[data-tab="sites"]').click()
    assert.equal(await page.locator('#ten-site-list .ten-name').filter({ hasText: /^瓜子漫画$/ }).count(), 1)
    await page.locator('[data-tab="chapters"]').click()
    await page.locator('#ten-load-chapters').click()
    assert.equal(await page.locator('#ten-current-comic').inputValue(), '瓜子测试作品')
    assert.equal(await page.locator('#ten-chapter-list [data-index]').count(), 2)
    await page.locator('#ten-chapter-list [data-index="0"] input').check()
    await page.locator('#ten-download-selected').click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]')[0]?.status === 'completed')
    const result = await page.evaluate(() => ({ custom: window.__gmValues.userWebInfo, saved: window.__saved }))
    assert.deepEqual(result.custom, [])
    assert.equal(result.saved.length, 2)
    for (const file of result.saved) assert.deepEqual(file.bytes, [...pixel])
    assert.equal(await page.locator('iframe.ten-comic-frame').count(), 0)
    assert.deepEqual(errors, [])
  } finally { await context.close() }
})
