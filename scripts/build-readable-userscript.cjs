const fs = require('node:fs')
const path = require('node:path')
const terser = require('terser')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'src', 'userscript')
const outputPath = path.join(root, '10漫画—重制版.user.js')

const prefixFiles = [
  'metadata.part',
  'workers/hipmh.js',
  'workers/manhuagui.js',
  'workers/kakaopage.js',
  'workers/ridibooks.js'
]
const siteMarker = '/*__EDGE_SITE_RULES__*/'

function replaceOne(sourceText, marker, replacement) {
  const index = sourceText.indexOf(marker)
  if (index < 0 || sourceText.indexOf(marker, index + marker.length) >= 0) {
    throw new Error(`Expected exactly one ${marker}`)
  }
  return sourceText.slice(0, index) + replacement + sourceText.slice(index + marker.length)
}

function moduleSource(name) {
  const text = fs.readFileSync(path.join(source, 'modules', `${name}.js`), 'utf8').trim()
  const prefix = 'module.exports = '
  if (!text.startsWith(prefix) || !text.endsWith(';')) {
    throw new Error(`Invalid source module wrapper: ${name}`)
  }
  return text.slice(prefix.length, -1).trim()
}

async function buildReadableUserscript() {
  const prefix = Buffer.concat(prefixFiles.map(name => fs.readFileSync(path.join(source, name))))
  let core = fs.readFileSync(path.join(source, 'runtime.source.js'), 'utf8')
  const sites = fs.readFileSync(path.join(source, 'sites', 'edge-sites.source.js'), 'utf8')
  const modules = {
    733: moduleSource('vendor'),
    390: moduleSource('config'),
    872: replaceOne(moduleSource('comics'), siteMarker, sites),
    624: moduleSource('downloads')
  }
  for (const [id, body] of Object.entries(modules)) {
    core = replaceOne(core, `/*__MODULE_${id}__*/(()=>{})`, `(${body})`)
  }
  // Queue is kept in a separate source file but runs in the UI module scope.
  const ui = replaceOne(moduleSource('ui'), '/*__QUEUE_CLASS__*/\n  class DownloadQueue {}', moduleSource('queue'))
  core = replaceOne(core, '/*__ENTRY__*/(()=>{})()', `(${ui})()`)
  const result = await terser.minify(core, {
    compress: false,
    mangle: false,
    format: { beautify: false, comments: 'all', max_line_len: 500 }
  })
  if (!result.code) throw new Error('Terser returned no userscript body')
  return Buffer.concat([prefix, Buffer.from(result.code + '\n', 'utf8')])
}

async function main() {
  const built = await buildReadableUserscript()
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(outputPath) || !built.equals(fs.readFileSync(outputPath))) {
      console.error('The userscript differs from its readable source. Run npm run build.')
      process.exitCode = 1
      return
    }
    console.log(`Userscript matches readable source: ${built.length} bytes`)
    return
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, built)
  console.log(`Built userscript: ${outputPath} (${built.length} bytes)`)
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })

module.exports = { buildReadableUserscript }
