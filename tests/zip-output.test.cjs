const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(path.resolve(__dirname,"../src/userscript/modules/queue.js"),"utf8");

let streamAvailable=true;
let activeEntry=null;
const Queue=vm.runInNewContext(`${source};module.exports`,{
  module:{exports:{}},
  downloadUtils:{pN:value=>String(value).trim(),zM:async(name,entries,digits,onProgress)=>{assert.equal(name,"漫画\\章节.zip");assert.equal(entries[0],activeEntry);assert.equal(digits,3);if(!streamAvailable)return false;activeEntry.blob=null;onProgress(1,1);return true}},
  yieldToBrowser:async()=>{},Blob
});

(async()=>{
  const queue=new Queue(1,1,3,null);
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
  const noDirectoryQueue=new Queue(1,1,3,null);
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
