const assert = require('node:assert/strict')
const { test } = require('node:test')
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('editable core and site source files parse independently', () => {
  for (const file of ['core.source.js', 'sites/edge-sites.source.js']) {
    const source = path.join(root, 'src', 'userscript', file)
    const checked = spawnSync(process.execPath, ['--check', source], { encoding: 'utf8' })
    assert.equal(checked.status, 0, `${file}: ${checked.stderr || checked.stdout}`)
  }
})
