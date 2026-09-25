const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { buildUserscript } = require('../scripts/build-userscript.cjs')

const root = path.resolve(__dirname, '..')

test('local source rebuilds the checked-in userscript byte for byte', () => {
  const expected = fs.readFileSync(path.join(root, '10漫画—重制版.user.js'))
  const first = buildUserscript()
  const second = buildUserscript()
  assert.deepEqual(first, expected)
  assert.deepEqual(second, expected)
})
