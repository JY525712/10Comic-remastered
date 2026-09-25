const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { buildReadableUserscript } = require('../scripts/build-readable-userscript.cjs')

test('the distributable userscript is generated from readable source', async () => {
  const output = await buildReadableUserscript()
  const committed = fs.readFileSync(path.resolve(__dirname, '../10漫画—重制版.user.js'))
  assert.ok(output.equals(committed), 'root userscript differs from readable source build')
})
