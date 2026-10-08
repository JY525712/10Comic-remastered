const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const source = fs.readFileSync(path.resolve(__dirname, '../src/userscript/sites/edge-sites.source.js'), 'utf8')
const plain = value => JSON.parse(JSON.stringify(value))
const origin = 'https://manhua.sfacg.com'

function rule(context = {}) {
  const rules = vm.runInNewContext(`const comicsWebInfo=[];${source};comicsWebInfo`, {
    URL, setTimeout, location: { href: origin + '/mh/XJYQS/', origin }, ...context
  })
  const found = rules.find(item => item.domain === 'manhua.sfacg.com')
  assert.ok(found, 'SF 菠萝包内置规则应匹配漫画站')
  return found
}

function link(href, name, vip = false) {
  return {
    textContent: (vip ? 'VIP' : '') + name,
    getAttribute: attribute => attribute === 'href' ? href : null,
    querySelector: selector => selector === 'b' && vip ? { textContent: 'VIP' } : null
  }
}

function directory(links) {
  return {
    querySelector: selector => selector.includes('h1') ? { textContent: '血姬与骑士' } : null,
    querySelectorAll: selector => selector === '.comic_Serial_list' ? [{ querySelectorAll: () => links }] : []
  }
}

function reader(context = {}) {
  let removed = false
  const frame = {
    contentWindow: { picAy: [], location: { href: origin + '/mh/XJYQS/81461/' } },
    contentDocument: { querySelector: () => null },
    remove() { removed = true }
  }
  const task = { frameId: 'sf-reader', url: origin + '/mh/XJYQS/81461/', signal: {} }
  return {
    frame, task, removed: () => removed,
    rule: rule({ document: { getElementById: id => id === task.frameId ? frame : null }, ...context })
  }
}

test('SF lists only this comic chapters, oldest first, with clean VIP names', async () => {
  const sf = rule({ document: directory([
    link('/mh/XJYQS/115842/', '447 被修改的记忆', true),
    link('http://manhua.sfacg.com/mh/XJYQS/81462/', '第1话'),
    link('/mh/XJYQS/81462/', '第1话'),
    link('/mh/XJYQS/81461/', '序章'),
    link('/mh/FRZ/111/', '其他漫画'),
    link('/mh/XJYQS/', '目录'),
    link('javascript:;', '切换'),
    link('https://example.com/mh/XJYQS/99/', '站外链接')
  ]) })
  assert.deepEqual(plain(await sf.getComicInfo()), [
    { comicName: '血姬与骑士', chapterName: '序章', chapterNumStr: '', url: origin + '/mh/XJYQS/81461/', readtype: 1, isPay: false, isSelect: false },
    { comicName: '血姬与骑士', chapterName: '第1话', chapterNumStr: '', url: origin + '/mh/XJYQS/81462/', readtype: 1, isPay: false, isSelect: false },
    { comicName: '血姬与骑士', chapterName: '447 被修改的记忆', chapterNumStr: '', url: origin + '/mh/XJYQS/115842/', readtype: 1, isPay: true, isSelect: false }
  ])
})

test('SF can load the directory when opened on a reader page', async () => {
  const requests = []
  const sf = rule({
    location: { href: origin + '/mh/XJYQS/81461/#p=2', origin },
    document: { querySelectorAll: () => [] },
    downloadUtils: {
      WY: async options => { requests.push(options); return { status: 200, responseText: '<h1>目录</h1>' } },
      U3: () => directory([link('/mh/XJYQS/81461/', '序章')])
    }
  })
  const chapters = await sf.getComicInfo()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, origin + '/mh/XJYQS/')
  assert.equal(chapters[0].chapterName, '序章')
})

test('SF rejects a failed directory request instead of falling back to unrelated links', async () => {
  const sf = rule({
    location: { href: origin + '/mh/XJYQS/81461/', origin },
    document: { querySelectorAll: () => [] },
    downloadUtils: { WY: async () => ({ status: 503, responseText: 'unavailable' }), U3: () => { throw new Error('must not parse error page') } }
  })
  await assert.rejects(sf.getComicInfo(), /SF.*目录/)
})

test('SF waits for picAy and returns every page in reading order, preserving signed URLs', async () => {
  let waited = 0
  let setup
  setup = reader({ setTimeout: callback => {
    waited++
    setup.frame.contentWindow.picAy = [
      '/Pic/book/001.jpg', 'https://coldpic.sfacg.com/Pic/book/002.webp?token=a%2Fb&x=1',
      String.raw`\/Pic\/book\/003.png`, '//coldpic.sfacg.com/Pic/book/004.jpg', '/Pic/book/001.jpg'
    ]
    callback()
  } })
  assert.deepEqual(plain(await setup.rule.getImgs('', setup.task)), [
    'https://coldpic.sfacg.com/Pic/book/001.jpg',
    'https://coldpic.sfacg.com/Pic/book/002.webp?token=a%2Fb&x=1',
    'https://coldpic.sfacg.com/Pic/book/003.png',
    'https://coldpic.sfacg.com/Pic/book/004.jpg',
    'https://coldpic.sfacg.com/Pic/book/001.jpg'
  ])
  assert.ok(waited > 0)
  assert.equal(setup.removed(), true)
})

test('SF cancellation stops parsing and releases the reader', async () => {
  const setup = reader()
  setup.task.signal.aborted = true
  await assert.rejects(setup.rule.getImgs('', setup.task), /取消|cancel/i)
  assert.equal(setup.removed(), true)
})

test('SF surfaces reader errors and releases the reader', async () => {
  const setup = reader()
  setup.frame.contentDocument.querySelector = selector => selector === '#Tips' ? { textContent: '请先购买章节', style: { display: 'block' } } : null
  await assert.rejects(setup.rule.getImgs('', setup.task), /请先购买章节/)
  assert.equal(setup.removed(), true)
})

test('SF does not silently drop invalid pages from an otherwise populated picAy', async () => {
  const setup = reader()
  setup.frame.contentWindow.picAy = ['/Pic/001.jpg', 'javascript:alert(1)', '/Pic/003.jpg']
  await assert.rejects(setup.rule.getImgs('', setup.task), /图片.*地址/)
  assert.equal(setup.removed(), true)
})

test('SF reports unavailable image data after a bounded wait', async () => {
  let waited = 0
  const setup = reader({ setTimeout: callback => { waited++; callback() } })
  await assert.rejects(setup.rule.getImgs('', setup.task), /SF.*图片.*登录|SF.*超时/)
  assert.ok(waited > 0 && waited <= 200)
  assert.equal(setup.removed(), true)
})

test('SF handles a redirect to the login site and releases the reader', async () => {
  const setup = reader()
  setup.frame.contentDocument = null
  await assert.rejects(setup.rule.getImgs('', setup.task), /SF.*登录|SF.*阅读页/)
  assert.equal(setup.removed(), true)
})

test('SF reads page globals through unsafeWindow when the userscript sees an isolated window', async () => {
  const pageWindow = { picAy: ['/Pic/page-world/001.jpg'], location: { href: origin + '/mh/XJYQS/81461/' } }
  const setup = reader({
    unsafeWindow: { document: { getElementById: id => id === 'sf-reader' ? { contentWindow: pageWindow } : null } },
    setTimeout: callback => callback()
  })
  setup.frame.contentWindow.picAy = undefined
  assert.deepEqual(plain(await setup.rule.getImgs('', setup.task)), ['https://coldpic.sfacg.com/Pic/page-world/001.jpg'])
  assert.equal(setup.removed(), true)
})

test('the complete iframe download flow reports login redirects with an actionable error', async () => {
  const downloadsSource = fs.readFileSync(path.resolve(__dirname, '../src/userscript/modules/downloads.js'), 'utf8')
  let removed = false
  let parsed = false
  const frame = { style: {}, contentDocument: null, remove() { removed = true } }
  const factory = vm.runInNewContext(`${downloadsSource};module.exports`, {
    module: { exports: {} }, setTimeout, clearTimeout, console: { log() {} },
    document: {
      createElement: () => frame,
      body: { appendChild: element => queueMicrotask(() => element.onload()) }
    }
  })
  const exports = {}
  const requireModule = id => id === 872 ? { Po: { useFrame: true, getImgs: () => { parsed = true } } } : {}
  requireModule.d = (target, getters) => Object.entries(getters).forEach(([name, get]) => Object.defineProperty(target, name, { get }))
  factory({}, exports, requireModule)
  await assert.rejects(exports.gJ({ url: origin + '/mh/XJYQS/115842/', signal: {} }), /阅读页.*登录|阅读页.*授权/)
  assert.equal(parsed, false)
  assert.equal(removed, true)
})
