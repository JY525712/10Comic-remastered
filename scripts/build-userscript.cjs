const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, 'src', 'userscript')
const outputPath = path.join(root, '10漫画—重制版.user.js')
const fragments = [
  'metadata.part',
  'workers/hipmh.js',
  'workers/manhuagui.js',
  'workers/kakaopage.js',
  'workers/ridibooks.js',
  'core/before-sites.part',
  'sites/edge-sites.js',
  'core/after-sites.part'
]

function buildUserscript() {
  return Buffer.concat(fragments.map(name => fs.readFileSync(path.join(sourceDir, name))))
}

function main() {
  const output = buildUserscript()
  const hash = crypto.createHash('sha256').update(output).digest('hex')
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(outputPath) || !output.equals(fs.readFileSync(outputPath))) {
      console.error('The userscript differs from its source fragments. Run npm run build.')
      process.exitCode = 1
      return
    }
    console.log(`Userscript matches source: ${output.length} bytes, SHA256 ${hash}`)
    return
  }
  fs.writeFileSync(outputPath, output)
  console.log(`Built ${outputPath}: ${output.length} bytes, SHA256 ${hash}`)
}

if (require.main === module) main()

module.exports = { buildUserscript }
