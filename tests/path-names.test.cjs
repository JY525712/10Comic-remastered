const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { test } = require('node:test')
const { chromium, root, openComic } = require('./helpers/browser.cjs')
const cases = require('./helpers/path-name-cases.cjs')
const factory = require('../src/userscript/modules/downloads.js')

function downloadUtils(enabled = true) {
  const loader = () => ({ cF: key => key === 'sanitizePathNames' ? enabled : undefined })
  loader.d = (target, definitions) => Object.keys(definitions).forEach(key => Object.defineProperty(target, key, { get: definitions[key] }))
  const api = {}
  factory({}, api, loader)
  return api
}

test('automatic cleanup repairs browser-rejected names and preserves allowed punctuation', () => {
  const api = downloadUtils()
  for (const [input, expected] of cases) {
    assert.equal(api.pN(input), expected, JSON.stringify(input))
    assert.equal(api.pN(expected), expected, `cleanup must be idempotent: ${expected}`)
  }
  assert.equal(api.pP('漫画\\第1话~\\001.jpg'), '漫画\\第1话～\\001.jpg')
})

test('disabling automatic cleanup preserves user-supplied symbols', () => {
  const api = downloadUtils(false)
  for (const [input] of cases) assert.equal(api.pN(input), input)
  assert.equal(api.pP('漫画~\\第1话~\\001.jpg'), '漫画~\\第1话~\\001.jpg')
})

test('cleaned names pass the real Chromium native directory and file handle validators on Windows', { skip: process.platform !== 'win32' }, async () => {
  const api = downloadUtils()
  const base = path.join(root, 'dist/verification')
  fs.mkdirSync(base, { recursive: true })
  const directory = fs.mkdtempSync(path.join(base, 'native-name-check-'))
  const folders = path.join(directory, 'folders'), files = path.join(directory, 'files')
  fs.mkdirSync(folders); fs.mkdirSync(files)
  const inputs = [...new Set([...cases.map(([name]) => name), ...'!#$%&\'()+,-.;=@[]^_`{}~'.split('').flatMap(symbol => [`A${symbol}B`, `${symbol}AB`, `AB${symbol}`])])]
  const names = [...new Set(inputs.flatMap(input => [input, api.pN(input)]))]
  for (const name of names) {
    // Never open DOS devices while preparing real disk fixtures. The browser
    // still validates their raw names; only the repaired names become files.
    const device = /^(?:con|prn|aux|nul|clock\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$|^(?:conin\$|conout\$)$/i.test(name)
    if (!name || name === '.' || name === '..' || /[\\/]/.test(name) || device) continue
    try { fs.mkdirSync(path.join(folders, name)) } catch {}
    try { fs.writeFileSync(path.join(files, name), 'filename probe') } catch {}
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<main style="height:600px">Filename probe</main><script>document.addEventListener("dragover",e=>e.preventDefault());document.addEventListener("drop",async e=>{e.preventDefault();window.__directory=await e.dataTransfer.items[0].getAsFileSystemHandle()})</script>' }))
    const page = await context.newPage()
    await page.goto('https://comic.test/filename-probe')
    const session = await context.newCDPSession(page)
    for (const type of ['dragEnter', 'dragOver', 'drop']) await session.send('Input.dispatchDragEvent', { type, x: 100, y: 100, data: { items: [], files: [directory], dragOperationsMask: 1 } })
    await page.waitForFunction(() => window.__directory?.kind === 'directory')
    const rows = await page.evaluate(async names => {
      const folders = await window.__directory.getDirectoryHandle('folders'), files = await window.__directory.getDirectoryHandle('files')
      const results = []
      for (const name of names) {
        const result = { name }
        for (const [kind, parent] of [['directory', folders], ['file', files]]) {
          try {
            await parent[kind === 'file' ? 'getFileHandle' : 'getDirectoryHandle'](name)
            result[kind] = 'accepted'
          } catch (error) { result[kind] = error.name }
        }
        results.push(result)
      }
      return results
    }, names)
    const report = inputs.map(input => ({ input, cleaned: api.pN(input), original: rows.find(row => row.name === input), result: rows.find(row => row.name === api.pN(input)) }))
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, '10漫画—重制版.user.js'))).digest('hex')
    fs.writeFileSync(path.join(base, 'filename-compatibility.json'), JSON.stringify({ sha256, browser: browser.version(), platform: process.platform, cases: report }, null, 2))
    const rejected = report.filter(row => row.result.directory !== 'accepted' || row.result.file !== 'accepted')
    assert.deepEqual(rejected, [], 'cleaned names must be accepted by both native handle methods')
    const tilde = report.find(row => row.input === '第1话~')
    assert.equal(tilde.original.directory, 'TypeError', 'reproduce the browser restriction even though Windows created the folder')
    assert.equal(fs.existsSync(path.join(folders, '第1话~')), true)
  } finally { await browser.close() }
})

for (const [mode, extension] of [[0, '/001.png'], [1, '第29话 拜托啦～.zip'], [2, '/001.jpg']]) {
  test(`Kuaikan chapter 29 uses a compatible output path in mode ${mode} without changing its title`, async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const { page, context, errors } = await openComic(browser, { count: 1, settings: { downType: mode } })
      try {
        await page.locator('#ten-toggle-options').click()
        await page.locator('#ten-current-comic').fill('全职剑修')
        await page.locator('#ten-current-chapter').fill('第29话 拜托啦~')
        await page.locator('#ten-download-current').click()
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]').length === 1)
        const result = await page.evaluate(() => ({ saved: window.__saved, history: JSON.parse(localStorage.getItem('ylComicDownHistory'))[0] }))
        assert.equal(result.history.status, 'completed')
        assert.equal(result.history.comicName, '全职剑修')
        assert.equal(result.history.downChapterName, '第29话 拜托啦~')
        for (const file of result.saved) assert.ok(file.name.startsWith('全职剑修/第29话 拜托啦～'), file.name)
        assert.ok(result.saved[0].name.endsWith(extension), result.saved[0].name)
        assert.deepEqual(errors, [])
      } finally { await context.close() }
    } finally { await browser.close() }
  })
}

test('browser-download fallback uses the same cleaned comic and chapter names', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const { page, context } = await openComic(browser, { count: 1 })
    try {
      await page.evaluate(() => { window.showDirectoryPicker = undefined })
      await page.locator('#ten-toggle-options').click()
      await page.locator('#ten-current-comic').fill('短~名')
      await page.locator('#ten-current-chapter').fill('第1话~')
      await page.locator('#ten-download-current').click()
      await page.waitForFunction(() => window.__saved.length === 2)
      const names = await page.evaluate(() => window.__saved.map(file => file.name.replaceAll('\\', '/')))
      assert.deepEqual(names, ['10Comic/短～名/第1话～/001.png', '10Comic/短～名/第1话～/002.png'])
    } finally { await context.close() }
  } finally { await browser.close() }
})

test('the cleanup checkbox actually switches the next download between raw and compatible names', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const { page, context } = await openComic(browser, { count: 1 })
    try {
      for (const enabled of [false, true]) {
        await page.locator('[data-tab="settings"]').click()
        await page.locator('#ten-sanitize-paths').setChecked(enabled)
        assert.equal(await page.evaluate(() => window.__gmValues.sanitizePathNames), enabled)
        await page.locator('[data-tab="chapters"]').click()
        await page.locator('#ten-toggle-options').click()
        await page.locator('#ten-current-comic').fill('短~名')
        await page.locator('#ten-current-chapter').fill('第1话~')
        await page.locator('#ten-download-current').click()
        if (enabled) { await page.locator('#ten-confirm').waitFor({ state: 'visible' }); await page.locator('#ten-confirm-ok').click() }
        await page.waitForFunction(count => window.__saved.length === count, enabled ? 4 : 2)
      }
      const names = await page.evaluate(() => window.__saved.map(file => file.name))
      assert.deepEqual(names, ['短~名/第1话~/001.png', '短~名/第1话~/002.png', '短～名/第1话～/001.png', '短～名/第1话～/002.png'])
    } finally { await context.close() }
  } finally { await browser.close() }
})
