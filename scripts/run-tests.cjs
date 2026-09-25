const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildReadableUserscript } = require('./build-readable-userscript.cjs')

const root = path.resolve(__dirname, '..')
const testDir = path.join(root, 'tests')
const files = fs.readdirSync(testDir)
  .filter(name => name.endsWith('.test.cjs'))
  .sort()
  .map(name => path.join(testDir, name))

async function main() {
  if (!files.length) throw new Error('No test files found')

  // Rule tests extract compact object literals. The root artifact is formatted
  // vertically, and its generator verifies it round-trips to this compact core.
  const compactPath = path.join(root, 'dist', '10漫画—重制版.compact.user.js')
  fs.mkdirSync(path.dirname(compactPath), { recursive: true })
  fs.writeFileSync(compactPath, await buildReadableUserscript())

  const result = spawnSync(process.execPath, ['--test', ...files], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, USERSCRIPT_PATH: compactPath }
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

main().catch(error => { console.error(error); process.exitCode = 1 })
