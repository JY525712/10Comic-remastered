const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { buildVerticalUserscript } = require('../scripts/build-vertical-userscript.cjs')

test('the distributable userscript is generated with uniform vertical layout', async () => {
  const output = await buildVerticalUserscript()
  const committed = fs.readFileSync(path.resolve(__dirname, '../10漫画—重制版.user.js'))
  assert.ok(output.equals(committed), 'root userscript differs from readable source build')
  const source = output.toString('utf8')
  assert.equal(source.includes('\r'), false, 'userscript mixes Windows and Unix newlines')
  assert.ok(source.split('\n').length > 1000, 'userscript unexpectedly has few physical lines')
})
