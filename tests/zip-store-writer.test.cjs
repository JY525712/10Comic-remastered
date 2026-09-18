const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(process.env.USERSCRIPT_PATH||path.resolve(__dirname,"../10漫画—重制版.user.js"),"utf8");
const start=source.indexOf("async function writeStoreZipToDirectoryV2");
assert.notEqual(start,-1,"缺少原生 STORE ZIP 写入器");
const bodyStart=source.indexOf("{",start);
let depth=0,end=-1;
for(let index=bodyStart;index<source.length;index++){
  if(source[index]==="{")depth++;
  else if(source[index]==="}"&&--depth===0){end=index+1;break}
}
assert.notEqual(end,-1,"无法定位原生 STORE ZIP 写入器结尾");

const chunks=[];
let cancelController=null,aborted=false,closed=false;
const file={async createWritable(){return{async write(blob){assert.ok(blob instanceof Blob);chunks.push(new Uint8Array(await blob.arrayBuffer()));if(cancelController)cancelController.abort()},async close(){closed=true},async abort(){aborted=true}}}};
const leaf={async getFileHandle(name,options){assert.equal(name,"chapter.zip");assert.equal(options.create,true);return file}};
const root={async getDirectoryHandle(name,options){assert.equal(name,"10Comic");assert.equal(options.create,true);return leaf}};
const writer=vm.runInNewContext(`(()=>{${source.slice(start,end)};return writeStoreZipToDirectoryV2})()`,{Promise,Uint8Array,ArrayBuffer,DataView,Blob,TextEncoder,Error,getDirectoryHandle:async()=>root,sanitizeDownloadPath:value=>value,addZeroForNum:(value,digits)=>String(value).padStart(digits,"0"),delay:async()=>{}});

const entries=[
  {imgIndex:1,suffix:"webp",blob:new Blob(["abc"],{type:"image/webp"}),imgurl:"1"},
  {imgIndex:2,suffix:"jpg",blob:new Blob(["defg"],{type:"image/jpeg"}),imgurl:"2"}
];

(async()=>{
  const progress=[];
  const result=await writer("10Comic\\chapter.zip",entries,3,(current,total)=>progress.push([current,total]),null);
  assert.equal(result,true);
  assert.equal(entries[0].blob,null);
  assert.equal(entries[1].blob,null);
  const size=chunks.reduce((sum,chunk)=>sum+chunk.length,0);
  const archive=new Uint8Array(size);let offset=0;for(const chunk of chunks){archive.set(chunk,offset);offset+=chunk.length}
  const view=new DataView(archive.buffer);
  assert.equal(view.getUint32(0,true),0x04034b50);
  const firstNameLength=view.getUint16(26,true);
  const firstName=new TextDecoder().decode(archive.slice(30,30+firstNameLength));
  assert.equal(firstName,"001.webp");
  assert.equal(view.getUint32(14,true),0x352441c2,"首文件 CRC32 应匹配 abc");
  const firstSize=view.getUint32(18,true);
  assert.equal(new TextDecoder().decode(archive.slice(30+firstNameLength,30+firstNameLength+firstSize)),"abc");
  const endOffset=archive.length-22;
  assert.equal(view.getUint32(endOffset,true),0x06054b50);
  assert.equal(view.getUint16(endOffset+10,true),2);
  const centralSize=view.getUint32(endOffset+12,true),centralOffset=view.getUint32(endOffset+16,true);
  assert.equal(centralOffset+centralSize,endOffset);
  assert.equal(view.getUint32(centralOffset,true),0x02014b50);
  assert.equal(view.getUint32(centralOffset+42,true),0,"首个中央目录项应指向首个本地文件头");
  assert.deepEqual(progress,[[1,2],[2,2]]);
  chunks.length=0;aborted=false;closed=false;
  await assert.rejects(()=>writer("10Comic\\chapter.zip",new Array(0xffff),3,()=>{},null),/ZIP 文件数量超过格式限制/);
  assert.equal(aborted,true);
  assert.equal(closed,false);
  chunks.length=0;aborted=false;closed=false;cancelController=new AbortController();
  const cancelledEntries=[{imgIndex:1,suffix:"webp",blob:new Blob(["cancel"],{type:"image/webp"}),imgurl:"1"}];
  await assert.rejects(()=>writer("10Comic\\chapter.zip",cancelledEntries,3,()=>{},cancelController.signal),/下载已取消/);
  assert.equal(aborted,true);
  assert.equal(closed,false);
  console.log("PASS native STORE ZIP writer creates a non-empty ordered archive");
})().catch(error=>{console.error(error);process.exitCode=1});
