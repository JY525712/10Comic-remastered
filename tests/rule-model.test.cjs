const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {test}=require('node:test')
const acorn=require('acorn')
const file=path.resolve(__dirname,'../src/userscript/modules/rule-model.js')
function model(){assert.ok(fs.existsSync(file),'missing shared rule model');let id=0;return require(file)({parse:acorn.parse,createId:()=>`rule-${++id}`,now:()=>1000,validateSelector:selector=>{if(selector==='[')throw new Error('invalid selector')}})}
const basic=()=>({webName:'示例',domain:'example.com',comicNameCss:'h1',chapterCss:'.chapters',imageCss:'.reader img'})
test('legacy rules get stable metadata without losing their existing parser fields',()=>{
  const m=model(),raw=[{...basic(),getImgs:'async function(){return []}',customData:{x:1}}]
  const first=m.migrate(raw),second=m.migrate(raw)
  assert.equal(first[0].id,second[0].id);assert.equal(first[0].enabled,true);assert.equal(first[0].version,1);assert.equal(first[0].getImgs,raw[0].getImgs);assert.deepEqual(first[0].customData,{x:1})
})
test('validation is shared across fields and function checks never execute supplied code',()=>{
  const m=model();global.__ruleProbe=0
  const valid=m.validate({...basic(),getImgs:'async function(){globalThis.__ruleProbe++;return []}'})
  assert.equal(valid.errors.length,0);assert.equal(global.__ruleProbe,0)
  const invoked=m.validate({...basic(),getImgs:'function(){globalThis.__ruleProbe++;return []}()'})
  assert.ok(invoked.errors.some(e=>e.field==='getImgs'));assert.equal(global.__ruleProbe,0)
  assert.ok(m.validate({...basic(),getImgs:'function(){with({}){}}'}).errors.some(e=>e.field==='getImgs'))
  for(const field of ['comicNameCss','chapterCss','imageCss'])assert.ok(m.validate({...basic(),[field]:'['}).errors.some(e=>e.field===field))
  delete global.__ruleProbe
})
test('safe JSON import rejects executable object syntax without running it',()=>{
  const m=model();global.__ruleProbe=0
  assert.throws(()=>m.parseJSON('(()=>{globalThis.__ruleProbe++;return []})()'))
  assert.equal(global.__ruleProbe,0)
  assert.equal(m.parseJSON(JSON.stringify([basic()])).length,1)
  delete global.__ruleProbe
})
test('matching explains precedence, explicit custom preference and disabled rules',()=>{
  const m=model(),builtins=[{...basic(),webName:'内置'}]
  const custom=m.migrate([{...basic(),webName:'自定义',getImgs:'function(){return []}'}])
  assert.equal(m.resolve('https://example.com/book',builtins,custom).selected.webName,'内置')
  custom[0].preferCustom=true;assert.equal(m.resolve('https://example.com/book',builtins,custom).selected.webName,'自定义')
  custom[0].enabled=false;assert.equal(m.resolve('https://example.com/book',builtins,custom).selected.webName,'内置')
  assert.equal(m.resolve('https://notexample.com/',builtins,custom).selected,null)
})
test('import preview distinguishes duplicates, overlapping domains, invalid records and new sites',()=>{
  const m=model(),existing=m.migrate([{...basic(),getImgs:'function(){return []}'}])
  const rows=m.previewImport([existing[0],{...basic(),webName:'修改',imageCss:'.pages img'},{...basic(),domain:''},{...basic(),domain:'other.test'}],existing)
  assert.deepEqual(rows.map(r=>r.kind),['duplicate','conflict','invalid','new'])
  assert.equal(rows[0].action,'skip');assert.equal(rows[3].action,'add')
  assert.deepEqual(m.previewImport([basic(),basic()],[]).map(row=>row.kind),['new','duplicate'])
  const batch=m.previewImport([basic(),{...basic(),webName:'另一规则',imageCss:'.pages img'}],[])
  assert.deepEqual(batch.map(row=>[row.kind,row.action]),[['new','add'],['conflict','skip']])
})
test('optional common parser settings normalize and validate without disabling advanced functions',()=>{
  const m=model()
  const result=m.validate({...basic(),readySelector:'.loaded',waitTimeoutMs:5000,imageAttributes:['data-original','src'],imageExcludeCss:'.ad',chapterUrlIncludes:'/chapter/'})
  assert.equal(result.errors.length,0);assert.deepEqual(result.rule.imageAttributes,['data-original','src'])
  assert.ok(m.validate({...basic(),waitTimeoutMs:0}).errors.length)
  assert.ok(m.validate({...basic(),imageExcludeCss:'['}).errors.some(e=>e.field==='imageExcludeCss'))
})

test('regex differences remain conflicts instead of collapsing into duplicates',()=>{
 const m=model(),first={...basic(),chapterNameReg:/chapter-(\d+)/i},second={...first,chapterNameReg:/episode-(\d+)/i}
 assert.equal(m.previewImport([second],m.migrate([first]))[0].kind,'conflict')
})

test('rule JSON preserves regular expressions and function text across a round trip',()=>{
 const m=model(),rule={...basic(),chapterNameReg:/chapter-(\d+)/i,getImgs:async function(){return []}}
 const encoded=m.serialize([rule]),decoded=m.parseJSON(encoded)[0]
 assert.equal(decoded.chapterNameReg.source,rule.chapterNameReg.source);assert.equal(decoded.chapterNameReg.flags,'i');assert.equal(typeof decoded.getImgs,'string')
 const collision={$tenComicValue:1,type:'RegExp',source:'ordinary object',flags:'i'}
 assert.deepEqual(m.parseJSON(m.serialize([{...basic(),customData:collision}]))[0].customData,collision)
 assert.ok(m.validate({...basic(),chapterNameReg:{}}).errors.some(error=>error.field==='chapterNameReg'))
})
