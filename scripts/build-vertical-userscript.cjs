const fs = require('node:fs')
const path = require('node:path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const terser = require('terser')
const { buildReadableUserscript } = require('./build-readable-userscript.cjs')

const root = path.resolve(__dirname, '..')
const outputPath = path.join(root, 'dist', '10漫画—重制版.vertical.user.js')
const bundleStart = '(()=>{var __webpack_modules__='

function wrapLongLiterals(source) {
  const ast = parser.parse(source, { sourceType: 'script' })
  const edits = []

  function wrap(path) {
    const { start, end } = path.node
    const original = source.slice(start, end)
    const wrapped = original.split('\n').map(line => {
      let result = ''
      let rest = line
      while (rest.length > 180) {
        let cut = rest.lastIndexOf(' ', 160)
        if (cut < 80) cut = rest.indexOf(' ', 160)
        if (cut < 0) break
        result += rest.slice(0, cut + 1) + '\\\n'
        rest = rest.slice(cut + 1)
      }
      return result + rest
    }).join('\n')
    if (wrapped !== original) edits.push({ start, end, wrapped })
  }

  traverse(ast, {
    StringLiteral: wrap,
    TemplateElement: wrap
  })
  edits.sort((a, b) => b.start - a.start)
  for (const { start, end, wrapped } of edits) {
    source = source.slice(0, start) + wrapped + source.slice(end)
  }
  return source
}

async function main() {
  const built = await buildReadableUserscript()
  const start = built.indexOf(bundleStart)
  if (start < 0) throw new Error('Userscript core was not found')
  const prefix = built.subarray(0, start)
  const compactCore = built.subarray(start).toString('utf8').trimEnd()
  const pretty = await terser.minify(compactCore, {
    compress: false,
    mangle: false,
    format: { beautify: true, comments: 'all', max_line_len: 160 }
  })
  const verticalCore = wrapLongLiterals(pretty.code)
  const roundTrip = await terser.minify(verticalCore, {
    compress: false,
    mangle: false,
    format: { beautify: false, comments: 'all', max_line_len: 500 }
  })
  if (roundTrip.code !== compactCore) {
    throw new Error('Vertical formatting changed the userscript core')
  }
  const vertical = Buffer.concat([prefix, Buffer.from(verticalCore + '\n', 'utf8')])
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, vertical)
  const lines = vertical.toString('utf8').split(/\r?\n/)
  console.log(`Built vertical userscript: ${outputPath} (${vertical.length} bytes, ${lines.length} lines)`)
  console.log(`Longest line: ${Math.max(...lines.map(line => line.length))} characters`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
