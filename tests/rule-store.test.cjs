const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {test}=require('node:test')
const acorn=require('acorn')
const createModel=require('../src/userscript/modules/rule-model.js')
const storeFile=path.resolve(__dirname,'../src/userscript/modules/rule-store.js')
function setup(){
  assert.ok(fs.existsSync(storeFile),'missing rule repository')
  let id=0,failKey='';const data=new Map()
  const model=createModel({parse:acorn.parse,createId:()=>`rule-${++id}`})
  const Store=require(storeFile)
  const storage={get:key=>structuredClone(data.get(key)),set:(key,value)=>{if(key===failKey)throw new Error('quota');data.set(key,structuredClone(value))},remove:key=>data.delete(key),keys:()=>[...data.keys()]}
  return{model,data,store:new Store(storage,model),fail:key=>{failKey=key}}
}
const rule=name=>({webName:name,domain:name+'.test',homepage:'https://'+name+'.test/',imageCss:'img',simpleRule:true})
test('ID-based editing keeps the target stable when another rule is inserted',()=>{
  const s=setup();const saved=s.store.save(rule('one'))
  s.store.save(rule('two'))
  s.store.save({...saved,webName:'edited'},{id:saved.id,baseVersion:saved.version})
  assert.equal(s.store.read().find(r=>r.id===saved.id).webName,'edited');assert.equal(s.store.read().length,2)
})
test('stale edits are rejected and previous values remain available as recovery points',()=>{
  const s=setup();const first=s.store.save(rule('one'))
  s.store.save({...first,webName:'new'},{id:first.id,baseVersion:first.version})
  assert.throws(()=>s.store.save({...first,webName:'stale'},{id:first.id,baseVersion:first.version}),/修改|版本|冲突/)
  const entry=s.store.history()[0];s.store.restore(entry.id)
  assert.equal(s.store.read()[0].webName,'one');assert.ok(s.store.read()[0].version>first.version)
})
test('failed journal or primary writes never silently discard the existing rules',()=>{
  const s=setup();s.store.save(rule('one'))
  s.fail('tenComic.ruleHistory.v1');assert.throws(()=>s.store.save(rule('two')),/quota/);assert.equal(s.store.read().length,1)
  s.fail('userWebInfo');assert.throws(()=>s.store.save(rule('two')),/quota/);assert.equal(s.store.read()[0].webName,'one')
})
test('import decisions preserve IDs on replacement and reject stale previews',()=>{
  const s=setup(),old=s.store.save(rule('one')),stamp=s.store.stamp()
  const rows=s.model.previewImport([{...rule('one'),webName:'replacement'},rule('two')],s.store.read())
  rows[0].action='replace';rows[0].targetId=old.id
  s.store.applyImport(rows,stamp)
  assert.equal(s.store.read().length,2);assert.equal(s.store.read().find(r=>r.id===old.id).webName,'replacement')
  assert.throws(()=>s.store.applyImport(rows,stamp),/变化|过期|重新/)
})
test('drafts and template fields survive storage and snapshots stay bounded',()=>{
  const s=setup();s.store.saveDraft('draft-1',{host:'one.test',fields:{webName:'草稿',getImgs:'function(){return []}'},updatedAt:1})
  assert.equal(s.store.drafts('one.test')[0].fields.webName,'草稿');assert.equal(s.store.drafts('other.test').length,0)
  s.store.removeDraft('draft-1');assert.equal(s.store.drafts('one.test').length,0)
  for(let n=0;n<24;n++)s.store.save(rule('entry'+n))
  assert.ok(s.store.history().length<=20)
})
