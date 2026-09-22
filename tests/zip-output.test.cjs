const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(process.env.USERSCRIPT_PATH||path.resolve(__dirname,"../10漫画—重制版.user.js"),"utf8");
const start=source.indexOf("async makeZip(e){");
const end=source.indexOf("}async combineImages(e){",start);
assert.notEqual(start,-1,"ZIP 输出方法不存在");
assert.notEqual(end,-1,"无法定位 ZIP 输出方法结尾");
const makeZipSource=source.slice(start,end+1);

let streamAvailable=true;
let activeEntry=null;
const Queue=vm.runInNewContext(`(class Queue{${makeZipSource}})`,{
  n:{pN:value=>String(value).trim(),zM:async(name,entries,digits,onProgress)=>{assert.equal(name,"漫画\\章节.zip");assert.equal(entries[0],activeEntry);assert.equal(digits,3);if(!streamAvailable)return false;activeEntry.blob=null;onProgress(1,1);return true}},
  i:async()=>{},Blob
});

(async()=>{
  const queue=new Queue();
  const stages=[];
  queue.imgIndexBitNum=3;
  queue.worker=[{comicName:"漫画",downChapterName:"章节",stage:""}];
  activeEntry={imgIndex:1,suffix:"webp",blob:new Blob(["image"],{type:"image/webp"}),imgurl:"https://img.test/1.webp"};
  queue.workerDownInfo=[[activeEntry]];
  queue.assertActive=index=>queue.worker[index];
  queue.setStage=(index,stage)=>{queue.worker[index].stage=stage};
  queue.refresh=()=>{stages.push(queue.worker[0].stage)};
  queue.waitUntilRunnable=async()=>{};
  await queue.makeZip(0);
  assert.ok(stages.includes("正在打包 1/1"));
  streamAvailable=false;
  const noDirectoryQueue=new Queue();
  noDirectoryQueue.imgIndexBitNum=3;
  noDirectoryQueue.worker=[{comicName:"漫画",downChapterName:"章节",stage:""}];
  activeEntry={imgIndex:1,suffix:"webp",blob:new Blob(["image"],{type:"image/webp"}),imgurl:"https://img.test/1.webp"};
  noDirectoryQueue.workerDownInfo=[[activeEntry]];
  noDirectoryQueue.assertActive=index=>noDirectoryQueue.worker[index];
  noDirectoryQueue.setStage=(index,stage)=>{noDirectoryQueue.worker[index].stage=stage};
  noDirectoryQueue.refresh=()=>{};
  noDirectoryQueue.waitUntilRunnable=async()=>{};
  await assert.rejects(()=>noDirectoryQueue.makeZip(0),/压缩下载需要先选择保存目录/);
  console.log("PASS ZIP output streams pre-compressed images into selected directory");
})().catch(error=>{console.error(error);process.exitCode=1});
