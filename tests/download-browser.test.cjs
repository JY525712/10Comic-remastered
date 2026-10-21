const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { chromium, openComic, pixel } = require('./helpers/browser.cjs')
let browser
before(async () => { browser = await chromium.launch({ headless: true }) })
after(async () => { await browser?.close() })

async function startOne(page) {
  await page.locator('#ten-load-chapters').click()
  await page.locator('#ten-chapter-list [data-index="0"] input').click()
  await page.locator('#ten-download-selected').click()
}
async function finish(page) {
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]').length === 1)
  return page.evaluate(() => ({ saved: window.__saved, history: JSON.parse(localStorage.getItem('ylComicDownHistory'))[0] }))
}
function zipEntries(bytes) {
  const buffer = Buffer.from(bytes), entries = []
  let offset = 0
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18), nameLength = buffer.readUInt16LE(offset + 26), extraLength = buffer.readUInt16LE(offset + 28)
    const start = offset + 30 + nameLength + extraLength
    entries.push({ name: buffer.subarray(offset + 30, offset + 30 + nameLength).toString(), bytes: [...buffer.subarray(start, start + size)] })
    offset = start + size
  }
  return entries
}

for (const [mode, name] of [[0, 'original images'], [1, 'STORE ZIP'], [2, 'stitched JPEG']]) {
  test(`${name} output matches the original script in filename, image order and bytes`, async () => {
    const results = []
    for (const baseline of [true, false]) {
      const { page, context, errors } = await openComic(browser, { baseline, count: 1, settings: { downType: mode } })
      try {
        await startOne(page)
        const result = await finish(page)
        assert.equal(result.history.status, 'completed')
        assert.equal(result.history.hasError, false)
        assert.deepEqual(errors, [])
        results.push(result.saved.map(file => mode === 1 ? { name: file.name, entries: zipEntries(file.bytes) } : file))
      } finally { await context.close() }
    }
    assert.deepEqual(results[1], results[0])
    if (mode === 0) {
      assert.equal(results[1].length, 2)
      assert.ok(results[1][0].name.endsWith('/001.png'))
      assert.ok(results[1][1].name.endsWith('/002.png'))
      assert.deepEqual(results[1][0].bytes, [...pixel])
    } else if (mode === 1) {
      assert.equal(results[1].length, 1)
      assert.deepEqual(results[1][0].entries.map(entry => entry.name), ['001.png', '002.png'])
      assert.deepEqual(results[1][0].entries[1].bytes, [...pixel])
    } else {
      assert.equal(results[1].length, 1)
      assert.ok(results[1][0].name.endsWith('/001.jpg'))
      assert.deepEqual(results[1][0].bytes.slice(0, 2), [255, 216])
    }
  })
}

test('image range keeps the original sequence number and legacy settings remain readable', async () => {
  const { page, context } = await openComic(browser, { count: 1, settings: { imgDownRange: [2, 2], imgIndexBitNum: 4, themePreset: 'ink', appearanceAxes: { density: 'compact', shape: 'sharp', motion: 'calm' } } })
  try {
    await startOne(page)
    const result = await finish(page)
    assert.equal(result.saved.length, 1)
    assert.ok(result.saved[0].name.endsWith('/0002.png'))
    assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), 'titanium')
    await page.locator('[data-tab="settings"]').click()
    assert.equal(await page.locator('#ten-digits').inputValue(), '4')
    assert.equal(await page.locator('#ten-range-start').inputValue(), '2')
    assert.equal(await page.locator('#ten-comic-root').getAttribute('data-density'), 'compact')
  } finally { await context.close() }
})

test('pause and resume keep an active download available, cancellation finishes without further output', async () => {
  const { page, context } = await openComic(browser, { count: 1, requestDelay: -1 })
  try {
    await startOne(page)
    await page.locator('[data-task-action="pause"]').click()
    assert.equal(await page.locator('[data-task-action="resume"]').count(), 1)
    await page.locator('[data-task-action="resume"]').click()
    await page.locator('[data-task-action="cancel"]').click()
    await page.locator('#ten-confirm-ok').click()
    const result = await finish(page)
    assert.equal(result.history.status, 'cancelled')
    assert.equal(result.saved.length, 0)
    // History persistence can precede the batched UI refresh by one frame.
    await page.locator('[data-worker-card]').waitFor({ state: 'detached' })
    assert.equal(await page.locator('[data-worker-card]').count(), 0)
  } finally { await context.close() }
})

test('an old settings backup imports and exports through the existing UI', async () => {
  const { page, context } = await openComic(browser)
  try {
    await page.locator('[data-tab="settings"]').click()
    const rule = { domain: 'comic.test', homepage: 'https://comic.test/', webName: '旧规则', comicNameCss: '#fixture-title', chapterCss: '#fixture-chapters', readtype: 1, getImgs: 'async function(){return []}' }
    const oldBackup = { format: '10Comic-settings-backup', version: 1, settings: { themePreset: 'porcelain', maxPictureNum: 4, imgIndexBitNum: 5 }, rules: [rule] }
    await page.locator('#ten-backup-file').setInputFiles({ name: 'old-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldBackup)) })
    await page.locator('#ten-rule-import-preview').waitFor({state:'visible'})
    await page.locator('[data-import-action="0"]').selectOption('replace')
    await page.locator('#ten-rule-import-apply').click()
    await page.waitForFunction(() => window.__gmValues.imgIndexBitNum === 5)
    assert.equal(await page.locator('#ten-concurrent-images').inputValue(), '4')
    assert.equal(await page.locator('#ten-comic-root').getAttribute('data-theme'), 'cloud')
    await page.locator('#ten-backup-export').click()
    await page.waitForFunction(() => window.__saved.length > 0)
    const exported = JSON.parse(Buffer.from(await page.evaluate(() => window.__saved[0].bytes)).toString())
    assert.equal(exported.format, '10Comic-settings-backup')
    assert.equal(exported.version, 1)
    assert.equal(exported.settings.imgIndexBitNum, 5)
    assert.equal(exported.rules.length,1)
    for(const [key,value] of Object.entries(rule)) assert.deepEqual(exported.rules[0][key],value)
    assert.equal(exported.rules[0].schemaVersion,1)
  } finally { await context.close() }
})

test('pending chapter snapshots restore through the existing recovery controls', async () => {
  const task = { originHost: 'comic.test', comicName: '恢复漫画', chapterName: '第1话', downChapterName: '第1话', url: 'https://comic.test/chapter/1', readtype: 1, downType: 0 }
  const { page, context } = await openComic(browser, { settings: { pendingTasks: [task] } })
  try {
    await page.locator('[data-tab="tasks"]').click()
    await page.locator('#ten-recovery').waitFor({ state: 'visible' })
    assert.equal(await page.locator('#ten-recovery-count').textContent(), '1 个任务可恢复')
    await page.locator('#ten-recovery-restore').click()
    const result = await finish(page)
    assert.equal(result.history.comicName, '恢复漫画')
    assert.equal(result.history.status, 'completed')
    assert.equal(result.saved.length, 2)
    assert.ok(result.saved[0].name.endsWith('/001.png'))
  } finally { await context.close() }
})
