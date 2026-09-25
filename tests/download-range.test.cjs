const assert = require('node:assert/strict')
const { test } = require('node:test')
const vm = require('node:vm')
const { buildReadableUserscript } = require('../scripts/build-readable-userscript.cjs')

const images = [1, 2, 3].map(number => `https://img.example/${number}.webp`)

async function runQueue(range) {
  const source = (await buildReadableUserscript()).toString('utf8')
  const start = source.indexOf('async exeDown(e){')
  const end = source.indexOf('}async down(e){', start)
  assert.ok(start >= 0 && end > start)
  const Queue = vm.runInNewContext(`(class Queue{${source.slice(start, end + 1)}})`, {
    n: { gJ: async () => images },
    r: { cF: () => range }
  })
  const queue = new Queue()
  const worker = { url: 'https://comic.example/chapter', readtype: 1, abortController: { signal: {} } }
  queue.worker = [worker]
  queue.waitUntilRunnable = async () => {}
  queue.setStage = () => {}
  queue.assertActive = () => worker
  queue.resetSpeed = () => {}
  queue.down = async () => {}
  queue.finishWorker = async () => {}
  queue.failWorker = (_index, error) => { throw error }
  await queue.exeDown(0)
  return JSON.parse(JSON.stringify(worker.imgs))
}

test('default range downloads all image URLs', async () => {
  assert.deepEqual(await runQueue([1, -1]), images.map((url, index) => ({ url, imgIndex: index + 1 })))
})

test('single-page range downloads only the requested page', async () => {
  assert.deepEqual(await runQueue([1, 1]), [{ url: images[0], imgIndex: 1 }])
})
