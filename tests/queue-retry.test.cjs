const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const policy = require('../src/userscript/modules/retry-policy.js')
const { pixel } = require('./helpers/browser.cjs')
const source = fs.readFileSync(path.resolve(__dirname, '../src/userscript/modules/queue.js'), 'utf8')
const image = () => ({ status: 200, response: new Blob([pixel], { type: 'image/png' }) })
const flush = () => new Promise(resolve => setImmediate(resolve))
function setup(responses, options = {}) {
  let now = 1000000, queue; const requests = [], saved = [], waits = [], callbacks = []
  const retryPolicy = { ...policy, decide: input => policy.decide({ ...input, random: () => 0 }) }
  const downloads = {
    retryPolicy, sR: (url, failure, attempt) => Boolean(failure) && attempt < 2 && !url.startsWith('blob:'),
    WY: async request => { requests.push({ url: request.url, time: now }); return typeof responses === 'function' ? responses(request.url, requests.length) : responses.shift() || image() },
    zd: async data => { saved.push(data); return true }, pN: value => value, xo: (value,digits) => String(value).padStart(digits,'0')
  }
  const config = { cF: key => key === 'imgDownRange' ? [1,-1] : 100 }
  const sleep = async (ms,signal) => { waits.push(ms); if (options.sleep) await options.sleep(ms,signal,queue); now += ms }
  const Queue = vm.runInNewContext(source + ';module.exports', { module: { exports: {} }, downloadUtils: downloads, configModule: config, yieldToBrowser: sleep, TaskCancelledError: class extends Error {}, document: { hidden: false }, window: { location: { href: 'https://comic.test/title', hostname: 'comic.test' } }, Blob, Uint8Array, TextDecoder, URL, AbortController, Error, Date, Promise, Map, console, setTimeout, clearTimeout })
  queue = new Queue(3,2,3,{ onChange: () => callbacks.push('change'), onPersist: () => callbacks.push('persist') }, { downloads, config, retryPolicy, now: () => now, sleep, yieldToBrowser: sleep })
  for (let index=0; index<3; index++) { queue.worker[index] = queue.createWorker({ comicName: '漫画', chapterName: '章节'+index, downChapterName: '章节'+index, url: 'https://comic.test/'+index, readtype: 1, downType: 0 }); queue.worker[index].totalNumber=1 }
  return { queue, requests, saved, waits, callbacks }
}
for (const packed of [false,true]) test(`${packed ? 'packed' : 'original'} images obey server backoff and count only the final successful result`, async () => {
  const s = setup([{ status:503, responseHeaders:'Retry-After: 2' }, image()])
  if (packed) await s.queue.addImgPromise(0,'https://img.test/1',{},0,1)
  else await s.queue.addImgDownPromise(0,'https://img.test/1',1)
  assert.equal(s.requests.length,2); assert.ok(s.requests[1].time-s.requests[0].time>=2000)
  assert.equal(s.queue.worker[0].processedNum,1); assert.equal(s.queue.worker[0].successNum,1); assert.equal(s.queue.worker[0].failedNum,0)
})
test('permanent failures stop after one attempt, network failures remain bounded', async () => {
  const missing=setup([{ status:404 },{status:404},{status:404}]); await missing.queue.addImgDownPromise(0,'https://img.test/1',1)
  assert.equal(missing.requests.length,1); assert.equal(missing.queue.worker[0].failedNum,1)
  const offline=setup(['timeout','timeout','timeout','timeout']); await offline.queue.addImgDownPromise(0,'https://img.test/1',1)
  assert.equal(offline.requests.length,3); assert.equal(offline.queue.worker[0].processedNum,1)
})
test('even an exhausted rate-limit response cools down the same origin without blocking other origins', async () => {
  let release; const gate=new Promise(resolve=>{release=resolve})
  const s=setup((url,count)=>count===1?{status:429,responseHeaders:'Retry-After: 4'}:image(),{sleep:()=>gate})
  await s.queue.addImgPromise(0,'https://img.test/1',{},2,1)
  const same=s.queue.addImgPromise(1,'https://img.test/2',{},0,1)
  const other=s.queue.addImgPromise(2,'https://other.test/3',{},0,1)
  await other; await flush()
  assert.equal(s.requests.some(item=>item.url==='https://img.test/2'),false)
  assert.ok(s.requests.some(item=>item.url==='https://other.test/3'&&item.time===1000000))
  release(); await same
  assert.ok(s.requests.find(item=>item.url==='https://img.test/2').time>=1004000)
})
test('server cooldowns never delay local blob images from the same origin', async () => {
  let release;const gate=new Promise(resolve=>{release=resolve})
  const s=setup([{status:429,responseHeaders:'Retry-After: 2'},image()],{sleep:()=>gate})
  await s.queue.addImgPromise(0,'https://img.test/1',{},2,1)
  const local=s.queue.addImgPromise(1,'blob:https://img.test/local',{},0,1)
  await flush();const delayed=s.waits.length;release();await local
  assert.equal(delayed,0,'local temporary images do not use the remote server')
})
test('a cancelled retry wait finishes immediately and issues no further request', async () => {
  const s=setup([{status:429,responseHeaders:'Retry-After: 60'}],{sleep:(_ms,signal)=>policy.sleep(100,signal)})
  const task=s.queue.addImgPromise(0,'https://img.test/1',{},0,1)
  while (!s.waits.length) await flush()
  s.queue.cancel(0)
  const outcome=await Promise.race([task.then(()=> 'resolved',error=>error.message),new Promise(resolve=>setTimeout(()=>resolve('not cancelled promptly'),30))])
  assert.match(outcome,/下载.*取消/); await task.catch(()=>{}); assert.equal(s.requests.length,1)
})
test('pausing during backoff prevents retries until resumed', async () => {
  let release; const gate=new Promise(resolve=>{release=resolve})
  const s=setup([{status:503,responseHeaders:'Retry-After: 1'},image()],{sleep:()=>gate})
  const task=s.queue.addImgPromise(0,'https://img.test/1',{},0,1)
  while (!s.waits.length) await flush()
  s.queue.pause(0); release(); await flush(); assert.equal(s.requests.length,1)
  s.queue.resume(0); await task; assert.equal(s.requests.length,2)
})
test('explicit queue services and named event callbacks work without depending on UI names', () => {
  const s=setup([]); s.queue.refresh()
  assert.deepEqual(s.callbacks,['change','persist'])
})
test('legacy completion callbacks retain their original receiver', async () => {
  const s=setup([]),events={received:[],notifyTask(worker){this.received.push(worker.status)}}
  const Queue=s.queue.constructor
  const queue=new Queue(1,1,3,events,{downloads:{},config:{cF:()=>100},historyStorage:{getItem:()=> '[]',setItem(){}},location:{href:'https://comic.test',hostname:'comic.test'},schedule(){}})
  queue.worker[0]=queue.createWorker({url:'https://comic.test/1'})
  await queue.finishWorker(0);assert.deepEqual(events.received,['completed'])
})
test('a longer cooldown reported during a wait cannot be bypassed by the old deadline', async () => {
  let extended=false
  const s=setup([{status:503,responseHeaders:'Retry-After: 2'},image()],{sleep:(_ms,_signal,queue)=>{if(!extended){extended=true;queue.imageCooldowns.set('https://img.test',{until:queue.now()+5000})}}})
  await s.queue.addImgPromise(0,'https://img.test/1',{},0,1)
  assert.ok(s.requests[1].time-s.requests[0].time>=5000)
})
test('the request stage leaves the waiting label before the next image request starts', async () => {
  let stage, s
  s=setup((_url,count)=>{if(count===1)return{status:503,responseHeaders:'Retry-After: 1'};stage=s.queue.worker[0].stage;return image()})
  await s.queue.addImgPromise(0,'https://img.test/1',{},0,1)
  assert.match(stage,/正在重试/)
})
test('pausing at request admission prevents a new network request until resumed', async () => {
  const s=setup([image()]);let paused=false
  s.queue.waitForImageOrigin=async()=>{if(!paused){paused=true;s.queue.pause(0)}return ''}
  const task=s.queue.addImgPromise(0,'https://img.test/1',{},0,1)
  await flush(); assert.equal(s.requests.length,0)
  s.queue.resume(0);await task;assert.equal(s.requests.length,1)
})
test('an excessive Retry-After stops automatic work on that origin without issuing premature requests', async () => {
  const s=setup([{status:429,responseHeaders:'Retry-After: 3600'}])
  await s.queue.addImgPromise(0,'https://img.test/1',{},0,1)
  await s.queue.addImgPromise(1,'https://img.test/2',{},0,1)
  assert.equal(s.requests.length,1);assert.equal(s.waits.length,0)
  assert.match(s.queue.worker[1].failures[0].reason,/稍后/)
})
test('the queue can complete through explicit services without browser/UI closure globals', async () => {
  const changes=[], history=[], scheduled=[]
  const Queue=vm.runInNewContext(source+';module.exports',{module:{exports:{}},Blob,Uint8Array,TextDecoder,URL,AbortController,Error,Date,Promise,Map})
  const queue=new Queue(1,1,3,{onChange:()=>changes.push('change')},{
    downloads:{},config:{cF:()=>100},location:{href:'https://comic.test/title',hostname:'comic.test'},
    historyStorage:{getItem:()=>JSON.stringify(history),setItem:(_key,text)=>history.splice(0,history.length,...JSON.parse(text))},
    schedule:callback=>scheduled.push(callback),isPageHidden:()=>false,isSettingsVisible:()=>false
  })
  queue.worker[0]=queue.createWorker({url:'https://comic.test/1',comicName:'漫画',downChapterName:'章节',readtype:1,downType:0})
  queue.refresh(); await queue.finishWorker(0)
  assert.ok(changes.length); assert.equal(history[0].status,'completed'); assert.equal(queue.worker[0],undefined); assert.equal(scheduled.length,1)
})
