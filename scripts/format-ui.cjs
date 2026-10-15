const fs = require('node:fs')
const path = require('node:path')
const terser = require('terser')
const { wrapLongLiterals } = require('./build-vertical-userscript.cjs')

async function main() {
  const directory = path.resolve(__dirname, '../src/userscript/ui')
  // Entry slot comments are declaration boundaries, so only format complete
  // fragments. A general formatter can move comments inside an earlier scope.
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith('.js'))) {
    const target = path.resolve(directory, file)
    const original = fs.readFileSync(target, 'utf8')
    const options = { compress: false, mangle: false, format: { beautify: true, comments: 'all', max_line_len: 140 } }
    const formatted = await terser.minify(original, options)
    const output = wrapLongLiterals(formatted.code)
    const compactOptions = { compress: false, mangle: false, format: { comments: false } }
    const before = await terser.minify(original, compactOptions)
    const after = await terser.minify(output, compactOptions)
    if (before.code !== after.code) throw new Error(`Formatting changed ${file}`)
    fs.writeFileSync(target, output + '\n')
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
