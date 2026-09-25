const assert = require('node:assert/strict')
const { test } = require('node:test')
const crypto = require('node:crypto')
const terser = require('terser')
const { buildReadableUserscript } = require('../scripts/build-readable-userscript.cjs')

const bundleStart = '(()=>{var __webpack_modules__='
const options = { compress: false, mangle: false, format: { beautify: false, comments: 'all', max_line_len: 500 } }
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const publishedPrefixHash = 'a3168dfb0ba91b9d96e4d04eed9b5fb791b1be66705fad064a544386b189cba1'
const publishedCanonicalCoreHash = 'e13b123dfd117e1ab8923cf260a205175e9db52371ce1efc3da55237d9c973d3'

test('readable source preserves the published metadata and core syntax', async () => {
  const built = await buildReadableUserscript()
  const again = await buildReadableUserscript()
  assert.ok(built.equals(again), 'build is not deterministic')

  const newStart = built.indexOf(bundleStart)
  assert.ok(newStart > 0)
  assert.equal(sha256(built.subarray(0, newStart)), publishedPrefixHash, 'metadata or reader workers changed')

  const newCore = await terser.minify(built.subarray(newStart).toString('utf8'), options)
  assert.equal(sha256(newCore.code), publishedCanonicalCoreHash, 'readable core differs from published core')
})
