const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const policyPath = path.resolve(__dirname, '../src/userscript/modules/retry-policy.js')
function policy() { assert.ok(fs.existsSync(policyPath), 'missing independently testable image retry policy'); return require(policyPath) }
const now = Date.parse('2026-10-21T00:00:00Z')
const decide = overrides => policy().decide({ url: 'https://img.test/1', response: 'timeout', failure: '图片请求超时', attempt: 0, now, random: () => 0, ...overrides })
test('only temporary failures retry, with a bounded number of attempts', () => {
  for (const response of ['timeout', 'onerror', { status: 0 }, ...[408,425,429,500,502,503,504].map(status => ({ status }))]) assert.equal(decide({ response }).retry, true)
  for (const response of ['abort', ...[400,401,403,404,405,410,422,501,505].map(status => ({ status })), { status: 200, imageValidationFailure: 'invalid' }, { status: 200, imageValidationFailure: 'empty' }]) assert.equal(decide({ response }).retry, false)
  assert.equal(decide({ failure: '' }).retry, false)
  assert.equal(decide({ url: 'blob:https://comic.test/id' }).retry, false)
  assert.equal(decide({ attempt: 2 }).retry, false)
})
test('backoff grows and positive jitter never shortens a server waiting instruction', () => {
  assert.ok(decide({ attempt: 1 }).delayMs > decide({ attempt: 0 }).delayMs)
  const response = { status: 429, responseHeaders: 'Content-Type: text/html\r\nrEtRy-AfTeR: 3\r\n' }
  assert.equal(decide({ response }).delayMs, 3000)
  assert.equal(decide({ response }).cooldownMs, 3000)
  const withJitter = decide({ response, random: () => 1 })
  assert.ok(withJitter.delayMs >= 3000 && withJitter.delayMs <= 3250)
})
test('HTTP date retry instructions use the server Date header when available to compensate clock skew', () => {
  const response = { status: 503, responseHeaders: 'Date: Wed, 21 Oct 2026 00:01:00 GMT\r\nRetry-After: Wed, 21 Oct 2026 00:01:05 GMT' }
  assert.equal(decide({ response }).delayMs, 5000)
  assert.equal(decide({ response: { status: 503, responseHeaders: 'Retry-After: Wed, 21 Oct 2026 00:00:04 GMT' } }).delayMs, 4000)
})
test('malformed headers fall back, and excessive server delays stop rather than retry early', () => {
  for (const value of ['garbage','-1','1.5','Infinity']) assert.ok(decide({ response: { status: 429, responseHeaders: 'Retry-After: ' + value } }).delayMs >= 1000)
  const long = decide({ response: { status: 429, responseHeaders: 'Retry-After: 3600' } })
  assert.equal(long.retry, false); assert.equal(long.cooldownMs, 3600000); assert.match(long.reason, /等待|稍后/)
  assert.equal(decide({ response: { status: 429, responseHeaders: 'Retry-After: 4' }, attempt: 2 }).cooldownMs, 4000)
  const maximum = decide({ response: { status: 429, responseHeaders: 'Retry-After: 600' }, random: () => 1 })
  assert.equal(maximum.retry,true);assert.equal(maximum.delayMs,600000)
})
test('retry sleeping aborts immediately and does not retain its abort listener', async () => {
  const controller = new AbortController(); let adds = 0, removes = 0
  const signal = controller.signal, add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal)
  signal.addEventListener = (...args) => { adds++; return add(...args) }; signal.removeEventListener = (...args) => { removes++; return remove(...args) }
  const waiting = policy().sleep(60000, signal)
  controller.abort(); await assert.rejects(waiting, /取消/); assert.equal(adds, removes)
})
