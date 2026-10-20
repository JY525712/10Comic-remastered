const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const { pixel } = require('./helpers/browser.cjs')
const source = fs.readFileSync(path.resolve(__dirname, '../src/userscript/modules/queue.js'), 'utf8')
function setup(options = {}) {
  const history = [], scheduled = [], notifications = []
  const Queue = vm.runInNewContext(`${source};module.exports`, {
    module: { exports: {} }, Blob, Uint8Array, TextDecoder, URL, AbortController, Error, Date, Promise,
    document: { hidden: false }, window: { location: { href: 'https://comic.test/title', hostname: 'comic.test' } },
    localStorage: { getItem: () => JSON.stringify(history), setItem: (_, text) => { if (options.storageFails) throw new Error('quota'); history.splice(0, history.length, ...JSON.parse(text)) } },
    configModule: { cF: key => key === 'historyLimit' ? 100 : [1, -1] },
    downloadUtils: { pN: text => text, xo: (n, d) => String(n).padStart(d, '0'), sR: () => false, WY: async () => options.response || { status: 200, response: new Blob([pixel], { type: 'image/png' }) }, zd: async () => options.write !== false },
    yieldToBrowser: async () => {}, TaskCancelledError: class extends Error {}, console,
    setTimeout: callback => { scheduled.push(callback); return scheduled.length }
  })
  const queue = new Queue(1, 2, 3, { $forceUpdate() {}, persistTasks() {}, getHistoryData() {}, notifyTask(item) { notifications.push(item); if (options.notifyFails) throw new Error('notify failed') }, storageError(error) { notifications.push(error.message) } })
  queue.worker[0] = queue.createWorker({ comicName: '漫画', chapterName: '第1话', downChapterName: '第1话', url: 'https://comic.test/chapter/1', downType: 0, readtype: 1 })
  queue.worker[0].totalNumber = 2
  return { queue, history, scheduled, notifications, Queue }
}
test('image validation rejects empty, HTML and JSON responses even with a successful status', async () => {
  const { queue } = setup()
  for (const [data, type] of [['', 'image/png'], ['<!doctype html><html>login</html>', 'image/jpeg'], ['{"error":"login"}', 'application/octet-stream'], ['not a jpeg', 'image/jpeg']]) {
    assert.notEqual(await queue.requestFailure({ status: 200, response: new Blob([data], { type }) }), '', `${type}: invalid image accepted`)
  }
})
test('image validation accepts real binary images with missing or generic MIME and determines their suffix', async () => {
  const { queue } = setup()
  for (const type of ['', 'application/octet-stream', 'image/png']) {
    const response = { status: 200, response: new Blob([pixel], { type }) }
    assert.equal(await queue.requestFailure(response), '')
    assert.equal(queue.getSuffix('https://img.test/signed?token=x', response), 'png')
  }
})
test('processed progress distinguishes valid saved images from failures and failed writes', async () => {
  const ok = setup(); await ok.queue.addImgDownPromise(0, 'https://img.test/1', 1)
  const bad = setup({ response: { status: 200, response: new Blob(['<html>login</html>'], { type: 'text/html' }) } }); await bad.queue.addImgDownPromise(0, 'https://img.test/1', 1)
  const disk = setup({ write: false }); await disk.queue.addImgDownPromise(0, 'https://img.test/1', 1)
  for (const [s, succeeded, failed, written] of [[ok, 1, 0, 1], [bad, 0, 1, 0], [disk, 0, 1, 0]]) {
    const w = s.queue.worker[0]
    assert.equal(w.processedNum, 1); assert.equal(w.successNum, succeeded); assert.equal(w.failedNum, failed); assert.equal(w.writtenNum, written); assert.equal(w.progress, 50)
  }
})
test('fast saving validates the response instead of accepting an HTML file as a successful image', async () => {
  const { queue } = setup({ response: { status: 200, response: new Blob(['<html>login</html>'], { type: 'text/html' }) } })
  Object.assign(queue.worker[0], { directFlow: 1, directRemoteDownload: true, useDirectory: false })
  await queue.addImgDownPromise(0, 'https://img.test/1.jpg', 1)
  assert.equal(queue.worker[0].hasError, true, 'invalid direct-download content was accepted')
  assert.equal(queue.worker[0].successNum, 0); assert.equal(queue.worker[0].failedNum, 1)
})
test('legacy resume processed counts migrate without turning failures into successful images', () => {
  const { queue } = setup()
  const w = queue.createWorker({ url: 'https://comic.test/1', downType: 0, readtype: 1, resumeImages: [{ url: 'https://img.test/3', imgIndex: 3 }], resumeTotal: 3, resumeCompleted: 2, resumeFailures: [{ url: 'https://img.test/2', imgIndex: 2 }] })
  assert.equal(w.processedNum, 2); assert.equal(w.successNum, 1); assert.equal(w.failedNum, 1); assert.equal(w.writtenNum, 1)
})
test('queue identity separates output modes and supplement tasks while detecting the same chapter', () => {
  const { Queue } = setup()
  const task = { url: 'https://comic.test/1?token=x', comicName: '漫画', downType: 0, imageRange: [1, -1] }
  assert.equal(Queue.taskKey(task), Queue.taskKey({ ...task, url: task.url + '#reader' }))
  assert.notEqual(Queue.taskKey(task), Queue.taskKey({ ...task, downType: 1 }))
  assert.notEqual(Queue.taskKey(task), Queue.taskKey({ ...task, imageRange: [2, 2] }))
  assert.notEqual(Queue.taskKey(task), Queue.taskKey({ ...task, retryImages: [{ url: 'https://img.test/1', imgIndex: 1 }] }))
})
test('completed evidence survives other output modes and a later failed attempt of the same chapter', () => {
  const { queue, history } = setup()
  const task = { comicName: '漫画', chapterName: '第1话', downChapterName: '第1话', url: 'https://comic.test/chapter/1', downType: 0, readtype: 1, imageRange: [1,-1] }
  for (const [downType, status] of [[0,'completed'],[1,'completed'],[0,'failed']]) {
    const worker = queue.createWorker({ ...task, downType }); worker.status = status; worker.hasError = status === 'failed'
    queue.saveHistory(worker)
  }
  assert.equal(history.length, 3)
  assert.ok(history.some(record => record.status === 'completed' && record.task.downType === 0))
  assert.ok(history.some(record => record.status === 'completed' && record.task.downType === 1))
})
for (const cancelled of [false, true]) test(`storage/notification failures cannot strand a ${cancelled ? 'cancelled' : 'completed'} worker`, async () => {
  const s = setup({ storageFails: true, notifyFails: true })
  if (cancelled) { s.queue.worker[0].cancelled = true; s.queue.failWorker(0, new Error('cancel')) }
  else await s.queue.finishWorker(0)
  assert.equal(s.queue.worker[0], undefined)
  assert.equal(s.queue.workerDownInfo[0], undefined)
  assert.equal(s.scheduled.length, 1)
  assert.ok(s.queue.historyFallback?.length, 'history must remain available in memory')
})
