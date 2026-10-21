const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadAdapters } = require('./helpers/adapters.cjs')
const plain = value => JSON.parse(JSON.stringify(value))

test('every built-in adapter has a consistent registry contract and matches its declared homepage', () => {
  const { rules, api } = loadAdapters()
  assert.ok(rules.length >= 18)
  const names = new Set()
  for (const rule of rules) {
    assert.ok(typeof rule.webName === 'string' && rule.webName.trim()); assert.equal(names.has(rule.webName),false); names.add(rule.webName)
    assert.ok(['http:','https:'].includes(new URL(rule.homepage).protocol),rule.webName)
    assert.equal(api.HL(rule.homepage)?.webName,rule.webName,rule.homepage)
    assert.ok([0,1].includes(rule.readtype),rule.webName)
    assert.equal(typeof rule.getImgs,'function',rule.webName)
    assert.ok(typeof rule.chapterCss === 'string' || typeof rule.getComicInfo === 'function',rule.webName)
    assert.ok(Number.isFinite(rule.batchDelay) && rule.batchDelay >= 0,rule.webName)
    const domains = Array.isArray(rule.domain) ? rule.domain : [rule.domain]
    for (const domain of domains) {
      assert.equal(typeof domain,'string',rule.webName)
      const matched = api.HL('https://' + domain.replace(/^\*\./,'') + '/')
      assert.equal(matched?.webName,rule.webName,rule.webName + ': ' + domain)
    }
  }
})
test('Naver fixture preserves page order, repeated images and signed URL parameters', async () => {
  const rule=loadAdapters().rules.find(rule=>rule.domain==='comic.naver.com')
  const urls=['https://img.test/1.jpg?token=a%2Fb&n=1','https://img.test/2.webp?x=2','https://img.test/2.webp?x=2']
  const html='<div class="wt_viewer">\n'+urls.map(url=>`<img src="${url}">`).join('\n')+'\n</div>'
  assert.deepEqual(plain(await rule.getImgs(html,{})),urls)
  assert.deepEqual(plain(await rule.getImgs('<div class="wt_viewer"></div>',{})),[])
  await assert.rejects(Promise.resolve().then(()=>rule.getImgs('<html>login</html>',{})))
})
test('Komiic fixture uses the requested chapter and preserves API page order', async () => {
  const requests=[]
  const { rules }=loadAdapters({downloads:{WY:async request=>{requests.push(request);return{responseText:JSON.stringify({data:{imagesByChapterId:[{kid:'first'},{kid:'second'}]}})}}}})
  const rule=rules.find(rule=>rule.domain==='komiic.com')
  assert.deepEqual(plain(await rule.getImgs('',{url:'https://komiic.com/comic/1/chapter/27/images'})),['https://komiic.com/api/image/first','https://komiic.com/api/image/second'])
  assert.equal(requests.length,1);assert.equal(JSON.parse(requests[0].data).variables.chapterId,'27')
  await assert.rejects(rule.getImgs('',{url:'https://komiic.com/comic/1'}));assert.equal(requests.length,1)
})
test('Komiic fixture surfaces malformed responses without fabricating image URLs', async () => {
  for (const responseText of ['not-json','{}','{"data":{}}']) {
    const rule=loadAdapters({downloads:{WY:async()=>({responseText})}}).rules.find(rule=>rule.domain==='komiic.com')
    await assert.rejects(rule.getImgs('',{url:'https://komiic.com/chapter/27/images'}))
  }
})
test('Baozi fixture merges paginated images, removes duplicate URLs and retains signatures', async () => {
  const requested=[], next='https://www.baozimh.com/reader/next'
  const first='https://img.test/1.jpg?token=a%2Fb&n=1', second='https://img.test/2.webp?token=z'
  const rule=loadAdapters({downloads:{WY:async(method,url)=>{requested.push([method,url]);return{responseText:`<img src="${first}">\n<img src="${second}">`}}}}).rules.find(rule=>rule.webName==='包子漫画')
  const result=await rule.getImgs(`<img src="${first}">\n<div class="next_chapter"><a href="${next}">点击进入下一页</a></div>`,{})
  assert.deepEqual(plain(result),[first,second]);assert.deepEqual(requested,[['get',next]])
  assert.deepEqual(plain(await rule.getImgs('<html>no images</html>',{})),[])
})
