const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const root = path.resolve(__dirname, '../..')

// Load the actual source registry without extracting rules by text offsets.
function loadAdapters(options = {}) {
  const source = fs.readFileSync(path.join(root, 'src/userscript/modules/comics.js'), 'utf8')
    .replace('/*__EDGE_SITE_RULES__*/', fs.readFileSync(path.join(root, 'src/userscript/sites/edge-sites.source.js'), 'utf8'))
  const downloads = {
    oL: value => Array.isArray(value) ? 'Array' : typeof value,
    WY: async () => { throw new Error('Unexpected fixture network request') },
    ...options.downloads
  }
  const config = { cF: () => [], ...options.config }
  const requireModule = id => { if (id === 624) return downloads; if (id === 390) return config; throw new Error('Unexpected adapter dependency: ' + id) }
  requireModule.d = (exports, getters) => { for (const [name,get] of Object.entries(getters)) Object.defineProperty(exports,name,{get}) }
  const factory = vm.runInNewContext(source + ';module.exports', { module: { exports: {} }, URL, console, ...options.globals })
  const api = {}; factory({},api,requireModule)
  return { api, rules: api.eT().originalInfo }
}
module.exports = { loadAdapters }
