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

async function buildReadableUserscript() {
  const prefix = Buffer.concat(prefixFiles.map(name => fs.readFileSync(path.join(source, name))))
  const core = fs.readFileSync(path.join(source, 'core.source.js'), 'utf8')
  const sites = fs.readFileSync(path.join(source, 'sites', 'edge-sites.source.js'), 'utf8')
  const first = core.indexOf(siteMarker)
  if (first < 0 || core.indexOf(siteMarker, first + siteMarker.length) >= 0) {
    throw new Error('Expected exactly one site rule marker')
  }
  const assembled = core.slice(0, first) + sites + core.slice(first + siteMarker.length)
  const result = await terser.minify(assembled, {
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
