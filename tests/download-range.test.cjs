const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const images = [1, 2, 3].map(number => `https://img.example/${number}.webp`)
const queueSource = fs.readFileSync(path.resolve(__dirname, '../src/userscript/modules/queue.js'), 'utf8')

async function runQueue(range) {
  const Queue = vm.runInNewContext(`${queueSource};module.exports`, {
    module: { exports: {} },
    n: { gJ: async () => images },
    r: { cF: () => range }
  })
  const queue = new Queue(1, 1, 3, null)
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
