const assert = require('node:assert/strict')
const { test, before, after } = require('node:test')
const { chromium, openComic, pixel } = require('./helpers/browser.cjs')
let browser
before(async()=>{browser=await chromium.launch({headless:true})})
after(async()=>{await browser?.close()})
async function start(page) {
  await page.locator('#ten-load-chapters').click();await page.locator('#ten-select-all').click();await page.locator('#ten-download-selected').click()
}
for (const mode of [0,1,2]) test(`mode ${mode} observes Retry-After before retrying a real browser request`,async()=>{
  const {page,context}=await openComic(browser,{count:1,settings:{downType:mode,maxPictureNum:1}})
  const times=[]
  try {
    await context.route('https://img.test/1.png',route=>{
      times.push(Date.now())
      return times.length===1?route.fulfill({status:429,headers:{'Retry-After':'2','Access-Control-Expose-Headers':'Retry-After'},contentType:'text/html',body:'rate limited'}):route.fulfill({status:200,contentType:'image/png',body:pixel})
    })
    await start(page)
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ylComicDownHistory')||'[]')[0]?.status==='completed')
    assert.equal(times.length,2);assert.ok(times[1]-times[0]>=1980, `retry gap ${times[1]-times[0]}ms; timestamps ${JSON.stringify(times)}`)
    const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('ylComicDownHistory'))[0])
    assert.equal(result.processedNum,2);assert.equal(result.successNum,2);assert.equal(result.failedNum,0);assert.equal(result.writtenNum,2)
    assert.ok(result.diagnostics.some(item=>item.stage==='图片重试'&&item.category==='rate-limit'))
  } finally {await context.close()}
})
test('a permanent browser HTTP error is recorded once without unnecessary retries',async()=>{
  const {page,context}=await openComic(browser,{count:1});let requests=0
  try {
    await context.route('https://img.test/1.png',route=>{requests++;return route.fulfill({status:404,body:'missing'})})
    await start(page);await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ylComicDownHistory')||'[]').length===1)
    const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('ylComicDownHistory'))[0])
    assert.equal(requests,1);assert.equal(record.status,'partial');assert.equal(record.processedNum,2);assert.equal(record.successNum,1);assert.equal(record.failedNum,1);assert.equal(record.writtenNum,1)
  } finally {await context.close()}
})
test('the cancel control interrupts a long retry wait without saving output or issuing another request',async()=>{
  const {page,context}=await openComic(browser,{count:1,settings:{maxPictureNum:1}});let requests=0
  try {
    await context.route('https://img.test/**',route=>{requests++;return route.fulfill({status:429,headers:{'Retry-After':'60','Access-Control-Expose-Headers':'Retry-After'},body:'rate limited'})})
    await start(page)
    await page.waitForFunction(()=>document.querySelector('[data-task-stage]')?.textContent.includes('等待'))
    await page.locator('[data-task-action="cancel"]').click();await page.locator('#ten-confirm-ok').click()
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ylComicDownHistory')||'[]')[0]?.status==='cancelled')
    assert.equal(requests,1);assert.equal(await page.evaluate(()=>window.__saved.length),0)
  } finally {await context.close()}
})
