const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default
const root = path.resolve(__dirname, '..')
const baseline = fs.readFileSync(path.join(root, 'baseline/original-2.0.11.user.js'), 'utf8')
const current = fs.readFileSync(process.env.USERSCRIPT_PATH || path.join(root, '10漫画—重制版.user.js'), 'utf8')

function preservedParts(source) {
  const parts = {}
  traverse(parser.parse(source), {
    ObjectProperty(path) {
      if ([390, 624, 872].includes(path.node.key.value) && path.node.value.type === 'ArrowFunctionExpression') {
        parts[path.node.key.value] = generate(path.node.value, { compact: true, comments: false }).code
      }
    },
    ClassDeclaration(path) {
      if (path.node.id.name === 'DownloadQueue') parts.queue = generate(path.node, { compact: true, comments: false }).code
    }
  })
  return parts
}
test('site adapters, download engine, queue and settings keep the original executable syntax', () => {
  const original = preservedParts(baseline), optimized = preservedParts(current)
  for (const key of ['390', '624', '872', 'queue']) {
    assert.ok(original[key], `missing original module ${key}`)
    assert.equal(optimized[key], original[key], `behavior-sensitive module ${key} changed`)
  }
})
test('userscript identity, grants, matching and reader workers remain compatible', () => {
  const metadata = source => source.slice(0, source.indexOf('// ==/UserScript==')).split('\n').filter(line => !line.startsWith('// @version')).join('\n')
  assert.equal(metadata(current), metadata(baseline))
  for (const name of ['HIPMH', 'MANHUAGUI', 'KAKAOPAGE', 'RIDIBOOKS']) {
    const worker = source => source.slice(source.indexOf(`/* ${name}_READER_WORKER_START */`), source.indexOf(`/* ${name}_READER_WORKER_END */`))
    assert.equal(worker(current), worker(baseline))
  }
})
