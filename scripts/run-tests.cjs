const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const testDir = path.join(root, 'tests')
const files = fs.readdirSync(testDir)
  .filter(name => name.endsWith('.test.cjs'))
  .sort()
  .map(name => path.join(testDir, name))

if (!files.length) throw new Error('No test files found')

const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
