const crypto = require('node:crypto')
const terser = require('terser')
const { buildReadableUserscript } = require('./build-readable-userscript.cjs')

const bundleStart = '(()=>{var __webpack_modules__='
const publishedPrefixHash = 'a3168dfb0ba91b9d96e4d04eed9b5fb791b1be66705fad064a544386b189cba1'
const publishedCanonicalCoreHash = 'e13b123dfd117e1ab8923cf260a205175e9db52371ce1efc3da55237d9c973d3'
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')

async function main() {
  const built = await buildReadableUserscript()
  const start = built.indexOf(bundleStart)
  if (start < 0) throw new Error('Userscript core was not found')
  if (sha256(built.subarray(0, start)) !== publishedPrefixHash) {
    throw new Error('Metadata or reader workers differ from the published 2.0.10 script')
  }
  const core = await terser.minify(built.subarray(start).toString('utf8'), {
    compress: false,
    mangle: false,
    format: { beautify: false, comments: 'all', max_line_len: 500 }
  })
  if (sha256(core.code) !== publishedCanonicalCoreHash) {
    throw new Error('Core syntax differs from the published 2.0.10 script')
  }
  console.log('Readable source matches the published 2.0.10 metadata, workers and canonical core')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
