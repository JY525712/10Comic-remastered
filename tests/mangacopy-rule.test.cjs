const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const source=fs.readFileSync(process.env.USERSCRIPT_PATH||path.resolve(__dirname,"../10漫画—重制版.user.js"),"utf8");
const start=source.indexOf('{domain:["mangacopy.com","www.mangacopy.com"]');
assert.notEqual(start,-1,"拷贝漫画内置规则不存在");
const end=source.indexOf('},{domain:"ridibooks.com"',start);
assert.notEqual(end,-1,"无法定位拷贝漫画规则结尾");

const chapters=[
  {textContent:"開始閱讀",getAttribute:n=>n==="href"?"/comic/test/chapter/one":null,closest:s=>s===".comicParticulars-botton"?{}:null},
  {textContent:"第01話",getAttribute:n=>n==="href"?"/comic/test/chapter/one":null,closest:()=>null},
  {textContent:"第01話",getAttribute:n=>n==="href"?"/comic/test/chapter/one":null,closest:()=>null},
  {textContent:"第02話",getAttribute:n=>n==="href"?"/comic/test/chapter/two":null,closest:()=>null}
];
let frameStep=0;
const pageImages=[
  {getAttribute:n=>n==="data-src"?"https://sb.example/1.webp":null},
  {getAttribute:n=>n==="data-src"?"https://sb.example/2.webp":null},
  {getAttribute:n=>n==="data-src"?"https://s3.example/loading.jpg":null},
  {getAttribute:n=>n==="data-src"?"https://sb.example/3.webp":null},
  {getAttribute:n=>n==="data-src"?"https://sb.example/4.webp":null}
];
const frameDoc={
  documentElement:{scrollHeight:5000},body:{scrollHeight:5000},
  querySelectorAll:s=>{assert.equal(s,'.comicContent-list img[data-src]');return pageImages.slice(0,frameStep<2?3:5)}
};
const frameWin={innerHeight:900,scrollY:0,scrollBy:()=>{frameStep++;frameWin.scrollY+=2000}};
const frame={style:{},contentDocument:frameDoc,contentWindow:frameWin,remove(){}};
const ctx={
  URL,Date,Math,
  location:{origin:"https://www.mangacopy.com"},
  document:{querySelector:s=>(assert.equal(s,"h6"),{textContent:"测试漫画"}),querySelectorAll:s=>(assert.equal(s,'a[href*="/chapter/"]'),chapters),getElementById:id=>(assert.equal(id,"frame-1"),frame)},
  downloadUtils:{gw:async()=>{}},
  setTimeout,clearTimeout
};
const rule=vm.runInNewContext(`(${source.slice(start,end+1)})`,ctx);
(async()=>{
  assert.equal(rule.webName,"拷贝漫画");
  assert.equal(rule.useFrame,true);
  assert.deepEqual(JSON.parse(JSON.stringify(await rule.getComicInfo.call(rule))),[
    {comicName:"测试漫画",chapterName:"第01話",chapterNumStr:"",url:"https://www.mangacopy.com/comic/test/chapter/one",readtype:1,isPay:false,isSelect:false},
    {comicName:"测试漫画",chapterName:"第02話",chapterNumStr:"",url:"https://www.mangacopy.com/comic/test/chapter/two",readtype:1,isPay:false,isSelect:false}
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(await rule.getImgs.call(rule,"",{frameId:"frame-1",url:"https://www.mangacopy.com/comic/test/chapter/one"}))),["https://sb.example/1.webp","https://sb.example/2.webp","https://sb.example/3.webp","https://sb.example/4.webp"]);
  assert.ok(frameStep>=2,"规则应通过滚动触发懒加载");
  console.log("PASS 拷贝漫画目录解析与懒加载阅读页处理");
})().catch(error=>{console.error(error);process.exitCode=1});
