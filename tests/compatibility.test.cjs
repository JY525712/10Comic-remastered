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

function preservedParts(source, sfacgDescription) {
  const parts = {}
  const ast = parser.parse(source)
  // Explicitly approved reliability changes have behavior tests. Keep the
  // remaining adapters, download helpers and queue operations byte-for-byte AST equivalent.
  const reliabilityMethods = new Set(['taskKey', 'historyKey', 'addList', 'refresh', 'reportStorageError', 'snapshotTask', 'snapshotWorker', 'createWorker', 'advance', 'exeDown', 'addImgDownPromise', 'addImgPromise', 'requestFailure', 'getSuffix', 'makeZip', 'combineImages', 'finishWorker', 'failWorker', 'completeWorker', 'saveHistory'])
  const revisionOnly = node => {
    if (node?.type !== 'AssignmentExpression' || node.left.type !== 'MemberExpression' || node.left.object.type !== 'ThisExpression' || node.left.property.name !== 'waitingRevision') return false
    assert.equal(generate(node, { compact: true }).code, 'this.waitingRevision=(this.waitingRevision||0)+1', 'only a structural revision increment may be excluded')
    return true
  }
  traverse(ast, { ObjectExpression(path) {
    const property = name => path.node.properties.find(node => node.type === 'ObjectProperty' && (node.key.name || node.key.value) === name)
    if (property('domain')?.value.value !== 'manhua.sfacg.com') return
    const description = property('webDesc')
    assert.equal(description?.value.value, sfacgDescription, 'SF description must match the explicitly approved text')
    description.value = { type: 'StringLiteral', value: '' }
  }, ClassDeclaration(path) {
    if (path.node.id?.name === 'DownloadQueue') path.node.body.body = path.node.body.body.filter(method => !reliabilityMethods.has(method.key.name))
  }, VariableDeclarator(path) {
    if (['getFrameContent', 'getImage'].includes(path.node.id?.name)) path.node.init = { type: 'NullLiteral' }
  }, FunctionDeclaration(path) {
    if (['sanitizePathName', 'writeStoreZipToDirectoryV2'].includes(path.node.id?.name)) path.node.body.body = []
  }, ExpressionStatement(path) {
    const value = path.node.expression
    if (revisionOnly(value) || value.type === 'LogicalExpression' && revisionOnly(value.right)) path.remove()
  }, SequenceExpression(path) {
    path.node.expressions = path.node.expressions.filter(node => !revisionOnly(node))
  } })
  traverse(ast, {
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
test('adapters, config and operations outside explicitly approved reliability changes keep their original executable syntax', () => {
  const original = preservedParts(baseline, '在作品页加载章节；仅下载当前账号可正常阅读的章节。'), optimized = preservedParts(current, '打开站点')
  for (const key of ['390', '624', '872', 'queue']) {
    assert.ok(original[key], `missing original module ${key}`)
    assert.equal(optimized[key], original[key], `behavior-sensitive module ${key} changed`)
  }
})
test('userscript identity, grants, matching and reader workers remain compatible', () => {
  const metadata = source => source.slice(0, source.indexOf('// ==/UserScript==')).split('\n').filter(line => !line.startsWith('// @version') && line !== '// @grant        GM_listValues').join('\n')
  assert.equal(current.split('// @grant        GM_listValues').length, 2, 'only the recovery-key enumeration grant is added')
  assert.equal(metadata(current), metadata(baseline))
  for (const name of ['HIPMH', 'MANHUAGUI', 'KAKAOPAGE', 'RIDIBOOKS']) {
    const worker = source => source.slice(source.indexOf(`/* ${name}_READER_WORKER_START */`), source.indexOf(`/* ${name}_READER_WORKER_END */`))
    assert.equal(worker(current), worker(baseline))
  }
})
