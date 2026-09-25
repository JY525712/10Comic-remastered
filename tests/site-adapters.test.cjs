const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.resolve(__dirname, '../src/userscript/sites/edge-sites.source.js'), 'utf8')

function rules(context) {
  return vm.runInNewContext(`const comicsWebInfo=[];${source};comicsWebInfo`, { URL, ...context })
}

test('Zero uses the title after leading whitespace and returns ordered chapters', async () => {
  const links = [1, 2, 3, 4].map(number => ({
    textContent: String(number),
    getAttribute: name => name === 'href' ? `/pc/view/index.php?zjid=${700000 + number}` : null
  }))
  const document = {
    querySelector: selector => selector === 'main h1' ? { textContent: '\n    晚安 迷途的羔羊【已完结】' } : null,
    querySelectorAll: selector => selector.includes('zjid=') ? links : []
  }
  const zero = rules({ document, location: { origin: 'https://www.zerobyw33.com' } })
    .find(rule => rule.homepage.includes('zerobyw33.com'))
  const chapters = await zero.getComicInfo()
  assert.deepEqual(JSON.parse(JSON.stringify(chapters.map(({ comicName, chapterName, url }) => ({ comicName, chapterName, url })))),
    [1, 2, 3, 4].map(number => ({
      comicName: '晚安 迷途的羔羊',
      chapterName: String(number),
      url: `https://www.zerobyw33.com/pc/view/index.php?zjid=${700000 + number}`
    })))
})

test('Mangabz reads each distinct page and releases its reader frame', async () => {
  const images = [1, 2, 3].map(page => `https://img.example/${page}.jpg`)
  let page = 1
  let removed = false
  const frame = {
    contentWindow: {},
    contentDocument: {
      querySelector(selector) {
        if (selector === '.bottom-page2') return { textContent: '1 - 3' }
        if (selector === 'a[href="javascript:ShowNext();"]') return { click: () => { page++ } }
        if (selector === '#lbcurrentpage') return { textContent: String(page) }
        if (selector === '#cp_image') return { getAttribute: () => images[page - 1] }
        throw new Error(`Unexpected selector ${selector}`)
      }
    },
    remove: () => { removed = true }
  }
  const mangabz = rules({ document: { getElementById: () => frame } })
    .find(rule => rule.homepage.includes('mangabz.com'))
  const result = await mangabz.getImgs('', { frameId: 'reader-1', url: 'https://www.mangabz.com/m1/', signal: {} })
  assert.deepEqual(JSON.parse(JSON.stringify(result)), images)
  assert.equal(removed, true)
})

test('Manhuagui worker publishes all page images in reading order', async () => {
  const id = 'task-1'
  const readerUrl = 'https://www.manhuagui.com/comic/31208/545082.html'
  const record = { id, readerUrl, status: 'waiting', cancelled: false }
  const store = new Map([['tenComicManhuaguiWorker:' + id, record]])
  const images = [1, 2, 3, 4].map(page => `https://img.example/${page}.webp`)
  const select = { options: images.map((_, index) => ({ value: String(index + 1) })), value: '1', dispatchEvent: () => {} }
  const document = {
    readyState: 'complete',
    querySelector(selector) {
      if (selector === '#pageSelect') return select
      if (selector === '#mangaFile') return { getAttribute: () => images[Number(select.value) - 1] }
      throw new Error(`Unexpected selector ${selector}`)
    }
  }
  const window = { close: () => {} }
  const workerSource = fs.readFileSync(path.resolve(__dirname, '../src/userscript/workers/manhuagui.js'), 'utf8')
  vm.runInNewContext(workerSource, {
    URL, Date, Promise, setTimeout,
    location: { hostname: 'www.manhuagui.com', pathname: '/comic/31208/545082.html', hash: '#tencomic-mg-task=' + id, origin: 'https://www.manhuagui.com' },
    document, window,
    Event: class { constructor(type) { this.type = type } },
    GM_getValue: (key, fallback) => store.get(key) ?? fallback,
    GM_setValue: (key, value) => store.set(key, value)
  })
  await window.__tenComicManhuaguiWorkerPromise
  assert.equal(store.get('tenComicManhuaguiWorker:' + id).status, 'ready')
  assert.deepEqual(JSON.parse(JSON.stringify(store.get('tenComicManhuaguiWorker:' + id).images)), images)
})
