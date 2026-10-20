const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const file = path.resolve(__dirname, '../src/userscript/modules/recovery.js')
function setup() {
  assert.ok(fs.existsSync(file), 'missing independent recovery session store')
  const Store = vm.runInNewContext(fs.readFileSync(file, 'utf8') + ';module.exports', { module: { exports: {} }, Date, Math, JSON, Promise, Error, Set, Map, URL })
  const data = new Map(), held = new Set()
  const storage = { get: key => structuredClone(data.get(key)), set: (key, value) => data.set(key, structuredClone(value)), remove: key => data.delete(key), keys: () => [...data.keys()] }
  const locks = { async request(name, options, callback) { if (typeof options === 'function') { callback = options; options = {} } if (held.has(name)) return callback(null); held.add(name); try { return await callback({ name }) } finally { held.delete(name) } } }
  return { data, storage, make: id => new Store(storage, { id, host: 'comic.test', origin: 'https://comic.test', locks }) }
}
const task = id => ({ taskId: id, url: `https://comic.test/${id}`, comicName: '漫画', chapterName: id })
test('same-host sessions write independently and live owners are not offered for recovery', async () => {
  const s = setup(), a = s.make('a'), b = s.make('b'); await Promise.all([a.ready, b.ready])
  a.persist([task('one')]); b.persist([task('two')])
  assert.equal(s.data.get(a.key).tasks[0].taskId, 'one'); assert.equal(s.data.get(b.key).tasks[0].taskId, 'two')
  assert.equal((await b.candidates()).length, 0)
  a.close()
  const candidates = await b.candidates()
  assert.equal(candidates.length, 1); assert.equal(candidates[0].tasks[0].taskId, 'one')
  b.close()
})
test('two tabs cannot claim the same abandoned batch, and claiming stores the destination first', async () => {
  const s = setup(), a = s.make('a'); await a.ready; a.persist([task('one')]); a.close()
  const b = s.make('b'), c = s.make('c'); await Promise.all([b.ready,c.ready])
  const [rb, rc] = await Promise.all([b.candidates(),c.candidates()]); let accepted = 0
  const take = store => async tasks => { accepted += tasks.length; store.persist(tasks); await Promise.resolve() }
  await Promise.all([b.claim(rb,take(b)),c.claim(rc,take(c))])
  assert.equal(accepted, 1); assert.equal(s.data.has(a.key), false)
  b.close(); c.close()
})
test('failed persistence preserves the source batch and legacy migration does not erase other hosts', async () => {
  const s = setup(); s.data.set('pendingTasks', [task('old'), { ...task('other'), originHost: 'other.test', url: 'https://other.test/1' }])
  const b = s.make('b'); await b.ready
  const refs = await b.candidates()
  await assert.rejects(b.claim(refs, async () => { throw new Error('quota') }), /quota/)
  assert.equal((await b.candidates()).flatMap(ref => ref.tasks).length, 1)
  await b.claim(await b.candidates(), async tasks => b.persist(tasks))
  assert.equal((await b.candidates()).length, 0)
  assert.equal(s.data.get('pendingTasks').length, 2)
  b.close()
})
test('failed source retirement keeps the successful destination owner protected from a third tab', async () => {
  const s = setup(), a = s.make('a'); await a.ready; a.persist([task('one')]); a.close()
  const b = s.make('b'), c = s.make('c'); await Promise.all([b.ready,c.ready])
  const originalRemove = s.storage.remove
  s.storage.remove = key => { if (key === a.key) throw new Error('remove failed'); return originalRemove(key) }
  assert.equal(await b.claim(await b.candidates(), async tasks => b.persist(tasks)), 1)
  assert.equal(b.warnings.length, 1)
  assert.equal((await c.candidates()).length, 0, 'already transferred tasks must remain owned by the active destination')
  assert.equal((await b.candidates()).length, 0, 'the destination must not offer its own transferred batch again')
  b.persist([]); b.close()
  assert.equal((await c.candidates()).length, 0, 'completed transfers must stay retired after the destination closes')
  c.close()
})
test('a failed legacy adoption cannot hide a later changed legacy snapshot', async () => {
  const s = setup(), b = s.make('b'); await b.ready
  s.data.set('pendingTasks', [task('old')])
  await assert.rejects(b.claim(await b.candidates(), async () => { throw new Error('quota') }), /quota/)
  s.data.set('pendingTasks', [task('new')])
  assert.equal((await b.candidates())[0].tasks[0].taskId, 'new')
  b.close()
})
test('synchronous lock rejection falls back to independent leased checkpoints', async () => {
  const s = setup(), Store = s.make('unused').constructor
  const b = new Store(s.storage, { id: 'blocked', host: 'comic.test', origin: 'https://comic.test', locks: { request() { throw new Error('not allowed') } } })
  await b.ready
  b.persist([task('one')]); assert.equal(s.data.get(b.key).protected, false); b.close()
})
