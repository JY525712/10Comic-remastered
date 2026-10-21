const assert = require('node:assert/strict')
const fs = require('node:fs')
const { test } = require('node:test')
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('all editable JavaScript sources parse independently, including new modules and reader workers', () => {
  const sourceRoot = path.join(root, 'src', 'userscript')
  const sources = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(path.join(directory,entry.name)) : entry.name.endsWith('.js') ? [path.join(directory,entry.name)] : [])
  for (const source of sources(sourceRoot)) {
    const checked = spawnSync(process.execPath, ['--check', source], { encoding: 'utf8' })
    assert.equal(checked.status, 0, `${path.relative(sourceRoot,source)}: ${checked.stderr || checked.stdout}`)
  }
})
