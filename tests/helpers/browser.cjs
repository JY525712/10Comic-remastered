const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const runtimePackages = process.env.CODEX_NODE_MODULES || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
const { chromium } = require(require.resolve('playwright', { paths: [path.resolve(__dirname, '../..'), runtimePackages] }))

const root = path.resolve(__dirname, '../..')
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4ioAAAAASUVORK5CYII=', 'base64')

async function openComic(browser, options = {}) {
  const count = options.count ?? 300
  const context = await browser.newContext({ viewport: options.viewport || { width: 1280, height: 900 }, reducedMotion: options.reducedMotion || 'no-preference' })
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><h1 id="fixture-title">测试漫画</h1><div id="fixture-chapters">${Array.from({ length: count }, (_, i) => `<a href="/chapter/${i + 1}">第 ${i + 1} 话 很长的漫画章节名称用于测试换行与省略</a>`).join('')}</div><div id="fixture-results"><div class="fixture-result"><a href="/series/1" title="搜索结果漫画"><img src="https://img.test/search.png"></a></div></div><button id="outside">宿主网页按钮</button></body></html>`
  await context.route('**/*', route => route.fulfill({ status: 200, contentType: route.request().url().includes('img.test') ? 'image/png' : 'text/html; charset=utf-8', body: route.request().url().includes('img.test') ? pixel : html }))
  await context.addInitScript(({ settings, supported, requestDelay }) => {
    const values = {
      appLoadDefault: { isShowUI: true, loadHotKey: 'V', rightSize: 100 },
      userWebInfo: supported ? [{ domain: 'comic.test', homepage: 'https://comic.test/', webName: '本地验证站点', comicNameCss: '#fixture-title', chapterCss: '#fixture-chapters', readtype: 1, useFrame: false, getImgs: 'async function(){return ["https://img.test/1.png","https://img.test/2.png"]}' }] : [],
      effectLevel: 0,
      ...settings
    }
    window.__gmValues = values
    window.__menus = []
    window.__saved = []
    window.__notifications = []
    window.GM_getValue = (key, fallback) => key in values ? values[key] : fallback
    window.GM_setValue = (key, value) => { values[key] = value }
    window.GM_deleteValue = key => { delete values[key] }
    window.GM_registerMenuCommand = (label, action) => { window.__menus.push({ label, action }) }
    window.GM_info = { script: { version: 'test' } }
    window.GM_addStyle = css => { const style = document.createElement('style'); style.textContent = css; document.documentElement.append(style) }
    window.GM_setClipboard = text => { window.__clipboard = text }
    window.GM_notification = value => window.__notifications.push(value)
    window.GM_openInTab = url => ({ close() {} })
    window.unsafeWindow = window
    let releaseRequests
    const requestGate = new Promise(resolve => { releaseRequests = resolve })
    window.__releaseRequests = () => releaseRequests()
    window.GM_xmlhttpRequest = request => {
      const controller = new AbortController()
      fetch(request.url, { signal: controller.signal }).then(async response => {
        const value = request.responseType === 'blob' ? await response.blob() : request.responseType === 'arraybuffer' ? await response.arrayBuffer() : await response.text()
        if (requestDelay === -1) await requestGate
        else if (requestDelay) await new Promise(resolve => setTimeout(resolve, requestDelay))
        request.onload?.({ status: response.status, response: value, responseText: typeof value === 'string' ? value : '', finalUrl: request.url, responseHeaders: 'content-type: image/png' })
      }).catch(error => request.onerror?.(error))
      return { abort: () => controller.abort() }
    }
    window.GM_download = request => {
      const controller = new AbortController()
      fetch(request.url, { signal: controller.signal }).then(async response => {
        const bytes = Array.from(new Uint8Array(await response.arrayBuffer()))
        window.__saved.push({ name: request.name, bytes })
        request.onload?.({})
      }).catch(error => request.onerror?.(error))
      return { abort: () => controller.abort() }
    }
    const directory = prefix => ({
      name: prefix || '验证目录', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getDirectoryHandle: async name => directory(prefix ? prefix + '/' + name : name),
      getFileHandle: async name => ({ createWritable: async () => {
        let chunks = []
        return { write: async chunk => { chunks.push(chunk instanceof Blob ? new Uint8Array(await chunk.arrayBuffer()) : new Uint8Array(chunk.buffer || chunk, chunk.byteOffset || 0, chunk.byteLength)) }, close: async () => window.__saved.push({ name: (prefix ? prefix + '/' : '') + name, bytes: Array.from(chunks.flatMap(chunk => Array.from(chunk))) }), abort: async () => { chunks = [] } }
      } })
    })
    window.showDirectoryPicker = async () => directory('')
  }, { settings: options.settings || {}, supported: options.supported !== false, requestDelay: options.requestDelay || 0 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('https://comic.test/title')
  const sourcePath = options.baseline ? path.join(root, 'baseline/original-2.0.11.user.js') : (process.env.USERSCRIPT_PATH || path.join(root, '10漫画—重制版.user.js'))
  await page.addScriptTag({ content: fs.readFileSync(sourcePath, 'utf8') })
  if (options.supported !== false && options.settings?.appLoadDefault?.isShowUI !== false) await page.locator('#ten-panel.is-open').waitFor()
  return { page, context, errors }
}

module.exports = { chromium, openComic, root, pixel }
