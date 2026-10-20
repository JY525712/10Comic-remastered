const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const source = fs.readFileSync(path.resolve(__dirname, '../src/userscript/modules/downloads.js'), 'utf8')
function setup(loaded) {
  const frames = new Map(), timers = new Map(); let timerId = 0
  const rule = { Po: { useFrame: true, getImgs: async () => new Promise(() => {}) } }
  const document = { createElement: () => ({ style: {}, contentDocument: { body: { outerHTML: '<html>reader</html>' } }, remove() { frames.delete(this.id) } }), getElementById: id => frames.get(id), body: { appendChild(frame) { frames.set(frame.id, frame); if (loaded) queueMicrotask(() => frame.onload?.()) } } }
  const req = id => id === 872 ? rule : { cF: () => null }; req.d = (exports, fields) => { for (const [name, getter] of Object.entries(fields)) Object.defineProperty(exports, name, { get: getter }) }
  const wrapper = vm.runInNewContext(`${source};module.exports`, { module: { exports: {} }, Blob, URL, Uint8Array, Uint32Array, DataView, TextEncoder, Promise, Error, document, window: { location: { href: 'https://comic.test/1' } }, setTimeout: callback => { timers.set(++timerId, callback); return timerId }, clearTimeout: id => timers.delete(id), queueMicrotask, console })
  const api = {}; wrapper({}, api, req)
  return { api, frames, timers, rule }
}
for (const loaded of [false, true]) test(`cancellation stops ${loaded ? 'an uncooperative parser' : 'iframe loading'} and releases its resources`, async () => {
  const { api, frames, timers } = setup(loaded), controller = new AbortController()
  const result = api.gJ({ url: 'https://comic.test/reader', signal: controller.signal })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(frames.size, 1)
  controller.abort()
  const outcome = await Promise.race([result.then(() => 'resolved', error => error.message), new Promise(resolve => setTimeout(() => resolve('did not settle'), 30))])
  assert.match(outcome, /取消/)
  assert.equal(frames.size, 0); assert.equal(timers.size, 0)
})
test('reusable reader frames remain alive between batches and are cleaned when the next batch is cancelled', async () => {
  const { api, frames, rule } = setup(true)
  rule.Po.reuseParsedImages = true
  let cleaned = 0
  const otherData = { cleanup() { cleaned++; for (const frame of frames.values()) frame.remove() } }
  rule.Po.getImgs = async () => ({ otherData, imgUrlArr: ['https://img.test/1'] })
  await api.gJ({ url: 'https://comic.test/reader', signal: new AbortController().signal })
  assert.equal(frames.size, 1, 'the next reader batch still needs its iframe')
  rule.Po.getImgs = async () => new Promise(() => {})
  const controller = new AbortController(), next = api.gJ({ url: 'https://comic.test/reader', otherData, signal: controller.signal })
  controller.abort()
  await assert.rejects(next, /取消/)
  assert.equal(frames.size, 0); assert.ok(cleaned > 0)
})
