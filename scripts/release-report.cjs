const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { buildVerticalUserscript } = require('./build-vertical-userscript.cjs')
const root = path.resolve(__dirname, '..')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')

async function main() {
  const artifact = fs.readFileSync(path.join(root, '10漫画—重制版.user.js'))
  const sha256 = hash(artifact)
  assert.ok(artifact.equals(await buildVerticalUserscript()), 'artifact differs from source')
  const baseline = fs.readFileSync(path.join(root, 'baseline/original-2.0.11.user.js'))
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'baseline/manifest.json')))
  assert.equal(hash(baseline), manifest.sha256)
  const log = fs.readFileSync(path.join(root, 'final-tests.log'), 'utf8')
  assert.ok(log.includes('Artifact SHA256: ' + sha256), 'tests are for an earlier artifact')
  const total = Number(log.match(/tests (\d+)/)?.[1])
  const passed = Number(log.match(/pass (\d+)/)?.[1])
  const failed = Number(log.match(/fail (\d+)/)?.[1])
  assert.ok(total > 25 && total === passed && failed === 0, 'full test suite is not green')
  const directory = path.join(root, 'dist/verification')
  const browser = JSON.parse(fs.readFileSync(path.join(directory, 'browser-report.json')))
  const themes = JSON.parse(fs.readFileSync(path.join(directory, 'themes-report.json')))
  assert.equal(themes.sha256, sha256, 'theme checks are for an earlier artifact')
  assert.equal(themes.checks.length, 72)
  const benchmark = JSON.parse(fs.readFileSync(path.join(directory, 'chapter-benchmark.json')))
  assert.equal(browser.sha256, sha256, 'browser checks are for an earlier artifact')
  assert.equal(benchmark.sha256, sha256, 'benchmark is for an earlier artifact')
  assert.equal(browser.checks.length, 27)
  const report = {
    version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version, generatedAt: new Date().toISOString(),
    artifact: { file: '10漫画—重制版.user.js', bytes: artifact.length, sha256 },
    baseline: manifest,
    sizeReductionPercent: Number((100 * (1 - artifact.length / baseline.length)).toFixed(2)),
    tests: { command: 'npm test', total, passed, failed },
    build: 'matches source; uniform LF; node --check verified separately',
    browser: { command: 'npm run verify:browser', checks: browser.checks.length },
    themes: { command: 'npm run verify:themes', checks: themes.checks.length },
    benchmark: benchmark.summary,
    scope: 'Offline Chromium fixtures, unchanged adapter/download/queue/config AST, no live account or site availability claim'
  }
  fs.writeFileSync(path.join(directory, 'release-report.json'), JSON.stringify(report, null, 2))
  fs.copyFileSync(path.join(root, '10漫画—重制版.user.js'), path.join(root, 'dist/10漫画—重制版.user.js'))
  console.log(JSON.stringify(report, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
