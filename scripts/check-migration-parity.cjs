const crypto = require('node:crypto')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default
const terser = require('terser')
const { buildReadableUserscript } = require('./build-readable-userscript.cjs')

const bundleStart = '(()=>{var __webpack_modules__='
const publishedPrefixHash = 'a3168dfb0ba91b9d96e4d04eed9b5fb791b1be66705fad064a544386b189cba1'
const publishedBindingNormalizedCoreHash = '8fff4548899d96d534f31c4544193c79e65bd3ac2b4e7ae017b463bb67760653'
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

function normalizeBindings(coreSource) {
  const ast = parser.parse(coreSource, { sourceType: 'script' })
  const seen = new Set()
  const bindings = []
  traverse(ast, {
    enter(path) {
      if (!path.isScope()) return
      for (const binding of Object.values(path.scope.bindings)) {
        if (seen.has(binding)) continue
        seen.add(binding)
        bindings.push(binding)
      }
    }
  })
  bindings.sort((left, right) => left.identifier.start - right.identifier.start)
  bindings.forEach((binding, index) => {
    binding.scope.rename(binding.identifier.name, `__ten_binding_${index}`)
  })
  return generate(ast, { comments: false, compact: true }).code
}

async function main() {
  const built = await buildReadableUserscript()
  const start = built.indexOf(bundleStart)
  if (start < 0) throw new Error('Userscript core was not found')
  if (sha256(built.subarray(0, start)) !== publishedPrefixHash) {
    throw new Error('Metadata or reader workers differ from the published 2.0.10 script')
  }
  const core = await terser.minify(normalizeBindings(built.subarray(start).toString('utf8')), {
    compress: false,
    mangle: false,
    format: { beautify: false, comments: false, max_line_len: 500 }
  })
  if (sha256(core.code) !== publishedBindingNormalizedCoreHash) {
    throw new Error('Core syntax differs from the published 2.0.10 script')
  }
  console.log('Readable source matches the published 2.0.10 metadata, workers and normalized core')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
