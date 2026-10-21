const assert=require('node:assert/strict')
const {test,before,after}=require('node:test')
const {chromium,openComic,pixel}=require('./helpers/browser.cjs')
const {loadAdapters}=require('./helpers/adapters.cjs')
let browser
before(async()=>{browser=await chromium.launch({headless:true})})
after(async()=>{await browser?.close()})
async function editor(page){await page.locator('[data-tab="settings"]').click();const section=page.locator('#ten-rule-editor-card');if(!await section.evaluate(e=>e.open))await page.locator('#ten-rule-editor-card > summary').click()}
async function fields(page){await page.locator('#ten-rule-name').fill('新规则');await page.locator('#ten-rule-domain').fill('comic.test');await page.locator('#ten-rule-title-selector').fill('#fixture-title');await page.locator('#ten-rule-chapter-selector').fill('#fixture-chapters');await page.locator('#ten-rule-image-selector').fill('.reader img')}
test('staged rule testing distinguishes unverified reading pages and previews one chapter without a download',async()=>{
 const {page,context}=await openComic(browser,{count:3});try{
  await editor(page);assert.equal(await page.locator('#ten-rule-match-status').count(),1)
  await fields(page);await page.locator('#ten-rule-test').click()
  assert.match(await page.locator('#ten-rule-test-result').textContent(),/未验证|未测试/)
  await context.route('https://comic.test/chapter/1',route=>route.fulfill({status:200,contentType:'text/html',body:'<div class="reader"><img src="https://img.test/1.png"><img src="https://img.test/2.png"></div>'}))
  await page.locator('#ten-rule-preview').click();await page.waitForFunction(()=>document.querySelectorAll('#ten-rule-preview-result img').length===2)
  assert.equal(await page.evaluate(()=>window.__saved.length),0);assert.equal(await page.locator('#ten-rule-preview-result img').count(),2)
 }finally{await context.close()}
})
test('field validation does not execute an IIFE disguised as a parser function',async()=>{
 const {page,context}=await openComic(browser);try{
  await editor(page);await fields(page);await page.locator('#ten-rule-advanced > summary').click()
  await page.locator('#ten-rule-getimgs').fill('function(){window.__ruleProbe=1;return []}()');await page.locator('#ten-rule-test').click()
  assert.equal(await page.evaluate(()=>window.__ruleProbe),undefined);assert.equal(await page.locator('#ten-rule-getimgs').getAttribute('aria-invalid'),'true')
  await page.locator('#ten-rule-getimgs').fill('');await page.locator('#ten-rule-chapter-selector').fill('[');await page.locator('#ten-rule-save').click()
  assert.equal(await page.locator('#ten-rule-chapter-selector').getAttribute('aria-invalid'),'true')
 }finally{await context.close()}
})
test('JSON import is previewed, selective, deduplicated and reversible',async()=>{
 const {page,context}=await openComic(browser,{count:1});try{
  await editor(page);await page.locator('.ten-rule-json > summary').first().click()
  const existing=await page.evaluate(()=>{const r=window.__gmValues.userWebInfo[0];return{...r,getImgs:typeof r.getImgs==='function'?r.getImgs.toString():r.getImgs}})
  const added={webName:'导入新站',domain:'new.test',imageCss:'img'}
  await page.locator('#ten-rule-text').fill(JSON.stringify([existing,added]));await page.locator('#ten-import-rules').click()
  assert.equal(await page.locator('#ten-rule-import-preview [data-import-row]').count(),2)
  assert.equal(await page.evaluate(()=>window.__gmValues.userWebInfo.length),1)
  await page.locator('#ten-rule-import-apply').click()
  assert.equal(await page.evaluate(()=>window.__gmValues.userWebInfo.length),2)
  await editor(page);await page.locator('#ten-rule-history').locator('..').locator('summary').click();await page.locator('#ten-rule-history').selectOption({index:1});await page.locator('#ten-rule-history-restore').click();await page.locator('#ten-confirm-ok').click()
  assert.equal(await page.evaluate(()=>window.__gmValues.userWebInfo.length),1)
 }finally{await context.close()}
})
test('drafts can be recovered and templates have an undo action',async()=>{
 const {page,context}=await openComic(browser);try{
  await editor(page);await fields(page);await page.locator('#ten-rule-template-library > summary').click();await page.locator('[data-rule-template="lazy"]').click();await page.locator('#ten-rule-template-undo').click()
  assert.equal(await page.locator('#ten-rule-image-selector').inputValue(),'.reader img')
  await page.locator('#ten-close').click();await page.evaluate(()=>window.__menus.find(m=>m.label.includes('显示/隐藏')).action());await page.locator('#ten-comic-launcher').click();await editor(page)
  await page.locator('#ten-rule-new').click();await page.locator('#ten-confirm-ok').click()
  await page.locator('#ten-rule-drafts').selectOption({index:1});await page.locator('#ten-rule-draft-restore').click()
  assert.equal(await page.locator('#ten-rule-name').inputValue(),'新规则')
 }finally{await context.close()}
})
test('common parser options filter chapter links and image attributes without custom code',async()=>{
 const rule={webName:'表单解析',domain:'comic.test',imageCss:'.reader img',simpleRule:true,comicNameCss:'#fixture-title',chapterCss:'#fixture-chapters',chapterUrlIncludes:'/chapter/2',imageAttributes:['data-original'],imageExcludeCss:'.ad',readtype:1}
 const {page,context}=await openComic(browser,{count:3,settings:{userWebInfo:[rule]}});try{
  await context.route('https://comic.test/chapter/2',r=>r.fulfill({status:200,contentType:'text/html',body:'<div class="reader"><img data-original="https://img.test/1.png"><img class="ad" data-original="https://img.test/ad.png"></div>'}))
  await page.locator('#ten-load-chapters').click();assert.equal(await page.locator('#ten-chapter-list [data-index]').count(),1)
  await page.locator('#ten-select-all').click();await page.locator('#ten-download-selected').click();await page.waitForFunction(()=>window.__saved.length===1)
  assert.deepEqual(await page.evaluate(()=>window.__saved[0].bytes),[...pixel])
 }finally{await context.close()}
})

test('pending draft survives immediate host removal of the panel',async()=>{
 const {page,context}=await openComic(browser);try{
  await editor(page);await page.evaluate(()=>{const input=document.querySelector('#ten-rule-name');input.value='移除前的草稿';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#ten-comic-root').remove();window.__menus.find(m=>m.label.includes('显示/隐藏')).action()})
  await page.waitForFunction(()=>Object.keys(window.__gmValues).some(key=>key.startsWith('tenComic.ruleDraft.v1:')&&window.__gmValues[key].fields.webName==='移除前的草稿'))
 }finally{await context.close()}
})

test('preview reports broken image samples without claiming the chapter works',async()=>{
 const {page,context}=await openComic(browser,{count:1});try{
  await editor(page);await fields(page);await page.locator('#ten-rule-test').click()
  await context.route('https://comic.test/chapter/1',r=>r.fulfill({status:200,contentType:'text/html',body:'<div class="reader"><img src="https://img.test/broken.png"></div>'}))
  await context.route('https://img.test/broken.png',r=>r.fulfill({status:403,body:'forbidden'}))
  await page.locator('#ten-rule-preview').click();await page.waitForFunction(()=>/加载失败|加载成功/.test(document.querySelector('#ten-rule-preview-result').textContent))
  assert.match(await page.locator('#ten-rule-preview-result').textContent(),/加载失败.*1/)
  assert.equal(await page.locator('#ten-rule-test-result').evaluate(e=>e.classList.contains('is-success')),false)
  assert.equal(await page.evaluate(()=>window.__saved.length),0)
 }finally{await context.close()}
})

test('registry honors built-in precedence, custom preference and disabled state',()=>{
 let rules=[{domain:'ac.qq.com',webName:'自定义腾讯',imageCss:'img'}]
 const {api}=loadAdapters({config:{cF:()=>rules},globals:{window:{}}})
 assert.notEqual(api.HL('https://ac.qq.com/').webName,'自定义腾讯')
 rules[0].preferCustom=true;assert.equal(api.HL('https://ac.qq.com/').webName,'自定义腾讯')
 rules[0].enabled=false;assert.notEqual(api.HL('https://ac.qq.com/').webName,'自定义腾讯')
})

test('active and waiting downloads keep the adapter captured when enqueued',async()=>{
 const {page,context}=await openComic(browser,{count:2,requestDelay:-1,settings:{maxChapterNum:1}});try{
  await page.locator('#ten-load-chapters').click();await page.locator('#ten-select-all').click();await page.locator('#ten-download-selected').click()
  await page.locator('[data-tab="sites"]').click();await page.locator('[data-source="1"]').click();await page.locator('[data-edit-rule]').first().click()
  await page.locator('#ten-rule-getimgs').fill('async function(){return ["https://img.test/new.png"]}');await page.locator('#ten-rule-save').click()
  await page.locator('[data-tab="chapters"]').click();await page.locator('#ten-reload-chapters').click()
  await editor(page);assert.match(await page.locator('#ten-rule-match-status').textContent(),/自定义/)
  await page.evaluate(()=>window.__releaseRequests())
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ylComicDownHistory')||'[]').filter(r=>r.status==='completed').length===2)
  assert.equal(await page.evaluate(()=>window.__saved.length),4)
 }finally{await context.close()}
})

test('managed rules support filtering, disabled copies, toggles and JSON export',async()=>{
 const {page,context}=await openComic(browser);try{
  await page.locator('[data-tab="sites"]').click();await page.locator('[data-source="1"]').click()
  await page.locator('[data-rule-action="copy"]').click();await page.waitForFunction(()=>window.__gmValues.userWebInfo.length===2)
  const copy=await page.evaluate(()=>window.__gmValues.userWebInfo.find(r=>r.webName.includes('副本')));assert.equal(copy.enabled,false);assert.equal(copy.preferCustom,false)
  await page.locator('#ten-rule-filter').fill('副本');assert.equal(await page.locator('#ten-managed-rule-list [data-rule-id]:visible').count(),1)
  await page.locator('[data-rule-id="'+copy.id+'"] [data-rule-action="toggle"]').click()
  assert.equal(await page.evaluate(id=>window.__gmValues.userWebInfo.find(r=>r.id===id).enabled,copy.id),true)
  await page.locator('[data-rule-id="'+copy.id+'"] [data-rule-action="prefer"]').click()
  await page.locator('[data-rule-id="'+copy.id+'"] [data-rule-action="export"]').click();await page.waitForFunction(()=>window.__saved.length===1)
  const exported=JSON.parse(Buffer.from(await page.evaluate(()=>window.__saved[0].bytes)).toString());assert.equal(exported[0].id,copy.id);assert.equal(exported[0].preferCustom,true)
 }finally{await context.close()}
})

test('stale imports cannot write backup settings and selector highlighting covers every match',async()=>{
 const {page,context}=await openComic(browser,{count:2});try{
  await editor(page);await fields(page);await page.locator('[data-rule-highlight="chapterCss"]').click();assert.match(await page.locator('#ten-rule-selector-hint').textContent(),/命中 1 项/)
  const backup={format:'10Comic-settings-backup',version:1,settings:{imgIndexBitNum:8},rules:[{webName:'新站',domain:'new.test',imageCss:'img'}]}
  await page.locator('#ten-backup-file').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))})
  await page.locator('#ten-rule-import-preview').waitFor({state:'visible'})
  await page.evaluate(()=>window.__gmValues.userWebInfo.push({domain:'other.test',webName:'并发规则',imageCss:'img'}))
  const old=await page.evaluate(()=>window.__gmValues.imgIndexBitNum)
  await page.locator('#ten-rule-import-apply').click();assert.equal(await page.evaluate(()=>window.__gmValues.imgIndexBitNum),old)
  assert.equal(await page.locator('#ten-rule-import-preview').isVisible(),true)
 }finally{await context.close()}
})

test('deleting the active draft does not recreate it when leaving settings',async()=>{
 const {page,context}=await openComic(browser);try{
  await editor(page);await fields(page)
  await page.waitForFunction(()=>Object.keys(window.__gmValues).some(key=>key.startsWith('tenComic.ruleDraft.v1:')))
  await page.locator('#ten-rule-drafts').selectOption({index:1});await page.locator('#ten-rule-draft-discard').click();await page.locator('#ten-confirm-ok').click()
  await page.locator('[data-tab="chapters"]').click()
  assert.equal(await page.evaluate(()=>Object.keys(window.__gmValues).filter(key=>key.startsWith('tenComic.ruleDraft.v1:')).length),0)
 }finally{await context.close()}
})

test('hidden reader blob images remain alive until preview samples are copied',async()=>{
 const {page,context}=await openComic(browser,{count:1});try{
  await editor(page);await fields(page);await page.locator('#ten-rule-advanced > summary').click();await page.locator('#ten-rule-use-frame').check()
  await context.route('https://comic.test/chapter/1',r=>r.fulfill({status:200,contentType:'text/html',body:`<div class="reader"><img id="pic"></div><script>document.querySelector('#pic').src=URL.createObjectURL(new Blob([Uint8Array.from(${JSON.stringify([...pixel])})],{type:'image/png'}))</script>`}))
  await page.locator('#ten-rule-test').click();await page.locator('#ten-rule-preview').click()
  await page.waitForFunction(()=>/待验证 0/.test(document.querySelector('#ten-rule-preview-result').textContent))
  assert.match(await page.locator('#ten-rule-preview-result').textContent(),/加载成功 1/)
  await page.locator('#ten-close').click();assert.equal(await page.locator('iframe.ten-comic-frame').count(),0)
 }finally{await context.close()}
})

test('cancelled late preview never revokes an object URL owned by the host page',async()=>{
 const {page,context}=await openComic(browser,{count:0});try{
  await page.evaluate(bytes=>{window.__hostBlob=URL.createObjectURL(new Blob([Uint8Array.from(bytes)],{type:'image/png'}));window.__revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.__revoked.push(url);revoke(url)}},[...pixel])
  await editor(page);await fields(page);await page.locator('#ten-rule-advanced > summary').click()
  await page.locator('#ten-rule-getimgs').fill('async function(){window.__parserStarted=true;await new Promise(resolve=>window.__finishParser=resolve);return [window.__hostBlob]}')
  await page.locator('#ten-rule-test').click();await page.locator('#ten-rule-preview').click();await page.locator('#ten-confirm-ok').click()
  await page.waitForFunction(()=>window.__parserStarted);await page.locator('#ten-rule-preview-cancel').click();await page.evaluate(()=>window.__finishParser())
  await page.waitForFunction(()=>!document.querySelector('#ten-rule-preview').disabled)
  assert.equal(await page.evaluate(()=>window.__revoked.includes(window.__hostBlob)),false)
  assert.equal(await page.evaluate(async()=>await(await fetch(window.__hostBlob)).blob().then(b=>b.size)),pixel.length)
 }finally{await context.close()}
})

test('single-rule and settings exports preserve legacy regexes and executable function text as data',async()=>{
 const {page,context}=await openComic(browser);try{
  await page.evaluate(()=>{window.__gmValues.userWebInfo[0].chapterNameReg=/chapter-(\d+)/i;window.__gmValues.userWebInfo[0].getImgs=async function(){return []}})
  await page.locator('[data-tab="sites"]').click();await page.locator('[data-source="1"]').click();await page.locator('[data-rule-action="export"]').click()
  await page.waitForFunction(()=>window.__saved.length===1)
  const single=Buffer.from(await page.evaluate(()=>window.__saved[0].bytes)).toString(),wire=JSON.parse(single)
  assert.equal(wire[0].chapterNameReg.source,'chapter-(\\d+)');assert.equal(wire[0].chapterNameReg.flags,'i');assert.equal(typeof wire[0].getImgs,'string')
  await editor(page);await page.locator('.ten-rule-json > summary').first().click();await page.locator('#ten-rule-text').fill(single);await page.locator('#ten-import-rules').click()
  assert.match(await page.locator('#ten-rule-import-preview').textContent(),/重复/)
  await page.locator('#ten-backup-export').click();await page.waitForFunction(()=>window.__saved.length===2)
  const backup=JSON.parse(Buffer.from(await page.evaluate(()=>window.__saved[1].bytes)).toString());assert.deepEqual(backup.rules[0].chapterNameReg,wire[0].chapterNameReg)
 }finally{await context.close()}
})
