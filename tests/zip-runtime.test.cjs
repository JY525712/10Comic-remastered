const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default
const { chromium, openComic, root, pixel } = require('./helpers/browser.cjs')

function writerSource(file) {
  let code
  traverse(parser.parse(fs.readFileSync(file, 'utf8')), { FunctionDeclaration(p) {
    if (p.node.id.name === 'writeStoreZipToDirectoryV2') code = generate(p.node).code
  } })
  assert.ok(code)
  return code
}

async function archive(file, cancelAtYield = false) {
  let copiedBytes = 0, yields = 0, aborted = false
  const chunks = [], controller = new AbortController()
  class TrackedBlob extends Blob {
    constructor(parts, options) {
      super(parts, options)
      copiedBytes += parts.reduce((sum, part) => sum + (part.byteLength || 0), 0)
    }
  }
  const handle = {
    getDirectoryHandle: async () => handle,
    getFileHandle: async () => ({ createWritable: async () => ({
      async write(data) { chunks.push(data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : Buffer.from(data.buffer, data.byteOffset, data.byteLength)) },
      async close() {}, async abort() { aborted = true }
    }) })
  }
  const writer = vm.runInNewContext(`${writerSource(file)};writeStoreZipToDirectoryV2`, {
    Uint8Array, Uint32Array, DataView, TextEncoder, Blob: TrackedBlob,
    getDirectoryHandle: async () => handle, sanitizeDownloadPath: value => value,
    addZeroForNum: (value, digits) => String(value).padStart(digits, '0'),
    delay: async () => { yields++; if (cancelAtYield) controller.abort() }
  })
  const bytes = new Uint8Array(5 * 1024 * 1024)
  for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251
  const entry = { blob: new Blob([bytes]), imgIndex: 1, suffix: 'png' }
  if (cancelAtYield) await assert.rejects(writer('漫画\\章节.zip', [entry], 3, null, controller.signal), /下载已取消/)
  else await writer('漫画\\章节.zip', [entry], 3)
  return { data: Buffer.concat(chunks), copiedBytes, yields, aborted, writes: chunks.length }
}

test('ZIP output remains byte-identical while avoiding extra Blob copies and yielding during large checksums', async () => {
  const before = await archive(path.join(root, 'baseline/original-2.0.11.user.js'))
  const after = await archive(path.join(root, 'src/userscript/modules/downloads.js'))
  assert.ok(after.data.equals(before.data), 'archive data, ordering and CRC32 changed')
  assert.equal(after.copiedBytes, 0, 'ZIP buffers are copied into extra Blob objects')
  assert.ok(after.yields > 1, 'large checksums monopolize the JavaScript turn')
})

test('cancelling during a large checksum stops before writing image data', async () => {
  const result = await archive(path.join(root, 'src/userscript/modules/downloads.js'), true)
  assert.equal(result.aborted, true)
  assert.equal(result.writes, 0)
})

test('the ZIP writer works with a real browser FileSystemWritableFileStream', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const { page, context } = await openComic(browser, { count: 1, settings: { downType: 1 } })
    try {
      await page.evaluate(async () => { window.__tenComicDirectoryHandle = await navigator.storage.getDirectory() })
      await page.locator('#ten-load-chapters').click()
      await page.locator('#ten-select-all').click()
      await page.locator('#ten-download-selected').click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('ylComicDownHistory') || '[]')[0]?.status === 'completed')
      const bytes = await page.evaluate(async () => {
        const dir = await window.__tenComicDirectoryHandle.getDirectoryHandle('测试漫画')
        const file = await dir.getFileHandle('第 1 话 很长的漫画章节名称用于测试换行与省略.zip')
        return Array.from(new Uint8Array(await (await file.getFile()).arrayBuffer()))
      })
      const zip = Buffer.from(bytes), length = zip.readUInt16LE(26), extra = zip.readUInt16LE(28)
      assert.equal(zip.readUInt32LE(0), 0x04034b50)
      assert.equal(zip.subarray(30, 30 + length).toString(), '001.png')
      assert.ok(zip.subarray(30 + length + extra, 30 + length + extra + pixel.length).equals(pixel))
    } finally { await context.close() }
  } finally { await browser.close() }
})
