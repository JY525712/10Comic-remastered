// ==UserScript==
// @name         10漫画—重制版
// @namespace    urn:10comic:remastered
// @version      2.0.14
// @description  漫画章节下载、搜索与自定义规则工具（液体玻璃 UI 重制版）
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_setClipboard
// @grant        GM_info
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        unsafeWindow
// @license      GPLv3
// @match        *://*/*
// @connect      *
// @noframes
// ==/UserScript==

/* HIPMH_READER_WORKER_START */
(()=>{
  const prefix="tenComicHipmhWorker:";
  if(location.hostname!=="reader.hipmh.top")return;
  const match=String(location.hash||"").match(/(?:^#|&)tencomic-task=([^&]+)/);
  if(!match)return;
  const taskId=match[1];
  const key=prefix+taskId;
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  const run=async()=>{
    try{
      const initial=GM_getValue(key,null);
      if(!initial||initial.id!==taskId||initial.cancelled)return;
      const deadline=Date.now()+12e4;
      while(Date.now()<deadline){
        const record=GM_getValue(key,null);
        if(!record||record.id!==taskId||record.cancelled)return;
        const root=document.getElementById("chapcontent");
        if(root){
          const total=Math.max(0,Number(root.getAttribute("data-total-images"))||0);
          const images=[...new Set([...root.querySelectorAll(".chapter-image[data-src]")]
            .map(image=>String(image.getAttribute("data-src")||"").trim())
            .filter(url=>/^https:\/\//i.test(url)))];
          if(images.length&&(!total||images.length>=total)){
            GM_setValue(key,{...record,status:"ready",images,updatedAt:Date.now()});
            return;
          }
        }
        await wait(250);
      }
      const record=GM_getValue(key,null);
      record&&GM_setValue(key,{...record,status:"error",error:"HipMH 阅读页图片加载超时",updatedAt:Date.now()});
    }catch(error){
      const record=GM_getValue(key,null);
      record&&GM_setValue(key,{...record,status:"error",error:String(error&&error.message||error||"HipMH 阅读页处理失败"),updatedAt:Date.now()});
    }finally{
      try{window.close()}catch(error){}
    }
  };
  const start=()=>{window.__tenComicHipmhWorkerPromise=run()};
  "loading"===document.readyState?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();
/* HIPMH_READER_WORKER_END */

/* MANHUAGUI_READER_WORKER_START */
(()=>{
  if(!/^(?:www\.)?manhuagui\.com$/i.test(location.hostname)||!/^\/comic\/\d+\/\d+\.html$/i.test(location.pathname))return;
  const match=String(location.hash||"").match(/(?:^#|&)tencomic-mg-task=([^&]+)/);
  if(!match)return;
  const taskId=match[1],key="tenComicManhuaguiWorker:"+taskId;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const run=async()=>{
    try{
      const initial=GM_getValue(key,null);
      if(!initial||initial.id!==taskId||initial.cancelled)return;
      const expected=new URL(initial.readerUrl);
      if(expected.origin!==location.origin||expected.pathname!==location.pathname)return;
      const deadline=Date.now()+180000;
      let select=null;
      while(Date.now()<deadline){
        const record=GM_getValue(key,null);
        if(!record||record.cancelled)return;
        select=document.querySelector("#pageSelect");
        if(select&&select.options.length&&document.querySelector("#mangaFile"))break;
        await wait(100);
      }
      if(!select||!select.options.length)throw new Error("Manhuagui page selector did not load");
      const total=select.options.length,images=[];
      for(let page=1;page<=total;page++){
        if(Date.now()>=deadline)throw new Error("Manhuagui reader timed out");
        const record=GM_getValue(key,null);
        if(!record||record.cancelled)return;
        if(select.value!==String(page)){
          select.value=String(page);
          select.dispatchEvent(new Event("input",{bubbles:true}));
          select.dispatchEvent(new Event("change",{bubbles:true}));
        }
        let found="";
        for(let attempt=0;attempt<80;attempt++){
          const src=String(document.querySelector("#mangaFile")?.getAttribute("src")||"");
          if(/^https?:\/\//i.test(src)&&src!==images[images.length-1]){found=src;break}
          await wait(100);
        }
        if(!found)throw new Error("Manhuagui image page "+page+" timed out");
        images.push(found);
      }
      const record=GM_getValue(key,null);
      if(record&&!record.cancelled)GM_setValue(key,{...record,status:"ready",images,updatedAt:Date.now()});
    }catch(error){
      const record=GM_getValue(key,null);
      if(record)GM_setValue(key,{...record,status:"error",error:String(error?.message||error),updatedAt:Date.now()});
    }finally{try{window.close()}catch(error){}}
  };
  const start=()=>{window.__tenComicManhuaguiWorkerPromise=run()};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();
/* MANHUAGUI_READER_WORKER_END */

/* KAKAOPAGE_READER_WORKER_START */
(()=>{
  const prefix="tenComicKakaoWorker:";
  if(location.hostname!=="page.kakao.com"||!/\/viewer\//.test(location.pathname))return;
  const match=String(location.hash||"").match(/(?:^#|&)tencomic-kakao-task=([^&]+)/);
  if(!match)return;
  const taskId=match[1];
  const key=prefix+taskId;
  const task=GM_getValue(key,null);
  if(!task||task.id!==taskId||task.cancelled||!String(task.readerUrl||"").includes(location.pathname))return;

  // The response-observation pattern is adapted from the GPL-3.0-only
  // "KakaoPage Downloader" userscript by ozler365. No request or unlock is forged.
  const findImageData=(value,depth=0)=>{
    if(!value||"object"!==typeof value||depth>8)return null;
    if(value.imageDownloadData&&Array.isArray(value.imageDownloadData.files))return value.imageDownloadData;
    for(const child of Object.values(value)){
      const found=findImageData(child,depth+1);
      if(found)return found;
    }
    return null;
  };
  let timeoutId=null;
  const publish=value=>{
    const record=GM_getValue(key,null);
    if(!record||record.id!==taskId||record.cancelled||record.status!=="waiting")return;
    const imageData=findImageData(value);
    if(!imageData)return;
    const ordered=imageData.files.map((file,index)=>({
      url:String(file&&(
        file.secureUrl||file.url||file.imageUrl
      )||"").trim(),
      order:Number(file&&(file.no??file.order??file.sortOrder))||index+1,
    })).filter(item=>/^https:\/\//i.test(item.url)).sort((a,b)=>a.order-b.order);
    const images=[...new Set(ordered.map(item=>item.url))];
    if(!images.length)return;
    timeoutId&&clearTimeout(timeoutId);
    GM_setValue(key,{...record,status:"ready",images,title:String(imageData.title||"KakaoPage 章节").trim(),updatedAt:Date.now()});
  };
  const parseAndPublish=text=>{
    if(!String(text||"").includes("imageDownloadData"))return;
    try{publish(JSON.parse(text))}catch(error){}
  };

  if("undefined"!==typeof XMLHttpRequest&&XMLHttpRequest.prototype){
    const originalOpen=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(){
      this.addEventListener("load",()=>{
        try{parseAndPublish(this.responseText)}catch(error){}
      });
      return originalOpen.apply(this,arguments);
    };
  }
  if("function"===typeof window.fetch){
    const originalFetch=window.fetch;
    window.fetch=function(...args){
      return originalFetch.apply(this,args).then(response=>{
        try{
          const clone=response.clone();
          clone.text().then(parseAndPublish).catch(()=>{});
        }catch(error){}
        return response;
      });
    };
  }
  timeoutId=setTimeout(()=>{
    const record=GM_getValue(key,null);
    record&&record.id===taskId&&record.status==="waiting"&&GM_setValue(key,{...record,status:"error",error:"KakaoPage 阅读器未返回可下载图片；请确认章节免费或当前账号已有访问权限",updatedAt:Date.now()});
  },9e4);
})();
/* KAKAOPAGE_READER_WORKER_END */

/* RIDIBOOKS_READER_WORKER_START */
(()=>{
  const prefix="tenComicRidiWorker:";
  if(location.hostname!=="ridibooks.com")return;
  const match=String(location.hash||"").match(/(?:^#|&)tencomic-ridi-task=([^&]+)/);
  if(!match)return;
  const taskId=match[1],key=prefix+taskId,task=GM_getValue(key,null);
  if(!task||task.id!==taskId||task.cancelled||!String(task.readerUrl||"").includes(location.pathname))return;

  // Independently implemented from the response-observation concept documented
  // by ozler365's Ridibooks Comic Ripper; no DRM, cookie, or unlock mechanism is used.
  let timeoutId=null;
  const publish=data=>{
    const record=GM_getValue(key,null);
    if(!record||record.id!==taskId||record.cancelled||record.status!=="waiting")return;
    const pages=data&&data.data&&Array.isArray(data.data.pages)?data.data.pages:[];
    const images=[...new Set(pages.map(page=>{
      if("string"===typeof page)return page;
      return page&&("string"===typeof page.src?page.src:"string"===typeof page.url?page.url:"string"===typeof page.image?page.image:"");
    }).filter(url=>/^https:\/\//i.test(String(url))))];
    if(!images.length)return;
    timeoutId&&clearTimeout(timeoutId);
    GM_setValue(key,{...record,status:"ready",images,title:String(data.data.book_title||"RidiBooks 章节").trim(),updatedAt:Date.now()});
  };
  const parseAndPublish=text=>{
    try{String(text||"").includes("pages")&&publish(JSON.parse(text))}catch(error){}
  };
  if("undefined"!==typeof XMLHttpRequest&&XMLHttpRequest.prototype){
    const originalOpen=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url){
      this.addEventListener("load",()=>{
        try{String(url||"").includes("generate")&&parseAndPublish(this.responseText)}catch(error){}
      });
      return originalOpen.apply(this,arguments);
    };
  }
  if("function"===typeof window.fetch){
    const originalFetch=window.fetch;
    window.fetch=function(...args){
      return originalFetch.apply(this,args).then(response=>{
        try{
          const url="string"===typeof args[0]?args[0]:args[0]&&args[0].url;
          String(url||"").includes("generate")&&response.clone().json().then(publish).catch(()=>{});
        }catch(error){}
        return response;
      });
    };
  }
  timeoutId=setTimeout(()=>{
    const record=GM_getValue(key,null);
    record&&record.id===taskId&&record.status==="waiting"&&GM_setValue(key,{...record,status:"error",error:"RidiBooks 阅读器未返回可下载图片；请确认章节免费或当前账号已有访问权限",updatedAt:Date.now()});
  },9e4);
})();
/* RIDIBOOKS_READER_WORKER_END */

/*! Acorn 8.18.0 — MIT
MIT License

Copyright (C) 2012-2022 by various contributors (see AUTHORS)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
function __tenComicRuleSyntax(){if(!__tenComicRuleSyntax.parser){const i={exports:{}},s=i.exports;t=this,e=function(t){"use strict"
;var e=[509,0,227,0,150,4,294,9,1368,2,2,1,6,3,41,2,5,0,166,1,574,3,9,9,7,9,32,4,318,1,78,5,71,10,50,3,123,2,54,14,32,10,3,1,11,3,46,10,8,0,46,9,7,2,37,13,2,9,6,1,45,0,13,2,49,13,9,3,2,11,83,11,7,0,3,0,158,11,6,9,7,3,56,1,2,6,3,1,3,2,10,0,11,1,3,6,4,4,68,8,2,0,3,0,2,3,2,4,2,0,15,1,83,17,10,9,5,0,82,19,13,9,214,6,3,8,28,1,83,16,16,9,82,12,9,9,7,19,58,14,5,9,243,14,166,9,71,5,2,1,3,3,2,0,2,1,13,9,120,6,3,6,4,0,29,9,41,6,2,3,9,0,10,10,47,15,199,7,137,9,54,7,2,7,17,9,57,21,2,13,123,5,4,0,2,1,2,6,2,0,9,9,49,4,2,1,2,4,9,9,55,9,266,3,10,1,2,0,49,6,4,4,14,10,5350,0,7,14,11465,27,2343,9,87,9,39,4,60,6,26,9,535,9,470,0,2,54,8,3,82,0,12,1,19628,1,4178,9,519,45,3,22,543,4,4,5,9,7,3,6,31,3,149,2,1418,49,513,54,5,49,9,0,15,0,23,4,2,14,1361,6,2,16,3,6,2,1,2,4,101,0,161,6,10,9,357,0,62,13,499,13,245,1,2,9,233,0,3,0,8,1,6,0,475,6,110,6,6,9,4759,9,787719,239],i=[0,11,2,25,2,18,2,1,2,14,3,13,35,122,70,52,268,28,4,48,48,31,14,29,6,37,11,29,3,35,5,7,2,4,43,157,19,35,5,35,5,39,9,51,13,10,2,14,2,6,2,1,2,10,2,14,2,6,2,1,4,51,13,310,10,21,11,7,25,5,2,41,2,8,70,5,3,0,2,43,2,1,4,0,3,22,11,22,10,30,66,18,2,1,11,21,11,25,7,25,39,55,7,1,65,0,16,3,2,2,2,28,43,28,4,28,36,7,2,27,28,53,11,21,11,18,14,17,111,72,56,50,14,50,14,35,39,27,10,22,251,41,7,1,17,5,57,28,11,0,9,21,43,17,47,20,28,22,13,52,58,1,3,0,14,44,33,24,27,35,30,0,3,0,9,34,4,0,13,47,15,3,22,0,2,0,36,17,2,24,20,1,64,6,2,0,2,3,2,14,2,9,8,46,39,7,3,1,3,21,2,6,2,1,2,4,4,0,19,0,13,4,31,9,2,0,3,0,2,37,2,0,26,0,2,0,45,52,19,3,21,2,31,47,21,1,2,0,185,46,42,3,37,47,21,0,60,42,14,0,72,26,38,6,186,43,117,63,32,7,3,0,3,7,2,1,2,23,16,0,2,0,95,7,3,38,17,0,2,0,29,0,11,39,8,0,22,0,12,45,20,0,19,72,200,32,32,8,2,36,18,0,50,29,113,6,2,1,2,37,22,0,26,5,2,1,2,31,15,0,24,43,261,18,16,0,2,12,2,33,125,0,80,921,103,110,18,195,2637,96,16,1071,18,5,26,3994,6,582,6842,29,1763,568,8,30,18,78,18,29,19,47,17,3,32,20,6,18,433,44,212,63,33,24,3,24,45,74,6,0,67,12,65,1,2,0,15,4,10,7381,42,31,98,114,8702,3,2,6,2,1,2,290,16,0,30,2,3,0,15,3,9,395,2309,106,6,12,4,8,8,9,5991,84,2,70,2,1,3,0,3,1,3,3,2,11,2,0,2,6,2,64,2,3,3,7,2,6,2,27,2,3,2,4,2,0,4,6,2,339,3,24,2,24,2,30,2,24,2,30,2,24,2,30,2,24,2,30,2,24,2,7,1845,30,7,5,262,61,147,44,11,6,17,0,322,29,19,43,485,27,229,29,3,0,208,30,2,2,2,1,2,6,3,4,10,1,225,6,2,3,2,1,2,14,2,196,60,67,8,0,1205,3,2,26,2,1,2,0,3,0,2,9,2,3,2,0,2,0,7,0,5,0,2,0,2,0,2,2,2,1,2,0,3,0,2,0,2,0,2,0,2,0,2,1,2,0,3,3,2,6,2,3,2,3,2,0,2,9,2,16,6,2,2,4,2,16,4421,42719,33,4381,3,5773,3,7472,16,621,2467,541,1507,4938,6,8489],s="ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙՠ-ֈא-תׯ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࡠ-ࡪࡰ-ࢇࢉ-࢏ࢠ-ࣉऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱৼਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡૹଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘ-ౚ౜ౝౠౡಀಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ೜-ೞೠೡೱೲഄ-ഌഎ-ഐഒ-ഺഽൎൔ-ൖൟ-ൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄຆ-ຊຌ-ຣລວ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜑᜟ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡸᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭌᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᲀ-ᲊᲐ-ᲺᲽ-Ჿᳩ-ᳬᳮ-ᳳᳵᳶᳺᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ℘-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ゛-ゟァ-ヺー-ヿㄅ-ㄯㄱ-ㆎㆠ-ㆿㇰ-ㇿ㐀-䶿一-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-Ƛ꟱-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꣽꣾꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭩꭰ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ",r={
3:"abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
5:"class enum extends super const export import",6:"enum",strict:"implements interface let package private protected public static yield",
strictBind:"eval arguments"
},a="break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this",n={
5:a,"5module":a+" export import",6:a+" const class extends export import super"
},o=/^in(stanceof)?$/,h=new RegExp("["+s+"]"),p=new RegExp("["+s+"‌‍·̀-ͯ·҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߽߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࢗ-࢟࣊-ࣣ࣡-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯৾ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ૺ-૿ଁ-ଃ଼ା-ୄେୈୋ-୍୕-ୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఄ఼ా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ೳഀ-ഃ഻഼ാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ඁ-ඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ຼ່-໎໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟፩-፱ᜒ-᜕ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠏-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏᧐-᧚ᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᪿ-᫝᫠-᫫ᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭᳴᳷-᳹᷀-᷿‌‍‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯・꘠-꘩꙯ꙴ-꙽ꚞꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧ꠬ꢀꢁꢴ-ꣅ꣐-꣙꣠-꣱ꣿ-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-︯︳︴﹍-﹏０-９＿･]")
;function c(t,e){for(var i=65536,s=0;s<e.length;s+=2){if((i+=e[s])>t)return!1;if((i+=e[s+1])>=t)return!0}return!1}function u(t,e){
return t<65?36===t:t<91||(t<97?95===t:t<123||(t<=65535?t>=170&&h.test(String.fromCharCode(t)):!1!==e&&c(t,i)))}function l(t,s){
return t<48?36===t:t<58||!(t<65)&&(t<91||(t<97?95===t:t<123||(t<=65535?t>=170&&p.test(String.fromCharCode(t)):!1!==s&&(c(t,i)||c(t,e)))))}var d=function(t,e){
void 0===e&&(e={}),this.label=t,this.keyword=e.keyword,this.beforeExpr=!!e.beforeExpr,this.startsExpr=!!e.startsExpr,this.isLoop=!!e.isLoop,
this.isAssign=!!e.isAssign,this.prefix=!!e.prefix,this.postfix=!!e.postfix,this.binop=e.binop||null,this.updateContext=null};function f(t,e){return new d(t,{
beforeExpr:!0,binop:e})}var m={beforeExpr:!0},g={startsExpr:!0},x={};function v(t,e){return void 0===e&&(e={}),e.keyword=t,x[t]=new d(t,e)}var y={
num:new d("num",g),regexp:new d("regexp",g),string:new d("string",g),name:new d("name",g),privateId:new d("privateId",g),eof:new d("eof"),bracketL:new d("[",{
beforeExpr:!0,startsExpr:!0}),bracketR:new d("]"),braceL:new d("{",{beforeExpr:!0,startsExpr:!0}),braceR:new d("}"),parenL:new d("(",{beforeExpr:!0,
startsExpr:!0}),parenR:new d(")"),comma:new d(",",m),semi:new d(";",m),colon:new d(":",m),dot:new d("."),question:new d("?",m),questionDot:new d("?."),
arrow:new d("=>",m),template:new d("template"),invalidTemplate:new d("invalidTemplate"),ellipsis:new d("...",m),backQuote:new d("`",g),dollarBraceL:new d("${",{
beforeExpr:!0,startsExpr:!0}),eq:new d("=",{beforeExpr:!0,isAssign:!0}),assign:new d("_=",{beforeExpr:!0,isAssign:!0}),incDec:new d("++/--",{prefix:!0,
postfix:!0,startsExpr:!0}),prefix:new d("!/~",{beforeExpr:!0,prefix:!0,startsExpr:!0}),logicalOR:f("||",1),logicalAND:f("&&",2),bitwiseOR:f("|",3),
bitwiseXOR:f("^",4),bitwiseAND:f("&",5),equality:f("==/!=/===/!==",6),relational:f("</>/<=/>=",7),bitShift:f("<</>>/>>>",8),plusMin:new d("+/-",{beforeExpr:!0,
binop:9,prefix:!0,startsExpr:!0}),modulo:f("%",10),star:f("*",10),slash:f("/",10),starstar:new d("**",{beforeExpr:!0}),coalesce:f("??",1),_break:v("break"),
_case:v("case",m),_catch:v("catch"),_continue:v("continue"),_debugger:v("debugger"),_default:v("default",m),_do:v("do",{isLoop:!0,beforeExpr:!0}),
_else:v("else",m),_finally:v("finally"),_for:v("for",{isLoop:!0}),_function:v("function",g),_if:v("if"),_return:v("return",m),_switch:v("switch"),
_throw:v("throw",m),_try:v("try"),_var:v("var"),_const:v("const"),_while:v("while",{isLoop:!0}),_with:v("with"),_new:v("new",{beforeExpr:!0,startsExpr:!0}),
_this:v("this",g),_super:v("super",g),_class:v("class",g),_extends:v("extends",m),_export:v("export"),_import:v("import",g),_null:v("null",g),_true:v("true",g),
_false:v("false",g),_in:v("in",{beforeExpr:!0,binop:7}),_instanceof:v("instanceof",{beforeExpr:!0,binop:7}),_typeof:v("typeof",{beforeExpr:!0,prefix:!0,
startsExpr:!0}),_void:v("void",{beforeExpr:!0,prefix:!0,startsExpr:!0}),_delete:v("delete",{beforeExpr:!0,prefix:!0,startsExpr:!0})
},b=/\r\n?|\n|\u2028|\u2029/,_=new RegExp(b.source,"g");function k(t){return 10===t||13===t||8232===t||8233===t}function S(t,e,i){void 0===i&&(i=t.length)
;for(var s=e;s<i;s++){var r=t.charCodeAt(s);if(k(r))return s<i-1&&13===r&&10===t.charCodeAt(s+1)?s+2:s+1}return-1}
var C=/[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/,w=/(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g,E=Object.prototype,A=E.hasOwnProperty,I=E.toString,P=Object.hasOwn||function(t,e){
return A.call(t,e)},V=Array.isArray||function(t){return"[object Array]"===I.call(t)},N=Object.create(null);function T(t){
return N[t]||(N[t]=new RegExp("^(?:"+t.replace(/ /g,"|")+")$"))}function L(t){return t<=65535?String.fromCharCode(t):(t-=65536,
String.fromCharCode(55296+(t>>10),56320+(1023&t)))}var R=/(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/,D=function(t,e){
this.line=t,this.column=e};D.prototype.offset=function(t){return new D(this.line,this.column+t)};var O=function(t,e,i){this.start=e,this.end=i,
null!==t.sourceFile&&(this.source=t.sourceFile)};function B(t,e){for(var i=1,s=0;;){var r=S(t,s,e);if(r<0)return new D(i,e-s);++i,s=r}}var M={ecmaVersion:null,
sourceType:"script",strict:!1,onInsertedSemicolon:null,onTrailingComma:null,allowReserved:null,allowReturnOutsideFunction:!1,allowImportExportEverywhere:!1,
allowAwaitOutsideFunction:null,allowSuperOutsideMethod:null,allowHashBang:!1,checkPrivateFields:!0,locations:!1,startLocation:null,onToken:null,onComment:null,
ranges:!1,program:null,sourceFile:null,directSourceFile:null,preserveParens:!1},F=!1;function U(t){var e={};for(var i in M)e[i]=t&&P(t,i)?t[i]:M[i]
;if("latest"===e.ecmaVersion?e.ecmaVersion=1e8:null==e.ecmaVersion?(!F&&"object"==typeof console&&console.warn&&(F=!0,
console.warn("Since Acorn 8.0.0, options.ecmaVersion is required.\nDefaulting to 2020, but this will stop working in the future.")),
e.ecmaVersion=11):e.ecmaVersion>=2015&&(e.ecmaVersion-=2009),null==e.allowReserved&&(e.allowReserved=e.ecmaVersion<5),
t&&null!=t.allowHashBang||(e.allowHashBang=e.ecmaVersion>=14),V(e.onToken)){var s=e.onToken;e.onToken=function(t){return s.push(t)}}
if(V(e.onComment)&&(e.onComment=function(t,e){return function(i,s,r,a,n,o){var h={type:i?"Block":"Line",value:s,start:r,end:a}
;t.locations&&(h.loc=new O(this,n,o)),t.ranges&&(h.range=[r,a]),e.push(h)}}(e,e.onComment)),
"commonjs"===e.sourceType&&e.allowAwaitOutsideFunction)throw new Error("Cannot use allowAwaitOutsideFunction with sourceType: commonjs");return e}
var q=256,j=259;function G(t,e){return 2|(t?4:0)|(e?8:0)}var H=function(t,e,i){this.options=t=U(t),this.sourceFile=t.sourceFile,
this.keywords=T(n[t.ecmaVersion>=6?6:"module"===t.sourceType?"5module":5]);var s="";!0!==t.allowReserved&&(s=r[t.ecmaVersion>=6?6:5===t.ecmaVersion?5:3],
"module"===t.sourceType&&(s+=" await")),this.reservedWords=T(s);var a=(s?s+" ":"")+r.strict;this.reservedWordsStrict=T(a),
this.reservedWordsStrictBind=T(a+" "+r.strictBind),this.input=String(e),this.containsEsc=!1,this.pos=i||0,this.curLine=1,
t.startLocation?(this.lineStart=this.pos-t.startLocation.column,this.curLine=t.startLocation.line):i?(this.lineStart=this.input.lastIndexOf("\n",i-1)+1,
this.options.locations&&(this.curLine=this.input.slice(0,this.lineStart).split(b).length)):this.lineStart=0,this.type=y.eof,this.value=null,
this.start=this.end=this.pos,this.startLoc=this.endLoc=this.curPosition(),this.lastTokEndLoc=this.lastTokStartLoc=null,
this.lastTokStart=this.lastTokEnd=this.pos,this.context=this.initialContext(),this.exprAllowed=!0,this.inModule="module"===t.sourceType,
this.strict=this.inModule||!0===t.strict||this.strictDirective(this.pos),this.potentialArrowAt=-1,this.potentialArrowInForAwait=!1,
this.yieldPos=this.awaitPos=this.awaitIdentPos=0,this.labels=[],this.undefinedExports=Object.create(null),
0===this.pos&&t.allowHashBang&&"#!"===this.input.slice(0,2)&&this.skipLineComment(2),this.scopeStack=[],
this.enterScope("commonjs"===this.options.sourceType?2:1),this.regexpState=null,this.privateNameStack=[]},W={inFunction:{configurable:!0},inGenerator:{
configurable:!0},inAsync:{configurable:!0},canAwait:{configurable:!0},allowReturn:{configurable:!0},allowSuper:{configurable:!0},allowDirectSuper:{
configurable:!0},treatFunctionsAsVar:{configurable:!0},allowNewDotTarget:{configurable:!0},allowUsing:{configurable:!0},inClassStaticBlock:{configurable:!0}}
;H.prototype.parse=function(){var t=this,e=this.options.program||this.startNode();return this.nextToken(),this.catchStackOverflow(function(){
return t.parseTopLevel(e)})},W.inFunction.get=function(){return(2&this.currentVarScope().flags)>0},W.inGenerator.get=function(){
return(8&this.currentVarScope().flags)>0},W.inAsync.get=function(){return(4&this.currentVarScope().flags)>0},W.canAwait.get=function(){
for(var t=this.scopeStack.length-1;t>=0;t--){var e=this.scopeStack[t].flags;if(768&e)return!1;if(2&e)return(4&e)>0}
return this.inModule&&this.options.ecmaVersion>=13||this.options.allowAwaitOutsideFunction},W.allowReturn.get=function(){
return!!this.inFunction||!!(this.options.allowReturnOutsideFunction&&1&this.currentVarScope().flags)},W.allowSuper.get=function(){
return(64&this.currentThisScope().flags)>0||this.options.allowSuperOutsideMethod},W.allowDirectSuper.get=function(){return(128&this.currentThisScope().flags)>0
},W.treatFunctionsAsVar.get=function(){return this.treatFunctionsAsVarInScope(this.currentScope())},W.allowNewDotTarget.get=function(){
for(var t=this.scopeStack.length-1;t>=0;t--){var e=this.scopeStack[t].flags;if(768&e||2&e&&!(16&e))return!0}return!1},W.allowUsing.get=function(){
var t=this.currentScope().flags;return!(1024&t||!this.inModule&&1&t)},W.inClassStaticBlock.get=function(){return(this.currentVarScope().flags&q)>0},
H.extend=function(){for(var t=[],e=arguments.length;e--;)t[e]=arguments[e];for(var i=this,s=0;s<t.length;s++)i=t[s](i);return i},H.parse=function(t,e){
return new this(e,t).parse()},H.parseExpressionAt=function(t,e,i){var s=new this(i,t,e);return s.nextToken(),s.parseExpression()},H.tokenizer=function(t,e){
return new this(e,t)},Object.defineProperties(H.prototype,W);var z=H.prototype,K=/^(?:'((?:\\[^]|[^'\\])*?)'|"((?:\\[^]|[^"\\])*?)")/
;z.strictDirective=function(t){if(this.options.ecmaVersion<5)return!1;for(;;){w.lastIndex=t,t+=w.exec(this.input)[0].length;var e=K.exec(this.input.slice(t))
;if(!e)return!1;if("use strict"===(e[1]||e[2])){w.lastIndex=t+e[0].length;var i=w.exec(this.input),s=i.index+i[0].length,r=this.input.charAt(s)
;return";"===r||"}"===r||b.test(i[0])&&!(/[(`.[+\-/*%<>=,?^&]/.test(r)||"!"===r&&"="===this.input.charAt(s+1))}t+=e[0].length,w.lastIndex=t,
t+=w.exec(this.input)[0].length,";"===this.input[t]&&t++}},z.eat=function(t){return this.type===t&&(this.next(),!0)},z.isContextual=function(t){
return this.type===y.name&&this.value===t&&!this.containsEsc},z.eatContextual=function(t){return!!this.isContextual(t)&&(this.next(),!0)},
z.catchStackOverflow=function(t){try{return t()}catch(t){
if(!(t instanceof Error&&(/\bstack\b.*\b(exceeded|overflow)\b/i.test(t.message)||/\btoo much recursion\b/i.test(t.message))))throw t
;this.raise(this.start,"Not enough stack space to parse input")}},z.expectContextual=function(t){this.eatContextual(t)||this.unexpected()},
z.canInsertSemicolon=function(){return this.type===y.eof||this.type===y.braceR||b.test(this.input.slice(this.lastTokEnd,this.start))},
z.insertSemicolon=function(){
if(this.canInsertSemicolon())return this.options.onInsertedSemicolon&&this.options.onInsertedSemicolon(this.lastTokEnd,this.lastTokEndLoc),!0},
z.semicolon=function(){this.eat(y.semi)||this.insertSemicolon()||this.unexpected()},z.afterTrailingComma=function(t,e){
if(this.type===t)return this.options.onTrailingComma&&this.options.onTrailingComma(this.lastTokStart,this.lastTokStartLoc),e||this.next(),!0},
z.expect=function(t){this.eat(t)||this.unexpected()},z.unexpected=function(t){this.raise(null!=t?t:this.start,"Unexpected token")};var Q=function(){
this.shorthandAssign=this.trailingComma=this.parenthesizedAssign=this.parenthesizedBind=this.doubleProto=-1};z.checkPatternErrors=function(t,e){if(t){
t.trailingComma>-1&&this.raiseRecoverable(t.trailingComma,"Comma is not permitted after the rest element");var i=e?t.parenthesizedAssign:t.parenthesizedBind
;i>-1&&this.raiseRecoverable(i,e?"Assigning to rvalue":"Parenthesized pattern")}},z.checkExpressionErrors=function(t,e){if(!t)return!1
;var i=t.shorthandAssign,s=t.doubleProto;if(!e)return i>=0||s>=0;i>=0&&this.raise(i,"Shorthand property assignments are valid only in destructuring patterns"),
s>=0&&this.raiseRecoverable(s,"Redefinition of __proto__ property")},z.checkYieldAwaitInDefaultParams=function(){
this.yieldPos&&(!this.awaitPos||this.yieldPos<this.awaitPos)&&this.raise(this.yieldPos,"Yield expression cannot be a default value"),
this.awaitPos&&this.raise(this.awaitPos,"Await expression cannot be a default value")},z.isSimpleAssignTarget=function(t){
return"ParenthesizedExpression"===t.type?this.isSimpleAssignTarget(t.expression):"Identifier"===t.type||"MemberExpression"===t.type};var Y=H.prototype
;Y.parseTopLevel=function(t){var e=Object.create(null);for(t.body||(t.body=[]);this.type!==y.eof;){var i=this.parseStatement(null,!0,e);t.body.push(i)}
if(this.inModule)for(var s=0,r=Object.keys(this.undefinedExports);s<r.length;s+=1){var a=r[s]
;this.raiseRecoverable(this.undefinedExports[a].start,"Export '"+a+"' is not defined")}return this.adaptDirectivePrologue(t.body),this.next(),
t.sourceType="commonjs"===this.options.sourceType?"script":this.options.sourceType,this.finishNode(t,"Program")};var X={kind:"loop"},Z={kind:"switch"}
;Y.isLet=function(t){if(this.options.ecmaVersion<6||!this.isContextual("let"))return!1;w.lastIndex=this.pos
;var e=w.exec(this.input),i=this.pos+e[0].length,s=this.fullCharCodeAt(i);if(91===s||92===s)return!0;if(t)return!1;if(123===s)return!0;if(u(s)){var r=i;do{
i+=s<=65535?1:2}while(l(s=this.fullCharCodeAt(i)));if(92===s)return!0;var a=this.input.slice(r,i);if(!o.test(a))return!0}return!1},Y.isAsyncFunction=function(){
if(this.options.ecmaVersion<8||!this.isContextual("async"))return!1;w.lastIndex=this.pos;var t,e=w.exec(this.input),i=this.pos+e[0].length
;return!(b.test(this.input.slice(this.pos,i))||"function"!==this.input.slice(i,i+8)||i+8!==this.input.length&&(l(t=this.fullCharCodeAt(i+8))||92===t))},
Y.isUsingKeyword=function(t,e){if(this.options.ecmaVersion<17||!this.isContextual(t?"await":"using"))return!1;w.lastIndex=this.pos
;var i=w.exec(this.input),s=this.pos+i[0].length;if(b.test(this.input.slice(this.pos,s)))return!1;if(t){var r,a=s+5
;if("using"!==this.input.slice(s,a)||a===this.input.length||l(r=this.fullCharCodeAt(a))||92===r)return!1;w.lastIndex=a;var n=w.exec(this.input)
;if(s=a+n[0].length,n&&b.test(this.input.slice(a,s)))return!1}var h=this.fullCharCodeAt(s);if(!u(h)&&92!==h)return!1;var p=s;do{s+=h<=65535?1:2
}while(l(h=this.fullCharCodeAt(s)));if(92===h)return!0;var c=this.input.slice(p,s);return!o.test(c)&&!(e&&!t&&"of"===c&&(w.lastIndex=s,
s+=w.exec(this.input)[0].length,61!==this.input.charCodeAt(s)||61===(h=this.input.charCodeAt(s+1))||62===h))},Y.isAwaitUsing=function(t){
return this.isUsingKeyword(!0,t)},Y.isUsing=function(t){return this.isUsingKeyword(!1,t)},Y.parseStatement=function(t,e,i){var s,r=this.type,a=this.startNode()
;switch(this.isLet(t)&&(r=y._var,s="let"),r){case y._break:case y._continue:return this.parseBreakContinueStatement(a,r.keyword);case y._debugger:
return this.parseDebuggerStatement(a);case y._do:return this.parseDoStatement(a);case y._for:return this.parseForStatement(a);case y._function:
return t&&(this.strict||"if"!==t&&"label"!==t)&&this.options.ecmaVersion>=6&&this.unexpected(),this.parseFunctionStatement(a,!1,!t);case y._class:
return t&&this.unexpected(),this.parseClass(a,!0);case y._if:return this.parseIfStatement(a);case y._return:return this.parseReturnStatement(a);case y._switch:
return this.parseSwitchStatement(a);case y._throw:return this.parseThrowStatement(a);case y._try:return this.parseTryStatement(a);case y._const:case y._var:
return s=s||this.value,t&&"var"!==s&&this.unexpected(),this.parseVarStatement(a,s);case y._while:return this.parseWhileStatement(a);case y._with:
return this.parseWithStatement(a);case y.braceL:return this.parseBlock(!0,a);case y.semi:return this.parseEmptyStatement(a);case y._export:case y._import:
if(this.options.ecmaVersion>10&&r===y._import){w.lastIndex=this.pos;var n=w.exec(this.input),o=this.pos+n[0].length,h=this.input.charCodeAt(o)
;if(40===h||46===h)return this.parseExpressionStatement(a,this.parseExpression())}
return this.options.allowImportExportEverywhere||(e||this.raise(this.start,"'import' and 'export' may only appear at the top level"),
this.inModule||this.raise(this.start,"'import' and 'export' may appear only with 'sourceType: module'")),r===y._import?this.parseImport(a):this.parseExport(a,i)
;default:if(this.isAsyncFunction())return t&&this.unexpected(),this.next(),this.parseFunctionStatement(a,!0,!t)
;var p=this.isAwaitUsing(!1)?"await using":this.isUsing(!1)?"using":null
;if(p)return this.allowUsing||this.raise(this.start,"Using declaration cannot appear in the top level when source type is `script` or in the bare case statement"),
t&&this.raise(this.start,"Using declaration is not allowed in single-statement positions"),
"await using"===p&&(this.canAwait||this.raise(this.start,"Await using cannot appear outside of async function"),this.next()),this.next(),this.parseVar(a,!1,p),
this.semicolon(),this.finishNode(a,"VariableDeclaration");var c=this.value,u=this.parseExpression()
;return r===y.name&&"Identifier"===u.type&&this.eat(y.colon)?this.parseLabeledStatement(a,c,u,t):this.parseExpressionStatement(a,u)}},
Y.parseBreakContinueStatement=function(t,e){var i="break"===e
;this.next(),this.eat(y.semi)||this.insertSemicolon()?t.label=null:this.type!==y.name?this.unexpected():(t.label=this.parseIdent(),this.semicolon())
;for(var s=0;s<this.labels.length;++s){var r=this.labels[s];if(null==t.label||r.name===t.label.name){if(null!=r.kind&&(i||"loop"===r.kind))break
;if(t.label&&i)break}}return s===this.labels.length&&this.raise(t.start,"Unsyntactic "+e),this.finishNode(t,i?"BreakStatement":"ContinueStatement")},
Y.parseDebuggerStatement=function(t){return this.next(),this.semicolon(),this.finishNode(t,"DebuggerStatement")},Y.parseDoStatement=function(t){
return this.next(),this.labels.push(X),t.body=this.parseStatement("do"),this.labels.pop(),this.expect(y._while),t.test=this.parseParenExpression(),
this.options.ecmaVersion>=6?this.eat(y.semi):this.semicolon(),this.finishNode(t,"DoWhileStatement")},Y.parseForStatement=function(t){this.next()
;var e=this.options.ecmaVersion>=9&&this.canAwait&&this.eatContextual("await")?this.lastTokStart:-1;if(this.labels.push(X),this.enterScope(0),
this.expect(y.parenL),this.type===y.semi)return e>-1&&this.unexpected(e),this.parseFor(t,null);var i=this.isLet()
;if(this.type===y._var||this.type===y._const||i){var s=this.startNode(),r=i?"let":this.value;return this.next(),this.parseVar(s,!0,r),
this.finishNode(s,"VariableDeclaration"),this.parseForAfterInit(t,s,e)}
var a=this.isContextual("let"),n=!1,o=this.isUsing(!0)?"using":this.isAwaitUsing(!0)?"await using":null;if(o){var h=this.startNode();return this.next(),
"await using"===o&&(this.canAwait||this.raise(this.start,"Await using cannot appear outside of async function"),this.next()),this.parseVar(h,!0,o),
this.finishNode(h,"VariableDeclaration"),this.parseForAfterInit(t,h,e)}
var p=this.containsEsc,c=new Q,u=this.start,l=e>-1?this.parseExprSubscripts(c,"await"):this.parseExpression(!0,c)
;return this.type===y._in||(n=this.options.ecmaVersion>=6&&this.isContextual("of"))?(e>-1?(this.type===y._in&&this.unexpected(e),
t.await=!0):n&&this.options.ecmaVersion>=8&&(l.start!==u||p||"Identifier"!==l.type||"async"!==l.name?this.options.ecmaVersion>=9&&(t.await=!1):this.unexpected()),
a&&n&&this.raise(l.start,"The left-hand side of a for-of loop may not start with 'let'."),this.toAssignable(l,!1,c),this.checkLValPattern(l),
this.parseForIn(t,l)):(this.checkExpressionErrors(c,!0),e>-1&&this.unexpected(e),this.parseFor(t,l))},Y.parseForAfterInit=function(t,e,i){
return(this.type===y._in||this.options.ecmaVersion>=6&&this.isContextual("of"))&&1===e.declarations.length?(this.type===y._in?("using"!==e.kind&&"await using"!==e.kind||e.declarations[0].init||this.raise(this.start,"Using declaration is not allowed in for-in loops"),
this.options.ecmaVersion>=9&&i>-1&&this.unexpected(i)):this.options.ecmaVersion>=9&&(t.await=i>-1),this.parseForIn(t,e)):(i>-1&&this.unexpected(i),
this.parseFor(t,e))},Y.parseFunctionStatement=function(t,e,i){return this.next(),this.parseFunction(t,J|(i?0:tt),!1,e)},Y.parseIfStatement=function(t){
return this.next(),t.test=this.parseParenExpression(),t.consequent=this.parseStatement("if"),t.alternate=this.eat(y._else)?this.parseStatement("if"):null,
this.finishNode(t,"IfStatement")},Y.parseReturnStatement=function(t){return this.allowReturn||this.raise(this.start,"'return' outside of function"),this.next(),
this.eat(y.semi)||this.insertSemicolon()?t.argument=null:(t.argument=this.parseExpression(),this.semicolon()),this.finishNode(t,"ReturnStatement")},
Y.parseSwitchStatement=function(t){var e;this.next(),t.discriminant=this.parseParenExpression(),t.cases=[],this.expect(y.braceL),this.labels.push(Z),
this.enterScope(1024);for(var i=!1;this.type!==y.braceR;)if(this.type===y._case||this.type===y._default){var s=this.type===y._case
;e&&this.finishNode(e,"SwitchCase"),t.cases.push(e=this.startNode()),e.consequent=[],this.next(),
s?e.test=this.parseExpression():(i&&this.raiseRecoverable(this.lastTokStart,"Multiple default clauses"),i=!0,e.test=null),this.expect(y.colon)
}else e||this.unexpected(),e.consequent.push(this.parseStatement(null));return this.exitScope(),e&&this.finishNode(e,"SwitchCase"),this.next(),
this.labels.pop(),this.finishNode(t,"SwitchStatement")},Y.parseThrowStatement=function(t){return this.next(),
b.test(this.input.slice(this.lastTokEnd,this.start))&&this.raise(this.lastTokEnd,"Illegal newline after throw"),t.argument=this.parseExpression(),
this.semicolon(),this.finishNode(t,"ThrowStatement")};var $=[];Y.parseCatchClauseParam=function(){var t=this.parseBindingAtom(),e="Identifier"===t.type
;return this.enterScope(e?32:0),this.checkLValPattern(t,e?4:2),this.expect(y.parenR),t},Y.parseTryStatement=function(t){if(this.next(),
t.block=this.parseBlock(),t.handler=null,this.type===y._catch){var e=this.startNode();this.next(),
this.eat(y.parenL)?e.param=this.parseCatchClauseParam():(this.options.ecmaVersion<10&&this.unexpected(),e.param=null,this.enterScope(0)),
e.body=this.parseBlock(!1),this.exitScope(),t.handler=this.finishNode(e,"CatchClause")}return t.finalizer=this.eat(y._finally)?this.parseBlock():null,
t.handler||t.finalizer||this.raise(t.start,"Missing catch or finally clause"),this.finishNode(t,"TryStatement")},Y.parseVarStatement=function(t,e,i){
return this.next(),this.parseVar(t,!1,e,i),this.semicolon(),this.finishNode(t,"VariableDeclaration")},Y.parseWhileStatement=function(t){return this.next(),
t.test=this.parseParenExpression(),this.labels.push(X),t.body=this.parseStatement("while"),this.labels.pop(),this.finishNode(t,"WhileStatement")},
Y.parseWithStatement=function(t){return this.strict&&this.raise(this.start,"'with' in strict mode"),this.next(),t.object=this.parseParenExpression(),
t.body=this.parseStatement("with"),this.finishNode(t,"WithStatement")},Y.parseEmptyStatement=function(t){return this.next(),this.finishNode(t,"EmptyStatement")
},Y.parseLabeledStatement=function(t,e,i,s){for(var r=0,a=this.labels;r<a.length;r+=1)a[r].name===e&&this.raise(i.start,"Label '"+e+"' is already declared")
;for(var n=this.type.isLoop?"loop":this.type===y._switch?"switch":null,o=this.labels.length-1;o>=0;o--){var h=this.labels[o];if(h.statementStart!==t.start)break
;h.statementStart=this.start,h.kind=n}return this.labels.push({name:e,kind:n,statementStart:this.start}),
t.body=this.parseStatement(s?-1===s.indexOf("label")?s+"label":s:"label"),this.labels.pop(),t.label=i,this.finishNode(t,"LabeledStatement")},
Y.parseExpressionStatement=function(t,e){return t.expression=e,this.semicolon(),this.finishNode(t,"ExpressionStatement")},Y.parseBlock=function(t,e,i){
for(void 0===t&&(t=!0),void 0===e&&(e=this.startNode()),e.body=[],this.expect(y.braceL),t&&this.enterScope(0);this.type!==y.braceR;){
var s=this.parseStatement(null);e.body.push(s)}return i&&(this.strict=!1),this.next(),t&&this.exitScope(),this.finishNode(e,"BlockStatement")},
Y.parseFor=function(t,e){return t.init=e,this.expect(y.semi),t.test=this.type===y.semi?null:this.parseExpression(),this.expect(y.semi),
t.update=this.type===y.parenR?null:this.parseExpression(),this.expect(y.parenR),t.body=this.parseStatement("for"),this.exitScope(),this.labels.pop(),
this.finishNode(t,"ForStatement")},Y.parseForIn=function(t,e){var i=this.type===y._in;return this.next(),
"VariableDeclaration"===e.type&&null!=e.declarations[0].init&&(!i||this.options.ecmaVersion<8||this.strict||"var"!==e.kind||"Identifier"!==e.declarations[0].id.type)&&this.raise(e.start,(i?"for-in":"for-of")+" loop variable declaration may not have an initializer"),
t.left=e,t.right=i?this.parseExpression():this.parseMaybeAssign(),this.expect(y.parenR),t.body=this.parseStatement("for"),this.exitScope(),this.labels.pop(),
this.finishNode(t,i?"ForInStatement":"ForOfStatement")},Y.parseVar=function(t,e,i,s){for(t.declarations=[],t.kind=i;;){var r=this.startNode()
;if(this.parseVarId(r,i),
this.eat(y.eq)?r.init=this.parseMaybeAssign(e):s||"const"!==i||this.type===y._in||this.options.ecmaVersion>=6&&this.isContextual("of")?s||"using"!==i&&"await using"!==i||!(this.options.ecmaVersion>=17)||this.type===y._in||this.isContextual("of")?s||"Identifier"===r.id.type||e&&(this.type===y._in||this.isContextual("of"))?r.init=null:this.raise(this.lastTokEnd,"Complex binding patterns require an initialization value"):this.raise(this.lastTokEnd,"Missing initializer in "+i+" declaration"):this.unexpected(),
t.declarations.push(this.finishNode(r,"VariableDeclarator")),!this.eat(y.comma))break}return t},Y.parseVarId=function(t,e){
t.id="using"===e||"await using"===e?this.parseIdent():this.parseBindingAtom(),this.checkLValPattern(t.id,"var"===e?1:2,!1)};var J=1,tt=2;function et(t,e){
var i=e.key.name,s=t[i],r="true";return"MethodDefinition"!==e.type||"get"!==e.kind&&"set"!==e.kind||(r=(e.static?"s":"i")+e.kind),
"iget"===s&&"iset"===r||"iset"===s&&"iget"===r||"sget"===s&&"sset"===r||"sset"===s&&"sget"===r?(t[i]="true",!1):!!s||(t[i]=r,!1)}function it(t,e){
var i=t.computed,s=t.key;return!i&&("Identifier"===s.type&&s.name===e||"Literal"===s.type&&s.value===e)}Y.parseFunction=function(t,e,i,s,r){
this.initFunction(t),(this.options.ecmaVersion>=9||this.options.ecmaVersion>=6&&!s)&&(this.type===y.star&&e&tt&&this.unexpected(),t.generator=this.eat(y.star)),
this.options.ecmaVersion>=8&&(t.async=!!s),e&J&&(t.id=4&e&&this.type!==y.name?null:this.parseIdent(),
!t.id||e&tt||this.checkLValSimple(t.id,this.strict||t.generator||t.async?this.treatFunctionsAsVar?1:2:3))
;var a=this.yieldPos,n=this.awaitPos,o=this.awaitIdentPos;return this.yieldPos=0,this.awaitPos=0,this.awaitIdentPos=0,this.enterScope(G(t.async,t.generator)),
e&J||(t.id=this.type===y.name?this.parseIdent():null),this.parseFunctionParams(t),this.parseFunctionBody(t,i,!1,r),this.yieldPos=a,this.awaitPos=n,
this.awaitIdentPos=o,this.finishNode(t,e&J?"FunctionDeclaration":"FunctionExpression")},Y.parseFunctionParams=function(t){this.expect(y.parenL),
t.params=this.parseBindingList(y.parenR,!1,this.options.ecmaVersion>=8),this.checkYieldAwaitInDefaultParams()},Y.parseClass=function(t,e){this.next()
;var i=this.strict;this.strict=!0,this.parseClassId(t,e),this.parseClassSuper(t);var s=this.enterClassBody(),r=this.startNode(),a=!1;for(r.body=[],
this.expect(y.braceL);this.type!==y.braceR;){var n=this.parseClassElement(null!==t.superClass);n&&(r.body.push(n),
"MethodDefinition"===n.type&&"constructor"===n.kind?(a&&this.raiseRecoverable(n.start,"Duplicate constructor in the same class"),
a=!0):n.key&&"PrivateIdentifier"===n.key.type&&et(s,n)&&this.raiseRecoverable(n.key.start,"Identifier '#"+n.key.name+"' has already been declared"))}
return this.strict=i,this.next(),t.body=this.finishNode(r,"ClassBody"),this.exitClassBody(),this.finishNode(t,e?"ClassDeclaration":"ClassExpression")},
Y.parseClassElement=function(t){if(this.eat(y.semi))return null;var e=this.options.ecmaVersion,i=this.startNode(),s="",r=!1,a=!1,n="method",o=!1
;if(this.eatContextual("static")){if(e>=13&&this.eat(y.braceL))return this.parseClassStaticBlock(i),i
;this.isClassElementNameStart()||this.type===y.star?o=!0:s="static"}if(i.static=o,
!s&&e>=8&&this.eatContextual("async")&&(!this.isClassElementNameStart()&&this.type!==y.star||this.canInsertSemicolon()?s="async":a=!0),
!s&&(e>=9||!a)&&this.eat(y.star)&&(r=!0),!s&&!a&&!r){var h=this.value
;(this.eatContextual("get")||this.eatContextual("set"))&&(this.isClassElementNameStart()?n=h:s=h)}if(s?(i.computed=!1,
i.key=this.startNodeAt(this.lastTokStart,this.lastTokStartLoc),i.key.name=s,this.finishNode(i.key,"Identifier")):this.parseClassElementName(i),
e<13||this.type===y.parenL||"method"!==n||r||a){var p=!i.static&&it(i,"constructor"),c=p&&t
;p&&"method"!==n&&this.raise(i.key.start,"Constructor can't have get/set modifier"),i.kind=p?"constructor":n,this.parseClassMethod(i,r,a,c)
}else this.parseClassField(i);return i},Y.isClassElementNameStart=function(){
return this.type===y.name||this.type===y.privateId||this.type===y.num||this.type===y.string||this.type===y.bracketL||this.type.keyword},
Y.parseClassElementName=function(t){
this.type===y.privateId?("constructor"===this.value&&this.raise(this.start,"Classes can't have an element named '#constructor'"),t.computed=!1,
t.key=this.parsePrivateIdent()):this.parsePropertyName(t)},Y.parseClassMethod=function(t,e,i,s){var r=t.key
;"constructor"===t.kind?(e&&this.raise(r.start,"Constructor can't be a generator"),
i&&this.raise(r.start,"Constructor can't be an async method")):t.static&&it(t,"prototype")&&this.raise(r.start,"Classes may not have a static property named prototype")
;var a=t.value=this.parseMethod(e,i,s);return"get"===t.kind&&0!==a.params.length&&this.raiseRecoverable(a.start,"getter should have no params"),
"set"===t.kind&&1!==a.params.length&&this.raiseRecoverable(a.start,"setter should have exactly one param"),
"set"===t.kind&&"RestElement"===a.params[0].type&&this.raiseRecoverable(a.params[0].start,"Setter cannot use rest params"),this.finishNode(t,"MethodDefinition")
},Y.parseClassField=function(t){
return it(t,"constructor")?this.raise(t.key.start,"Classes can't have a field named 'constructor'"):t.static&&it(t,"prototype")&&this.raise(t.key.start,"Classes can't have a static field named 'prototype'"),
this.eat(y.eq)?(this.enterScope(576),t.value=this.parseMaybeAssign(),this.exitScope()):t.value=null,this.semicolon(),this.finishNode(t,"PropertyDefinition")},
Y.parseClassStaticBlock=function(t){t.body=[];var e=this.labels;for(this.labels=[],this.enterScope(320);this.type!==y.braceR;){var i=this.parseStatement(null)
;t.body.push(i)}return this.next(),this.exitScope(),this.labels=e,this.finishNode(t,"StaticBlock")},Y.parseClassId=function(t,e){
this.type===y.name?(t.id=this.parseIdent(),e&&this.checkLValSimple(t.id,2,!1)):(!0===e&&this.unexpected(),t.id=null)},Y.parseClassSuper=function(t){
t.superClass=this.eat(y._extends)?this.parseExprSubscripts(null,!1):null},Y.enterClassBody=function(){var t={declared:Object.create(null),used:[]}
;return this.privateNameStack.push(t),t.declared},Y.exitClassBody=function(){var t=this.privateNameStack.pop(),e=t.declared,i=t.used
;if(this.options.checkPrivateFields)for(var s=this.privateNameStack.length,r=0===s?null:this.privateNameStack[s-1],a=0;a<i.length;++a){var n=i[a]
;P(e,n.name)||(r?r.used.push(n):this.raiseRecoverable(n.start,"Private field '#"+n.name+"' must be declared in an enclosing class"))}},
Y.parseExportAllDeclaration=function(t,e){return this.options.ecmaVersion>=11&&(this.eatContextual("as")?(t.exported=this.parseModuleExportName(),
this.checkExport(e,t.exported,this.lastTokStart)):t.exported=null),this.expectContextual("from"),this.type!==y.string&&this.unexpected(),
t.source=this.parseExprAtom(),this.options.ecmaVersion>=16&&(t.attributes=this.parseWithClause()),this.semicolon(),this.finishNode(t,"ExportAllDeclaration")},
Y.parseExport=function(t,e){if(this.next(),this.eat(y.star))return this.parseExportAllDeclaration(t,e)
;if(this.eat(y._default))return this.checkExport(e,"default",this.lastTokStart),t.declaration=this.parseExportDefaultDeclaration(),
this.finishNode(t,"ExportDefaultDeclaration");if(this.shouldParseExportStatement())t.declaration=this.parseExportDeclaration(t),
"VariableDeclaration"===t.declaration.type?this.checkVariableExport(e,t.declaration.declarations):this.checkExport(e,t.declaration.id,t.declaration.id.start),
t.specifiers=[],t.source=null,this.options.ecmaVersion>=16&&(t.attributes=[]);else{if(t.declaration=null,t.specifiers=this.parseExportSpecifiers(e),
this.eatContextual("from"))this.type!==y.string&&this.unexpected(),t.source=this.parseExprAtom(),
this.options.ecmaVersion>=16&&(t.attributes=this.parseWithClause());else{for(var i=0,s=t.specifiers;i<s.length;i+=1){var r=s[i];this.checkUnreserved(r.local),
this.checkLocalExport(r.local),"Literal"===r.local.type&&this.raise(r.local.start,"A string literal cannot be used as an exported binding without `from`.")}
t.source=null,this.options.ecmaVersion>=16&&(t.attributes=[])}this.semicolon()}return this.finishNode(t,"ExportNamedDeclaration")},
Y.parseExportDeclaration=function(t){return this.parseStatement(null)},Y.parseExportDefaultDeclaration=function(){var t
;if(this.type===y._function||(t=this.isAsyncFunction())){var e=this.startNode();return this.next(),t&&this.next(),this.parseFunction(e,4|J,!1,t)}
if(this.type===y._class){var i=this.startNode();return this.parseClass(i,"nullableID")}var s=this.parseMaybeAssign();return this.semicolon(),s},
Y.checkExport=function(t,e,i){t&&("string"!=typeof e&&(e="Identifier"===e.type?e.name:e.value),P(t,e)&&this.raiseRecoverable(i,"Duplicate export '"+e+"'"),
t[e]=!0)},Y.checkPatternExport=function(t,e){var i=e.type
;if("Identifier"===i)this.checkExport(t,e,e.start);else if("ObjectPattern"===i)for(var s=0,r=e.properties;s<r.length;s+=1){var a=r[s]
;this.checkPatternExport(t,a)}else if("ArrayPattern"===i)for(var n=0,o=e.elements;n<o.length;n+=1){var h=o[n];h&&this.checkPatternExport(t,h)
}else"Property"===i?this.checkPatternExport(t,e.value):"AssignmentPattern"===i?this.checkPatternExport(t,e.left):"RestElement"===i&&this.checkPatternExport(t,e.argument)
},Y.checkVariableExport=function(t,e){if(t)for(var i=0,s=e;i<s.length;i+=1){var r=s[i];this.checkPatternExport(t,r.id)}},
Y.shouldParseExportStatement=function(){
return"var"===this.type.keyword||"const"===this.type.keyword||"class"===this.type.keyword||"function"===this.type.keyword||this.isLet()||this.isAsyncFunction()
},Y.parseExportSpecifier=function(t){var e=this.startNode();return e.local=this.parseModuleExportName(),
e.exported=this.eatContextual("as")?this.parseModuleExportName():e.local,this.checkExport(t,e.exported,e.exported.start),this.finishNode(e,"ExportSpecifier")},
Y.parseExportSpecifiers=function(t){var e=[],i=!0;for(this.expect(y.braceL);!this.eat(y.braceR);){if(i)i=!1;else if(this.expect(y.comma),
this.afterTrailingComma(y.braceR))break;e.push(this.parseExportSpecifier(t))}return e},Y.parseImport=function(t){return this.next(),
this.type===y.string?(t.specifiers=$,t.source=this.parseExprAtom()):(t.specifiers=this.parseImportSpecifiers(),this.expectContextual("from"),
t.source=this.type===y.string?this.parseExprAtom():this.unexpected()),this.options.ecmaVersion>=16&&(t.attributes=this.parseWithClause()),this.semicolon(),
this.finishNode(t,"ImportDeclaration")},Y.parseImportSpecifier=function(){var t=this.startNode();return t.imported=this.parseModuleExportName(),
this.eatContextual("as")?t.local=this.parseIdent():(this.checkUnreserved(t.imported),t.local=t.imported),this.checkLValSimple(t.local,2),
this.finishNode(t,"ImportSpecifier")},Y.parseImportDefaultSpecifier=function(){var t=this.startNode();return t.local=this.parseIdent(),
this.checkLValSimple(t.local,2),this.finishNode(t,"ImportDefaultSpecifier")},Y.parseImportNamespaceSpecifier=function(){var t=this.startNode()
;return this.next(),this.expectContextual("as"),t.local=this.parseIdent(),this.checkLValSimple(t.local,2),this.finishNode(t,"ImportNamespaceSpecifier")},
Y.parseImportSpecifiers=function(){var t=[],e=!0;if(this.type===y.name&&(t.push(this.parseImportDefaultSpecifier()),!this.eat(y.comma)))return t
;if(this.type===y.star)return t.push(this.parseImportNamespaceSpecifier()),t;for(this.expect(y.braceL);!this.eat(y.braceR);){
if(e)e=!1;else if(this.expect(y.comma),this.afterTrailingComma(y.braceR))break;t.push(this.parseImportSpecifier())}return t},Y.parseWithClause=function(){
var t=[];if(!this.eat(y._with))return t;this.expect(y.braceL);for(var e={},i=!0;!this.eat(y.braceR);){if(i)i=!1;else if(this.expect(y.comma),
this.afterTrailingComma(y.braceR))break;var s=this.parseImportAttribute(),r="Identifier"===s.key.type?s.key.name:s.key.value
;P(e,r)&&this.raiseRecoverable(s.key.start,"Duplicate attribute key '"+r+"'"),e[r]=!0,t.push(s)}return t},Y.parseImportAttribute=function(){
var t=this.startNode();return t.key=this.type===y.string?this.parseExprAtom():this.parseIdent("never"!==this.options.allowReserved),this.expect(y.colon),
this.type!==y.string&&this.unexpected(),t.value=this.parseExprAtom(),this.finishNode(t,"ImportAttribute")},Y.parseModuleExportName=function(){
if(this.options.ecmaVersion>=13&&this.type===y.string){var t=this.parseLiteral(this.value)
;return R.test(t.value)&&this.raise(t.start,"An export name cannot include a lone surrogate."),t}return this.parseIdent(!0)},
Y.adaptDirectivePrologue=function(t){for(var e=0;e<t.length&&this.isDirectiveCandidate(t[e]);++e)t[e].directive=t[e].expression.raw.slice(1,-1)},
Y.isDirectiveCandidate=function(t){
return this.options.ecmaVersion>=5&&"ExpressionStatement"===t.type&&"Literal"===t.expression.type&&"string"==typeof t.expression.value&&('"'===this.input[t.start]||"'"===this.input[t.start])
};var st=H.prototype;st.toAssignable=function(t,e,i){if(this.options.ecmaVersion>=6&&t)switch(t.type){case"Identifier":
this.inAsync&&"await"===t.name&&this.raise(t.start,"Cannot use 'await' as identifier inside an async function");break;case"ObjectPattern":case"ArrayPattern":
case"AssignmentPattern":case"RestElement":break;case"ObjectExpression":t.type="ObjectPattern",i&&this.checkPatternErrors(i,!0)
;for(var s=0,r=t.properties;s<r.length;s+=1){var a=r[s]
;this.toAssignable(a,e),"RestElement"!==a.type||"ArrayPattern"!==a.argument.type&&"ObjectPattern"!==a.argument.type||this.raise(a.argument.start,"Unexpected token")
}break;case"Property":"init"!==t.kind&&this.raise(t.key.start,"Object pattern can't contain getter or setter"),this.toAssignable(t.value,e);break
;case"ArrayExpression":t.type="ArrayPattern",i&&this.checkPatternErrors(i,!0),this.toAssignableList(t.elements,e);break;case"SpreadElement":
t.type="RestElement",
this.toAssignable(t.argument,e),"AssignmentPattern"===t.argument.type&&this.raise(t.argument.start,"Rest elements cannot have a default value");break
;case"AssignmentExpression":"="!==t.operator&&this.raise(t.left.end,"Only '=' operator can be used for specifying default value."),t.type="AssignmentPattern",
delete t.operator,this.toAssignable(t.left,e);break;case"ParenthesizedExpression":this.toAssignable(t.expression,e,i);break;case"ChainExpression":
this.raiseRecoverable(t.start,"Optional chaining cannot appear in left-hand side");break;case"MemberExpression":if(!e)break;default:
this.raise(t.start,"Assigning to rvalue")}else i&&this.checkPatternErrors(i,!0);return t},st.toAssignableList=function(t,e){for(var i=t.length,s=0;s<i;s++){
var r=t[s];r&&this.toAssignable(r,e)}if(i){var a=t[i-1]
;6===this.options.ecmaVersion&&e&&a&&"RestElement"===a.type&&"Identifier"!==a.argument.type&&this.unexpected(a.argument.start)}return t},
st.parseSpread=function(t){var e=this.startNode();return this.next(),e.argument=this.parseMaybeAssign(!1,t),this.finishNode(e,"SpreadElement")},
st.parseRestBinding=function(){var t=this.startNode();return this.next(),6===this.options.ecmaVersion&&this.type!==y.name&&this.unexpected(),
t.argument=this.parseBindingAtom(),this.finishNode(t,"RestElement")},st.parseBindingAtom=function(){if(this.options.ecmaVersion>=6)switch(this.type){
case y.bracketL:var t=this.startNode();return this.next(),t.elements=this.parseBindingList(y.bracketR,!0,!0),this.finishNode(t,"ArrayPattern");case y.braceL:
return this.parseObj(!0)}return this.parseIdent()},st.parseBindingList=function(t,e,i,s){for(var r=[],a=!0;!this.eat(t);)if(a?a=!1:this.expect(y.comma),
e&&this.type===y.comma)r.push(null);else{if(i&&this.afterTrailingComma(t))break;if(this.type===y.ellipsis){var n=this.parseRestBinding()
;this.parseBindingListItem(n),r.push(n),this.type===y.comma&&this.raiseRecoverable(this.start,"Comma is not permitted after the rest element"),this.expect(t)
;break}r.push(this.parseAssignableListItem(s))}return r},st.parseAssignableListItem=function(t){var e=this.parseMaybeDefault(this.start,this.startLoc)
;return this.parseBindingListItem(e),e},st.parseBindingListItem=function(t){return t},st.parseMaybeDefault=function(t,e,i){if(i=i||this.parseBindingAtom(),
this.options.ecmaVersion<6||!this.eat(y.eq))return i;var s=this.startNodeAt(t,e);return s.left=i,s.right=this.parseMaybeAssign(),
this.finishNode(s,"AssignmentPattern")},st.checkLValSimple=function(t,e,i){void 0===e&&(e=0);var s=0!==e;switch(t.type){case"Identifier":
this.strict&&this.reservedWordsStrictBind.test(t.name)&&this.raiseRecoverable(t.start,(s?"Binding ":"Assigning to ")+t.name+" in strict mode"),
s&&(2===e&&"let"===t.name&&this.raiseRecoverable(t.start,"let is disallowed as a lexically bound name"),
i&&(P(i,t.name)&&this.raiseRecoverable(t.start,"Argument name clash"),i[t.name]=!0),5!==e&&this.declareName(t.name,e,t.start));break;case"ChainExpression":
this.raiseRecoverable(t.start,"Optional chaining cannot appear in left-hand side");break;case"MemberExpression":
s&&this.raiseRecoverable(t.start,"Binding member expression");break;case"ParenthesizedExpression":
return s&&this.raiseRecoverable(t.start,"Binding parenthesized expression"),this.checkLValSimple(t.expression,e,i);default:
this.raise(t.start,(s?"Binding":"Assigning to")+" rvalue")}},st.checkLValPattern=function(t,e,i){switch(void 0===e&&(e=0),t.type){case"ObjectPattern":
for(var s=0,r=t.properties;s<r.length;s+=1){var a=r[s];this.checkLValInnerPattern(a,e,i)}break;case"ArrayPattern":for(var n=0,o=t.elements;n<o.length;n+=1){
var h=o[n];h&&this.checkLValInnerPattern(h,e,i)}break;default:this.checkLValSimple(t,e,i)}},st.checkLValInnerPattern=function(t,e,i){switch(void 0===e&&(e=0),
t.type){case"Property":this.checkLValInnerPattern(t.value,e,i);break;case"AssignmentPattern":this.checkLValPattern(t.left,e,i);break;case"RestElement":
this.checkLValPattern(t.argument,e,i);break;default:this.checkLValPattern(t,e,i)}};var rt=function(t,e,i,s,r){this.token=t,this.isExpr=!!e,
this.preserveSpace=!!i,this.override=s,this.generator=!!r},at={b_stat:new rt("{",!1),b_expr:new rt("{",!0),b_tmpl:new rt("${",!1),p_stat:new rt("(",!1),
p_expr:new rt("(",!0),q_tmpl:new rt("`",!0,!0,function(t){return t.tryReadTemplateToken()}),f_stat:new rt("function",!1),f_expr:new rt("function",!0),
f_expr_gen:new rt("function",!0,!1,null,!0),f_gen:new rt("function",!1,!1,null,!0)},nt=H.prototype;nt.initialContext=function(){return[at.b_stat]},
nt.curContext=function(){return this.context[this.context.length-1]},nt.braceIsBlock=function(t){var e=this.curContext()
;return e===at.f_expr||e===at.f_stat||(t!==y.colon||e!==at.b_stat&&e!==at.b_expr?t===y._return||t===y.name&&this.exprAllowed?b.test(this.input.slice(this.lastTokEnd,this.start)):t===y._else||t===y.semi||t===y.eof||t===y.parenR||t===y.arrow||(t===y.braceL?e===at.b_stat:t!==y._var&&t!==y._const&&t!==y.name&&!this.exprAllowed):!e.isExpr)
},nt.inGeneratorContext=function(){for(var t=this.context.length-1;t>=1;t--){var e=this.context[t];if("function"===e.token)return e.generator}return!1},
nt.updateContext=function(t){var e,i=this.type;i.keyword&&t===y.dot?this.exprAllowed=!1:(e=i.updateContext)?e.call(this,t):this.exprAllowed=i.beforeExpr},
nt.overrideContext=function(t){this.curContext()!==t&&(this.context[this.context.length-1]=t)},y.parenR.updateContext=y.braceR.updateContext=function(){
if(1!==this.context.length){var t=this.context.pop();t===at.b_stat&&"function"===this.curContext().token&&(t=this.context.pop()),this.exprAllowed=!t.isExpr
}else this.exprAllowed=!0},y.braceL.updateContext=function(t){this.context.push(this.braceIsBlock(t)?at.b_stat:at.b_expr),this.exprAllowed=!0},
y.dollarBraceL.updateContext=function(){this.context.push(at.b_tmpl),this.exprAllowed=!0},y.parenL.updateContext=function(t){
var e=t===y._if||t===y._for||t===y._with||t===y._while;this.context.push(e?at.p_stat:at.p_expr),this.exprAllowed=!0},y.incDec.updateContext=function(){},
y._function.updateContext=y._class.updateContext=function(t){
!t.beforeExpr||t===y._else||t===y.semi&&this.curContext()!==at.p_stat||t===y._return&&b.test(this.input.slice(this.lastTokEnd,this.start))||(t===y.colon||t===y.braceL)&&this.curContext()===at.b_stat?this.context.push(at.f_stat):this.context.push(at.f_expr),
this.exprAllowed=!1},y.colon.updateContext=function(){"function"===this.curContext().token&&this.context.pop(),this.exprAllowed=!0},
y.backQuote.updateContext=function(){this.curContext()===at.q_tmpl?this.context.pop():this.context.push(at.q_tmpl),this.exprAllowed=!1},
y.star.updateContext=function(t){if(t===y._function){var e=this.context.length-1
;this.context[e]===at.f_expr?this.context[e]=at.f_expr_gen:this.context[e]=at.f_gen}this.exprAllowed=!0},y.name.updateContext=function(t){var e=!1
;this.options.ecmaVersion>=6&&t!==y.dot&&("of"===this.value&&!this.exprAllowed||"yield"===this.value&&this.inGeneratorContext())&&(e=!0),this.exprAllowed=e}
;var ot=H.prototype;function ht(t){return"Identifier"===t.type||"ParenthesizedExpression"===t.type&&ht(t.expression)}function pt(t){
return"MemberExpression"===t.type&&"PrivateIdentifier"===t.property.type||"ChainExpression"===t.type&&pt(t.expression)||"ParenthesizedExpression"===t.type&&pt(t.expression)
}ot.checkPropClash=function(t,e,i){
if(!(this.options.ecmaVersion>=9&&"SpreadElement"===t.type||this.options.ecmaVersion>=6&&(t.computed||t.method||t.shorthand))){var s,r=t.key;switch(r.type){
case"Identifier":s=r.name;break;case"Literal":s=String(r.value);break;default:return}var a=t.kind
;if(this.options.ecmaVersion>=6)"__proto__"===s&&"init"===a&&(e.proto&&(i?i.doubleProto<0&&(i.doubleProto=r.start):this.raiseRecoverable(r.start,"Redefinition of __proto__ property")),
e.proto=!0);else{var n=e[s="$"+s]
;n?("init"===a?this.strict&&n.init||n.get||n.set:n.init||n[a])&&this.raiseRecoverable(r.start,"Redefinition of property"):n=e[s]={init:!1,get:!1,set:!1},n[a]=!0
}}},ot.parseExpression=function(t,e){var i=this;return this.catchStackOverflow(function(){var s=i.start,r=i.startLoc,a=i.parseMaybeAssign(t,e)
;if(i.type===y.comma){var n=i.startNodeAt(s,r);for(n.expressions=[a];i.eat(y.comma);)n.expressions.push(i.parseMaybeAssign(t,e))
;return i.finishNode(n,"SequenceExpression")}return a})},ot.parseMaybeAssign=function(t,e,i){if(this.isContextual("yield")){
if(this.inGenerator)return this.parseYield(t);this.exprAllowed=!1}var s=!1,r=-1,a=-1,n=-1;e?(r=e.parenthesizedAssign,a=e.trailingComma,n=e.doubleProto,
e.parenthesizedAssign=e.trailingComma=-1):(e=new Q,s=!0);var o=this.start,h=this.startLoc
;this.type!==y.parenL&&this.type!==y.name||(this.potentialArrowAt=this.start,this.potentialArrowInForAwait="await"===t);var p=this.parseMaybeConditional(t,e)
;if(i&&(p=i.call(this,p,o,h)),this.type.isAssign){var c=this.startNodeAt(o,h);return c.operator=this.value,this.type===y.eq&&(p=this.toAssignable(p,!1,e)),
s||(e.parenthesizedAssign=e.trailingComma=e.doubleProto=-1),e.shorthandAssign>=p.start&&(e.shorthandAssign=-1),
this.type===y.eq?this.checkLValPattern(p):this.checkLValSimple(p),c.left=p,this.next(),c.right=this.parseMaybeAssign(t),n>-1&&(e.doubleProto=n),
this.finishNode(c,"AssignmentExpression")}return s&&this.checkExpressionErrors(e,!0),r>-1&&(e.parenthesizedAssign=r),a>-1&&(e.trailingComma=a),p},
ot.parseMaybeConditional=function(t,e){var i=this.start,s=this.startLoc,r=this.parseExprOps(t,e);if(this.checkExpressionErrors(e))return r
;if(("ArrowFunctionExpression"!==r.type||r.start!==i)&&this.eat(y.question)){var a=this.startNodeAt(i,s);return a.test=r,a.consequent=this.parseMaybeAssign(),
this.expect(y.colon),a.alternate=this.parseMaybeAssign(t),this.finishNode(a,"ConditionalExpression")}return r},ot.parseExprOps=function(t,e){
var i=this.start,s=this.startLoc,r=this.parseMaybeUnary(e,!1,!1,t)
;return this.checkExpressionErrors(e)||r.start===i&&"ArrowFunctionExpression"===r.type?r:this.parseExprOp(r,i,s,-1,t)},ot.parseExprOp=function(t,e,i,s,r){
var a=this.type.binop;if(null!=a&&(!r||this.type!==y._in)&&a>s){var n=this.type===y.logicalOR||this.type===y.logicalAND,o=this.type===y.coalesce
;o&&(a=y.logicalAND.binop);var h=this.value;this.next()
;var p=this.start,c=this.startLoc,u=this.parseExprOp(this.parseMaybeUnary(null,!1,!1,r),p,c,a,r),l=this.buildBinary(e,i,t,u,h,n||o)
;return(n&&this.type===y.coalesce||o&&(this.type===y.logicalOR||this.type===y.logicalAND))&&this.raiseRecoverable(this.start,"Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses"),
this.parseExprOp(l,e,i,s,r)}return t},ot.buildBinary=function(t,e,i,s,r,a){
"PrivateIdentifier"===s.type&&this.raise(s.start,"Private identifier can only be left side of binary expression");var n=this.startNodeAt(t,e);return n.left=i,
n.operator=r,n.right=s,this.finishNode(n,a?"LogicalExpression":"BinaryExpression")},ot.parseMaybeUnary=function(t,e,i,s){var r,a=this.start,n=this.startLoc
;if(this.isContextual("await")&&this.canAwait)r=this.parseAwait(s),e=!0;else if(this.type.prefix){var o=this.startNode(),h=this.type===y.incDec
;o.operator=this.value,o.prefix=!0,this.next(),o.argument=this.parseMaybeUnary(null,!0,h,s),this.checkExpressionErrors(t,!0),
h?this.checkLValSimple(o.argument):this.strict&&"delete"===o.operator&&ht(o.argument)?this.raiseRecoverable(o.start,"Deleting local variable in strict mode"):"delete"===o.operator&&pt(o.argument)?this.raiseRecoverable(o.start,"Private fields can not be deleted"):e=!0,
r=this.finishNode(o,h?"UpdateExpression":"UnaryExpression")}else if(e||this.type!==y.privateId){if(r=this.parseExprSubscripts(t,s),
this.checkExpressionErrors(t))return r;for(;this.type.postfix&&!this.canInsertSemicolon();){var p=this.startNodeAt(a,n);p.operator=this.value,p.prefix=!1,
p.argument=r,this.checkLValSimple(r),this.next(),r=this.finishNode(p,"UpdateExpression")}
}else(s||0===this.privateNameStack.length)&&this.options.checkPrivateFields&&this.unexpected(),r=this.parsePrivateIdent(),this.type!==y._in&&this.unexpected()
;return i||"ArrowFunctionExpression"===r.type&&r.start===a||!this.eat(y.starstar)?r:e?void this.unexpected(this.lastTokStart):this.buildBinary(a,n,r,this.parseMaybeUnary(null,!1,!1,s),"**",!1)
},ot.parseExprSubscripts=function(t,e){var i=this.start,s=this.startLoc,r=this.parseExprAtom(t,e)
;if("ArrowFunctionExpression"===r.type&&")"!==this.input.slice(this.lastTokStart,this.lastTokEnd))return r;var a=this.parseSubscripts(r,i,s,!1,e)
;return t&&"MemberExpression"===a.type&&(t.parenthesizedAssign>=a.start&&(t.parenthesizedAssign=-1),t.parenthesizedBind>=a.start&&(t.parenthesizedBind=-1),
t.trailingComma>=a.start&&(t.trailingComma=-1)),a},ot.parseSubscripts=function(t,e,i,s,r){
for(var a=this.options.ecmaVersion>=8&&"Identifier"===t.type&&"async"===t.name&&this.lastTokEnd===t.end&&!this.canInsertSemicolon()&&t.end-t.start===5&&this.potentialArrowAt===t.start,n=!1;;){
var o=this.parseSubscript(t,e,i,s,a,n,r);if(o.optional&&(n=!0),o===t||"ArrowFunctionExpression"===o.type){if(n){var h=this.startNodeAt(e,i);h.expression=o,
o=this.finishNode(h,"ChainExpression")}return o}t=o}},ot.shouldParseAsyncArrow=function(){return!this.canInsertSemicolon()&&this.eat(y.arrow)},
ot.parseSubscriptAsyncArrow=function(t,e,i,s){return this.parseArrowExpression(this.startNodeAt(t,e),i,!0,s)},ot.parseSubscript=function(t,e,i,s,r,a,n){
var o=this.options.ecmaVersion>=11,h=o&&this.eat(y.questionDot)
;s&&h&&this.raise(this.lastTokStart,"Optional chaining cannot appear in the callee of new expressions");var p=this.eat(y.bracketL)
;if(p||h&&this.type!==y.parenL&&this.type!==y.backQuote||this.eat(y.dot)){var c=this.startNodeAt(e,i);c.object=t,p?(c.property=this.parseExpression(),
this.expect(y.bracketR)):this.type===y.privateId&&"Super"!==t.type?c.property=this.parsePrivateIdent():c.property=this.parseIdent("never"!==this.options.allowReserved),
c.computed=!!p,o&&(c.optional=h),t=this.finishNode(c,"MemberExpression")}else if(!s&&this.eat(y.parenL)){
var u=new Q,l=this.yieldPos,d=this.awaitPos,f=this.awaitIdentPos;this.yieldPos=0,this.awaitPos=0,this.awaitIdentPos=0
;var m=this.parseExprList(y.parenR,this.options.ecmaVersion>=8,!1,u);if(r&&!h&&this.shouldParseAsyncArrow())return this.checkPatternErrors(u,!1),
this.checkYieldAwaitInDefaultParams(),this.awaitIdentPos>0&&this.raise(this.awaitIdentPos,"Cannot use 'await' as identifier inside an async function"),
this.yieldPos=l,this.awaitPos=d,this.awaitIdentPos=f,this.parseSubscriptAsyncArrow(e,i,m,n);this.checkExpressionErrors(u,!0),this.yieldPos=l||this.yieldPos,
this.awaitPos=d||this.awaitPos,this.awaitIdentPos=f||this.awaitIdentPos;var g=this.startNodeAt(e,i);g.callee=t,g.arguments=m,o&&(g.optional=h),
t=this.finishNode(g,"CallExpression")}else if(this.type===y.backQuote){
(h||a)&&this.raise(this.start,"Optional chaining cannot appear in the tag of tagged template expressions");var x=this.startNodeAt(e,i);x.tag=t,
x.quasi=this.parseTemplate({isTagged:!0}),t=this.finishNode(x,"TaggedTemplateExpression")}return t},ot.parseExprAtom=function(t,e,i){
this.type===y.slash&&this.readRegexp();var s,r=this.potentialArrowAt===this.start;switch(this.type){case y._super:
return this.allowSuper||this.raise(this.start,"'super' keyword outside a method"),s=this.startNode(),this.next(),
this.type!==y.parenL||this.allowDirectSuper||this.raise(s.start,"super() call outside constructor of a subclass"),
this.type!==y.dot&&this.type!==y.bracketL&&this.type!==y.parenL&&this.unexpected(),this.finishNode(s,"Super");case y._this:return s=this.startNode(),
this.next(),this.finishNode(s,"ThisExpression");case y.name:var a=this.start,n=this.startLoc,o=this.containsEsc,h=this.parseIdent(!1)
;if(this.options.ecmaVersion>=8&&!o&&"async"===h.name&&!this.canInsertSemicolon()&&this.eat(y._function))return this.overrideContext(at.f_expr),
this.parseFunction(this.startNodeAt(a,n),0,!1,!0,e);if(r&&!this.canInsertSemicolon()){
if(this.eat(y.arrow))return this.parseArrowExpression(this.startNodeAt(a,n),[h],!1,e)
;if(this.options.ecmaVersion>=8&&"async"===h.name&&this.type===y.name&&!o&&(!this.potentialArrowInForAwait||"of"!==this.value||this.containsEsc))return h=this.parseIdent(!1),
!this.canInsertSemicolon()&&this.eat(y.arrow)||this.unexpected(),this.parseArrowExpression(this.startNodeAt(a,n),[h],!0,e)}return h;case y.regexp:
var p=this.value;return(s=this.parseLiteral(p.value)).regex={pattern:p.pattern,flags:p.flags},s;case y.num:case y.string:return this.parseLiteral(this.value)
;case y._null:case y._true:case y._false:return(s=this.startNode()).value=this.type===y._null?null:this.type===y._true,s.raw=this.type.keyword,this.next(),
this.finishNode(s,"Literal");case y.parenL:var c=this.start,u=this.parseParenAndDistinguishExpression(r,e)
;return t&&(t.parenthesizedAssign<0&&!this.isSimpleAssignTarget(u)&&(t.parenthesizedAssign=c),t.parenthesizedBind<0&&(t.parenthesizedBind=c)),u;case y.bracketL:
return s=this.startNode(),this.next(),s.elements=this.parseExprList(y.bracketR,!0,!0,t),this.finishNode(s,"ArrayExpression");case y.braceL:
return this.overrideContext(at.b_expr),this.parseObj(!1,t);case y._function:return s=this.startNode(),this.next(),this.parseFunction(s,0);case y._class:
return this.parseClass(this.startNode(),!1);case y._new:return this.parseNew();case y.backQuote:return this.parseTemplate();case y._import:
return this.options.ecmaVersion>=11?this.parseExprImport(i):this.unexpected();default:return this.parseExprAtomDefault()}},ot.parseExprAtomDefault=function(){
this.unexpected()},ot.parseExprImport=function(t){var e=this.startNode()
;if(this.containsEsc&&this.raiseRecoverable(this.start,"Escape sequence in keyword import"),this.next(),
this.type===y.parenL&&!t)return this.parseDynamicImport(e);if(this.type===y.dot){var i=this.startNodeAt(e.start,e.loc&&e.loc.start);return i.name="import",
e.meta=this.finishNode(i,"Identifier"),this.parseImportMeta(e)}this.unexpected()},ot.parseDynamicImport=function(t){if(this.next(),
t.source=this.parseMaybeAssign(),this.options.ecmaVersion>=16)this.eat(y.parenR)?t.options=null:(this.expect(y.comma),
this.afterTrailingComma(y.parenR)?t.options=null:(t.options=this.parseMaybeAssign(),this.eat(y.parenR)||(this.expect(y.comma),
this.afterTrailingComma(y.parenR)||this.unexpected())));else if(!this.eat(y.parenR)){var e=this.start
;this.eat(y.comma)&&this.eat(y.parenR)?this.raiseRecoverable(e,"Trailing comma is not allowed in import()"):this.unexpected(e)}
return this.finishNode(t,"ImportExpression")},ot.parseImportMeta=function(t){this.next();var e=this.containsEsc;return t.property=this.parseIdent(!0),
"meta"!==t.property.name&&this.raiseRecoverable(t.property.start,"The only valid meta property for import is 'import.meta'"),
e&&this.raiseRecoverable(t.start,"'import.meta' must not contain escaped characters"),
"module"===this.options.sourceType||this.options.allowImportExportEverywhere||this.raiseRecoverable(t.start,"Cannot use 'import.meta' outside a module"),
this.finishNode(t,"MetaProperty")},ot.parseLiteral=function(t){var e=this.startNode();return e.value=t,e.raw=this.input.slice(this.start,this.end),
110===e.raw.charCodeAt(e.raw.length-1)&&(e.bigint=null!=e.value?e.value.toString():e.raw.slice(0,-1).replace(/_/g,"")),this.next(),this.finishNode(e,"Literal")
},ot.parseParenExpression=function(){this.expect(y.parenL);var t=this.parseExpression();return this.expect(y.parenR),t},ot.shouldParseArrow=function(t){
return!this.canInsertSemicolon()},ot.parseParenAndDistinguishExpression=function(t,e){var i,s=this.start,r=this.startLoc,a=this.options.ecmaVersion>=8
;if(this.options.ecmaVersion>=6){this.next();var n,o=this.start,h=this.startLoc,p=[],c=!0,u=!1,l=new Q,d=this.yieldPos,f=this.awaitPos;for(this.yieldPos=0,
this.awaitPos=0;this.type!==y.parenR;){if(c?c=!1:this.expect(y.comma),a&&this.afterTrailingComma(y.parenR,!0)){u=!0;break}if(this.type===y.ellipsis){
n=this.start,
p.push(this.parseParenItem(this.parseRestBinding())),this.type===y.comma&&this.raiseRecoverable(this.start,"Comma is not permitted after the rest element")
;break}p.push(this.parseMaybeAssign(!1,l,this.parseParenItem))}var m=this.lastTokEnd,g=this.lastTokEndLoc;if(this.expect(y.parenR),
t&&this.shouldParseArrow(p)&&this.eat(y.arrow))return this.checkPatternErrors(l,!1),this.checkYieldAwaitInDefaultParams(),this.yieldPos=d,this.awaitPos=f,
this.parseParenArrowList(s,r,p,e);p.length&&!u||this.unexpected(this.lastTokStart),n&&this.unexpected(n),this.checkExpressionErrors(l,!0),
this.yieldPos=d||this.yieldPos,this.awaitPos=f||this.awaitPos,p.length>1?((i=this.startNodeAt(o,h)).expressions=p,
this.finishNodeAt(i,"SequenceExpression",m,g)):i=p[0]}else i=this.parseParenExpression();if(this.options.preserveParens){var x=this.startNodeAt(s,r)
;return x.expression=i,this.finishNode(x,"ParenthesizedExpression")}return i},ot.parseParenItem=function(t){return t},ot.parseParenArrowList=function(t,e,i,s){
return this.parseArrowExpression(this.startNodeAt(t,e),i,!1,s)};var ct=[];ot.parseNew=function(){
this.containsEsc&&this.raiseRecoverable(this.start,"Escape sequence in keyword new");var t=this.startNode();if(this.next(),
this.options.ecmaVersion>=6&&this.type===y.dot){var e=this.startNodeAt(t.start,t.loc&&t.loc.start);e.name="new",t.meta=this.finishNode(e,"Identifier"),
this.next();var i=this.containsEsc
;return t.property=this.parseIdent(!0),"target"!==t.property.name&&this.raiseRecoverable(t.property.start,"The only valid meta property for new is 'new.target'"),
i&&this.raiseRecoverable(t.start,"'new.target' must not contain escaped characters"),
this.allowNewDotTarget||this.raiseRecoverable(t.start,"'new.target' can only be used in functions and class static block"),this.finishNode(t,"MetaProperty")}
var s=this.start,r=this.startLoc;return t.callee=this.parseSubscripts(this.parseExprAtom(null,!1,!0),s,r,!0,!1),
"Super"===t.callee.type&&this.raiseRecoverable(s,"Invalid use of 'super'"),
this.eat(y.parenL)?t.arguments=this.parseExprList(y.parenR,this.options.ecmaVersion>=8,!1):t.arguments=ct,this.finishNode(t,"NewExpression")},
ot.parseTemplateElement=function(t){var e=t.isTagged,i=this.startNode()
;return this.type===y.invalidTemplate?(e||this.raiseRecoverable(this.start,"Bad escape sequence in untagged template literal"),i.value={
raw:this.value.replace(/\r\n?/g,"\n"),cooked:null}):i.value={raw:this.input.slice(this.start,this.end).replace(/\r\n?/g,"\n"),cooked:this.value},this.next(),
i.tail=this.type===y.backQuote,this.finishNode(i,"TemplateElement")},ot.parseTemplate=function(t){void 0===t&&(t={});var e=t.isTagged;void 0===e&&(e=!1)
;var i=this.startNode();this.next(),i.expressions=[];var s=this.parseTemplateElement({isTagged:e})
;for(i.quasis=[s];!s.tail;)this.type===y.eof&&this.raise(this.pos,"Unterminated template literal"),this.expect(y.dollarBraceL),
i.expressions.push(this.parseExpression()),this.expect(y.braceR),i.quasis.push(s=this.parseTemplateElement({isTagged:e}));return this.next(),
this.finishNode(i,"TemplateLiteral")},ot.isAsyncProp=function(t){
return!t.computed&&"Identifier"===t.key.type&&"async"===t.key.name&&(this.type===y.name||this.type===y.num||this.type===y.string||this.type===y.bracketL||this.type.keyword||this.options.ecmaVersion>=9&&this.type===y.star)&&!b.test(this.input.slice(this.lastTokEnd,this.start))
},ot.parseObj=function(t,e){var i=this.startNode(),s=!0,r={};for(i.properties=[],this.next();!this.eat(y.braceR);){if(s)s=!1;else if(this.expect(y.comma),
this.options.ecmaVersion>=5&&this.afterTrailingComma(y.braceR))break;var a=this.parseProperty(t,e);t||this.checkPropClash(a,r,e),i.properties.push(a)}
return this.finishNode(i,t?"ObjectPattern":"ObjectExpression")},ot.parseProperty=function(t,e){var i,s,r,a,n=this.startNode()
;if(this.options.ecmaVersion>=9&&this.eat(y.ellipsis))return t?(n.argument=this.parseIdent(!1),
this.type===y.comma&&this.raiseRecoverable(this.start,"Comma is not permitted after the rest element"),
this.finishNode(n,"RestElement")):(n.argument=this.parseMaybeAssign(!1,e),this.type===y.comma&&e&&e.trailingComma<0&&(e.trailingComma=this.start),
this.finishNode(n,"SpreadElement"));this.options.ecmaVersion>=6&&(n.method=!1,n.shorthand=!1,(t||e)&&(r=this.start,a=this.startLoc),t||(i=this.eat(y.star)))
;var o=this.containsEsc;return this.parsePropertyName(n),!t&&!o&&this.options.ecmaVersion>=8&&!i&&this.isAsyncProp(n)?(s=!0,
i=this.options.ecmaVersion>=9&&this.eat(y.star),this.parsePropertyName(n)):s=!1,this.parsePropertyValue(n,t,i,s,r,a,e,o),this.finishNode(n,"Property")},
ot.parseGetterSetter=function(t){var e=t.key.name;this.parsePropertyName(t),t.value=this.parseMethod(!1),t.kind=e;var i="get"===t.kind?0:1
;if(t.value.params.length!==i){var s=t.value.start
;"get"===t.kind?this.raiseRecoverable(s,"getter should have no params"):this.raiseRecoverable(s,"setter should have exactly one param")
}else"set"===t.kind&&"RestElement"===t.value.params[0].type&&this.raiseRecoverable(t.value.params[0].start,"Setter cannot use rest params")},
ot.parsePropertyValue=function(t,e,i,s,r,a,n,o){(i||s)&&this.type===y.colon&&this.unexpected(),
this.eat(y.colon)?(t.value=e?this.parseMaybeDefault(this.start,this.startLoc):this.parseMaybeAssign(!1,n),
t.kind="init"):this.options.ecmaVersion>=6&&this.type===y.parenL?(e&&this.unexpected(),t.method=!0,t.value=this.parseMethod(i,s),
t.kind="init"):e||o||!(this.options.ecmaVersion>=5)||t.computed||"Identifier"!==t.key.type||"get"!==t.key.name&&"set"!==t.key.name||this.type===y.comma||this.type===y.braceR||this.type===y.eq?this.options.ecmaVersion>=6&&!t.computed&&"Identifier"===t.key.type?((i||s)&&this.unexpected(),
this.checkUnreserved(t.key),"await"!==t.key.name||this.awaitIdentPos||(this.awaitIdentPos=r),
e?t.value=this.parseMaybeDefault(r,a,this.copyNode(t.key)):this.type===y.eq&&n?(n.shorthandAssign<0&&(n.shorthandAssign=this.start),
t.value=this.parseMaybeDefault(r,a,this.copyNode(t.key))):t.value=this.copyNode(t.key),t.kind="init",
t.shorthand=!0):this.unexpected():((i||s)&&this.unexpected(),this.parseGetterSetter(t))},ot.parsePropertyName=function(t){if(this.options.ecmaVersion>=6){
if(this.eat(y.bracketL))return t.computed=!0,t.key=this.parseMaybeAssign(),this.expect(y.bracketR),t.key;t.computed=!1}
return t.key=this.type===y.num||this.type===y.string?this.parseExprAtom():this.parseIdent("never"!==this.options.allowReserved)},ot.initFunction=function(t){
t.id=null,this.options.ecmaVersion>=6&&(t.generator=t.expression=!1),this.options.ecmaVersion>=8&&(t.async=!1)},ot.parseMethod=function(t,e,i){
var s=this.startNode(),r=this.yieldPos,a=this.awaitPos,n=this.awaitIdentPos;return this.initFunction(s),this.options.ecmaVersion>=6&&(s.generator=t),
this.options.ecmaVersion>=8&&(s.async=!!e),this.yieldPos=0,this.awaitPos=0,this.awaitIdentPos=0,this.enterScope(64|G(e,s.generator)|(i?128:0)),
this.expect(y.parenL),s.params=this.parseBindingList(y.parenR,!1,this.options.ecmaVersion>=8),this.checkYieldAwaitInDefaultParams(),
this.parseFunctionBody(s,!1,!0,!1),this.yieldPos=r,this.awaitPos=a,this.awaitIdentPos=n,this.finishNode(s,"FunctionExpression")},
ot.parseArrowExpression=function(t,e,i,s){var r=this.yieldPos,a=this.awaitPos,n=this.awaitIdentPos;return this.enterScope(16|G(i,!1)),this.initFunction(t),
this.options.ecmaVersion>=8&&(t.async=!!i),this.yieldPos=0,this.awaitPos=0,this.awaitIdentPos=0,t.params=this.toAssignableList(e,!0),
this.parseFunctionBody(t,!0,!1,s),this.yieldPos=r,this.awaitPos=a,this.awaitIdentPos=n,this.finishNode(t,"ArrowFunctionExpression")},
ot.parseFunctionBody=function(t,e,i,s){var r=e&&this.type!==y.braceL,a=this.strict,n=!1;if(r)t.body=this.parseMaybeAssign(s),t.expression=!0,
this.checkParams(t,!1);else{var o=this.options.ecmaVersion>=7&&!this.isSimpleParamList(t.params)
;a&&!o||(n=this.strictDirective(this.end))&&o&&this.raiseRecoverable(t.start,"Illegal 'use strict' directive in function with non-simple parameter list")
;var h=this.labels;this.labels=[],n&&(this.strict=!0),this.checkParams(t,!a&&!n&&!e&&!i&&this.isSimpleParamList(t.params)),
this.strict&&t.id&&this.checkLValSimple(t.id,5),t.body=this.parseBlock(!1,void 0,n&&!a),t.expression=!1,this.adaptDirectivePrologue(t.body.body),this.labels=h}
this.exitScope()},ot.isSimpleParamList=function(t){for(var e=0,i=t;e<i.length;e+=1)if("Identifier"!==i[e].type)return!1;return!0},ot.checkParams=function(t,e){
for(var i=Object.create(null),s=0,r=t.params;s<r.length;s+=1){var a=r[s];this.checkLValInnerPattern(a,1,e?null:i)}},ot.parseExprList=function(t,e,i,s){
for(var r=[],a=!0;!this.eat(t);){if(a)a=!1;else if(this.expect(y.comma),e&&this.afterTrailingComma(t))break;var n=void 0
;i&&this.type===y.comma?n=null:this.type===y.ellipsis?(n=this.parseSpread(s),
s&&this.type===y.comma&&s.trailingComma<0&&(s.trailingComma=this.start)):n=this.parseMaybeAssign(!1,s),r.push(n)}return r},ot.checkUnreserved=function(t){
var e=t.start,i=t.end,s=t.name;this.inGenerator&&"yield"===s&&this.raiseRecoverable(e,"Cannot use 'yield' as identifier inside a generator"),
this.inAsync&&"await"===s&&this.raiseRecoverable(e,"Cannot use 'await' as identifier inside an async function"),
this.currentThisScope().flags&j||"arguments"!==s||this.raiseRecoverable(e,"Cannot use 'arguments' in class field initializer"),
!this.inClassStaticBlock||"arguments"!==s&&"await"!==s||this.raise(e,"Cannot use "+s+" in class static initialization block"),
this.keywords.test(s)&&this.raise(e,"Unexpected keyword '"+s+"'"),
this.options.ecmaVersion<6&&-1!==this.input.slice(e,i).indexOf("\\")||(this.strict?this.reservedWordsStrict:this.reservedWords).test(s)&&(this.inAsync||"await"!==s||this.raiseRecoverable(e,"Cannot use keyword 'await' outside an async function"),
this.raiseRecoverable(e,"The keyword '"+s+"' is reserved"))},ot.parseIdent=function(t){var e=this.parseIdentNode();return this.next(!!t),
this.finishNode(e,"Identifier"),t||(this.checkUnreserved(e),"await"!==e.name||this.awaitIdentPos||(this.awaitIdentPos=e.start)),e},ot.parseIdentNode=function(){
var t=this.startNode();return this.type===y.name?t.name=this.value:this.type.keyword?(t.name=this.type.keyword,
"class"!==t.name&&"function"!==t.name||this.lastTokEnd===this.lastTokStart+1&&46===this.input.charCodeAt(this.lastTokStart)||this.context.pop(),
this.type=y.name):this.unexpected(),t},ot.parsePrivateIdent=function(){var t=this.startNode()
;return this.type===y.privateId?t.name=this.value:this.unexpected(),this.next(),this.finishNode(t,"PrivateIdentifier"),
this.options.checkPrivateFields&&(0===this.privateNameStack.length?this.raise(t.start,"Private field '#"+t.name+"' must be declared in an enclosing class"):this.privateNameStack[this.privateNameStack.length-1].used.push(t)),
t},ot.parseYield=function(t){this.yieldPos||(this.yieldPos=this.start);var e=this.startNode();return this.next(),
this.type===y.semi||this.canInsertSemicolon()||this.type!==y.star&&!this.type.startsExpr?(e.delegate=!1,e.argument=null):(e.delegate=this.eat(y.star),
e.argument=this.parseMaybeAssign(t)),this.finishNode(e,"YieldExpression")},ot.parseAwait=function(t){this.awaitPos||(this.awaitPos=this.start)
;var e=this.startNode();return this.next(),e.argument=this.parseMaybeUnary(null,!0,!1,t),this.finishNode(e,"AwaitExpression")};var ut=H.prototype
;ut.raise=function(t,e){var i=B(this.input,t);e+=" ("+i.line+":"+i.column+")",this.sourceFile&&(e+=" in "+this.sourceFile);var s=new SyntaxError(e)
;throw s.pos=t,s.loc=i,s.raisedAt=this.pos,s},ut.raiseRecoverable=ut.raise,ut.curPosition=function(){
if(this.options.locations)return new D(this.curLine,this.pos-this.lineStart)};var lt=H.prototype,dt=function(t){this.flags=t,this.var=[],this.lexical=[],
this.functions=[]};lt.enterScope=function(t){this.scopeStack.push(new dt(t))},lt.exitScope=function(){this.scopeStack.pop()},
lt.treatFunctionsAsVarInScope=function(t){return 2&t.flags||!this.inModule&&1&t.flags},lt.declareName=function(t,e,i){var s=!1;if(2===e){
var r=this.currentScope();s=r.lexical.indexOf(t)>-1||r.functions.indexOf(t)>-1||r.var.indexOf(t)>-1,r.lexical.push(t),
this.inModule&&1&r.flags&&delete this.undefinedExports[t]}else if(4===e)this.currentScope().lexical.push(t);else if(3===e){var a=this.currentScope()
;s=this.treatFunctionsAsVar?a.lexical.indexOf(t)>-1:a.lexical.indexOf(t)>-1||a.var.indexOf(t)>-1,a.functions.push(t)
}else for(var n=this.scopeStack.length-1;n>=0;--n){var o=this.scopeStack[n]
;if(o.lexical.indexOf(t)>-1&&!(32&o.flags&&o.lexical[0]===t)||!this.treatFunctionsAsVarInScope(o)&&o.functions.indexOf(t)>-1){s=!0;break}if(o.var.push(t),
this.inModule&&1&o.flags&&delete this.undefinedExports[t],o.flags&j)break}s&&this.raiseRecoverable(i,"Identifier '"+t+"' has already been declared")},
lt.checkLocalExport=function(t){-1===this.scopeStack[0].lexical.indexOf(t.name)&&-1===this.scopeStack[0].var.indexOf(t.name)&&(this.undefinedExports[t.name]=t)
},lt.currentScope=function(){return this.scopeStack[this.scopeStack.length-1]},lt.currentVarScope=function(){for(var t=this.scopeStack.length-1;;t--){
var e=this.scopeStack[t];if(771&e.flags)return e}},lt.currentThisScope=function(){for(var t=this.scopeStack.length-1;;t--){var e=this.scopeStack[t]
;if(771&e.flags&&!(16&e.flags))return e}};var ft=function(t,e,i){this.type="",this.start=e,this.end=0,t.options.locations&&(this.loc=new O(t,i)),
t.options.directSourceFile&&(this.sourceFile=t.options.directSourceFile),t.options.ranges&&(this.range=[e,0])},mt=H.prototype;function gt(t,e,i,s){
return t.type=e,t.end=i,this.options.locations&&(t.loc.end=s),this.options.ranges&&(t.range[1]=i),t}mt.startNode=function(){
return new ft(this,this.start,this.startLoc)},mt.startNodeAt=function(t,e){return new ft(this,t,e)},mt.finishNode=function(t,e){
return gt.call(this,t,e,this.lastTokEnd,this.lastTokEndLoc)},mt.finishNodeAt=function(t,e,i,s){return gt.call(this,t,e,i,s)},mt.copyNode=function(t){
var e=new ft(this,t.start,this.startLoc);for(var i in t)e[i]=t[i];return e}
;var xt="ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS",vt=xt+" Extended_Pictographic",yt=vt+" EBase EComp EMod EPres ExtPict",bt={
9:xt,10:vt,11:vt,12:yt,13:yt,14:yt},_t={9:"",10:"",11:"",12:"",13:"",
14:"Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji"
},kt="Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu",St="Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb",Ct=St+" Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd",wt=Ct+" Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho",Et=wt+" Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi",At=Et+" Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith",It={
9:St,10:Ct,11:wt,12:Et,13:At,
14:At+" Berf Beria_Erfe Gara Garay Gukh Gurung_Khema Hrkt Katakana_Or_Hiragana Kawi Kirat_Rai Krai Nag_Mundari Nagm Ol_Onal Onao Sidetic Sidt Sunu Sunuwar Tai_Yo Tayo Todhri Todr Tolong_Siki Tols Tulu_Tigalari Tutg Unknown Zzzz"
},Pt={};function Vt(t){var e=Pt[t]={binary:T(bt[t]+" "+kt),binaryOfStrings:T(_t[t]),nonBinary:{General_Category:T(kt),Script:T(It[t])}}
;e.nonBinary.Script_Extensions=e.nonBinary.Script,e.nonBinary.gc=e.nonBinary.General_Category,e.nonBinary.sc=e.nonBinary.Script,
e.nonBinary.scx=e.nonBinary.Script_Extensions}for(var Nt=0,Tt=[9,10,11,12,13,14];Nt<Tt.length;Nt+=1)Vt(Tt[Nt]);var Lt=H.prototype,Rt=function(t,e){
this.parent=t,this.base=e||this};Rt.prototype.separatedFrom=function(t){for(var e=this;e;e=e.parent)for(var i=t;i;i=i.parent)if(e.base===i.base&&e!==i)return!0
;return!1},Rt.prototype.sibling=function(){return new Rt(this.parent,this.base)};var Dt=function(t){this.parser=t,
this.validFlags="gim"+(t.options.ecmaVersion>=6?"uy":"")+(t.options.ecmaVersion>=9?"s":"")+(t.options.ecmaVersion>=13?"d":"")+(t.options.ecmaVersion>=15?"v":""),
this.unicodeProperties=Pt[t.options.ecmaVersion>=14?14:t.options.ecmaVersion],this.source="",this.flags="",this.start=0,this.switchU=!1,this.switchV=!1,
this.switchN=!1,this.pos=0,this.lastIntValue=0,this.lastStringValue="",this.lastAssertionIsQuantifiable=!1,this.numCapturingParens=0,this.maxBackReference=0,
this.groupNames=Object.create(null),this.backReferenceNames=[],this.branchID=null};function Ot(t){return 105===t||109===t||115===t}function Bt(t){
return 36===t||t>=40&&t<=43||46===t||63===t||t>=91&&t<=94||t>=123&&t<=125}function Mt(t){return t>=65&&t<=90||t>=97&&t<=122}function Ft(t){return Mt(t)||95===t}
function Ut(t){return Ft(t)||qt(t)}function qt(t){return t>=48&&t<=57}function jt(t){return t>=48&&t<=57||t>=65&&t<=70||t>=97&&t<=102}function Gt(t){
return t>=65&&t<=70?t-65+10:t>=97&&t<=102?t-97+10:t-48}function Ht(t){return t>=48&&t<=55}Dt.prototype.reset=function(t,e,i){
var s=-1!==i.indexOf("v"),r=-1!==i.indexOf("u");this.start=0|t,this.source=e+"",this.flags=i,s&&this.parser.options.ecmaVersion>=15?(this.switchU=!0,
this.switchV=!0,this.switchN=!0):(this.switchU=r&&this.parser.options.ecmaVersion>=6,this.switchV=!1,this.switchN=r&&this.parser.options.ecmaVersion>=9)},
Dt.prototype.raise=function(t){this.parser.raiseRecoverable(this.start,"Invalid regular expression: /"+this.source+"/: "+t)},Dt.prototype.at=function(t,e){
void 0===e&&(e=!1);var i=this.source,s=i.length;if(t>=s)return-1;var r=i.charCodeAt(t);if(!e&&!this.switchU||r<=55295||r>=57344||t+1>=s)return r
;var a=i.charCodeAt(t+1);return a>=56320&&a<=57343?(r<<10)+a-56613888:r},Dt.prototype.nextIndex=function(t,e){void 0===e&&(e=!1);var i=this.source,s=i.length
;if(t>=s)return s;var r,a=i.charCodeAt(t);return!e&&!this.switchU||a<=55295||a>=57344||t+1>=s||(r=i.charCodeAt(t+1))<56320||r>57343?t+1:t+2},
Dt.prototype.current=function(t){return void 0===t&&(t=!1),this.at(this.pos,t)},Dt.prototype.lookahead=function(t){return void 0===t&&(t=!1),
this.at(this.nextIndex(this.pos,t),t)},Dt.prototype.advance=function(t){void 0===t&&(t=!1),this.pos=this.nextIndex(this.pos,t)},Dt.prototype.eat=function(t,e){
return void 0===e&&(e=!1),this.current(e)===t&&(this.advance(e),!0)},Dt.prototype.eatChars=function(t,e){void 0===e&&(e=!1)
;for(var i=this.pos,s=0,r=t;s<r.length;s+=1){var a=r[s],n=this.at(i,e);if(-1===n||n!==a)return!1;i=this.nextIndex(i,e)}return this.pos=i,!0},
Lt.validateRegExpFlags=function(t){for(var e=t.validFlags,i=t.flags,s=!1,r=!1,a=0;a<i.length;a++){var n=i.charAt(a)
;-1===e.indexOf(n)&&this.raise(t.start,"Invalid regular expression flag"),i.indexOf(n,a+1)>-1&&this.raise(t.start,"Duplicate regular expression flag"),
"u"===n&&(s=!0),"v"===n&&(r=!0)}this.options.ecmaVersion>=15&&s&&r&&this.raise(t.start,"Invalid regular expression flag")},Lt.validateRegExpPattern=function(t){
this.regexp_pattern(t),!t.switchN&&this.options.ecmaVersion>=9&&function(t){for(var e in t)return!0;return!1}(t.groupNames)&&(t.switchN=!0,
this.regexp_pattern(t))},Lt.regexp_pattern=function(t){t.pos=0,t.lastIntValue=0,t.lastStringValue="",t.lastAssertionIsQuantifiable=!1,t.numCapturingParens=0,
t.maxBackReference=0,t.groupNames=Object.create(null),t.backReferenceNames.length=0,t.branchID=null,this.regexp_disjunction(t),
t.pos!==t.source.length&&(t.eat(41)&&t.raise("Unmatched ')'"),(t.eat(93)||t.eat(125))&&t.raise("Lone quantifier brackets")),
t.maxBackReference>t.numCapturingParens&&t.raise("Invalid escape");for(var e=0,i=t.backReferenceNames;e<i.length;e+=1){var s=i[e]
;t.groupNames[s]||t.raise("Invalid named capture referenced")}},Lt.regexp_disjunction=function(t){var e=this.options.ecmaVersion>=16
;for(e&&(t.branchID=new Rt(t.branchID,null)),this.regexp_alternative(t);t.eat(124);)e&&(t.branchID=t.branchID.sibling()),this.regexp_alternative(t)
;e&&(t.branchID=t.branchID.parent),this.regexp_eatQuantifier(t,!0)&&t.raise("Nothing to repeat"),t.eat(123)&&t.raise("Lone quantifier brackets")},
Lt.regexp_alternative=function(t){for(;t.pos<t.source.length&&this.regexp_eatTerm(t););},Lt.regexp_eatTerm=function(t){
return this.regexp_eatAssertion(t)?(t.lastAssertionIsQuantifiable&&this.regexp_eatQuantifier(t)&&t.switchU&&t.raise("Invalid quantifier"),
!0):!!(t.switchU?this.regexp_eatAtom(t):this.regexp_eatExtendedAtom(t))&&(this.regexp_eatQuantifier(t),!0)},Lt.regexp_eatAssertion=function(t){var e=t.pos
;if(t.lastAssertionIsQuantifiable=!1,t.eat(94)||t.eat(36))return!0;if(t.eat(92)){if(t.eat(66)||t.eat(98))return!0;t.pos=e}if(t.eat(40)&&t.eat(63)){var i=!1
;if(this.options.ecmaVersion>=9&&(i=t.eat(60)),t.eat(61)||t.eat(33))return this.regexp_disjunction(t),t.eat(41)||t.raise("Unterminated group"),
t.lastAssertionIsQuantifiable=!i,!0}return t.pos=e,!1},Lt.regexp_eatQuantifier=function(t,e){return void 0===e&&(e=!1),
!!this.regexp_eatQuantifierPrefix(t,e)&&(t.eat(63),!0)},Lt.regexp_eatQuantifierPrefix=function(t,e){
return t.eat(42)||t.eat(43)||t.eat(63)||this.regexp_eatBracedQuantifier(t,e)},Lt.regexp_eatBracedQuantifier=function(t,e){var i=t.pos;if(t.eat(123)){
var s=0,r=-1;if(this.regexp_eatDecimalDigits(t)&&(s=t.lastIntValue,t.eat(44)&&this.regexp_eatDecimalDigits(t)&&(r=t.lastIntValue),
t.eat(125)))return-1!==r&&r<s&&!e&&t.raise("numbers out of order in {} quantifier"),!0;t.switchU&&!e&&t.raise("Incomplete quantifier"),t.pos=i}return!1},
Lt.regexp_eatAtom=function(t){
return this.regexp_eatPatternCharacters(t)||t.eat(46)||this.regexp_eatReverseSolidusAtomEscape(t)||this.regexp_eatCharacterClass(t)||this.regexp_eatUncapturingGroup(t)||this.regexp_eatCapturingGroup(t)
},Lt.regexp_eatReverseSolidusAtomEscape=function(t){var e=t.pos;if(t.eat(92)){if(this.regexp_eatAtomEscape(t))return!0;t.pos=e}return!1},
Lt.regexp_eatUncapturingGroup=function(t){var e=t.pos;if(t.eat(40)){if(t.eat(63)){if(this.options.ecmaVersion>=16){var i=this.regexp_eatModifiers(t),s=t.eat(45)
;if(i||s){for(var r=0;r<i.length;r++){var a=i.charAt(r);i.indexOf(a,r+1)>-1&&t.raise("Duplicate regular expression modifiers")}if(s){
var n=this.regexp_eatModifiers(t);i||n||58!==t.current()||t.raise("Invalid regular expression modifiers");for(var o=0;o<n.length;o++){var h=n.charAt(o)
;(n.indexOf(h,o+1)>-1||i.indexOf(h)>-1)&&t.raise("Duplicate regular expression modifiers")}}}}if(t.eat(58)){if(this.regexp_disjunction(t),t.eat(41))return!0
;t.raise("Unterminated group")}}t.pos=e}return!1},Lt.regexp_eatCapturingGroup=function(t){if(t.eat(40)){
if(this.options.ecmaVersion>=9?this.regexp_groupSpecifier(t):63===t.current()&&t.raise("Invalid group"),this.regexp_disjunction(t),
t.eat(41))return t.numCapturingParens+=1,!0;t.raise("Unterminated group")}return!1},Lt.regexp_eatModifiers=function(t){
for(var e="",i=0;-1!==(i=t.current())&&Ot(i);)e+=L(i),t.advance();return e},Lt.regexp_eatExtendedAtom=function(t){
return t.eat(46)||this.regexp_eatReverseSolidusAtomEscape(t)||this.regexp_eatCharacterClass(t)||this.regexp_eatUncapturingGroup(t)||this.regexp_eatCapturingGroup(t)||this.regexp_eatInvalidBracedQuantifier(t)||this.regexp_eatExtendedPatternCharacter(t)
},Lt.regexp_eatInvalidBracedQuantifier=function(t){return this.regexp_eatBracedQuantifier(t,!0)&&t.raise("Nothing to repeat"),!1},
Lt.regexp_eatSyntaxCharacter=function(t){var e=t.current();return!!Bt(e)&&(t.lastIntValue=e,t.advance(),!0)},Lt.regexp_eatPatternCharacters=function(t){
for(var e=t.pos,i=0;-1!==(i=t.current())&&!Bt(i);)t.advance();return t.pos!==e},Lt.regexp_eatExtendedPatternCharacter=function(t){var e=t.current()
;return!(-1===e||36===e||e>=40&&e<=43||46===e||63===e||91===e||94===e||124===e||(t.advance(),0))},Lt.regexp_groupSpecifier=function(t){if(t.eat(63)){
this.regexp_eatGroupName(t)||t.raise("Invalid group");var e=this.options.ecmaVersion>=16,i=t.groupNames[t.lastStringValue]
;if(i)if(e)for(var s=0,r=i;s<r.length;s+=1)r[s].separatedFrom(t.branchID)||t.raise("Duplicate capture group name");else t.raise("Duplicate capture group name")
;e?(i||(t.groupNames[t.lastStringValue]=[])).push(t.branchID):t.groupNames[t.lastStringValue]=!0}},Lt.regexp_eatGroupName=function(t){if(t.lastStringValue="",
t.eat(60)){if(this.regexp_eatRegExpIdentifierName(t)&&t.eat(62))return!0;t.raise("Invalid capture group name")}return!1},
Lt.regexp_eatRegExpIdentifierName=function(t){if(t.lastStringValue="",this.regexp_eatRegExpIdentifierStart(t)){
for(t.lastStringValue+=L(t.lastIntValue);this.regexp_eatRegExpIdentifierPart(t);)t.lastStringValue+=L(t.lastIntValue);return!0}return!1},
Lt.regexp_eatRegExpIdentifierStart=function(t){var e=t.pos,i=this.options.ecmaVersion>=11,s=t.current(i);return t.advance(i),
92===s&&this.regexp_eatRegExpUnicodeEscapeSequence(t,i)&&(s=t.lastIntValue),function(t){return u(t,!0)||36===t||95===t}(s)?(t.lastIntValue=s,!0):(t.pos=e,!1)},
Lt.regexp_eatRegExpIdentifierPart=function(t){var e=t.pos,i=this.options.ecmaVersion>=11,s=t.current(i);return t.advance(i),
92===s&&this.regexp_eatRegExpUnicodeEscapeSequence(t,i)&&(s=t.lastIntValue),function(t){return l(t,!0)||36===t||95===t||8204===t||8205===t
}(s)?(t.lastIntValue=s,!0):(t.pos=e,!1)},Lt.regexp_eatAtomEscape=function(t){
return!!(this.regexp_eatBackReference(t)||this.regexp_eatCharacterClassEscape(t)||this.regexp_eatCharacterEscape(t)||t.switchN&&this.regexp_eatKGroupName(t))||(t.switchU&&(99===t.current()&&t.raise("Invalid unicode escape"),
t.raise("Invalid escape")),!1)},Lt.regexp_eatBackReference=function(t){var e=t.pos;if(this.regexp_eatDecimalEscape(t)){var i=t.lastIntValue
;if(t.switchU)return i>t.maxBackReference&&(t.maxBackReference=i),!0;if(i<=t.numCapturingParens)return!0;t.pos=e}return!1},Lt.regexp_eatKGroupName=function(t){
if(t.eat(107)){if(this.regexp_eatGroupName(t))return t.backReferenceNames.push(t.lastStringValue),!0;t.raise("Invalid named reference")}return!1},
Lt.regexp_eatCharacterEscape=function(t){
return this.regexp_eatControlEscape(t)||this.regexp_eatCControlLetter(t)||this.regexp_eatZero(t)||this.regexp_eatHexEscapeSequence(t)||this.regexp_eatRegExpUnicodeEscapeSequence(t,!1)||!t.switchU&&this.regexp_eatLegacyOctalEscapeSequence(t)||this.regexp_eatIdentityEscape(t)
},Lt.regexp_eatCControlLetter=function(t){var e=t.pos;if(t.eat(99)){if(this.regexp_eatControlLetter(t))return!0;t.pos=e}return!1},Lt.regexp_eatZero=function(t){
return 48===t.current()&&!qt(t.lookahead())&&(t.lastIntValue=0,t.advance(),!0)},Lt.regexp_eatControlEscape=function(t){var e=t.current()
;return 116===e?(t.lastIntValue=9,t.advance(),!0):110===e?(t.lastIntValue=10,t.advance(),!0):118===e?(t.lastIntValue=11,t.advance(),
!0):102===e?(t.lastIntValue=12,t.advance(),!0):114===e&&(t.lastIntValue=13,t.advance(),!0)},Lt.regexp_eatControlLetter=function(t){var e=t.current()
;return!!Mt(e)&&(t.lastIntValue=e%32,t.advance(),!0)},Lt.regexp_eatRegExpUnicodeEscapeSequence=function(t,e){void 0===e&&(e=!1);var i,s=t.pos,r=e||t.switchU
;if(t.eat(117)){if(this.regexp_eatFixedHexDigits(t,4)){var a=t.lastIntValue;if(r&&a>=55296&&a<=56319){var n=t.pos
;if(t.eat(92)&&t.eat(117)&&this.regexp_eatFixedHexDigits(t,4)){var o=t.lastIntValue;if(o>=56320&&o<=57343)return t.lastIntValue=1024*(a-55296)+(o-56320)+65536,
!0}t.pos=n,t.lastIntValue=a}return!0}if(r&&t.eat(123)&&this.regexp_eatHexDigits(t)&&t.eat(125)&&(i=t.lastIntValue)>=0&&i<=1114111)return!0
;r&&t.raise("Invalid unicode escape"),t.pos=s}return!1},Lt.regexp_eatIdentityEscape=function(t){
if(t.switchU)return!!this.regexp_eatSyntaxCharacter(t)||!!t.eat(47)&&(t.lastIntValue=47,!0);var e=t.current()
;return!(99===e||t.switchN&&107===e||(t.lastIntValue=e,t.advance(),0))},Lt.regexp_eatDecimalEscape=function(t){t.lastIntValue=0;var e=t.current()
;if(e>=49&&e<=57){do{t.lastIntValue=10*t.lastIntValue+(e-48),t.advance()}while((e=t.current())>=48&&e<=57);return!0}return!1},
Lt.regexp_eatCharacterClassEscape=function(t){var e=t.current();if(function(t){return 100===t||68===t||115===t||83===t||119===t||87===t
}(e))return t.lastIntValue=-1,t.advance(),1;var i=!1;if(t.switchU&&this.options.ecmaVersion>=9&&((i=80===e)||112===e)){var s;if(t.lastIntValue=-1,t.advance(),
t.eat(123)&&(s=this.regexp_eatUnicodePropertyValueExpression(t))&&t.eat(125))return i&&2===s&&t.raise("Invalid property name"),s
;t.raise("Invalid property name")}return 0},Lt.regexp_eatUnicodePropertyValueExpression=function(t){var e=t.pos
;if(this.regexp_eatUnicodePropertyName(t)&&t.eat(61)){var i=t.lastStringValue;if(this.regexp_eatUnicodePropertyValue(t)){var s=t.lastStringValue
;return this.regexp_validateUnicodePropertyNameAndValue(t,i,s),1}}if(t.pos=e,this.regexp_eatLoneUnicodePropertyNameOrValue(t)){var r=t.lastStringValue
;return this.regexp_validateUnicodePropertyNameOrValue(t,r)}return 0},Lt.regexp_validateUnicodePropertyNameAndValue=function(t,e,i){
P(t.unicodeProperties.nonBinary,e)||t.raise("Invalid property name"),t.unicodeProperties.nonBinary[e].test(i)||t.raise("Invalid property value")},
Lt.regexp_validateUnicodePropertyNameOrValue=function(t,e){
return t.unicodeProperties.binary.test(e)?1:t.switchV&&t.unicodeProperties.binaryOfStrings.test(e)?2:void t.raise("Invalid property name")},
Lt.regexp_eatUnicodePropertyName=function(t){var e=0;for(t.lastStringValue="";Ft(e=t.current());)t.lastStringValue+=L(e),t.advance()
;return""!==t.lastStringValue},Lt.regexp_eatUnicodePropertyValue=function(t){var e=0;for(t.lastStringValue="";Ut(e=t.current());)t.lastStringValue+=L(e),
t.advance();return""!==t.lastStringValue},Lt.regexp_eatLoneUnicodePropertyNameOrValue=function(t){return this.regexp_eatUnicodePropertyValue(t)},
Lt.regexp_eatCharacterClass=function(t){if(t.eat(91)){var e=t.eat(94),i=this.regexp_classContents(t);return t.eat(93)||t.raise("Unterminated character class"),
e&&2===i&&t.raise("Negated character class may contain strings"),!0}return!1},Lt.regexp_classContents=function(t){
return 93===t.current()?1:t.switchV?this.regexp_classSetExpression(t):(this.regexp_nonEmptyClassRanges(t),1)},Lt.regexp_nonEmptyClassRanges=function(t){
for(;this.regexp_eatClassAtom(t);){var e=t.lastIntValue;if(t.eat(45)&&this.regexp_eatClassAtom(t)){var i=t.lastIntValue
;!t.switchU||-1!==e&&-1!==i||t.raise("Invalid character class"),-1!==e&&-1!==i&&e>i&&t.raise("Range out of order in character class")}}},
Lt.regexp_eatClassAtom=function(t){var e=t.pos;if(t.eat(92)){if(this.regexp_eatClassEscape(t))return!0;if(t.switchU){var i=t.current()
;(99===i||Ht(i))&&t.raise("Invalid class escape"),t.raise("Invalid escape")}t.pos=e}var s=t.current();return 93!==s&&(t.lastIntValue=s,t.advance(),!0)},
Lt.regexp_eatClassEscape=function(t){var e=t.pos;if(t.eat(98))return t.lastIntValue=8,!0;if(t.switchU&&t.eat(45))return t.lastIntValue=45,!0
;if(!t.switchU&&t.eat(99)){if(this.regexp_eatClassControlLetter(t))return!0;t.pos=e}
return this.regexp_eatCharacterClassEscape(t)||this.regexp_eatCharacterEscape(t)},Lt.regexp_classSetExpression=function(t){var e,i=1
;if(this.regexp_eatClassSetRange(t));else if(e=this.regexp_eatClassSetOperand(t)){2===e&&(i=2)
;for(var s=t.pos;t.eatChars([38,38]);)38!==t.current()&&(e=this.regexp_eatClassSetOperand(t))?2!==e&&(i=1):t.raise("Invalid character in character class")
;if(s!==t.pos)return i;for(;t.eatChars([45,45]);)this.regexp_eatClassSetOperand(t)||t.raise("Invalid character in character class");if(s!==t.pos)return i
}else t.raise("Invalid character in character class");for(;;)if(!this.regexp_eatClassSetRange(t)){if(!(e=this.regexp_eatClassSetOperand(t)))return i
;2===e&&(i=2)}},Lt.regexp_eatClassSetRange=function(t){var e=t.pos;if(this.regexp_eatClassSetCharacter(t)){var i=t.lastIntValue
;if(t.eat(45)&&this.regexp_eatClassSetCharacter(t)){var s=t.lastIntValue;return-1!==i&&-1!==s&&i>s&&t.raise("Range out of order in character class"),!0}t.pos=e}
return!1},Lt.regexp_eatClassSetOperand=function(t){
return this.regexp_eatClassSetCharacter(t)?1:this.regexp_eatClassStringDisjunction(t)||this.regexp_eatNestedClass(t)},Lt.regexp_eatNestedClass=function(t){
var e=t.pos;if(t.eat(91)){var i=t.eat(94),s=this.regexp_classContents(t);if(t.eat(93))return i&&2===s&&t.raise("Negated character class may contain strings"),s
;t.pos=e}if(t.eat(92)){var r=this.regexp_eatCharacterClassEscape(t);if(r)return r;t.pos=e}return null},Lt.regexp_eatClassStringDisjunction=function(t){
var e=t.pos;if(t.eatChars([92,113])){if(t.eat(123)){var i=this.regexp_classStringDisjunctionContents(t);if(t.eat(125))return i}else t.raise("Invalid escape")
;t.pos=e}return null},Lt.regexp_classStringDisjunctionContents=function(t){
for(var e=this.regexp_classString(t);t.eat(124);)2===this.regexp_classString(t)&&(e=2);return e},Lt.regexp_classString=function(t){
for(var e=0;this.regexp_eatClassSetCharacter(t);)e++;return 1===e?1:2},Lt.regexp_eatClassSetCharacter=function(t){var e=t.pos
;if(t.eat(92))return!(!this.regexp_eatCharacterEscape(t)&&!this.regexp_eatClassSetReservedPunctuator(t)&&(t.eat(98)?(t.lastIntValue=8,0):(t.pos=e,1)))
;var i=t.current();return!(i<0||i===t.lookahead()&&function(t){return 33===t||t>=35&&t<=38||t>=42&&t<=44||46===t||t>=58&&t<=64||94===t||96===t||126===t
}(i)||function(t){return 40===t||41===t||45===t||47===t||t>=91&&t<=93||t>=123&&t<=125}(i)||(t.advance(),t.lastIntValue=i,0))},
Lt.regexp_eatClassSetReservedPunctuator=function(t){var e=t.current();return!!function(t){
return 33===t||35===t||37===t||38===t||44===t||45===t||t>=58&&t<=62||64===t||96===t||126===t}(e)&&(t.lastIntValue=e,t.advance(),!0)},
Lt.regexp_eatClassControlLetter=function(t){var e=t.current();return!(!qt(e)&&95!==e||(t.lastIntValue=e%32,t.advance(),0))},
Lt.regexp_eatHexEscapeSequence=function(t){var e=t.pos;if(t.eat(120)){if(this.regexp_eatFixedHexDigits(t,2))return!0;t.switchU&&t.raise("Invalid escape"),
t.pos=e}return!1},Lt.regexp_eatDecimalDigits=function(t){var e=t.pos,i=0;for(t.lastIntValue=0;qt(i=t.current());)t.lastIntValue=10*t.lastIntValue+(i-48),
t.advance();return t.pos!==e},Lt.regexp_eatHexDigits=function(t){var e=t.pos,i=0;for(t.lastIntValue=0;jt(i=t.current());)t.lastIntValue=16*t.lastIntValue+Gt(i),
t.advance();return t.pos!==e},Lt.regexp_eatLegacyOctalEscapeSequence=function(t){if(this.regexp_eatOctalDigit(t)){var e=t.lastIntValue
;if(this.regexp_eatOctalDigit(t)){var i=t.lastIntValue;e<=3&&this.regexp_eatOctalDigit(t)?t.lastIntValue=64*e+8*i+t.lastIntValue:t.lastIntValue=8*e+i
}else t.lastIntValue=e;return!0}return!1},Lt.regexp_eatOctalDigit=function(t){var e=t.current();return Ht(e)?(t.lastIntValue=e-48,t.advance(),
!0):(t.lastIntValue=0,!1)},Lt.regexp_eatFixedHexDigits=function(t,e){var i=t.pos;t.lastIntValue=0;for(var s=0;s<e;++s){var r=t.current()
;if(!jt(r))return t.pos=i,!1;t.lastIntValue=16*t.lastIntValue+Gt(r),t.advance()}return!0};var Wt=function(t){this.type=t.type,this.value=t.value,
this.start=t.start,this.end=t.end,t.options.locations&&(this.loc=new O(t,t.startLoc,t.endLoc)),t.options.ranges&&(this.range=[t.start,t.end])},zt=H.prototype
;function Kt(t){return"function"!=typeof BigInt?null:BigInt(t.replace(/_/g,""))}zt.next=function(t){
!t&&this.type.keyword&&this.containsEsc&&this.raiseRecoverable(this.start,"Escape sequence in keyword "+this.type.keyword),
this.options.onToken&&this.options.onToken(new Wt(this)),this.lastTokEnd=this.end,this.lastTokStart=this.start,this.lastTokEndLoc=this.endLoc,
this.lastTokStartLoc=this.startLoc,this.nextToken()},zt.getToken=function(){return this.next(),new Wt(this)},
"undefined"!=typeof Symbol&&(zt[Symbol.iterator]=function(){var t=this;return{next:function(){var e=t.getToken();return{done:e.type===y.eof,value:e}}}}),
zt.nextToken=function(){var t=this.curContext();return t&&t.preserveSpace||this.skipSpace(),this.start=this.pos,
this.options.locations&&(this.startLoc=this.curPosition()),
this.pos>=this.input.length?this.finishToken(y.eof):t.override?t.override(this):void this.readToken(this.fullCharCodeAtPos())},zt.readToken=function(t){
return u(t,this.options.ecmaVersion>=6)||92===t?this.readWord():this.getTokenFromCode(t)},zt.fullCharCodeAt=function(t){var e=this.input.charCodeAt(t)
;if(e<=55295||e>=56320)return e;var i=this.input.charCodeAt(t+1);return i<=56319||i>=57344?e:(e<<10)+i-56613888},zt.fullCharCodeAtPos=function(){
return this.fullCharCodeAt(this.pos)},zt.skipBlockComment=function(){
var t=this.options.onComment&&this.curPosition(),e=this.pos,i=this.input.indexOf("*/",this.pos+=2);if(-1===i&&this.raise(this.pos-2,"Unterminated comment"),
this.pos=i+2,this.options.locations)for(var s=void 0,r=e;(s=S(this.input,r,this.pos))>-1;)++this.curLine,r=this.lineStart=s
;this.options.onComment&&this.options.onComment(!0,this.input.slice(e+2,i),e,this.pos,t,this.curPosition())},zt.skipLineComment=function(t){
for(var e=this.pos,i=this.options.onComment&&this.curPosition(),s=this.input.charCodeAt(this.pos+=t);this.pos<this.input.length&&!k(s);)s=this.input.charCodeAt(++this.pos)
;this.options.onComment&&this.options.onComment(!1,this.input.slice(e+t,this.pos),e,this.pos,i,this.curPosition())},zt.skipSpace=function(){
t:for(;this.pos<this.input.length;){var t=this.input.charCodeAt(this.pos);switch(t){case 32:case 160:++this.pos;break;case 13:
10===this.input.charCodeAt(this.pos+1)&&++this.pos;case 10:case 8232:case 8233:++this.pos,this.options.locations&&(++this.curLine,this.lineStart=this.pos);break
;case 47:switch(this.input.charCodeAt(this.pos+1)){case 42:this.skipBlockComment();break;case 47:this.skipLineComment(2);break;default:break t}break;default:
if(!(t>8&&t<14||t>=5760&&C.test(String.fromCharCode(t))))break t;++this.pos}}},zt.finishToken=function(t,e){this.end=this.pos,
this.options.locations&&(this.endLoc=this.curPosition());var i=this.type;this.type=t,this.value=e,this.updateContext(i)},zt.readToken_dot=function(){
var t=this.input.charCodeAt(this.pos+1);if(t>=48&&t<=57)return this.readNumber(!0);var e=this.input.charCodeAt(this.pos+2)
;return this.options.ecmaVersion>=6&&46===t&&46===e?(this.pos+=3,this.finishToken(y.ellipsis)):(++this.pos,this.finishToken(y.dot))},
zt.readToken_slash=function(){var t=this.input.charCodeAt(this.pos+1);return this.exprAllowed?(++this.pos,
this.readRegexp()):61===t?this.finishOp(y.assign,2):this.finishOp(y.slash,1)},zt.readToken_mult_modulo_exp=function(t){
var e=this.input.charCodeAt(this.pos+1),i=1,s=42===t?y.star:y.modulo;return this.options.ecmaVersion>=7&&42===t&&42===e&&(++i,s=y.starstar,
e=this.input.charCodeAt(this.pos+2)),61===e?this.finishOp(y.assign,i+1):this.finishOp(s,i)},zt.readToken_pipe_amp=function(t){
var e=this.input.charCodeAt(this.pos+1)
;return e===t?this.options.ecmaVersion>=12&&61===this.input.charCodeAt(this.pos+2)?this.finishOp(y.assign,3):this.finishOp(124===t?y.logicalOR:y.logicalAND,2):61===e?this.finishOp(y.assign,2):this.finishOp(124===t?y.bitwiseOR:y.bitwiseAND,1)
},zt.readToken_caret=function(){return 61===this.input.charCodeAt(this.pos+1)?this.finishOp(y.assign,2):this.finishOp(y.bitwiseXOR,1)},
zt.readToken_plus_min=function(t){var e=this.input.charCodeAt(this.pos+1)
;return e===t?45!==e||this.inModule||62!==this.input.charCodeAt(this.pos+2)||0!==this.lastTokEnd&&!b.test(this.input.slice(this.lastTokEnd,this.pos))?this.finishOp(y.incDec,2):(this.skipLineComment(3),
this.skipSpace(),this.nextToken()):61===e?this.finishOp(y.assign,2):this.finishOp(y.plusMin,1)},zt.readToken_lt_gt=function(t){
var e=this.input.charCodeAt(this.pos+1),i=1;return e===t?(i=62===t&&62===this.input.charCodeAt(this.pos+2)?3:2,
61===this.input.charCodeAt(this.pos+i)?this.finishOp(y.assign,i+1):this.finishOp(y.bitShift,i)):33!==e||60!==t||this.inModule||45!==this.input.charCodeAt(this.pos+2)||45!==this.input.charCodeAt(this.pos+3)?(61===e&&(i=2),
this.finishOp(y.relational,i)):(this.skipLineComment(4),this.skipSpace(),this.nextToken())},zt.readToken_eq_excl=function(t){
var e=this.input.charCodeAt(this.pos+1)
;return 61===e?this.finishOp(y.equality,61===this.input.charCodeAt(this.pos+2)?3:2):61===t&&62===e&&this.options.ecmaVersion>=6?(this.pos+=2,
this.finishToken(y.arrow)):this.finishOp(61===t?y.eq:y.prefix,1)},zt.readToken_question=function(){var t=this.options.ecmaVersion;if(t>=11){
var e=this.input.charCodeAt(this.pos+1);if(46===e){var i=this.input.charCodeAt(this.pos+2);if(i<48||i>57)return this.finishOp(y.questionDot,2)}
if(63===e)return t>=12&&61===this.input.charCodeAt(this.pos+2)?this.finishOp(y.assign,3):this.finishOp(y.coalesce,2)}return this.finishOp(y.question,1)},
zt.readToken_numberSign=function(){var t=35;if(this.options.ecmaVersion>=13&&(++this.pos,
u(t=this.fullCharCodeAtPos(),!0)||92===t))return this.finishToken(y.privateId,this.readWord1());this.raise(this.pos,"Unexpected character '"+L(t)+"'")},
zt.getTokenFromCode=function(t){switch(t){case 46:return this.readToken_dot();case 40:return++this.pos,this.finishToken(y.parenL);case 41:return++this.pos,
this.finishToken(y.parenR);case 59:return++this.pos,this.finishToken(y.semi);case 44:return++this.pos,this.finishToken(y.comma);case 91:return++this.pos,
this.finishToken(y.bracketL);case 93:return++this.pos,this.finishToken(y.bracketR);case 123:return++this.pos,this.finishToken(y.braceL);case 125:
return++this.pos,this.finishToken(y.braceR);case 58:return++this.pos,this.finishToken(y.colon);case 96:if(this.options.ecmaVersion<6)break;return++this.pos,
this.finishToken(y.backQuote);case 48:var e=this.input.charCodeAt(this.pos+1);if(120===e||88===e)return this.readRadixNumber(16)
;if(this.options.ecmaVersion>=6){if(111===e||79===e)return this.readRadixNumber(8);if(98===e||66===e)return this.readRadixNumber(2)}case 49:case 50:case 51:
case 52:case 53:case 54:case 55:case 56:case 57:return this.readNumber(!1);case 34:case 39:return this.readString(t);case 47:return this.readToken_slash()
;case 37:case 42:return this.readToken_mult_modulo_exp(t);case 124:case 38:return this.readToken_pipe_amp(t);case 94:return this.readToken_caret();case 43:
case 45:return this.readToken_plus_min(t);case 60:case 62:return this.readToken_lt_gt(t);case 61:case 33:return this.readToken_eq_excl(t);case 63:
return this.readToken_question();case 126:return this.finishOp(y.prefix,1);case 35:return this.readToken_numberSign()}
this.raise(this.pos,"Unexpected character '"+L(t)+"'")},zt.finishOp=function(t,e){var i=this.input.slice(this.pos,this.pos+e);return this.pos+=e,
this.finishToken(t,i)},zt.readRegexp=function(){for(var t,e,i=this.pos;;){this.pos>=this.input.length&&this.raise(i,"Unterminated regular expression")
;var s=this.input.charAt(this.pos);if(b.test(s)&&this.raise(i,"Unterminated regular expression"),t)t=!1;else{
if("["===s)e=!0;else if("]"===s&&e)e=!1;else if("/"===s&&!e)break;t="\\"===s}++this.pos}var r=this.input.slice(i,this.pos);++this.pos
;var a=this.pos,n=this.readWord1();this.containsEsc&&this.unexpected(a);var o=this.regexpState||(this.regexpState=new Dt(this));o.reset(i,r,n),
this.validateRegExpFlags(o),this.validateRegExpPattern(o);var h=null;try{h=new RegExp(r,n)}catch(t){}return this.finishToken(y.regexp,{pattern:r,flags:n,value:h
})},zt.readInt=function(t,e,i){
for(var s=this.options.ecmaVersion>=12&&void 0===e,r=i&&48===this.input.charCodeAt(this.pos),a=this.pos,n=0,o=0,h=0,p=null==e?1/0:e;h<p;++h,++this.pos){
var c=this.input.charCodeAt(this.pos),u=void 0
;if(s&&95===c)r&&this.raiseRecoverable(this.pos,"Numeric separator is not allowed in legacy octal numeric literals"),
95===o&&this.raiseRecoverable(this.pos,"Numeric separator must be exactly one underscore"),
0===h&&this.raiseRecoverable(this.pos,"Numeric separator is not allowed at the first of digits"),o=c;else{
if((u=c>=97?c-97+10:c>=65?c-65+10:c>=48&&c<=57?c-48:1/0)>=t)break;o=c,n=n*t+u}}
return s&&95===o&&this.raiseRecoverable(this.pos-1,"Numeric separator is not allowed at the last of digits"),this.pos===a||null!=e&&this.pos-a!==e?null:n},
zt.readRadixNumber=function(t){var e=this.pos;this.pos+=2;var i=this.readInt(t);return null==i&&this.raise(this.start+2,"Expected number in radix "+t),
this.options.ecmaVersion>=11&&110===this.input.charCodeAt(this.pos)?(i=Kt(this.input.slice(e,this.pos)),
++this.pos):u(this.fullCharCodeAtPos())&&this.raise(this.pos,"Identifier directly after number"),this.finishToken(y.num,i)},zt.readNumber=function(t){
var e=this.pos;t||null!==this.readInt(10,void 0,!0)||this.raise(e,"Invalid number");var i=this.pos-e>=2&&48===this.input.charCodeAt(e)
;i&&this.strict&&this.raise(e,"Invalid number");var s=this.input.charCodeAt(this.pos);if(!i&&!t&&this.options.ecmaVersion>=11&&110===s){
var r=Kt(this.input.slice(e,this.pos));return++this.pos,u(this.fullCharCodeAtPos())&&this.raise(this.pos,"Identifier directly after number"),
this.finishToken(y.num,r)}i&&/[89]/.test(this.input.slice(e,this.pos))&&(i=!1),46!==s||i||(++this.pos,this.readInt(10),s=this.input.charCodeAt(this.pos)),
69!==s&&101!==s||i||(43!==(s=this.input.charCodeAt(++this.pos))&&45!==s||++this.pos,null===this.readInt(10)&&this.raise(e,"Invalid number")),
u(this.fullCharCodeAtPos())&&this.raise(this.pos,"Identifier directly after number");var a,n=(a=this.input.slice(e,this.pos),
i?parseInt(a,8):parseFloat(a.replace(/_/g,"")));return this.finishToken(y.num,n)},zt.readCodePoint=function(){var t;if(123===this.input.charCodeAt(this.pos)){
this.options.ecmaVersion<6&&this.unexpected();var e=++this.pos;t=this.readHexChar(this.input.indexOf("}",this.pos)-this.pos),++this.pos,
t>1114111&&this.invalidStringToken(e,"Code point out of bounds")}else t=this.readHexChar(4);return t},zt.readString=function(t){for(var e="",i=++this.pos;;){
this.pos>=this.input.length&&this.raise(this.start,"Unterminated string constant");var s=this.input.charCodeAt(this.pos);if(s===t)break
;92===s?(e+=this.input.slice(i,this.pos),
e+=this.readEscapedChar(!1),i=this.pos):8232===s||8233===s?(this.options.ecmaVersion<10&&this.raise(this.start,"Unterminated string constant"),++this.pos,
this.options.locations&&(this.curLine++,this.lineStart=this.pos)):(k(s)&&this.raise(this.start,"Unterminated string constant"),++this.pos)}
return e+=this.input.slice(i,this.pos++),this.finishToken(y.string,e)};var Qt={};zt.tryReadTemplateToken=function(){this.inTemplateElement=!0;try{
this.readTmplToken()}catch(t){if(t!==Qt)throw t;this.readInvalidTemplateToken()}this.inTemplateElement=!1},zt.invalidStringToken=function(t,e){
if(this.inTemplateElement&&this.options.ecmaVersion>=9)throw Qt;this.raise(t,e)},zt.readTmplToken=function(){for(var t="",e=this.pos;;){
this.pos>=this.input.length&&this.raise(this.start,"Unterminated template");var i=this.input.charCodeAt(this.pos)
;if(96===i||36===i&&123===this.input.charCodeAt(this.pos+1))return this.pos!==this.start||this.type!==y.template&&this.type!==y.invalidTemplate?(t+=this.input.slice(e,this.pos),
this.finishToken(y.template,t)):36===i?(this.pos+=2,this.finishToken(y.dollarBraceL)):(++this.pos,this.finishToken(y.backQuote))
;if(92===i)t+=this.input.slice(e,this.pos),t+=this.readEscapedChar(!0),e=this.pos;else if(k(i)){switch(t+=this.input.slice(e,this.pos),++this.pos,i){case 13:
10===this.input.charCodeAt(this.pos)&&++this.pos;case 10:t+="\n";break;default:t+=String.fromCharCode(i)}this.options.locations&&(++this.curLine,
this.lineStart=this.pos),e=this.pos}else++this.pos}},zt.readInvalidTemplateToken=function(){
for(;this.pos<this.input.length;this.pos++)switch(this.input[this.pos]){case"\\":++this.pos;break;case"$":if("{"!==this.input[this.pos+1])break;case"`":
return this.finishToken(y.invalidTemplate,this.input.slice(this.start,this.pos));case"\r":"\n"===this.input[this.pos+1]&&++this.pos;case"\n":case"\u2028":
case"\u2029":++this.curLine,this.lineStart=this.pos+1}this.raise(this.start,"Unterminated template")},zt.readEscapedChar=function(t){
var e=this.input.charCodeAt(++this.pos);switch(++this.pos,e){case 110:return"\n";case 114:return"\r";case 120:return String.fromCharCode(this.readHexChar(2))
;case 117:return L(this.readCodePoint());case 116:return"\t";case 98:return"\b";case 118:return"\v";case 102:return"\f";case 13:
10===this.input.charCodeAt(this.pos)&&++this.pos;case 10:return this.options.locations&&(this.lineStart=this.pos,++this.curLine),"";case 56:case 57:
if(this.strict&&this.invalidStringToken(this.pos-1,"Invalid escape sequence"),t){var i=this.pos-1
;this.invalidStringToken(i,"Invalid escape sequence in template string")}default:if(e>=48&&e<=55){
var s=this.input.substr(this.pos-1,3).match(/^[0-7]+/)[0],r=parseInt(s,8);return r>255&&(s=s.slice(0,-1),r=parseInt(s,8)),this.pos+=s.length-1,
e=this.input.charCodeAt(this.pos),
"0"===s&&56!==e&&57!==e||!this.strict&&!t||this.invalidStringToken(this.pos-1-s.length,t?"Octal literal in template string":"Octal literal in strict mode"),
String.fromCharCode(r)}return k(e)?(this.options.locations&&(this.lineStart=this.pos,++this.curLine),""):String.fromCharCode(e)}},zt.readHexChar=function(t){
var e=this.pos,i=this.readInt(16,t);return null===i&&this.invalidStringToken(e,"Bad character escape sequence"),i},zt.readWord1=function(){this.containsEsc=!1
;for(var t="",e=!0,i=this.pos,s=this.options.ecmaVersion>=6;this.pos<this.input.length;){var r=this.fullCharCodeAtPos();if(l(r,s))this.pos+=r<=65535?1:2;else{
if(92!==r)break;this.containsEsc=!0,t+=this.input.slice(i,this.pos);var a=this.pos
;117!==this.input.charCodeAt(++this.pos)&&this.invalidStringToken(this.pos,"Expecting Unicode escape sequence \\uXXXX"),++this.pos;var n=this.readCodePoint()
;(e?u:l)(n,s)||this.invalidStringToken(a,"Invalid Unicode escape"),t+=L(n),i=this.pos}e=!1}return t+this.input.slice(i,this.pos)},zt.readWord=function(){
var t=this.readWord1(),e=y.name;return this.keywords.test(t)&&(e=x[t]),this.finishToken(e,t)};var Yt="8.18.0";H.acorn={Parser:H,version:Yt,defaultOptions:M,
Position:D,SourceLocation:O,getLineInfo:B,Node:ft,TokenType:d,tokTypes:y,keywordTypes:x,TokContext:rt,tokContexts:at,isIdentifierChar:l,isIdentifierStart:u,
Token:Wt,isNewLine:k,lineBreak:b,lineBreakG:_,nonASCIIwhitespace:C},t.Node=ft,t.Parser=H,t.Position=D,t.SourceLocation=O,t.TokContext=rt,t.Token=Wt,
t.TokenType=d,t.defaultOptions=M,t.getLineInfo=B,t.isIdentifierChar=l,t.isIdentifierStart=u,t.isNewLine=k,t.keywordTypes=x,t.lineBreak=b,t.lineBreakG=_,
t.nonASCIIwhitespace=C,t.parse=function(t,e){return H.parse(t,e)},t.parseExpressionAt=function(t,e,i){return H.parseExpressionAt(t,e,i)},t.tokContexts=at,
t.tokTypes=y,t.tokenizer=function(t,e){return H.tokenizer(t,e)},t.version=Yt
},"object"==typeof s&&void 0!==i?e(s):"function"==typeof define&&define.amd?define(["exports"],e):e((t="undefined"!=typeof globalThis?globalThis:t||self).acorn={}),
__tenComicRuleSyntax.parser=i.exports}var t,e;return __tenComicRuleSyntax.parser}
(() => {
    var __webpack_modules__ = {
        390: (webpackModule, webpackExports, webpackRequire) => {
            "use strict";
            webpackRequire.d(webpackExports, {
                Iq: () => initializeSettings,
                cF: () => getStorage,
                po: () => setStorage,
                zU: () => resetSettings
            });
            const configVersion = "2.0.8", configDefaults = {
                version: configVersion,
                appLoadDefault: {
                    isShowUI: !1,
                    loadHotKey: "V",
                    rightSize: 100,
                    centerSize: 100
                },
                maxChapterNum: 2,
                maxPictureNum: 3,
                downType: 0,
                directDownloadFlow: 0,
                sanitizePathNames: !0,
                maxSplicingHeight: 2e4,
                imgIndexBitNum: 3,
                imgSplicingFlag: !0,
                imgDownRange: [ 1, -1 ],
                historyLimit: 100,
                downloadNotification: !0,
                effectLevel: 1,
                themePreset: "glass",
                appearanceAxes: {
                    density: "standard",
                    shape: "standard",
                    motion: "standard"
                },
                pendingTasks: [],
                userWebInfo: [],
                rootDir: "10Comic"
            }, localStorageDefaults = {
                ylComicDownHistory: "[]"
            }, obsoleteKeys = [ "downHistory" ], initializeSettings = () => {
                for (const e in localStorageDefaults) null == localStorage.getItem(e) && localStorage.setItem(e, localStorageDefaults[e]);
                for (const e in configDefaults) void 0 === GM_getValue(e) && GM_setValue(e, configDefaults[e]);
                if (GM_getValue("version") !== configVersion) return obsoleteKeys.forEach(e => {
                    void 0 !== GM_getValue(e) && GM_deleteValue(e);
                }), GM_setValue("version", configVersion), !0;
            }, resetSettings = async () => {
                for (const e in configDefaults) GM_setValue(e, configDefaults[e]);
                return !0;
            }, setStorage = (e, t, n = null) => {
                if (n) {
                    const r = GM_getValue(e), a = r && "object" == typeof r ? r : {};
                    a[n] = t, t = a;
                }
                return GM_setValue(e, t), !0;
            }, getStorage = e => GM_getValue(e);
        },
        516: module => {
            module.exports = (dependencies => {
                "use strict";
                dependencies = dependencies || {};
                const now = dependencies.now || Date.now;
                const createId = dependencies.createId || (() => "rule-" + now().toString(36) + "-" + Math.random().toString(36).slice(2));
                const selectorCheck = dependencies.validateSelector || (selector => {
                    if (typeof document !== "undefined") document.querySelector(selector);
                });
                const functionCache = new Set;
                const domains = value => [ ...new Set((Array.isArray(value) ? value : String(value || "").split(/[,，\s]+/)).map(value => {
                    const input = String(value || "").trim().toLowerCase().replace(/^\*\./, "");
                    if (!input) return "";
                    const url = new URL(/^[a-z]+:\/\//i.test(input) ? input : "https://" + input);
                    if (![ "http:", "https:" ].includes(url.protocol) || url.username || url.password || url.port) throw new Error("请填写有效域名，不含账号或端口");
                    return url.hostname;
                }).filter(Boolean)) ];
                function matches(value, host) {
                    try {
                        return domains(value).some(domain => host === domain || host.endsWith("." + domain));
                    } catch (error) {
                        return false;
                    }
                }
                function hash(text) {
                    let value = 2166136261;
                    for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
                    return (value >>> 0).toString(36);
                }
                function migrate(list) {
                    const used = new Set;
                    return (Array.isArray(list) ? list : []).filter(rule => rule && typeof rule === "object" && !Array.isArray(rule)).map(raw => {
                        const rule = {
                            ...raw
                        };
                        for (const field of [ "getImgs", "getComicInfo" ]) if (typeof rule[field] === "function") rule[field] = rule[field].toString();
                        const base = typeof rule.id === "string" && /^[\w:-]{1,120}$/.test(rule.id) ? rule.id : "legacy-" + hash(JSON.stringify([ rule.domain, rule.webName, rule.homepage, rule.imageCss, rule.getImgs ]));
                        let id = base, suffix = 1;
                        while (used.has(id)) id = base + "-" + suffix++;
                        used.add(id);
                        return {
                            ...rule,
                            id: id,
                            schemaVersion: 1,
                            version: Math.max(1, Math.trunc(Number(rule.version) || 1)),
                            enabled: rule.enabled !== false,
                            preferCustom: rule.preferCustom === true
                        };
                    });
                }
                function checkFunction(source) {
                    if (functionCache.has(source)) return;
                    if (typeof source !== "string" || source.length > 1e5) throw new Error("解析函数必须是长度合理的函数文本");
                    const program = dependencies.parse('"use strict";(' + source + "\n)", {
                        ecmaVersion: "latest"
                    });
                    const node = program.body?.[1]?.expression;
                    if (program.body.length !== 2 || !node || ![ "FunctionExpression", "ArrowFunctionExpression" ].includes(node.type) || node.generator) throw new Error("只接受函数本身，不接受立即调用或其他表达式");
                    if (functionCache.size >= 200) functionCache.clear();
                    functionCache.add(source);
                }
                async function simpleImages(context, task = {}) {
                    const frame = task.frameId ? document.getElementById(task.frameId) : null;
                    const root = task.document || frame?.contentDocument || (context && typeof context.querySelectorAll === "function" ? context : (new DOMParser).parseFromString(String(context || ""), "text/html"));
                    const base = task.url || location.href;
                    const signal = task.signal;
                    const checkAbort = () => {
                        if (signal?.aborted) throw new Error("下载已取消");
                    };
                    checkAbort();
                    if (this.readySelector && !root.querySelector(this.readySelector)) {
                        if (!frame && !task.document) throw new Error("等待元素未找到；动态页面请启用隐藏页面读取");
                        const deadline = Date.now() + (this.waitTimeoutMs || 1e4);
                        while (!root.querySelector(this.readySelector)) {
                            checkAbort();
                            if (Date.now() >= deadline) throw new Error("等待元素超时：" + this.readySelector);
                            await new Promise((resolve, reject) => {
                                const abort = () => {
                                    clearTimeout(timer);
                                    signal?.removeEventListener?.("abort", abort);
                                    reject(new Error("下载已取消"));
                                };
                                const timer = setTimeout(() => {
                                    signal?.removeEventListener?.("abort", abort);
                                    resolve();
                                }, 100);
                                signal?.addEventListener?.("abort", abort, {
                                    once: true
                                });
                            });
                        }
                    }
                    checkAbort();
                    const attributes = this.imageAttributes?.length ? this.imageAttributes : [ "data-src", "data-original", "data-url", "data-lazy-src", "currentSrc", "srcset", "data-srcset", "src" ];
                    const urls = [];
                    for (const image of root.querySelectorAll(this.imageCss)) {
                        if (image.closest("#ten-comic-root")) continue;
                        if (this.imageExcludeCss && (image.matches(this.imageExcludeCss) || image.closest(this.imageExcludeCss))) continue;
                        let value = "";
                        for (const attribute of attributes) {
                            value = attribute === "currentSrc" ? image.currentSrc : image.getAttribute(attribute);
                            if (value && /srcset$/i.test(attribute)) value = (value.trim().split(/\s*,\s*/).pop() || "").trim().split(/\s+/)[0];
                            if (value) break;
                        }
                        if (!value) continue;
                        try {
                            const url = new URL(value, base);
                            if ([ "http:", "https:", "blob:" ].includes(url.protocol) || /^data:image\//i.test(url.href)) urls.push(url.href);
                        } catch (error) {}
                    }
                    return [ ...new Set(urls) ];
                }
                function validate(input) {
                    const errors = [];
                    if (!input || typeof input !== "object" || Array.isArray(input)) return {
                        rule: null,
                        errors: [ {
                            field: "rule",
                            message: "规则必须是对象"
                        } ]
                    };
                    const rule = {
                        ...input
                    };
                    const error = (field, message) => errors.push({
                        field: field,
                        message: message
                    });
                    rule.webName = String(rule.webName || "").trim();
                    if (!rule.webName || rule.webName.length > 120) error("webName", "请填写站点名称（最多120字）");
                    try {
                        const values = domains(rule.domain);
                        if (!values.length) throw new Error("请填写域名");
                        rule.domain = values.length === 1 ? values[0] : values;
                    } catch (reason) {
                        error("domain", reason.message);
                    }
                    const primary = Array.isArray(rule.domain) ? rule.domain[0] : rule.domain;
                    rule.homepage = String(rule.homepage || (primary ? "https://" + primary + "/" : "")).trim();
                    try {
                        const url = new URL(rule.homepage);
                        if (![ "http:", "https:" ].includes(url.protocol) || url.username || url.password) throw new Error;
                    } catch (reason) {
                        error("homepage", "站点首页必须是有效的 http/https 地址");
                    }
                    for (const field of [ "comicNameCss", "chapterCss", "imageCss", "readySelector", "imageExcludeCss" ]) {
                        rule[field] = String(rule[field] || "").trim();
                        if (rule[field]) try {
                            selectorCheck(rule[field]);
                        } catch (reason) {
                            error(field, "选择器格式不正确");
                        }
                    }
                    rule.readtype = rule.readtype === undefined ? 1 : Number(rule.readtype);
                    if (![ 0, 1 ].includes(rule.readtype)) error("readtype", "阅读方式无效");
                    rule.useFrame = rule.useFrame === true;
                    rule.waitTimeoutMs = rule.waitTimeoutMs === undefined || rule.waitTimeoutMs === "" ? 1e4 : Number(rule.waitTimeoutMs);
                    if (!Number.isFinite(rule.waitTimeoutMs) || rule.waitTimeoutMs < 1e3 || rule.waitTimeoutMs > 6e4) error("waitTimeoutMs", "等待超时应为1000至60000毫秒");
                    const attributes = rule.imageAttributes || [];
                    rule.imageAttributes = [ ...new Set((Array.isArray(attributes) ? attributes : String(attributes).split(/[,，\s]+/)).map(value => String(value).trim()).filter(Boolean)) ];
                    if (rule.imageAttributes.some(value => !/^[\w:-]+$/.test(value))) error("imageAttributes", "图片地址属性只能包含字母、数字、横线、冒号或下划线");
                    for (const field of [ "chapterUrlIncludes", "chapterUrlExcludes" ]) rule[field] = String(rule[field] || "").trim().slice(0, 500);
                    rule.simpleRule = Boolean(rule.imageCss && (!rule.getImgs || rule.simpleRule === true));
                    if (rule.chapterNameReg != null && typeof rule.chapterNameReg !== "string" && Object.prototype.toString.call(rule.chapterNameReg) !== "[object RegExp]") error("chapterNameReg", "章节名称正则字段已损坏，请重新填写正则表达式");
                    for (const field of [ "getImgs", "getComicInfo" ]) {
                        if (typeof rule[field] === "function") rule[field] = rule[field].toString();
                        if (field === "getImgs" && rule.simpleRule) rule[field] = simpleImages.toString();
                        if (rule[field]) try {
                            checkFunction(rule[field]);
                        } catch (reason) {
                            error(field, reason.message);
                        }
                    }
                    if (!rule.getImgs) error("getImgs", "请填写图片选择器或解析函数");
                    if (rule.simpleRule && rule.readtype === 0) error("readtype", "翻页阅读需要高级解析函数");
                    const metadata = migrate([ rule ])[0];
                    if (!input.id && metadata) metadata.id = createId();
                    return {
                        rule: metadata,
                        errors: errors
                    };
                }
                function fingerprint(rule) {
                    const copy = {
                        ...rule
                    };
                    for (const field of [ "id", "version", "schemaVersion", "updatedAt" ]) delete copy[field];
                    const normalized = validate(copy).rule || copy;
                    for (const field of [ "id", "version", "schemaVersion", "updatedAt" ]) delete normalized[field];
                    const ordered = value => Object.prototype.toString.call(value) === "[object RegExp]" ? value : Array.isArray(value) ? value.map(ordered) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [ key, ordered(value[key]) ])) : value;
                    return serialize(ordered(normalized));
                }
                function overlap(first, second) {
                    try {
                        return domains(first).some(a => domains(second).some(b => a === b || a.endsWith("." + b) || b.endsWith("." + a)));
                    } catch (error) {
                        return false;
                    }
                }
                function resolve(url, builtins, custom) {
                    let host;
                    try {
                        host = new URL(url).hostname.toLowerCase();
                    } catch (error) {
                        return {
                            selected: null,
                            source: "none",
                            candidates: []
                        };
                    }
                    const builtin = builtins.find(rule => matches(rule.domain, host));
                    const candidates = migrate(custom).filter(rule => matches(rule.domain, host));
                    const enabled = candidates.filter(rule => rule.enabled);
                    const preferred = enabled.find(rule => rule.preferCustom);
                    return {
                        selected: preferred || builtin || enabled[0] || null,
                        source: preferred || !builtin && enabled.length ? "custom" : builtin ? "builtin" : "none",
                        candidates: candidates,
                        builtin: builtin || null,
                        host: host
                    };
                }
                // Tagged values are data only. Escape ordinary objects using the reserved tag.
                                function serialize(value) {
                    const seen = new WeakSet;
                    const encode = (value, depth = 0) => {
                        if (depth > 30) throw new Error("规则数据嵌套过深");
                        if (typeof value === "function") return value.toString();
                        if (!value || typeof value !== "object") return value;
                        if (Object.prototype.toString.call(value) === "[object RegExp]") return {
                            $tenComicValue: 1,
                            type: "RegExp",
                            source: value.source,
                            flags: value.flags
                        };
                        if (seen.has(value)) throw new Error("规则包含循环引用");
                        seen.add(value);
                        const entries = Array.isArray(value) ? null : Object.entries(value).map(([key, item]) => [ key, encode(item, depth + 1) ]);
                        const result = !entries ? value.map(item => encode(item, depth + 1)) : Object.hasOwn(value, "$tenComicValue") ? {
                            $tenComicValue: 1,
                            type: "Object",
                            entries: entries
                        } : Object.fromEntries(entries);
                        seen.delete(value);
                        return result;
                    };
                    return JSON.stringify(encode(value), null, 2);
                }
                function deserialize(text) {
                    if (typeof text !== "string" || text.length > 2e6) throw new Error("规则文本为空或超过大小限制");
                    const decode = (value, depth = 0) => {
                        if (depth > 30) throw new Error("规则数据嵌套过深");
                        if (!value || typeof value !== "object") return value;
                        if (Array.isArray(value)) return value.map(item => decode(item, depth + 1));
                        if (value.$tenComicValue === 1 && value.type === "RegExp" && Object.keys(value).length === 4 && typeof value.source === "string" && typeof value.flags === "string") return new RegExp(value.source, value.flags);
                        if (value.$tenComicValue === 1 && value.type === "Object" && Object.keys(value).length === 3 && Array.isArray(value.entries)) {
                            if (value.entries.some(entry => !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string")) throw new Error("规则对象编码无效");
                            return Object.fromEntries(value.entries.map(([key, item]) => [ key, decode(item, depth + 1) ]));
                        }
                        return Object.fromEntries(Object.entries(value).map(([key, item]) => [ key, decode(item, depth + 1) ]));
                    };
                    return decode(JSON.parse(text));
                }
                function parseJSON(text) {
                    const value = deserialize(text);
                    if (!Array.isArray(value) || value.length > 500) throw new Error("请提供最多500条规则的数组");
                    return value;
                }
                function previewImport(incoming, existing) {
                    const fingerprints = new Set(existing.map(fingerprint)), incomingRules = [];
                    return incoming.map((raw, incomingIndex) => {
                        const result = validate(raw);
                        if (result.errors.length) return {
                            kind: "invalid",
                            action: "skip",
                            rule: result.rule,
                            errors: result.errors,
                            targets: []
                        };
                        const key = fingerprint(result.rule), duplicate = fingerprints.has(key);
                        const targets = existing.filter(rule => overlap(rule.domain, result.rule.domain));
                        const incomingConflicts = incomingRules.filter(entry => overlap(entry.rule.domain, result.rule.domain)).map(entry => entry.index);
                        const kind = duplicate ? "duplicate" : targets.length || incomingConflicts.length ? "conflict" : "new";
                        fingerprints.add(key);
                        incomingRules.push({
                            rule: result.rule,
                            index: incomingIndex + 1
                        });
                        return {
                            kind: kind,
                            action: kind === "new" ? "add" : "skip",
                            rule: result.rule,
                            errors: [],
                            targets: targets,
                            incomingConflicts: incomingConflicts
                        };
                    });
                }
                function compile(input, helpers = {}) {
                    const result = validate(input);
                    if (result.errors.length) throw new Error(result.errors.map(error => error.message).join("；"));
                    const rule = result.rule;
                    for (const field of [ "getImgs", "getComicInfo" ]) {
                        if (field === "getImgs" && rule.simpleRule) rule[field] = simpleImages; else if (typeof rule[field] === "string") {
                            checkFunction(rule[field]);
                            rule[field] = Function("request", "trimSpecial", "funstrToData", '"use strict";return (' + rule[field] + "\n)")(helpers.request, helpers.trimSpecial, helpers.funstrToData);
                        }
                    }
                    return rule;
                }
                return {
                    migrate: migrate,
                    validate: validate,
                    checkFunction: checkFunction,
                    parseJSON: parseJSON,
                    serialize: serialize,
                    deserialize: deserialize,
                    matches: matches,
                    overlap: overlap,
                    resolve: resolve,
                    previewImport: previewImport,
                    fingerprint: fingerprint,
                    simpleImages: simpleImages,
                    compile: compile,
                    createId: createId,
                    now: now
                };
            })({
                parse: (code, options) => __tenComicRuleSyntax().parse(code, options)
            });
        },
        872: (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
            "use strict";
            __webpack_require__.d(__webpack_exports__, {
                HL: () => matchWeb,
                Ni: () => searchFunTemplate_1,
                Po: () => currentComics,
                eT: () => getWebList
            });
            var downloadUtils = __webpack_require__(624), configModule = __webpack_require__(390);
            const customRuleModel = __webpack_require__(516);
            const searchFunTemplate_1 = async (data, keyword) => {
                let {search_add_url: search_add_url, search_pre: search_pre, alllist_dom_css: alllist_dom_css, minlist_dom_css: minlist_dom_css, namelink_index: namelink_index, img_src: img_src, use_background: use_background, img_reg: img_reg, match_reg_num: match_reg_num} = data.searchTemplate_1;
                namelink_index ? namelink_index-- : namelink_index = 0;
                let searchUrl = "";
                searchUrl = search_pre ? search_pre + search_add_url + keyword : data.homepage + search_add_url + keyword;
                let headers = "";
                data.headers && (headers = data.headers);
                const {responseText: responseText} = await (0, downloadUtils.WY)({
                    method: "get",
                    url: searchUrl,
                    data: "",
                    headers: headers
                }), dom = (0, downloadUtils.U3)(responseText).querySelector(alllist_dom_css), domList = dom.querySelectorAll(minlist_dom_css), searchList = [];
                return domList.forEach(element => {
                    const obj = {};
                    try {
                        obj.name = element.querySelector("a").title;
                        const pathname = element.querySelector("a").pathname;
                        if (obj.url = data.homepage + pathname.slice(1, pathname.length), use_background) obj.imageUrl = element.innerHTML.match(/background.*?(url)\('?(.*?)'?\)/)[2]; else if (img_reg) obj.imageUrl = element.innerHTML.match(img_reg)[match_reg_num]; else {
                            const reg2 = eval("/" + img_src + "=('|\")(.*?)('|\")/");
                            obj.imageUrl = element.innerHTML.match(reg2)[2];
                        }
                        if ("" === obj.name) {
                            let e = element.innerHTML.match(/title=('|")(.*?)('|")/);
                            e && e.length >= 2 ? obj.name = e[2] : (e = element.innerHTML.match(/alt=('|")(.*?)('|")/), 
                            e && e.length >= 2 && (obj.name = e[2])), "" === obj.name && (obj.name = element.querySelectorAll("a")[namelink_index].innerText);
                        }
                    } catch (e) {
                        console.log("error: ", data.webName, e);
                    }
                    searchList.push(obj);
                }), new Promise((e, t) => {
                    e(searchList);
                });
            }, comicsWebInfo = [ {
                domain: "manhua.zaimanhua.com",
                homepage: "https://manhua.zaimanhua.com/",
                webName: "再漫画",
                comicNameCss: ".wrap_intro_l_comic h1 a",
                chapterCss: ".tab-content-selected",
                readtype: 1,
                useFrame: !1,
                getImgs: async function(e, t) {
                    const n = String(t && t.url || "").match(/\/view\/[^/]+\/(\d+)\/(\d+)/);
                    if (!n) throw new Error("无法识别再漫画章节地址");
                    const r = `https://manhua.zaimanhua.com/api/v1/comic2/chapter/detail?channel=pc&app_name=zmh&version=1.0.0&timestamp=${Date.now()}&uid=0&comic_id=${n[1]}&chapter_id=${n[2]}`, a = await (0, 
                    downloadUtils.WY)({
                        method: "get",
                        url: r,
                        headers: {
                            referer: t.url
                        }
                    });
                    if (!a || "object" != typeof a) throw new Error("再漫画章节接口请求失败");
                    let i;
                    try {
                        i = JSON.parse(a.responseText || a.response || "");
                    } catch (e) {
                        throw new Error("再漫画章节接口响应格式错误");
                    }
                    if (0 !== Number(i.errno)) throw new Error(i.errmsg || "再漫画章节接口返回错误");
                    const o = i.data && i.data.chapterInfo && i.data.chapterInfo.page_url, s = Array.isArray(o) ? [ ...new Set(o.filter(e => /^https?:/i.test(String(e)))) ] : [];
                    if (!s.length) throw new Error("再漫画图片数据加载失败");
                    return s;
                }
            }, {
                domain: "comic.naver.com",
                homepage: "https://comic.naver.com/",
                webName: "comic.naver",
                comicNameCss: "#content > div.EpisodeListInfo__comic_info--yRAu0 > div > h2",
                chapterCss: "#content ul",
                chapterNameReg: /span.*?>(.*?)<\/span>/,
                webDesc: "找到漫画目录页再使用, 新打开页面需“重载列表”",
                readtype: 1,
                headers: {
                    referer: "https://comic.naver.com/"
                },
                getImgs: async function(e) {
                    const t = e.match(/class="wt_viewer"[\s\S]*?(<\/div>)/)[0].matchAll(/img src="(.*?)"/g), n = [];
                    for (const e of t) n.push(e[1]);
                    return n;
                }
            }, {
                domain: "ac.qq.com",
                homepage: "https://ac.qq.com/",
                webName: "腾讯漫画",
                comicNameCss: ".works-intro-title.ui-left strong",
                chapterCss: ".chapter-page-all.works-chapter-list",
                headers: "",
                readtype: 1,
                webDesc: "2023.3.2起, 需要APP观看的章节无法完整下载",
                hasSpend: !0,
                payKey: "ui-icon-pay",
                searchTemplate_1: {
                    search_add_url: "Comic/searchList?search=",
                    alllist_dom_css: ".mod_book_list",
                    minlist_dom_css: "li",
                    img_src: "data-original"
                },
                getImgs: function(context) {
                    let nonce = context.match(/<script>\s*window.*?=(.*?)?;/)[1];
                    nonce = eval(nonce);
                    const dataStr = context.match(/DATA.*?'(.*)?'/)[1], data = dataStr.split("");
                    nonce = nonce.match(/\d+[a-zA-Z]+/g);
                    let len = nonce.length, locate = null, str = "";
                    for (;len--; ) locate = 255 & parseInt(nonce[len]), str = nonce[len].replace(/\d+/g, ""), 
                    data.splice(locate, str.length);
                    const chapterStr = data.join(""), chapterObj = JSON.parse(window.atob(chapterStr)), imgarr = [];
                    return chapterObj.picture.forEach(e => {
                        imgarr.push(e.url);
                    }), imgarr;
                }
            }, {
                domain: "komiic.com",
                homepage: "https://komiic.com/",
                webName: "Komiic漫画",
                comicNameCss: ".ComicMain__info .text-h6",
                chapterCss: ".v-card-text .v-container .v-row",
                chapterNameReg: / class="serial">(.*?)<\/span>/,
                webDesc: "SPA页面, 新页面需“重载列表”重新匹配新名称",
                headers: {
                    referer: "https://komiic.com/"
                },
                readtype: 1,
                getImgs: async function(e, t) {
                    const {url: n} = t, r = {
                        operationName: "imagesByChapterId",
                        variables: {
                            chapterId: n.match(/chapter\/(\d*)\/images/)[1]
                        },
                        query: "query imagesByChapterId($chapterId: ID!) {\n  imagesByChapterId(chapterId: $chapterId) {\n    id\n    kid\n    height\n    width\n    __typename\n  }\n}\n"
                    }, {responseText: a} = await (0, downloadUtils.WY)({
                        method: "post",
                        url: "https://komiic.com/api/query",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        data: JSON.stringify(r)
                    }), i = JSON.parse(a).data.imagesByChapterId, o = [];
                    return i.forEach(e => {
                        o.push("https://komiic.com/api/image/" + e.kid);
                    }), o;
                }
            }, {
                domain: [ "www.baozimhcn.com", "www.baozimh.com", "cn.baozimhcn.com" ],
                homepage: "https://www.baozimh.com/",
                webName: "包子漫画",
                comicNameCss: "h1.comics-detail__title",
                chapterCss: ".comics-detail > .l-content:nth-of-type(3) #chapter-items",
                chapterCss_2: ".comics-detail > .l-content:nth-of-type(3) .pure-g",
                readtype: 1,
                searchTemplate_1: {
                    search_add_url: "search/?keyword=",
                    alllist_dom_css: ".pure-g.classify-items",
                    minlist_dom_css: "div.comics-card",
                    img_reg: /src=('|")(.*?)\?/,
                    match_reg_num: 2
                },
                getImgs: async function(e, t) {
                    const n = [], r = /next_chapter"><a href="(.*)?"[\s\S]{1,10}点击进入下一页/;
                    let a = !1, i = "";
                    do {
                        const t = e.matchAll(/<img.*src="(.*?)"/g);
                        for (const e of t) n.includes(e[1]) || n.push(e[1]);
                        if (a = r.test(e), a) {
                            i = e.match(r)[1];
                            const {responseText: t} = await (0, downloadUtils.WY)("get", i);
                            e = t;
                        }
                    } while (a);
                    return n;
                }
            }, {
                domain: "www.kuaikanmanhua.com",
                homepage: "https://www.kuaikanmanhua.com/",
                webName: "快看漫画",
                comicNameCss: "h3.title",
                chapterCss: ".episode-title",
                readtype: 1,
                hasSpend: !0,
                useFrame: !0,
                directRemoteDownload: !0,
                getComicInfo: async function() {
                    const e = unsafeWindow.__NUXT__.data[0], t = e.comics, n = e.topicInfo.title, r = [];
                    return t.forEach(e => {
                        const t = `https://www.kuaikanmanhua.com/webs/comic-next/${e.id}`, a = {
                            comicName: n,
                            chapterName: String(e.title || "").trim(),
                            chapterNumStr: "",
                            url: t,
                            readtype: this.readtype,
                            isPay: Boolean(e.locked),
                            isUnavailable: Boolean(e.locked),
                            unavailableReason: e.locked ? "当前账号未解锁" : "",
                            isSelect: !1
                        };
                        r.push(a);
                    }), r;
                },
                getImgs: async function(e, t) {
                    const n = document.getElementById(t.frameId);
                    if (!n) throw new Error("隐藏章节页面不存在");
                    try {
                        const o = n.contentWindow, s = n.contentDocument, d = String(s && s.body && s.body.innerText || ""), l = /当前章节为付费章节/.test(d), u = /余额不足/.test(d) && /(立即充值|立即购买)/.test(d);
                        if (l) throw new Error("当前账号未解锁此章节");
                        const c = () => o.__NUXT__ && o.__NUXT__.data && o.__NUXT__.data[0] && o.__NUXT__.data[0].res && o.__NUXT__.data[0].res.data && o.__NUXT__.data[0].res.data.comic_info && o.__NUXT__.data[0].res.data.comic_info.comic_images;
                        let a = c();
                        for (let e = 0; e < 20 && (!Array.isArray(a) || !a.length); e++) await (0, downloadUtils.gw)(.1), 
                        a = c();
                        let r = Array.isArray(a) && a.length ? a.map(e => e.url1280 || e.url).filter(Boolean) : s ? [ ...s.querySelectorAll(".imgList .img-box img.img") ].map(e => e.getAttribute("data-src") || e.currentSrc || e.src || "").filter(e => /^https?:/i.test(e)) : [];
                        if (r = [ ...new Set(r) ], !r.length) throw new Error("快看漫画图片数据加载失败");
                        if (u && r.length <= 2) throw new Error("当前账号未解锁此章节");
                        return r;
                    } finally {
                        n.remove();
                    }
                }
            }, {
                domain: "m.kuaikanmanhua.com",
                homepage: "https://m.kuaikanmanhua.com/",
                webName: "快看漫画m",
                comicNameCss: ".mask p.title",
                chapterCss: "",
                readtype: 1,
                hasSpend: !0,
                showInList: !1,
                useFrame: !0,
                directRemoteDownload: !0,
                getComicInfo: async function() {
                    const code = document.body.outerHTML.match(/\(function\(a,b,c.*?(\)\))/g)[0], data = eval(code), list = data.data[0].comicList, comicName = (0, 
                    downloadUtils.Sc)(data.data[0].topicInfo.title), newlist = list.map(e => ({
                        comicName: comicName,
                        chapterName: (0, downloadUtils.Sc)(e.title),
                        chapterNumStr: "",
                        url: "https://m.kuaikanmanhua.com/mobile/comics/" + e.id,
                        readtype: 1,
                        isPay: !e.is_free,
                        isUnavailable: Boolean(e.locked),
                        unavailableReason: e.locked ? "当前账号未解锁" : "",
                        isSelect: !1
                    }));
                    return newlist;
                },
                getImgs: async function(e, t) {
                    const n = document.getElementById(t.frameId);
                    if (!n) throw new Error("隐藏章节页面不存在");
                    try {
                        const o = n.contentWindow, s = n.contentDocument;
                        let r = s ? [ ...s.querySelectorAll(".imgList .img-box img.img") ].map(e => e.getAttribute("data-src") || e.currentSrc || e.src || "").filter(e => /^https?:/i.test(e)) : [];
                        r = [ ...new Set(r) ];
                        const d = String(s && s.body && s.body.innerText || ""), l = /当前章节为付费章节/.test(d), u = /余额不足/.test(d) && /(立即充值|立即购买)/.test(d);
                        if (l) throw new Error("当前账号未解锁此章节");
                        if (!r.length) {
                            let a = o.__NUXT__ && o.__NUXT__.data && o.__NUXT__.data[0] && o.__NUXT__.data[0].res && o.__NUXT__.data[0].res.data && o.__NUXT__.data[0].res.data.comic_info && o.__NUXT__.data[0].res.data.comic_info.comic_images;
                            if (!Array.isArray(a) || !a.length) await (0, downloadUtils.gw)(2), a = o.__NUXT__ && o.__NUXT__.data && o.__NUXT__.data[0] && o.__NUXT__.data[0].res && o.__NUXT__.data[0].res.data && o.__NUXT__.data[0].res.data.comic_info && o.__NUXT__.data[0].res.data.comic_info.comic_images;
                            if (!Array.isArray(a) || !a.length) throw new Error("快看漫画图片数据加载失败");
                            r = a.map(e => e.url1280 || e.url).filter(Boolean);
                        }
                        r = [ ...new Set(r) ];
                        if (u && r.length <= 2) throw new Error("当前账号未解锁此章节");
                        return r;
                    } finally {
                        n.remove();
                    }
                }
            }, {
                domain: "www.dongmanmanhua.cn",
                homepage: "https://www.dongmanmanhua.cn/",
                webName: "咚漫",
                comicNameCss: "h1.subj",
                chapterCss: "#_listUl",
                chapterNameReg: /alt="(.*?)"/,
                readtype: 1,
                headers: {
                    referer: "https://www.dongmanmanhua.cn/"
                },
                getImgs: async function(e) {
                    const t = e.match(/class="viewer_lst[\s\S]*?input/)[0].matchAll(/img src[\s\S]*?data-url="(.*?)"/g), n = [];
                    for (const e of t) n.push(e[1]);
                    return n;
                }
            }, {
                domain: [ "mangacopy.com", "www.mangacopy.com" ],
                homepage: "https://www.mangacopy.com/",
                webName: "拷贝漫画",
                comicNameCss: "h6",
                chapterCss: "",
                webDesc: "仅下载页面正常加载的漫画图片",
                readtype: 1,
                useFrame: !0,
                getComicInfo: async function() {
                    const e = String(document.querySelector("h6") && document.querySelector("h6").textContent || "拷贝漫画").trim() || "拷贝漫画", t = new Map;
                    return [ ...document.querySelectorAll('a[href*="/chapter/"]') ].forEach(n => {
                        if (n.closest && n.closest(".comicParticulars-botton")) return;
                        const r = String(n.getAttribute("href") || ""), a = String(n.textContent || "").trim();
                        if (!r || !a) return;
                        const i = new URL(r, location.origin).href;
                        t.has(i) || t.set(i, {
                            comicName: e,
                            chapterName: a,
                            chapterNumStr: "",
                            url: i,
                            readtype: this.readtype,
                            isPay: !1,
                            isSelect: !1
                        });
                    }), [ ...t.values() ];
                },
                getImgs: async function(e, t) {
                    const n = document.getElementById(t.frameId);
                    if (!n) throw new Error("隐藏章节页面不存在");
                    try {
                        const e = n.contentWindow, r = n.contentDocument;
                        if (!e || !r) throw new Error("无法读取隐藏章节页面");
                        n.style.cssText = "position:fixed;left:-10000px;top:0;width:1200px;height:900px;opacity:0;pointer-events:none;border:0;";
                        const a = () => [ ...r.querySelectorAll(".comicContent-list img[data-src]") ].map(e => e.getAttribute("data-src") || "").filter(e => /^https?:/i.test(e) && !/\/loading\.jpg(?:[?#]|$)/i.test(e)).map(e => {
                            try {
                                return new URL(e, t.url).href;
                            } catch (t) {
                                return e;
                            }
                        }), i = [];
                        let o = "", s = 0;
                        for (let n = 0; n < 80; n++) {
                            if (t && t.signal && t.signal.aborted) throw new Error("下载已取消");
                            const c = [ ...new Set(a()) ], d = c.join("\n");
                            d === o ? s++ : (o = d, s = 0), i.splice(0, i.length, ...c);
                            const l = Math.max(Number(r.documentElement && r.documentElement.scrollHeight || 0), Number(r.body && r.body.scrollHeight || 0)), u = Number(e.scrollY || 0) + Number(e.innerHeight || 0) >= l - 4;
                            if (i.length && u && s >= 3) break;
                            e.scrollBy(0, Math.max(1e3, Number(e.innerHeight) || 900)), await (0, downloadUtils.gw)(.15);
                        }
                        if (!i.length) throw new Error("拷贝漫画 阅读页未找到漫画图片");
                        return i;
                    } finally {
                        n.remove();
                    }
                }
            }, {
                domain: "ridibooks.com",
                homepage: "https://ridibooks.com/webtoon/recommendation",
                webName: "RidiBooks",
                comicNameCss: "h1",
                chapterCss: "",
                webDesc: "免费或已授权章节",
                readtype: 1,
                hasSpend: !0,
                useFrame: !1,
                readerTabMode: "ridi",
                directRemoteDownload: !1,
                getComicInfo: async function() {
                    const e = document.querySelector("h1"), t = String(e && e.textContent || "RidiBooks").trim() || "RidiBooks", n = () => [ ...document.querySelectorAll('li.js_series_book_list a[href*="/view"]') ];
                    let r = n();
                    for (let e = 0; e < 40 && !r.length; e++) await (0, downloadUtils.gw)(.25), r = n();
                    if (!r.length) throw new Error("未找到 RidiBooks 章节列表");
                    const a = new Map;
                    return r.forEach(e => {
                        const n = e.closest("li.js_series_book_list"), r = e.getAttribute("href") || "";
                        if (!n || !r) return;
                        const i = new URL(r, location.origin).href;
                        if (a.has(i)) return;
                        const o = String(n.querySelector(".js_book_title") && n.querySelector(".js_book_title").textContent || "").trim();
                        if (!o) return;
                        const s = Number(n.getAttribute("data-price") || 0) > 0, c = String(n.getAttribute("data-is-adult-only") || "0") === "1";
                        a.set(i, {
                            comicName: t,
                            chapterName: o,
                            chapterNumStr: "",
                            url: i,
                            readtype: this.readtype,
                            isPay: s || c,
                            isUnavailable: c,
                            unavailableReason: c ? "年龄限制章节需要在网页端完成官方验证" : s ? "需要当前账号已有访问权限" : "",
                            isSelect: !1
                        });
                    }), [ ...a.values() ];
                },
                getImgs: async function(e, t) {
                    const n = "tenComicRidiWorker:", r = Date.now().toString(36) + Math.random().toString(36).slice(2), a = n + r, i = String(t && t.url || "");
                    if (!/^https:\/\/ridibooks\.com\/books\/\d+\/view/i.test(i)) throw new Error("请在 RidiBooks 阅读器页面使用“下载当前章节”");
                    const o = i + (i.includes("#") ? "&" : "#") + "tencomic-ridi-task=" + r, s = {
                        id: r,
                        status: "waiting",
                        readerUrl: i,
                        images: [],
                        error: "",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        cancelled: !1
                    };
                    let c = null;
                    GM_setValue(a, s);
                    try {
                        if ("function" != typeof GM_openInTab) throw new Error("请允许脚本打开一个 RidiBooks 阅读标签页");
                        c = GM_openInTab(o, {
                            active: !1,
                            insert: !0,
                            setParent: !0
                        });
                        for (let e = 0; e < 360; e++) {
                            if (t && t.signal && t.signal.aborted) {
                                const e = GM_getValue(a, s);
                                throw GM_setValue(a, {
                                    ...e,
                                    cancelled: !0,
                                    status: "cancelled",
                                    updatedAt: Date.now()
                                }), new Error("下载已取消");
                            }
                            const e = GM_getValue(a, null);
                            if (e && "ready" === e.status) {
                                const t = [ ...new Set((Array.isArray(e.images) ? e.images : []).map(String).filter(e => /^https:\/\//i.test(e))) ];
                                if (!t.length) throw new Error("RidiBooks 阅读器没有返回图片");
                                return t;
                            }
                            if (e && "error" === e.status) throw new Error(e.error || "RidiBooks 章节未授权或读取失败");
                            await (0, downloadUtils.gw)(.25);
                        }
                        throw new Error("RidiBooks 阅读标签页响应超时；请确认章节免费或当前账号已有访问权限");
                    } finally {
                        GM_deleteValue(a);
                        try {
                            c && "function" == typeof c.close && c.close();
                        } catch (e) {}
                    }
                }
            }, {
                domain: "www.webtoons.com",
                homepage: "https://www.webtoons.com/",
                webName: "Webtoons",
                comicNameCss: ".subj",
                chapterCss: "#_listUl",
                readtype: 1,
                useFrame: !1,
                getImgs: function(e) {
                    const t = (0, downloadUtils.U3)(e), n = [ ...t.querySelectorAll("#_imageContainer img, .viewer_img img, ._imageContainer img") ].map(e => e.getAttribute("data-url") || e.getAttribute("src") || "").filter(e => /^https?:/i.test(e)), r = [ ...new Set(n) ];
                    if (!r.length) throw new Error("Webtoons 图片数据加载失败");
                    return r;
                }
            }, {
                domain: "page.kakao.com",
                homepage: "https://page.kakao.com/",
                webName: "KakaoPage",
                comicNameCss: "",
                chapterCss: "",
                webDesc: "仅下载免费章节或当前账号已经购买/有权访问的章节",
                headers: {
                    referer: "https://page.kakao.com/"
                },
                downHeaders: {
                    referer: "https://page.kakao.com/"
                },
                readtype: 1,
                hasSpend: !0,
                useFrame: !1,
                readerTabMode: "kakao",
                directRemoteDownload: !1,
                getComicInfo: async function() {
                    const e = () => [ ...document.querySelectorAll('a[href*="/viewer/"]') ];
                    let t = e();
                    for (let e = 0; e < 40 && !t.length; e++) await (0, downloadUtils.gw)(.25), t = e();
                    if (!t.length) throw new Error("未找到 KakaoPage 章节列表");
                    const n = String(document.title || "KakaoPage").replace(/\s*-\s*(?:웹툰|웹소설|책)[\s\S]*$/, "").replace(/\s*\|\s*카카오페이지[\s\S]*$/, "").trim() || "KakaoPage", r = new Map;
                    return t.forEach(e => {
                        const t = String(e.textContent || "").replace(/\s+/g, " ").trim();
                        if (!t || /동영상|웹에서\s*감상불가/.test(t)) return;
                        const a = e.getAttribute("href") || "", i = new URL(a, location.origin).href;
                        if (!/^https:\/\/page\.kakao\.com\/content\/\d+\/viewer\/\d+\/?/i.test(i) || r.has(i)) return;
                        const o = [ ...e.querySelectorAll(".font-medium2") ].map(e => String(e.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" ").trim() || t, s = /무료/.test(t);
                        r.set(i, {
                            comicName: n,
                            chapterName: o,
                            chapterNumStr: "",
                            url: i,
                            readtype: this.readtype,
                            isPay: !s,
                            isUnavailable: !1,
                            unavailableReason: s ? "" : "需要当前账号已有访问权限",
                            isSelect: !1
                        });
                    }), [ ...r.values() ];
                },
                getImgs: async function(e, t) {
                    const n = "tenComicKakaoWorker:", r = Date.now().toString(36) + Math.random().toString(36).slice(2), a = n + r, i = String(t && t.url || "");
                    if (!/^https:\/\/page\.kakao\.com\/content\/\d+\/viewer\/\d+\/?/i.test(i)) throw new Error("无法识别 KakaoPage 章节地址");
                    const o = i + (i.includes("#") ? "&" : "#") + "tencomic-kakao-task=" + r, s = {
                        id: r,
                        status: "waiting",
                        readerUrl: i,
                        images: [],
                        error: "",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        cancelled: !1
                    };
                    let c = null;
                    GM_setValue(a, s);
                    try {
                        if ("function" != typeof GM_openInTab) throw new Error("请允许脚本打开一个 KakaoPage 阅读标签页");
                        c = GM_openInTab(o, {
                            active: !1,
                            insert: !0,
                            setParent: !0
                        });
                        for (let e = 0; e < 360; e++) {
                            if (t && t.signal && t.signal.aborted) {
                                const e = GM_getValue(a, s);
                                throw GM_setValue(a, {
                                    ...e,
                                    cancelled: !0,
                                    status: "cancelled",
                                    updatedAt: Date.now()
                                }), new Error("下载已取消");
                            }
                            const e = GM_getValue(a, null);
                            if (e && "ready" === e.status) {
                                const t = [ ...new Set((Array.isArray(e.images) ? e.images : []).map(String).filter(e => /^https:\/\//i.test(e))) ];
                                if (!t.length) throw new Error("KakaoPage 阅读器没有返回图片");
                                return t;
                            }
                            if (e && "error" === e.status) throw new Error(e.error || "KakaoPage 章节未授权或读取失败");
                            await (0, downloadUtils.gw)(.25);
                        }
                        throw new Error("KakaoPage 阅读标签页响应超时；请确认章节免费或当前账号已有访问权限");
                    } finally {
                        GM_deleteValue(a);
                        try {
                            c && "function" == typeof c.close && c.close();
                        } catch (e) {}
                    }
                }
            }, {
                domain: "manga.bilibili.com",
                homepage: "https://manga.bilibili.com/",
                webName: "哔哩哔哩漫画",
                comicNameCss: "h1.manga-title.t-no-wrap",
                chapterCss: ".episode-list",
                webDesc: "仅下载免费或当前账号已购买章节",
                headers: {
                    referer: "https://manga.bilibili.com/"
                },
                readtype: 0,
                hasSpend: !0,
                useFrame: !0,
                reuseParsedImages: !0,
                heavyCanvasExport: !0,
                getComicInfo: async function() {
                    const e = location.href.match(/\/(?:detail\/)?mc(\d+)/);
                    if (!e) throw new Error("无法识别哔哩哔哩漫画ID");
                    const t = Number(e[1]), n = unsafeWindow && unsafeWindow.document ? unsafeWindow.document : document, r = () => {
                        const e = n.querySelector(".episode-list-component"), t = e && e.__vue__, r = t && t.episodeList;
                        return Array.isArray(r) ? r.flat().filter(e => e && e.id) : [];
                    };
                    let a = r();
                    for (let e = 0; e < 50 && !a.length; e++) await (0, downloadUtils.gw)(.1), a = r();
                    if (!a.length) throw new Error("哔哩哔哩桌面章节数据加载失败，请刷新页面后重试");
                    const i = n.querySelector(".manga-title"), o = String(i && i.textContent || n.title || "").trim().replace(/\s*-\s*哔哩哔哩漫画\s*$/, "");
                    return a.slice().sort((e, t) => Number(e.ord) - Number(t.ord)).map(e => {
                        const n = Boolean((void 0 !== e.isLocked ? e.isLocked : e.is_locked) && !(void 0 !== e.isInFree ? e.isInFree : e.is_in_free)), r = String(e._shortTitle || e.shortTitle || e.short_title || ""), a = String(e.title || "");
                        return {
                            comicName: o,
                            chapterName: (r + " " + a).trim(),
                            chapterNumStr: "",
                            url: "https://manga.bilibili.com/mc" + t + "/" + e.id,
                            readtype: this.readtype,
                            isPay: n,
                            isUnavailable: n,
                            unavailableReason: n ? "当前账号未解锁" : "",
                            isSelect: !1
                        };
                    });
                },
                getImgs: async function(e, t) {
                    let n = t.otherData;
                    const r = () => {
                        n && "function" == typeof n.cleanup && n.cleanup();
                    };
                    try {
                        if (!n) {
                            const e = document.getElementById(t.frameId);
                            if (!e) throw new Error("隐藏章节页面不存在");
                            n = {
                                frame: e,
                                canvasHelper: null,
                                canvasToBlob: null,
                                cleanup() {
                                    this.canvasHelper && this.canvasHelper.remove(), this.frame && this.frame.remove(), 
                                    this.canvasHelper = null, this.canvasToBlob = null, this.frame = null, this.win = null, 
                                    this.doc = null, this.range = null;
                                }
                            };
                            const r = e.contentWindow, a = e.contentDocument;
                            if (!r || !a) throw new Error("无法读取隐藏章节页面");
                            let i = null, o = [];
                            for (let e = 0; e < 60; e++) {
                                if (t.signal && t.signal.aborted) throw new Error("下载已取消");
                                i = a.querySelector(".range-input"), o = [ ...a.querySelectorAll(".image-list .image-item") ];
                                if (i && o.length) break;
                                await (0, downloadUtils.gw)(.25);
                            }
                            if (!i || !o.length) throw new Error("章节未授权或阅读器加载失败");
                            const s = (0, configModule.cF)("imgDownRange"), c = Math.max(1, parseInt(Array.isArray(s) ? s[0] : 1) || 1), d = Array.isArray(s) ? parseInt(s[1]) : -1, l = Math.min(o.length, -1 === d ? o.length : Math.max(c - 1, d));
                            if (l <= c - 1) throw new Error("所选下载范围内没有图片");
                            const u = document.createElement("iframe");
                            u.className = "ten-comic-canvas-helper", u.src = "about:blank", u.style.cssText = "display:none!important", 
                            document.documentElement.appendChild(u), n.canvasHelper = u;
                            let p = null;
                            for (let e = 0; e < 20; e++) {
                                if (p = u.contentWindow && u.contentWindow.HTMLCanvasElement && u.contentWindow.HTMLCanvasElement.prototype.toBlob, 
                                "function" == typeof p) break;
                                await (0, downloadUtils.gw)(.05);
                            }
                            if ("function" != typeof p) throw new Error("无法获取原生 Canvas 导出方法");
                            Object.assign(n, {
                                cursor: 0,
                                total: l - c + 1,
                                start: c - 1,
                                win: r,
                                doc: a,
                                range: i,
                                canvasToBlob: p
                            });
                        }
                        if (t.signal && t.signal.aborted) throw new Error("下载已取消");
                        const a = Math.max(1, Math.min(5, Math.trunc(Number(t.batchSize) || 1))), i = n.cursor, o = Math.min(n.total, i + a), s = [], c = [];
                        for (let e = i; e < o; e++) {
                            const r = n.start + e;
                            s.push(r);
                            let a = null;
                            for (let e = 0; e < 80; e++) {
                                if (t.signal && t.signal.aborted) throw new Error("下载已取消");
                                if ((0 === e || e && 0 === e % 20) && (n.range.value = String(r), n.range.dispatchEvent(new n.win.Event("input", {
                                    bubbles: !0
                                }))), (a = [ ...n.doc.querySelectorAll(".image-list .image-item") ][r]) && a.classList.contains("image-loaded") && (a = a.querySelector("canvas"))) break;
                                a = null, await (0, downloadUtils.gw)(.25);
                            }
                            if (!a) throw new Error("漫画第 " + (r + 1) + " 页加载超时，请确认该章节已购买或仍在限免");
                            c.push(a);
                        }
                        const l = await Promise.all(c.map(async (e, d) => {
                            let r;
                            for (let a = 0; a < 2; a++) try {
                                return await new Promise((t, r) => n.canvasToBlob.call(e, e => e && e.size > 1024 ? t(e) : r(new Error("漫画第 " + (s[d] + 1) + " 页画布导出失败")), "image/jpeg", .92));
                            } catch (e) {
                                if (r = e, 1 === a) throw r;
                                await (0, downloadUtils.gw)(.05);
                            }
                            throw r;
                        })), u = [];
                        try {
                            for (const e of l) u.push(URL.createObjectURL(e));
                        } catch (e) {
                            for (const e of u) try {
                                URL.revokeObjectURL(e);
                            } catch (e) {}
                            throw e;
                        }
                        return n.cursor = o, n.cursor >= n.total && n.cleanup(), {
                            imgUrlArr: u,
                            imgIndexStart: n.start + i + 1,
                            nextPageUrl: n.cursor < n.total ? t.url : null,
                            nextPageDelay: 0,
                            imgCount: n.total,
                            otherData: n
                        };
                    } catch (e) {
                        throw r(), e;
                    }
                }
            }, {
                domain: "m.hipmh.com",
                homepage: "https://m.hipmh.com/",
                webName: "嬉皮漫畫（HipMH）",
                comicNameCss: "aside h1, h1",
                chapterCss: "",
                webDesc: "免费漫画站点；下载时使用单个阅读标签页",
                readtype: 1,
                useFrame: !1,
                readerTabMode: !0,
                getComicInfo: async function(e) {
                    const t = () => [ ...document.querySelectorAll('a[href*="/chapter/go?hid="]') ], n = [ ...document.querySelectorAll("button") ].find(e => /查看所有章[節节]/.test(String(e.textContent || "")));
                    let r = t();
                    if (!r.length && n && !n.disabled) {
                        n.click();
                        for (let e = 0; e < 20 && !r.length; e++) await (0, downloadUtils.gw)(.25), r = t();
                    }
                    if (!r.length) throw new Error("未找到 HipMH 章节列表");
                    const a = new Map;
                    return r.forEach(t => {
                        const n = String(t.textContent || "").trim(), r = t.getAttribute("href") || "";
                        if (!n || !r) return;
                        const i = new URL(r, location.origin), o = i.searchParams.get("hid");
                        if (!o) return;
                        const s = new URL("/chapter/" + encodeURIComponent(o), "https://reader.hipmh.top").href;
                        a.has(s) || a.set(s, {
                            comicName: e,
                            chapterName: n,
                            chapterNumStr: "",
                            url: s,
                            readtype: this.readtype,
                            isPay: !1,
                            isSelect: !1
                        });
                    }), [ ...a.values() ];
                },
                getImgs: async function(e, t) {
                    const n = "tenComicHipmhWorker:", r = Date.now().toString(36) + Math.random().toString(36).slice(2), a = n + r, i = String(t && t.url || "");
                    if (!/^https:\/\/reader\.hipmh\.top\/chapter\//i.test(i)) throw new Error("无法识别 HipMH 章节地址");
                    const o = i + (i.includes("#") ? "&" : "#") + "tencomic-task=" + r, s = {
                        id: r,
                        status: "waiting",
                        readerUrl: i,
                        images: [],
                        error: "",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        cancelled: !1
                    };
                    let c = null;
                    GM_setValue(a, s);
                    try {
                        if ("function" != typeof GM_openInTab) throw new Error("请允许脚本打开一个 HipMH 阅读标签页");
                        c = GM_openInTab(o, {
                            active: !1,
                            insert: !0,
                            setParent: !0
                        });
                        for (let e = 0; e < 480; e++) {
                            if (t && t.signal && t.signal.aborted) {
                                const e = GM_getValue(a, s);
                                throw GM_setValue(a, {
                                    ...e,
                                    cancelled: !0,
                                    status: "cancelled",
                                    updatedAt: Date.now()
                                }), new Error("下载已取消");
                            }
                            const e = GM_getValue(a, null);
                            if (e && "ready" === e.status) {
                                const t = [ ...new Set((Array.isArray(e.images) ? e.images : []).filter(e => /^https:\/\//i.test(String(e)))) ];
                                if (!t.length) throw new Error("HipMH 阅读页没有返回图片");
                                return t;
                            }
                            if (e && "error" === e.status) throw new Error(e.error || "HipMH 阅读页处理失败");
                            await (0, downloadUtils.gw)(.25);
                        }
                        throw new Error("HipMH 阅读标签页响应超时");
                    } finally {
                        GM_deleteValue(a);
                        try {
                            c && "function" == typeof c.close && c.close();
                        } catch (e) {}
                    }
                }
            }, {
                domain: [ "rumanhua2.com", "www.rumanhua2.com" ],
                homepage: "https://www.rumanhua2.com/",
                webName: "如漫画",
                comicNameCss: "h1.name_mh",
                chapterCss: ".chapterlistload",
                readtype: 1,
                useFrame: !0,
                getComicInfo: async function(e) {
                    const t = () => [ ...document.querySelectorAll(".chapterlistload a[href]") ], n = t().length, r = document.querySelector(".chaplist-more button");
                    if (r && !r.disabled && (!r.getClientRects || r.getClientRects().length)) {
                        r.click();
                        let e = 0;
                        for (;e < 20 && t().length <= n; e++) await (0, downloadUtils.gw)(.25);
                        if (t().length <= n) throw new Error("完整章节列表加载超时");
                    }
                    const a = t();
                    if (!a.length) throw new Error("未找到章节列表");
                    const i = new Map;
                    return a.forEach(t => {
                        const n = String(t.textContent || "").trim(), r = t.href;
                        n && r && !i.has(r) && i.set(r, {
                            comicName: e,
                            chapterName: n,
                            chapterNumStr: "",
                            url: r,
                            readtype: this.readtype,
                            isPay: !1,
                            isSelect: !1
                        });
                    }), [ ...i.values() ];
                },
                getImgs: async function(e, t) {
                    const n = document.getElementById(t.frameId);
                    if (!n) throw new Error("隐藏章节页面不存在");
                    try {
                        const e = n.contentDocument;
                        if (!e) throw new Error("无法读取隐藏章节页面");
                        const r = () => {
                            const n = [ ...e.querySelectorAll(".main_img .chapter-img-box img") ].map(e => {
                                const n = e.getAttribute("data-src") || e.getAttribute("src") || "";
                                if (!n || /\/static\/images\/load\.gif(?:[?#]|$)/i.test(n)) return "";
                                try {
                                    return new URL(n, t.url || this.homepage).href;
                                } catch (e) {
                                    return n;
                                }
                            }).filter(Boolean);
                            return [ ...new Set(n) ];
                        };
                        let a = [], i = "", o = 0;
                        for (let e = 0; e < 20; e++) {
                            if (t && t.signal && t.signal.aborted) throw new Error("下载已取消");
                            const n = r(), s = n.join("\n");
                            s && s === i ? o += 1 : o = 0, a = n, i = s;
                            if (a.length && e >= 6 && o >= 3) break;
                            await (0, downloadUtils.gw)(.25);
                        }
                        if (!a.length) throw new Error("章节页面未找到漫画图片");
                        return a;
                    } finally {
                        n.remove();
                    }
                }
            } ];
            /* FOUR_SITE_ADDITIONS_START: refreshed Mangabz, Manhuagui, Zero */            comicsWebInfo.unshift({
                domain: [ "mangabz.com", "www.mangabz.com" ],
                homepage: "https://www.mangabz.com/",
                webName: "Mangabz",
                comicNameCss: "p.detail-info-title",
                chapterCss: "#chapterlistload",
                readtype: 1,
                useFrame: true,
                headers: {
                    referer: "https://www.mangabz.com/"
                },
                searchTemplate_1: {
                    search_add_url: "search?title=",
                    alllist_dom_css: ".container .mh-list",
                    minlist_dom_css: "li",
                    img_src: "src"
                },
                downHeaders: {
                    referer: "https://www.mangabz.com/"
                },
                getImgs: async function(html, task) {
                    const frame = document.getElementById(task.frameId);
                    if (!frame || !frame.contentDocument || !frame.contentWindow) throw new Error("Mangabz reader did not load");
                    try {
                        const doc = frame.contentDocument, win = frame.contentWindow;
                        const range = String(doc.querySelector(".bottom-page2")?.textContent || "").match(/-\s*(\d+)/);
                        const total = range ? Number(range[1]) : 0;
                        if (!total || total > 1e3 || !doc.querySelector('a[href="javascript:ShowNext();"]')) throw new Error("Mangabz page list is unavailable");
                        const images = [];
                        for (let page = 1; page <= total; page++) {
                            if (task.signal?.aborted) throw new Error("Download cancelled");
                            if (page > 1) doc.querySelector('a[href="javascript:ShowNext();"]').click();
                            let found = "";
                            for (let attempt = 0; attempt < 80; attempt++) {
                                const current = Number(doc.querySelector("#lbcurrentpage")?.textContent || 0);
                                const src = String(doc.querySelector("#cp_image")?.getAttribute("src") || "");
                                if (current === page && /^https?:\/\//i.test(src) && !/\/loading\./i.test(src) && src !== images[images.length - 1]) {
                                    found = new URL(src, task.url).href;
                                    break;
                                }
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                            if (!found) throw new Error("Mangabz image page " + page + " timed out");
                            images.push(found);
                        }
                        return images;
                    } finally {
                        frame.remove();
                    }
                }
            });
            comicsWebInfo.push({
                domain: [ "manhuagui.com", "www.manhuagui.com" ],
                homepage: "https://www.manhuagui.com/",
                webName: "看漫画",
                comicNameCss: "h1",
                chapterCss: ".chapter-list",
                chapterNameReg: /title="([^"]+)"/,
                readtype: 1,
                useFrame: false,
                readerTabMode: "manhuagui",
                downHeaders: {
                    referer: "https://www.manhuagui.com/"
                },
                getImgs: async function(html, task) {
                    const prefix = "tenComicManhuaguiWorker:", id = Date.now().toString(36) + Math.random().toString(36).slice(2);
                    const key = prefix + id, readerUrl = String(task?.url || "").split("#")[0];
                    if (!/^https:\/\/(?:www\.)?manhuagui\.com\/comic\/\d+\/\d+\.html$/i.test(readerUrl)) throw new Error("Invalid Manhuagui chapter URL");
                    const record = {
                        id: id,
                        status: "waiting",
                        readerUrl: readerUrl,
                        images: [],
                        error: "",
                        cancelled: false,
                        updatedAt: Date.now()
                    };
                    let tab = null;
                    GM_setValue(key, record);
                    try {
                        if (typeof GM_openInTab !== "function") throw new Error("Please allow the script to open a Manhuagui reader tab");
                        tab = GM_openInTab(readerUrl + "#tencomic-mg-task=" + id, {
                            active: false,
                            insert: true,
                            setParent: true
                        });
                        for (let attempt = 0; attempt < 900; attempt++) {
                            if (task?.signal?.aborted) {
                                const current = GM_getValue(key, record);
                                GM_setValue(key, {
                                    ...current,
                                    cancelled: true,
                                    status: "cancelled"
                                });
                                throw new Error("Download cancelled");
                            }
                            const current = GM_getValue(key, null);
                            if (current?.status === "ready") {
                                const images = [ ...new Set((Array.isArray(current.images) ? current.images : []).filter(url => /^https:\/\//i.test(String(url)))) ];
                                if (!images.length) throw new Error("Manhuagui reader returned no images");
                                return images;
                            }
                            if (current?.status === "error") throw new Error(current.error || "Manhuagui reader failed");
                            await new Promise(resolve => setTimeout(resolve, 250));
                        }
                        throw new Error("Manhuagui reader tab timed out");
                    } finally {
                        GM_deleteValue(key);
                        try {
                            tab?.close?.();
                        } catch (error) {}
                    }
                }
            }, {
                domain: [ "zerobyw33.com", "www.zerobyw33.com" ],
                homepage: "https://www.zerobyw33.com/pc/pc/",
                webName: "Zero搬运网",
                comicNameCss: "main h1",
                chapterCss: "main .grid.grid-cols-2",
                readtype: 1,
                useFrame: true,
                getComicInfo: async function() {
                    let title = "", links = [];
                    for (let attempt = 0; attempt < 50; attempt++) {
                        title = String(document.querySelector("main h1")?.textContent || "").trim().split(/\r?\n|\u3010/)[0].trim();
                        links = [ ...document.querySelectorAll('main .grid.grid-cols-2 a[href*="/pc/view/index.php?zjid="]') ];
                        if (title && links.length) break;
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    if (!title || !links.length) throw new Error("Zero comic title or chapters did not load");
                    const chapters = new Map;
                    for (const link of links) {
                        const name = String(link.textContent || "").trim(), href = link.getAttribute("href");
                        if (!name || !href) continue;
                        const url = new URL(href, location.origin).href;
                        if (!chapters.has(url)) chapters.set(url, {
                            comicName: title,
                            chapterName: name,
                            chapterNumStr: "",
                            url: url,
                            readtype: this.readtype,
                            isPay: false,
                            isSelect: false
                        });
                    }
                    return [ ...chapters.values() ];
                },
                downHeaders: {
                    referer: "https://www.zerobyw33.com/"
                },
                getImgs: async function(html, task) {
                    const frame = document.getElementById(task.frameId);
                    if (!frame || !frame.contentDocument) throw new Error("Zero reader did not load");
                    try {
                        const doc = frame.contentDocument;
                        for (let attempt = 0; attempt < 40; attempt++) {
                            if (task.signal?.aborted) throw new Error("Download cancelled");
                            const images = [ ...doc.querySelectorAll("#image-container img.manga-image") ].map(img => img.getAttribute("src") || "").filter(src => src && !/loading|placeholder/i.test(src)).map(src => new URL(src, task.url).href).filter(src => /^https?:\/\//i.test(src));
                            if (images.length) return [ ...new Set(images) ];
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                        throw new Error("Zero reader has no accessible images");
                    } finally {
                        frame.remove();
                    }
                }
            });
            /* FOUR_SITE_ADDITIONS_END */
            // SF 菠萝包：参考用户提供的下载脚本确认 picAy 数据形态；复用本站正常阅读流程。
                        comicsWebInfo.push({
                domain: "manhua.sfacg.com",
                homepage: "https://manhua.sfacg.com/",
                webName: "SF菠萝包漫画",
                webDesc: "打开站点",
                comicNameCss: 'h1, .Reduction_left a[href^="/mh/"]',
                chapterCss: ".comic_Serial_list",
                readtype: 1,
                useFrame: true,
                hasSpend: true,
                payKey: "VIP",
                downHeaders: {
                    referer: "https://manhua.sfacg.com/"
                },
                getComicInfo: async function() {
                    const pageUrl = new URL(location.href);
                    const match = pageUrl.pathname.match(/^\/mh\/([^/]+)\/(?:\d+\/)?$/i);
                    if (!match) throw new Error("请在 SF 漫画作品页或章节阅读页加载目录");
                    let root = document;
                    const directoryUrl = new URL("/mh/" + match[1] + "/", pageUrl).href;
                    if (/^\/mh\/[^/]+\/\d+\/$/i.test(pageUrl.pathname)) {
                        const response = await (0, downloadUtils.WY)({
                            method: "get",
                            url: directoryUrl,
                            useCookie: true,
                            headers: {
                                referer: pageUrl.href
                            }
                        });
                        if (!response || response.status !== 200) throw new Error("SF 漫画目录请求失败");
                        root = (0, downloadUtils.U3)(response.responseText || response.response || "");
                    }
                    const comicName = String(root.querySelector(this.comicNameCss)?.textContent || "").trim();
                    if (!comicName) throw new Error("SF 漫画目录中未找到作品名称");
                    const chapters = new Map;
                    for (const list of root.querySelectorAll(this.chapterCss)) {
                        // 本站每个目录分组均以最新章节在前显示。
                        for (const link of [ ...list.querySelectorAll("a[href]") ].reverse()) {
                            const href = link.getAttribute("href");
                            if (!href) continue;
                            let url;
                            try {
                                url = new URL(href, directoryUrl);
                            } catch (error) {
                                continue;
                            }
                            if (!/^https?:$/.test(url.protocol) || url.hostname !== "manhua.sfacg.com") continue;
                            url.protocol = pageUrl.protocol;
                            const chapter = url.pathname.match(/^\/mh\/([^/]+)\/\d+\/$/i);
                            if (url.origin !== pageUrl.origin || !chapter || chapter[1].toLowerCase() !== match[1].toLowerCase()) continue;
                            url.search = "";
                            url.hash = "";
                            const isPay = /^VIP$/i.test(String(link.querySelector("b")?.textContent || "").trim());
                            let chapterName = String(link.textContent || "").trim();
                            if (isPay) chapterName = chapterName.replace(/^VIP\s*/i, "").trim();
                            if (!chapterName || chapters.has(url.href)) continue;
                            chapters.set(url.href, {
                                comicName: comicName,
                                chapterName: chapterName,
                                chapterNumStr: "",
                                url: url.href,
                                readtype: this.readtype,
                                isPay: isPay,
                                isSelect: false
                            });
                        }
                    }
                    if (!chapters.size) throw new Error("SF 漫画目录中未找到章节");
                    return [ ...chapters.values() ];
                },
                getImgs: async function(html, task) {
                    const frame = document.getElementById(task?.frameId);
                    if (!frame) throw new Error("SF 漫画阅读页未加载");
                    try {
                        const readerUrl = new URL(task.url);
                        if (readerUrl.origin !== new URL(location.href).origin || !/^\/mh\/[^/]+\/\d+\/$/i.test(readerUrl.pathname)) {
                            throw new Error("无法识别 SF 漫画章节地址，请打开章节阅读页");
                        }
                        for (let attempt = 0; attempt < 150; attempt++) {
                            if (task.signal?.aborted) throw new Error("下载已取消");
                            const doc = frame.contentDocument;
                            // 页面全局变量不属于 DOM；隔离环境应使用已声明授权的页面窗口。
                                                        const pageFrame = typeof unsafeWindow !== "undefined" ? unsafeWindow.document?.getElementById(task.frameId) : null;
                            const win = frame.contentWindow?.wrappedJSObject || pageFrame?.contentWindow || frame.contentWindow;
                            if (!doc || !win) throw new Error("SF 漫画阅读页不可读取，请先在网站正常登录并打开章节");
                            if (new URL(win.location.href).pathname !== readerUrl.pathname) {
                                throw new Error("SF 漫画阅读页已跳转，请先确认该章节可正常阅读");
                            }
                            const pictures = win.picAy;
                            if (Array.isArray(pictures) && pictures.length) {
                                // 不按图片 URL 去重：相同图片也可能占据两个不同的阅读页。
                                return Array.from(pictures, picture => {
                                    if (typeof picture !== "string" || !picture.trim()) throw new Error("SF 漫画图片地址不完整");
                                    const clean = picture.trim().replace(/\\\//g, "/");
                                    let url;
                                    try {
                                        url = new URL(clean, "https://coldpic.sfacg.com/");
                                    } catch (error) {
                                        throw new Error("SF 漫画图片地址格式错误");
                                    }
                                    if (!/^https?:$/.test(url.protocol)) throw new Error("SF 漫画图片地址格式错误");
                                    return url.href;
                                });
                            }
                            const tips = doc.querySelector("#Tips");
                            if (tips && tips.style.display !== "none" && String(tips.textContent || "").trim()) {
                                throw new Error("SF 漫画阅读页：" + String(tips.textContent).trim());
                            }
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                        throw new Error("SF 漫画图片加载超时，请确认已登录且当前账号可正常阅读该章节");
                    } catch (error) {
                        if (error?.name === "SecurityError") throw new Error("SF 漫画阅读页已跳转到登录或授权页面，请先在网站正常打开章节");
                        throw error;
                    } finally {
                        frame.remove();
                    }
                }
            });
            comicsWebInfo.forEach(e => {
                void 0 === e.batchDelay && (e.batchDelay = 200);
            });
            const getWebList = () => {
                const e = (0, configModule.cF)("userWebInfo"), t = Array.isArray(e) ? e : [];
                return {
                    originalInfo: comicsWebInfo,
                    userWebInfo: t
                };
            };
            let currentComics = null;
            const matchWeb = e => {
                let t = "";
                try {
                    t = new URL(e || window.location.href).hostname.toLowerCase();
                } catch (e) {
                    return null;
                }
                const stored = (0, configModule.cF)("userWebInfo");
                const resolution = customRuleModel.resolve(e || window.location.href, comicsWebInfo, stored);
                currentComics = resolution.selected;
                if (resolution.source === "custom" && currentComics) {
                    const result = customRuleModel.validate(currentComics);
                    if (result.errors.length) {
                        console.warn("10漫画：自定义规则校验失败。", result.errors);
                        currentComics = resolution.builtin;
                        return currentComics;
                    }
                    currentComics = customRuleModel.compile(result.rule, {
                        request: downloadUtils.WY,
                        trimSpecial: downloadUtils.Sc,
                        funstrToData: downloadUtils.D
                    });
                    if (typeof window !== "undefined") window.request = downloadUtils.WY;
                }
                if (currentComics && typeof currentComics.getImgs === "string") currentComics.getImgs = funSplicing(currentComics.getImgs);
                if (currentComics && typeof currentComics.getComicInfo === "string") currentComics.getComicInfo = funSplicing(currentComics.getComicInfo);
                return currentComics;
            };
            function matchesRuleDomain(e, t) {
                return ("Array" === (0, downloadUtils.oL)(e) ? e : [ e ]).some(e => {
                    const n = String(e || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^\*\./, "");
                    return n && (t === n || t.endsWith(`.${n}`));
                });
            }
            function funSplicing(e) {
                const t = [], n = [];
                return e.includes("funstrToData") && (t.push("funstrToData"), n.push(downloadUtils.D)), 
                e.includes("request") && (t.push("request"), n.push(downloadUtils.WY)), e.includes("trimSpecial") && (t.push("trimSpecial"), 
                n.push(downloadUtils.Sc)), Function(...t, `"use strict";return (${e})`)(...n);
            }
        },
        624: (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
            "use strict";
            const imageRetryPolicy = (() => {
                "use strict";
                const MAX_RETRIES = 2;
                const MAX_AUTO_WAIT_MS = 10 * 60 * 1e3;
                const TEMPORARY_STATUSES = new Set([ 408, 425, 429, 500, 502, 503, 504 ]);
                function headerValue(headers, name) {
                    if (!headers) return "";
                    if (typeof headers.get === "function") return String(headers.get(name) || "").trim();
                    if (typeof headers === "object") {
                        const key = Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase());
                        return key ? String(headers[key]).trim() : "";
                    }
                    const match = String(headers).match(new RegExp("(?:^|\\r?\\n)" + name + "\\s*:\\s*([^\\r\\n]*)", "i"));
                    return match ? match[1].trim() : "";
                }
                function retryAfterMilliseconds(headers, now) {
                    const instruction = headerValue(headers, "retry-after");
                    if (!instruction) return null;
                    if (/^\d+$/.test(instruction)) return Math.min(Number.MAX_SAFE_INTEGER, Number(instruction) * 1e3);
                    if (!/^[A-Za-z]{3,9},?\s/.test(instruction) || !/\bGMT$/i.test(instruction)) return null;
                    const retryDate = Date.parse(instruction);
                    if (!Number.isFinite(retryDate)) return null;
                    const serverDate = Date.parse(headerValue(headers, "date"));
                    return Math.max(0, retryDate - (Number.isFinite(serverDate) ? serverDate : now));
                }
                /** Pure retry decision; no request, timer, storage or UI side effects. */                function decide({url: url, response: response, failure: failure, attempt: attempt = 0, now: now = Date.now(), random: random = Math.random}) {
                    const result = {
                        retry: false,
                        delayMs: 0,
                        cooldownMs: 0,
                        category: "permanent",
                        reason: ""
                    };
                    if (!failure) return {
                        ...result,
                        category: "success"
                    };
                    if (response === "abort") return {
                        ...result,
                        category: "cancelled"
                    };
                    if (String(url || "").startsWith("blob:")) return {
                        ...result,
                        category: "temporary-data"
                    };
                    const status = Number(response && response.status) || 0;
                    const networkFailure = response === "timeout" || response === "onerror" || !response || status === 0;
                    if (!networkFailure && !TEMPORARY_STATUSES.has(status)) return result;
                    const rateLimited = status === 429 || status === 503;
                    const headerDelay = retryAfterMilliseconds(response && response.responseHeaders, now);
                    const backoff = (rateLimited ? 1e3 : 500) * Math.pow(2, Math.min(2, Math.max(0, attempt)));
                    const minimumDelay = headerDelay === null ? backoff : headerDelay;
                    const jitter = Math.min(Math.max(0, MAX_AUTO_WAIT_MS - minimumDelay), Math.floor(Math.max(0, Math.min(1, Number(random()) || 0)) * Math.min(250, minimumDelay * .25)));
                    const delayMs = minimumDelay + jitter;
                    const cooldownMs = rateLimited || headerDelay !== null ? delayMs : 0;
                    if (minimumDelay > MAX_AUTO_WAIT_MS) return {
                        ...result,
                        cooldownMs: cooldownMs,
                        category: rateLimited ? "rate-limit" : "temporary",
                        reason: `服务器要求等待约 ${Math.ceil(minimumDelay / 1e3)} 秒，超出自动等待上限，请稍后手动重试`
                    };
                    return {
                        retry: attempt < MAX_RETRIES,
                        delayMs: delayMs,
                        cooldownMs: cooldownMs,
                        category: rateLimited ? "rate-limit" : "temporary",
                        reason: ""
                    };
                }
                function sleep(milliseconds, signal) {
                    return new Promise((resolve, reject) => {
                        if (signal && signal.aborted) return reject(new Error("下载已取消"));
                        let timer;
                        const finish = error => {
                            clearTimeout(timer);
                            signal?.removeEventListener?.("abort", abort);
                            if (error) reject(error); else resolve();
                        };
                        const abort = () => finish(new Error("下载已取消"));
                        timer = setTimeout(() => finish(), Math.max(0, milliseconds));
                        signal?.addEventListener?.("abort", abort, {
                            once: true
                        });
                    });
                }
                return {
                    decide: decide,
                    sleep: sleep,
                    MAX_RETRIES: MAX_RETRIES,
                    MAX_AUTO_WAIT_MS: MAX_AUTO_WAIT_MS
                };
            })();
            __webpack_require__.d(__webpack_exports__, {
                D: () => funstrToData,
                IJ: () => selectDownloadDirectory,
                Oh: () => ensureDownloadDirectory,
                Sc: () => trimSpecial,
                U3: () => parseToDOM,
                WY: () => request,
                gJ: () => getImage,
                gw: () => delay,
                oL: () => getType,
                oZ: () => loadDirectoryHandle,
                pN: () => pathName,
                pP: () => sanitizeDownloadPath,
                sR: () => shouldRetryImageRequest,
                retryPolicy: () => imageRetryPolicy,
                xo: () => addZeroForNum,
                zM: () => writeStoreZipToDirectoryV2,
                zd: () => downFile
            });
            async function writeStoreZipToDirectoryV2(path, entries, digits, onProgress, signal) {
                const root = await getDirectoryHandle();
                if (!root) return !1;
                const parts = sanitizeDownloadPath(path).split("\\").filter(Boolean), fileName = parts.pop();
                if (!fileName) throw new Error("ZIP 文件名不能为空");
                let directory = root;
                for (const part of parts) directory = await directory.getDirectoryHandle(part, {
                    create: !0
                });
                const fileHandle = await directory.getFileHandle(fileName, {
                    create: !0
                }), writable = await fileHandle.createWritable(), encoder = new TextEncoder;
                const throwIfAborted = () => {
                    if (signal && signal.aborted) throw new Error("下载已取消");
                }, abortWritable = () => {
                    try {
                        const result = writable.abort && writable.abort();
                        result && "function" == typeof result.catch && result.catch(() => {});
                    } catch (error) {}
                };
                signal && "function" == typeof signal.addEventListener && signal.addEventListener("abort", abortWritable, {
                    once: !0
                });
                const crcTable = new Uint32Array(256);
                for (let index = 0; index < 256; index++) {
                    let value = index;
                    for (let bit = 0; bit < 8; bit++) value = 1 & value ? 3988292384 ^ value >>> 1 : value >>> 1;
                    crcTable[index] = value >>> 0;
                }
                const crc32 = async bytes => {
                    let value = 4294967295;
                    for (let start = 0; start < bytes.length; start += 4194304) {
                        const end = Math.min(start + 4194304, bytes.length);
                        for (let index = start; index < end; index++) value = crcTable[255 & (value ^ bytes[index])] ^ value >>> 8;
                        if (end < bytes.length) {
                            if ("undefined" != typeof scheduler && "function" == typeof scheduler.yield) await scheduler.yield(); else await delay(0);
                            throwIfAborted();
                        }
                    }
                    return (4294967295 ^ value) >>> 0;
                };
                const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), write = bytes => writable.write(bytes);
                let offset = 0;
                const centralRecords = [];
                try {
                    throwIfAborted();
                    if (entries.length >= 65535) throw new Error("ZIP 文件数量超过格式限制");
                    for (let index = 0; index < entries.length; index++) {
                        throwIfAborted();
                        const entry = entries[index], imageIndex = entry.imgIndex || index + 1, isText = 1 === entry.blob || 0 === entry.blob, source = isText ? new Blob([ entry.imgurl ], {
                            type: "text/plain"
                        }) : entry.blob;
                        if (!source || "function" != typeof source.arrayBuffer) throw new Error("ZIP 图片数据无法读取");
                        const bytes = new Uint8Array(await source.arrayBuffer());
                        entry.blob = null;
                        throwIfAborted();
                        const nameBytes = encoder.encode(addZeroForNum(imageIndex, digits) + (isText ? ".txt" : "." + entry.suffix)), checksum = await crc32(bytes), size = bytes.length;
                        if (size >= 4294967295 || offset + 30 + nameBytes.length + size >= 4294967295) throw new Error("ZIP 文件超过 4GB 格式限制");
                        const localHeader = new Uint8Array(30), localView = view(localHeader);
                        localView.setUint32(0, 67324752, !0);
                        localView.setUint16(4, 20, !0);
                        localView.setUint16(6, 2048, !0);
                        localView.setUint16(8, 0, !0);
                        localView.setUint32(14, checksum, !0);
                        localView.setUint32(18, size, !0);
                        localView.setUint32(22, size, !0);
                        localView.setUint16(26, nameBytes.length, !0);
                        await write(localHeader);
                        throwIfAborted();
                        await write(nameBytes);
                        throwIfAborted();
                        await write(bytes);
                        throwIfAborted();
                        const centralHeader = new Uint8Array(46 + nameBytes.length), centralView = view(centralHeader);
                        centralView.setUint32(0, 33639248, !0);
                        centralView.setUint16(4, 20, !0);
                        centralView.setUint16(6, 20, !0);
                        centralView.setUint16(8, 2048, !0);
                        centralView.setUint16(10, 0, !0);
                        centralView.setUint32(16, checksum, !0);
                        centralView.setUint32(20, size, !0);
                        centralView.setUint32(24, size, !0);
                        centralView.setUint16(28, nameBytes.length, !0);
                        centralView.setUint32(42, offset, !0);
                        centralHeader.set(nameBytes, 46);
                        centralRecords.push(centralHeader);
                        offset += 30 + nameBytes.length + size;
                        if ("function" == typeof onProgress) onProgress(index + 1, entries.length);
                        await delay(0);
                    }
                    throwIfAborted();
                    const centralOffset = offset;
                    for (const record of centralRecords) {
                        await write(record);
                        throwIfAborted();
                        offset += record.length;
                    }
                    const centralSize = offset - centralOffset;
                    if (centralSize >= 4294967295) throw new Error("ZIP 中央目录超过格式限制");
                    const endRecord = new Uint8Array(22), endView = view(endRecord);
                    endView.setUint32(0, 101010256, !0);
                    endView.setUint16(8, centralRecords.length, !0);
                    endView.setUint16(10, centralRecords.length, !0);
                    endView.setUint32(12, centralSize, !0);
                    endView.setUint32(16, centralOffset, !0);
                    await write(endRecord);
                    throwIfAborted();
                    await writable.close();
                    throwIfAborted();
                    signal && "function" == typeof signal.removeEventListener && signal.removeEventListener("abort", abortWritable);
                    return !0;
                } catch (error) {
                    signal && "function" == typeof signal.removeEventListener && signal.removeEventListener("abort", abortWritable);
                    try {
                        writable.abort && await writable.abort();
                    } catch (abortError) {}
                    if (signal && signal.aborted) throw new Error("下载已取消");
                    throw error;
                }
            }
            var siteRules = __webpack_require__(872), configModule = __webpack_require__(390);
            const loadStyle = (e, t, n) => {
                const r = document.getElementsByTagName("head")[0], a = document.createElement("style");
                a.name = t, a.id = t, a.innerText = n, r.appendChild(a);
            }, loadStyle2 = e => new Promise((t, n) => {
                const r = document.getElementsByTagName("head")[0], a = document.createElement("link");
                a.rel = "stylesheet", a.type = "text/css", a.href = e, a.media = "all", r.appendChild(a), 
                setTimeout(() => {
                    t(!0);
                }, 1200);
            });
            function trimSpecial(e) {
                if ("" !== e) {
                    const t = /[`~!@#$^\&*|{}'<>?:;~']/g;
                    e = (e = e.replace(t, "")).replace(/\n|\r/g, "").trim();
                }
                return e;
            }
            function sanitizePathName(e) {
                // Native browser handles also reject format/non-characters and some '~'
                // names that Windows Explorer accepts. Keep ordinary punctuation intact.
                let t = String(null == e ? "" : e).replace(/[\p{Cf}\p{Cs}\ufdd0-\ufdef]/gu, "").replace(/[\p{Cc}<>:"/\\|?*]/gu, " ");
                t = Array.from(t).filter(c => (c.codePointAt(0) & 65535) < 65534).join("").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim().replace(/^[. ]+/, ".") || "未命名";
                const component = t.startsWith(".") ? t.slice(1) : t, dot = component.indexOf(".");
                const shortName = component.length <= 12 && !/[\s"\\/:+|<>=;?,*]/u.test(component) && (dot < 0 ? component.length <= 8 : dot > 0 && dot <= 8 && dot === component.lastIndexOf(".") && component.length - dot <= 4);
                if (component.includes("~") && (/^~|~$/u.test(component) || shortName)) t = t.replace(/~/g, "～");
                return /^(con|prn|aux|nul|clock\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i.test(t) || /^(conin\$|conout\$|desktop\.ini|thumbs\.db)$/i.test(t) ? "_" + t : t;
            }
            function pathName(e) {
                return !1 === (0, configModule.cF)("sanitizePathNames") ? String(null == e ? "" : e) : sanitizePathName(e);
            }
            function sanitizeDownloadPath(e) {
                const t = String(null == e ? "" : e);
                return !1 === (0, configModule.cF)("sanitizePathNames") ? t.replace(/\s+/gi, " ") : t.split("\\").map(sanitizePathName).join("\\");
            }
            const getType = e => {
                const t = typeof e;
                return "object" !== t ? t : Object.prototype.toString.call(e).replace(/^\[object (\S+)\]$/, "$1");
            }, getFrameContent = async (e, t, signal) => new Promise((n, r) => {
                const a = document.createElement("iframe");
                a.id = e, a.className = "ten-comic-frame", a.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;";
                const finish = (error, html) => {
                    clearTimeout(i), signal?.removeEventListener?.("abort", abort);
                    a.onload = null, a.onerror = null;
                    if (error) a.remove(), r(error); else n(html);
                }, abort = () => finish(new Error("下载已取消"));
                const i = setTimeout(() => {
                    finish(new Error("iframe 加载超时"));
                }, 45e3);
                if (signal && signal.aborted) return abort();
                signal?.addEventListener?.("abort", abort, {
                    once: true
                });
                a.onload = function() {
                    try {
                        finish(null, a.contentDocument.body.outerHTML);
                    } catch (e) {
                        finish(new Error("阅读页无法读取，可能已跳转到登录或授权页面，请先确认该章节可正常阅读"));
                    }
                }, a.onerror = function() {
                    finish(new Error("iframe 加载失败"));
                }, a.src = t, document.body.appendChild(a);
            }), getImage = async e => {
                let ownedFrame = null, abort, retainFrame = false;
                const adapter = e.adapter || siteRules.Po;
                if (!adapter) throw new Error("当前页面没有可用规则");
                const signal = e.signal;
                if (signal && signal.aborted) throw new Error("下载已取消");
                const cancelled = new Promise((resolve, reject) => {
                    abort = () => {
                        ownedFrame && ownedFrame.remove();
                        try {
                            e.otherData && typeof e.otherData.cleanup === "function" && e.otherData.cleanup();
                        } catch (ignored) {}
                        reject(new Error("下载已取消"));
                    };
                    signal?.addEventListener?.("abort", abort, {
                        once: true
                    });
                });
                try {
                    const parse = async () => {
                        const t = e.url;
                        let n = "";
                        if (e.document) n = e.document.documentElement.outerHTML; else if (shouldLoadFrame(adapter, e)) {
                            const r = [ "a", "b", "c", "d", "e", "f", "g", "h", "i", "g", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z" ], a = Math.round(25 * Math.random()) + 0, i = Math.round(25 * Math.random()) + 0, o = "ifr" + (new Date).getTime() + r[a] + r[i];
                            e.frameId = o;
                            const loading = getFrameContent(o, t, signal);
                            ownedFrame = document.getElementById(o);
                            n = await loading;
                        } else if (adapter.useFrame || "manhuagui" === adapter.readerTabMode) n = ""; else {
                            const r = await request({
                                method: "get",
                                url: t,
                                useCookie: e.isPay,
                                headers: adapter.headers || {},
                                signal: e.signal
                            });
                            if (!r || "object" != typeof r) throw new Error("章节页面请求失败");
                            n = r.response;
                        }
                        if (signal && signal.aborted) throw new Error("下载已取消");
                        const parsed = await adapter.getImgs(n, e);
                        if (signal && signal.aborted) {
                            try {
                                parsed?.otherData?.cleanup?.();
                            } catch (ignored) {}
                            if (!e.preview) for (const url of Array.isArray(parsed) ? parsed : parsed?.imgUrlArr || []) if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
                            throw new Error("下载已取消");
                        }
                        return parsed;
                    };
                    const parsed = await Promise.race([ parse(), cancelled ]);
                    retainFrame = Boolean(adapter.reuseParsedImages && parsed?.otherData && typeof parsed.otherData.cleanup === "function");
                    if (e.preview && ownedFrame && typeof e.retainPreviewFrame === "function") {
                        let released = false;
                        e.retainPreviewFrame(() => {
                            if (!released) {
                                released = true;
                                ownedFrame.remove();
                            }
                        });
                        retainFrame = true;
                    }
                    return parsed;
                } catch (e) {
                    !retainFrame && ownedFrame && ownedFrame.remove();
                    throw console.log("getImageError: ", e), e;
                } finally {
                    signal?.removeEventListener?.("abort", abort);
                    !retainFrame && ownedFrame && ownedFrame.remove();
                }
            }, shouldLoadFrame = function(e, t) {
                return Boolean(e && e.useFrame) && !(e.reuseParsedImages && t && t.otherData);
            }, requestLocalObjectUrl = async function(e, t) {
                try {
                    if (t && t.aborted) return "abort";
                    const n = await fetch(e, {
                        signal: t
                    }), r = await n.blob();
                    return {
                        status: n.status,
                        statusText: n.statusText,
                        response: r,
                        responseText: "",
                        responseHeaders: `content-type: ${r.type || "application/octet-stream"}\r\n`,
                        finalUrl: e
                    };
                } catch (e) {
                    return t && t.aborted ? "abort" : "onerror";
                } finally {
                    try {
                        URL.revokeObjectURL(e);
                    } catch (e) {}
                }
            }, shouldRetryImageRequest = function(imageUrl, failure, attempt, response) {
                if (response === undefined && typeof failure === "string") {
                    const status = failure.match(/HTTP\s+(\d{3})/);
                    if (status) response = {
                        status: Number(status[1])
                    }; else if (/取消/.test(failure)) response = "abort";
                }
                return imageRetryPolicy.decide({
                    url: imageUrl,
                    response: response,
                    failure: failure,
                    attempt: attempt
                }).retry;
            }, request = async function(...e) {
                let t, n, r, a, i, o, s, c, d, l, u, p, h;
                1 === e.length ? (({method: t, url: n, data: r, headers: a, responseType: i, timeout: o, useCookie: s, onload: d, onerror: l, ontimeout: u, signal: p} = e[0]), 
                s && (c = document.cookie)) : ([t, n, ...h] = e, h && (h.length > 0 && (r = h[0]), 
                h.length > 1 && (a = h[1])));
                a || null === siteRules.Po || (a = siteRules.Po.headers);
                if (n && String(n).startsWith("blob:")) return requestLocalObjectUrl(n, p);
                return new Promise(n ? e => {
                    let s, h = !1;
                    const m = t => {
                        h || (h = !0, p && p.removeEventListener("abort", g), e(t));
                    }, g = () => {
                        try {
                            s && "function" == typeof s.abort && s.abort();
                        } catch (e) {}
                        m("abort");
                    };
                    if (p && p.aborted) return m("abort");
                    try {
                        s = GM_xmlhttpRequest({
                            method: t,
                            url: n,
                            headers: a || {},
                            data: r || null,
                            responseType: i,
                            timeout: o || 3e4,
                            cookie: c || "",
                            onload: function(e) {
                                "function" == typeof d && d(e), m(e);
                            },
                            onerror: function(e) {
                                "function" == typeof l ? l(e) : console.log("request-e: ", e), m("onerror");
                            },
                            ontimeout: function() {
                                "function" == typeof u && u(), m("timeout");
                            }
                        }), p && !h && p.addEventListener("abort", g, {
                            once: !0
                        });
                    } catch (e) {
                        "function" == typeof l ? l(e) : console.log("request-e: ", e), m("onerror");
                    }
                } : (e, t) => {
                    e("");
                });
            };
            let rootDir = "10Comic";
            try {
                rootDir = (0, configModule.cF)("rootDir") || rootDir;
            } catch (e) {}
            const DIR_DB_NAME = "ten-comic-directory-db", DIR_DB_VERSION = 1, DIR_STORE_NAME = "handles", DIR_HANDLE_KEY = "download-directory", LEGACY_DIR_DB_NAME = "yl-comic-dir-db", LEGACY_DIR_HANDLE_KEY = "downloadDir";
            function openDirectoryDatabase(e = DIR_DB_NAME) {
                return new Promise((t, n) => {
                    const r = indexedDB.open(e, DIR_DB_VERSION);
                    r.onupgradeneeded = () => {
                        const e = r.result;
                        e.objectStoreNames.contains(DIR_STORE_NAME) || e.createObjectStore(DIR_STORE_NAME);
                    }, r.onsuccess = () => t(r.result), r.onerror = () => n(r.error);
                });
            }
            async function saveDirectoryHandle(e) {
                if (e && "undefined" != typeof indexedDB) try {
                    const t = await openDirectoryDatabase(), n = t.transaction(DIR_STORE_NAME, "readwrite");
                    n.objectStore(DIR_STORE_NAME).put(e, DIR_HANDLE_KEY), await new Promise((e, t) => {
                        n.oncomplete = e, n.onerror = () => t(n.error);
                    }), t.close();
                } catch (e) {
                    console.warn("10漫画：保存下载目录授权失败。", e);
                }
            }
            async function loadDirectoryHandle() {
                if ("undefined" == typeof indexedDB) return null;
                const e = [ [ DIR_DB_NAME, DIR_HANDLE_KEY ], [ LEGACY_DIR_DB_NAME, LEGACY_DIR_HANDLE_KEY ] ];
                for (const [t, n] of e) {
                    const e = await readDirectoryHandle(t, n);
                    if (e) return e;
                }
                return null;
            }
            async function readDirectoryHandle(e, t) {
                try {
                    const n = await openDirectoryDatabase(e), r = n.transaction(DIR_STORE_NAME, "readonly").objectStore(DIR_STORE_NAME).get(t), a = await new Promise((e, t) => {
                        r.onsuccess = () => e(r.result || null), r.onerror = () => t(r.error);
                    });
                    return n.close(), a;
                } catch (e) {
                    return null;
                }
            }
            async function selectDownloadDirectory() {
                if ("function" != typeof window.showDirectoryPicker) return null;
                const e = await window.showDirectoryPicker({
                    mode: "readwrite"
                });
                return window.__tenComicDirectoryHandle = e, window.__ylDirectoryHandle = e, await saveDirectoryHandle(e), 
                e;
            }
            async function getDirectoryHandle(e = !1) {
                if ("function" != typeof window.showDirectoryPicker) return null;
                let t = window.__tenComicDirectoryHandle || window.__ylDirectoryHandle;
                if (t || (t = await loadDirectoryHandle()), t) try {
                    let n = await t.queryPermission({
                        mode: "readwrite"
                    });
                    if (e && "granted" !== n && (n = await t.requestPermission({
                        mode: "readwrite"
                    })), "granted" === n) return window.__tenComicDirectoryHandle = t, window.__ylDirectoryHandle = t, 
                    t;
                } catch (e) {}
                if (!e) return null;
                try {
                    return await selectDownloadDirectory();
                } catch (e) {
                    return null;
                }
            }
            const ensureDownloadDirectory = () => getDirectoryHandle(!0);
            async function writeToDirectory(e, t, n) {
                const r = t.split("\\").filter(Boolean), a = r.pop();
                let i = e;
                for (const e of r) i = await i.getDirectoryHandle(e, {
                    create: !0
                });
                let o = n;
                if (!(n instanceof Blob)) {
                    const e = await fetch(n);
                    if (!e.ok) throw new Error(`下载文件失败：${e.status}`);
                    o = await e.blob();
                }
                const s = await i.getFileHandle(a, {
                    create: !0
                }), c = await s.createWritable();
                await c.write(o), await c.close();
            }
            const downFile = async (...e) => {
                let t, n, r, a, i, o, p;
                1 === e.length ? ({url: t, name: n, headers: r, onload: a, onerror: i, ontimeout: o, signal: p} = e[0]) : (t = e[0], 
                n = e[1]), n = sanitizeDownloadPath(n);
                if (p && p.aborted) return !1;
                const s = await getDirectoryHandle();
                if (p && p.aborted) return !1;
                if (s) try {
                    return await writeToDirectory(s, n, t), "function" == typeof a && a({}), !0;
                } catch (e) {
                    console.warn("10漫画：写入所选目录失败，回退到浏览器下载。", e);
                }
                const c = t instanceof Blob, d = c ? window.URL.createObjectURL(t) : t, l = () => {
                    c && window.URL.revokeObjectURL(d);
                };
                return new Promise(e => {
                    let h = null, s = !1;
                    const c = t => s ? !1 : (s = !0, p && p.removeEventListener("abort", u), l(), e(t), 
                    !0), u = () => {
                        try {
                            h && "function" == typeof h.abort && h.abort();
                        } catch (e) {}
                        c(!1);
                    };
                    if (p && p.aborted) return u();
                    try {
                        h = GM_download({
                            url: d,
                            name: pathName(rootDir) + "\\" + n,
                            headers: r,
                            onload: function(e) {
                                c(!0) && "function" == typeof a && a(e);
                            },
                            onerror: function(e) {
                                c(!1) && ("function" == typeof i && i(e), console.log("downFile-e: ", e));
                            },
                            ontimeout: function() {
                                c(!1) && "function" == typeof o && o();
                            }
                        }), p && !s && p.addEventListener("abort", u, {
                            once: !0
                        });
                    } catch (e) {
                        c(!1) && ("function" == typeof i && i(e), console.log("downFile-e: ", e));
                    }
                });
            }, addZeroForNum = (e, t) => {
                let n = e + "";
                return n.length < t ? (n = new Array(t + 1).join("0") + n, n = n.slice(-t), n) : n;
            }, getdomain = e => {
                e || (e = window.location.href);
                let t = "";
                var n = e.split("/");
                return t = n[2] ? n[2] : "", t;
            }, parseToDOM = e => {
                var t = document.createElement("div");
                return "string" == typeof e && (t.innerHTML = e), t;
            };
            function delay(e) {
                return new Promise(function(t) {
                    setTimeout(t, 1e3 * e);
                });
            }
            async function doThingsEachSecond(e, t) {
                let n, r = 0;
                do {
                    n = t(), n ? r = e : await delay(1), r++;
                } while (r < e);
            }
            async function startScroll(e, t) {
                return new Promise((n, r) => {
                    const a = setInterval(function() {
                        e.scrollBy(0, 50), t.forEach((e, t) => {
                            e() && (clearInterval(a), n([ a, `condition_${t + 1}` ]));
                        });
                    }, 200);
                });
            }
            const funstrToData = function funstrToData(str, reg) {
                const group = str.matchAll(reg), func = [];
                for (const e of group) func.push(e[1]), func.push(e[2]);
                func[1] || (func[1] = "()");
                const code = "(" + func[0] + ")" + func[1], data = eval(code);
                return data;
            }, getCookie = e => {
                const t = document.cookie.split(";");
                for (let n = 0; n < t.length; n++) {
                    const r = t[n].split("=");
                    if (e === r[0].trim()) return r[1];
                }
                return "";
            };
        }
    }, __webpack_module_cache__ = {};
    function __webpack_require__(e) {
        var t = __webpack_module_cache__[e];
        if (void 0 !== t) return t.exports;
        var n = __webpack_module_cache__[e] = {
            exports: {}
        };
        return __webpack_modules__[e](n, n.exports, __webpack_require__), n.exports;
    }
    __webpack_require__.d = (e, t) => {
        for (var n in t) __webpack_require__.o(t, n) && !__webpack_require__.o(e, n) && Object.defineProperty(e, n, {
            enumerable: !0,
            get: t[n]
        });
    }, __webpack_require__.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t);
    (() => {
        "use strict";
        var downloadUtils = __webpack_require__(624), configModule = __webpack_require__(390);
        class TaskCancelledError extends Error {
            constructor() {
                super("下载任务已取消"), this.name = "TaskCancelledError";
            }
        }
        const yieldToBrowser = e => Number(e) > 0 ? new Promise(t => setTimeout(t, e)) : "object" == typeof scheduler && scheduler && "function" == typeof scheduler.yield ? scheduler.yield() : "function" == typeof MessageChannel ? new Promise(e => {
            const t = new MessageChannel;
            t.port1.onmessage = () => {
                t.port1.close(), t.port2.close(), e();
            }, t.port2.postMessage(0);
        }) : Promise.resolve();
        class DownloadQueue {
            /**
   * Services can be injected for independent queue tests or other UI hosts.
   * callbacks: onChange/onPersist/onHistory/onComplete/onStorageError.
   * Legacy callback names remain accepted for existing integrations.
   */
            constructor(workerLen, maxPictureNum, imgIndexBitNum, callbacks, services = {}) {
                this.workerLen = workerLen || 3;
                this.pictureNum = maxPictureNum || 2;
                this.list = [];
                this.worker = new Array(this.workerLen);
                this.workerDownInfo = new Array(this.workerLen);
                this.imgIndexBitNum = imgIndexBitNum;
                this.historySequence = 0;
                const events = callbacks || {};
                const bindEvent = (name, legacyName) => {
                    const callback = events[name] || events[legacyName];
                    return typeof callback === "function" ? callback.bind(events) : undefined;
                };
                this.events = {
                    onChange: bindEvent("onChange", "$forceUpdate"),
                    onPersist: bindEvent("onPersist", "persistTasks"),
                    onHistory: bindEvent("onHistory", "getHistoryData"),
                    onComplete: bindEvent("onComplete", "notifyTask"),
                    onStorageError: bindEvent("onStorageError", "storageError")
                };
                this.downloads = services.downloads || downloadUtils;
                this.config = services.config || (typeof configModule !== "undefined" ? configModule : null);
                this.yieldToBrowser = services.yieldToBrowser || (typeof yieldToBrowser === "function" ? yieldToBrowser : async () => {});
                this.CancelledError = services.CancelledError || (typeof TaskCancelledError === "function" ? TaskCancelledError : class extends Error {
                    constructor() {
                        super("下载任务已取消");
                        this.name = "TaskCancelledError";
                    }
                });
                this.retryPolicy = services.retryPolicy || this.downloads.retryPolicy;
                this.now = services.now || (() => typeof performance !== "undefined" ? performance.now() : Date.now());
                this.wallNow = services.wallNow || Date.now;
                this.sleep = services.sleep || this.retryPolicy?.sleep;
                this.imageCooldowns = new Map;
                this.location = services.location || (typeof window !== "undefined" ? window.location : {
                    href: "",
                    hostname: ""
                });
                this.historyStorage = services.historyStorage || (typeof localStorage !== "undefined" ? localStorage : null);
                this.schedule = services.schedule || ((callback, milliseconds) => setTimeout(callback, milliseconds));
                this.isPageHidden = services.isPageHidden || (() => typeof document !== "undefined" && document.hidden);
                this.isSettingsVisible = services.isSettingsVisible || (() => typeof document !== "undefined" && Boolean(document.querySelector('#ten-panel.is-open .ten-view.is-active[data-view="settings"]')));
            }
            updateLimits(maxChapters, maxImages, digits) {
                this.workerLen = Math.max(1, Math.min(3, Number(maxChapters) || this.workerLen)), 
                this.pictureNum = Math.max(1, Math.min(5, Number(maxImages) || this.pictureNum));
                for (;this.worker.length < this.workerLen; ) this.worker.push(void 0), this.workerDownInfo.push(void 0);
                this.run(), this.refresh();
            }
            static taskKey(item) {
                let url = String(item.url || "");
                try {
                    const value = new URL(url, typeof window !== "undefined" ? window.location.href : undefined);
                    value.hash = "";
                    url = value.href;
                } catch (ignored) {}
                const retry = Array.isArray(item.retryImages) ? item.retryImages.map(image => [ image.imgIndex, image.url ]).sort((a, b) => String(a).localeCompare(String(b))) : [];
                return JSON.stringify([ url, item.comicName || "", Number(item.downType) || 0, item.imageRange || [ 1, -1 ], retry ]);
            }
            static historyKey(record) {
                const identity = record.task?.url ? DownloadQueue.taskKey(record.task) : JSON.stringify([ record.comicName || "", record.downChapterName || "" ]);
                const completed = !record.hasError && (record.status === "completed" || !record.status);
                return JSON.stringify([ identity, completed ? "completed" : "attempt" ]);
            }
            addList(list, allowDuplicates = false) {
                const keys = new Set([ ...this.list, ...this.worker.filter(Boolean).map(worker => worker.task) ].map(DownloadQueue.taskKey));
                let added = 0;
                for (const t of list) {
                    const key = DownloadQueue.taskKey(t);
                    if (!allowDuplicates && keys.has(key)) continue;
                    keys.add(key), this.list.unshift(t), added++;
                }
                added && (this.waitingRevision = (this.waitingRevision || 0) + 1);
                this.refresh();
                return added;
            }
            refresh() {
                for (const callback of [ !this.isPageHidden() && this.events.onChange, this.events.onPersist ]) {
                    if (typeof callback === "function") try {
                        callback();
                    } catch (error) {
                        this.reportStorageError(error);
                    }
                }
            }
            reportStorageError(error) {
                try {
                    this.events.onStorageError?.(error);
                } catch (ignored) {}
            }
            moveWaiting(index, direction) {
                const n = "up" === direction ? index + 1 : index - 1;
                return !(!this.list[index] || !this.list[n] || ([this.list[index], this.list[n]] = [ this.list[n], this.list[index] ], 
                this.waitingRevision = (this.waitingRevision || 0) + 1, this.refresh(), 0));
            }
            setAllPaused(paused) {
                let t = 0;
                return this.worker.forEach(n => {
                    n && !n.cancelled && n.paused !== paused && (paused ? n.pausedAt = Date.now() : (n.pausedAt && (n.elapsedBeforeMs = Math.max(0, Number(n.elapsedBeforeMs) || 0) + Math.max(0, n.pausedAt - n.activeStartedAt), 
                    n.activeStartedAt = Date.now(), n.pausedAt = null), this.resetSpeed(n), n.pauseWaiters.splice(0).forEach(e => e())), 
                    n.paused = paused, n.status = paused ? "paused" : "running", n.stage = paused ? "已暂停，将在当前请求结束后停止" : "继续下载", 
                    t += 1);
                }), t && this.refresh(), t;
            }
            cancelAll() {
                let e = 0;
                return this.worker.forEach(t => {
                    t && !t.cancelled && (t.cancelled = !0, t.paused = !1, t.status = "cancelling", 
                    t.stage = "正在取消", t.abortController.abort(), t.pauseWaiters.splice(0).forEach(e => e()), 
                    e += 1);
                }), e && this.refresh(), e;
            }
            clearWaiting() {
                const e = this.list.length;
                return e ? (this.list.length = 0, this.waitingRevision = (this.waitingRevision || 0) + 1, 
                this.refresh(), e) : 0;
            }
            pendingTasks() {
                const e = this.worker.filter(Boolean).map(e => this.snapshotWorker(e)), t = this.list.slice().reverse().map(e => this.snapshotTask(e));
                return e.concat(t);
            }
            snapshotTask(item) {
                let t = item.originHost || "";
                try {
                    t = t || new URL(item.url, this.location.href).hostname;
                } catch (e) {
                    t = this.location.hostname;
                }
                return {
                    comicName: item.comicName,
                    taskId: item.taskId,
                    chapterName: item.chapterName,
                    downChapterName: item.downChapterName,
                    url: item.url,
                    isPay: item.isPay,
                    characterType: item.characterType,
                    readtype: item.readtype,
                    downType: item.downType,
                    downHeaders: item.downHeaders,
                    batchDelay: item.batchDelay,
                    directFlow: item.directFlow,
                    directRemoteDownload: item.directRemoteDownload,
                    useDirectory: item.useDirectory,
                    heavyCanvasExport: Boolean(item.heavyCanvasExport),
                    retryImages: item.retryImages,
                    imageRange: item.imageRange,
                    originHost: t
                };
            }
            snapshotWorker(worker) {
                const t = this.snapshotTask(worker.task), n = this.taskTiming(worker);
                return t.resumeElapsedMs = n.activeMs, t.resumeWallStartedAt = worker.wallStartedAt, 
                t.resumePaused = Boolean(worker.paused), t.resumeProcessed = worker.processedNum, 
                t.resumeSucceeded = worker.successNum, t.resumeFailed = worker.failedNum, t.resumeWritten = worker.writtenNum, 
                worker.retryOnly ? t.retryImages = [ ...worker.inFlight, ...worker.retryPending ].map(e => ({
                    url: e.url,
                    imgIndex: e.imgIndex
                })) : 0 === Number(worker.downType) && 1 === Number(worker.readtype) && worker.totalNumber > 0 && (t.resumeImages = [ ...worker.inFlight, ...worker.imgs ].map(e => ({
                    url: e.url,
                    imgIndex: e.imgIndex
                })), t.resumeTotal = worker.totalNumber, t.resumeCompleted = worker.processedNum, 
                t.resumeFailures = worker.failures.map(e => ({
                    ...e
                })), t.resumeDiagnostics = worker.diagnostics.map(e => ({
                    ...e
                }))), t;
            }
            run() {
                for (let e = 0; e < this.workerLen; e++) {
                    if (this.worker[e] || !this.list.length) continue;
                    const t = this.list.pop();
                    this.waitingRevision = (this.waitingRevision || 0) + 1;
                    this.worker[e] = this.createWorker(t), this.workerDownInfo[e] = [], this.exeDown(e);
                }
                this.refresh();
            }
            createWorker(item) {
                const t = Array.isArray(item.retryImages) ? item.retryImages.filter(e => e && e.url) : [], n = Array.isArray(item.resumeImages) ? item.resumeImages.filter(e => e && e.url) : [], r = {
                    comicName: item.comicName,
                    taskId: item.taskId,
                    chapterName: item.chapterName,
                    downChapterName: item.downChapterName,
                    url: item.url,
                    isPay: item.isPay,
                    readtype: item.readtype,
                    downType: item.downType,
                    downHeaders: item.downHeaders,
                    batchDelay: item.batchDelay,
                    directFlow: item.directFlow,
                    directRemoteDownload: item.directRemoteDownload,
                    useDirectory: item.useDirectory,
                    heavyCanvasExport: Boolean(item.heavyCanvasExport),
                    retryImages: t,
                    imageRange: item.imageRange
                };
                const processed = n.length ? Math.max(0, Number(item.resumeProcessed ?? item.resumeCompleted) || 0) : 0;
                const failed = n.length ? Math.min(processed, Math.max(0, Number(item.resumeFailed ?? (item.resumeFailures || []).length) || 0)) : 0;
                const succeeded = n.length ? Math.min(processed, Math.max(0, Number(item.resumeSucceeded ?? processed - failed) || 0)) : 0;
                return {
                    ...r,
                    adapter: item.adapter,
                    imgIndex: 0,
                    processedNum: processed,
                    successNum: succeeded,
                    failedNum: failed,
                    writtenNum: n.length ? Math.max(0, Number(item.resumeWritten ?? succeeded) || 0) : 0,
                    outputFiles: 0,
                    totalNumber: n.length ? Math.max(n.length, Number(item.resumeTotal) || 0) : t.length,
                    imgs: n.map(e => ({
                        url: e.url,
                        imgIndex: Number(e.imgIndex) || 0
                    })),
                    inFlight: [],
                    progress: n.length && Number(item.resumeTotal) > 0 ? Math.min(100, Math.round(processed / Number(item.resumeTotal) * 100)) : 0,
                    downloadedBytes: 0,
                    byteImageCount: 0,
                    directRemoteCount: 0,
                    compatDownloadCount: 0,
                    speedBps: 0,
                    etaSeconds: null,
                    speedSamples: [ {
                        time: Date.now(),
                        bytes: 0
                    } ],
                    wallStartedAt: Number(item.resumeWallStartedAt) || Date.now(),
                    activeStartedAt: Date.now(),
                    elapsedBeforeMs: Math.max(0, Number(item.resumeElapsedMs) || 0),
                    pausedAt: item.resumePaused ? Date.now() : null,
                    hasError: Array.isArray(item.resumeFailures) && item.resumeFailures.length > 0,
                    otherData: void 0,
                    status: item.resumePaused ? "paused" : "running",
                    stage: item.resumePaused ? "已暂停，等待继续" : n.length ? "准备恢复未完成下载" : t.length ? "准备重试失败图片" : "准备解析章节",
                    paused: Boolean(item.resumePaused),
                    cancelled: !1,
                    pauseWaiters: [],
                    abortController: new AbortController,
                    failures: Array.isArray(item.resumeFailures) ? item.resumeFailures.map(e => ({
                        ...e
                    })) : [],
                    diagnostics: Array.isArray(item.resumeDiagnostics) ? item.resumeDiagnostics.map(e => ({
                        ...e
                    })) : [],
                    retryImages: t,
                    retryPending: t.slice(),
                    retryOnly: t.length > 0,
                    resumeOnly: n.length > 0,
                    task: r
                };
            }
            taskTiming(worker, now = Date.now()) {
                const n = Math.max(0, Number(worker.elapsedBeforeMs) || 0), r = Number(worker.activeStartedAt) || now, a = null != worker.pausedAt ? Number(worker.pausedAt) : now, i = n + Math.max(0, a - r), o = Math.max(i, now - (Number(worker.wallStartedAt) || now));
                return {
                    activeMs: Math.round(i),
                    totalMs: Math.round(o),
                    pausedMs: Math.round(Math.max(0, o - i))
                };
            }
            pause(index) {
                const t = this.worker[index];
                return !(!t || t.cancelled || t.paused || (t.paused = !0, t.pausedAt = Date.now(), 
                t.status = "paused", t.stage = "已暂停，将在当前请求结束后停止", this.refresh(), 0));
            }
            resume(index) {
                const t = this.worker[index];
                return !(!t || t.cancelled || !t.paused || (t.pausedAt && (t.elapsedBeforeMs = Math.max(0, Number(t.elapsedBeforeMs) || 0) + Math.max(0, t.pausedAt - t.activeStartedAt), 
                t.activeStartedAt = Date.now(), t.pausedAt = null), t.paused = !1, t.status = "running", 
                t.stage = "继续下载", this.resetSpeed(t), t.pauseWaiters.splice(0).forEach(e => e()), 
                this.refresh(), 0));
            }
            cancel(index) {
                const t = this.worker[index];
                return !(!t || t.cancelled || (t.cancelled = !0, t.paused = !1, t.status = "cancelling", 
                t.stage = "正在取消", t.abortController.abort(), t.pauseWaiters.splice(0).forEach(e => e()), 
                this.refresh(), 0));
            }
            cancelWaiting(index) {
                return !!this.list[index] && (this.list.splice(index, 1), this.waitingRevision = (this.waitingRevision || 0) + 1, 
                this.refresh(), !0);
            }
            async waitUntilRunnable(index) {
                let t = this.worker[index];
                if (!t || t.cancelled) throw new this.CancelledError("下载任务已取消");
                for (;t.paused; ) if (await new Promise(e => t.pauseWaiters.push(e)), t = this.worker[index], 
                !t || t.cancelled) throw new this.CancelledError("下载任务已取消");
            }
            assertActive(index) {
                const t = this.worker[index];
                if (!t || t.cancelled) throw new this.CancelledError("下载任务已取消");
                return t;
            }
            setStage(index, stage) {
                const n = this.worker[index];
                n && (n.stage = stage, this.refresh());
            }
            addDiagnostic(index, stage, error, extra = {}) {
                const a = this.worker[index];
                if (!a) return;
                const i = error instanceof Error ? error.message : String(error || "未知错误");
                a.diagnostics.push({
                    time: (new Date).toISOString(),
                    stage: stage,
                    message: i,
                    ...extra
                }), a.diagnostics.length > 80 && a.diagnostics.shift();
            }
            addFailure(index, imgurl, imgIndex, reason) {
                const a = this.worker[index];
                if (!a) return;
                if (a.hasError = !0, String(imgurl || "").startsWith("blob:")) return void this.addDiagnostic(index, "图片下载", reason, {
                    url: "临时画布图片",
                    imgIndex: imgIndex || 0
                });
                const i = [ imgIndex || 0, imgurl || "" ].join("\n"), o = a.failures.find(e => e.key === i);
                o ? o.reason = reason : a.failures.push({
                    key: i,
                    url: imgurl || "",
                    imgIndex: imgIndex || 0,
                    reason: reason
                }), this.addDiagnostic(index, "图片下载", reason, {
                    url: imgurl || "",
                    imgIndex: imgIndex || 0
                });
            }
            resetSpeed(worker) {
                worker.speedBps = 0, worker.etaSeconds = null, worker.speedSamples = [ {
                    time: Date.now(),
                    bytes: worker.downloadedBytes
                } ];
            }
            advance(index, imgurl, imgIndex, bytes = 0, succeeded = false, written = false) {
                const a = this.worker[index];
                if (!a) return;
                a.inFlight = a.inFlight.filter(e => e.imgIndex !== imgIndex || e.url !== imgurl);
                const i = Math.max(0, Number(bytes) || 0);
                i && (a.downloadedBytes += i, a.byteImageCount += 1);
                a.processedNum += 1, a.successNum += succeeded ? 1 : 0, a.failedNum += succeeded ? 0 : 1, 
                a.writtenNum += written ? 1 : 0;
                a.progress = a.totalNumber > 0 ? Math.min(100, Math.round(a.processedNum / a.totalNumber * 100)) : 0;
                const o = Date.now();
                for (a.speedSamples.push({
                    time: o,
                    bytes: a.downloadedBytes
                }); a.speedSamples.length > 2 && a.speedSamples[1].time < o - 8e3; ) a.speedSamples.shift();
                const s = a.speedSamples[0], c = (o - s.time) / 1e3, d = c >= .2 ? (a.downloadedBytes - s.bytes) / c : 0;
                d > 0 && (a.speedBps = a.speedBps > 0 ? .65 * a.speedBps + .35 * d : d);
                const l = Math.max(0, a.totalNumber - a.processedNum), u = a.byteImageCount ? a.downloadedBytes / a.byteImageCount : 0;
                a.etaSeconds = a.speedBps > 0 && u > 0 ? Math.ceil(l * u / a.speedBps) : null, this.refresh();
            }
            async exeDown(index) {
                const t = this.worker[index];
                try {
                    if (await this.waitUntilRunnable(index), t.resumeOnly) this.setStage(index, "正在恢复未完成下载"), 
                    this.resetSpeed(t), await this.down(index); else if (t.retryOnly) await this.downFailures(index); else if (1 === Number(t.readtype)) {
                        let a;
                        this.setStage(index, "正在解析章节图片");
                        try {
                            a = await (0, this.downloads.gJ)({
                                adapter: t.adapter,
                                url: t.url,
                                isPay: t.isPay,
                                signal: t.abortController.signal
                            });
                        } catch (t) {
                            throw this.addDiagnostic(index, "章节解析", t), new Error("未能解析章节图片，请检查站点规则或网络状态");
                        }
                        if (this.assertActive(index), !Array.isArray(a) || !a.length) throw this.addDiagnostic(index, "章节解析", "规则没有返回图片地址"), 
                        new Error("章节中没有可下载的图片");
                        const i = t.imageRange || (0, this.config.cF)("imgDownRange"), o = Array.isArray(i) ? Math.max(1, parseInt(i[0]) || 1) : 1, s = Array.isArray(i) ? parseInt(i[1]) : -1;
                        if (t.imgs = (-1 === s ? a.slice(o - 1) : a.slice(o - 1, s)).map((e, t) => ({
                            url: e,
                            imgIndex: o + t
                        })), t.totalNumber = t.imgs.length, !t.totalNumber) throw new Error("所选下载范围内没有图片");
                        this.resetSpeed(t), await this.down(index);
                    } else this.resetSpeed(t), await this.down2(index);
                    await this.finishWorker(index);
                } catch (t) {
                    this.failWorker(index, t);
                }
            }
            async down(workerId) {
                const t = this.assertActive(workerId);
                for (;t.imgs.length; ) {
                    const a = Date.now();
                    await this.waitUntilRunnable(workerId), this.setStage(workerId, t.downType ? "正在获取图片数据" : "正在保存图片");
                    const n = t.imgs.splice(0, this.pictureNum);
                    t.inFlight = n.slice(), this.refresh();
                    const r = await Promise.all(n.map(n => t.downType ? this.addImgPromise(workerId, n.url, t.downHeaders, 0, n.imgIndex) : this.addImgDownPromise(workerId, n.url, n.imgIndex, t.downHeaders)));
                    t.downType && this.workerDownInfo[workerId].push(...r), t.inFlight = [], this.refresh();
                    if (t.imgs.length) {
                        const o = Number(t.batchDelay);
                        if (Number.isFinite(o) && o >= 0) {
                            const s = this.isPageHidden() ? 0 : Math.max(0, o - (Date.now() - a));
                            await this.controlledDelay(workerId, s);
                        } else await this.controlledDelay(workerId, 1e3);
                    }
                }
                await this.finalizeOutput(workerId);
            }
            async down2(workerId) {
                const t = this.assertActive(workerId);
                let r = !0;
                try {
                    for (;r; ) {
                        const d = Date.now();
                        await this.waitUntilRunnable(workerId), this.setStage(workerId, "正在解析下一页图片");
                        const a = await (0, this.downloads.gJ)({
                            adapter: t.adapter,
                            url: t.url,
                            imgIndex: t.imgIndex,
                            totalNumber: t.totalNumber,
                            isPay: t.isPay,
                            otherData: t.otherData,
                            batchSize: !this.isPageHidden() && t.heavyCanvasExport && this.isSettingsVisible() ? 1 : this.pictureNum,
                            signal: t.abortController.signal
                        });
                        const i = Array.isArray(a && a.imgUrlArr) ? a.imgUrlArr.slice() : [], h = Number(a && a.imgIndexStart);
                        let m = Number.isInteger(h) && h > 0 ? h : null;
                        t.otherData = a && a.otherData, t.totalNumber = Math.max(parseInt(a && a.imgCount) || 0, t.totalNumber, t.imgIndex + i.length);
                        try {
                            this.assertActive(workerId);
                            for (;i.length; ) {
                                await this.waitUntilRunnable(workerId);
                                const n = i.splice(0, this.pictureNum).map(e => ({
                                    url: e,
                                    imgIndex: null === m ? ++t.imgIndex : (t.imgIndex++, m++)
                                }));
                                try {
                                    const r = await Promise.all(n.map(n => t.downType ? this.addImgPromise(workerId, n.url, t.downHeaders, 0, n.imgIndex) : this.addImgDownPromise(workerId, n.url, n.imgIndex, t.downHeaders)));
                                    t.downType && this.workerDownInfo[workerId].push(...r);
                                } catch (e) {
                                    for (const e of n) if ("string" == typeof e.url && e.url.startsWith("blob:")) try {
                                        URL.revokeObjectURL(e.url);
                                    } catch (e) {}
                                    throw e;
                                }
                            }
                        } finally {
                            for (const e of i) if ("string" == typeof e && e.startsWith("blob:")) try {
                                URL.revokeObjectURL(e);
                            } catch (e) {}
                        }
                        const o = a && a.nextPageUrl, s = Number(a && a.nextPageDelay), c = Number.isFinite(s) && s >= 0 ? s : 1e3, l = a && a.adaptivePageDelay ? this.isPageHidden() ? 0 : Math.max(0, c - (Date.now() - d)) : c;
                        r = Boolean(o && t.imgIndex < t.totalNumber), r && (t.url = o, await this.controlledDelay(workerId, l));
                    }
                    await this.finalizeOutput(workerId);
                } finally {
                    if (t.otherData && "function" == typeof t.otherData.cleanup) try {
                        t.otherData.cleanup();
                    } catch (e) {}
                }
            }
            async downFailures(workerId) {
                const t = this.assertActive(workerId);
                this.setStage(workerId, "正在补下载失败图片"), this.resetSpeed(t);
                const n = t.retryPending;
                for (;n.length; ) {
                    await this.waitUntilRunnable(workerId);
                    const r = n.splice(0, this.pictureNum);
                    t.inFlight = r.slice(), this.refresh(), await Promise.all(r.map(n => this.addImgDownPromise(workerId, n.url, Number(n.imgIndex) || ++t.imgIndex, t.downHeaders))), 
                    t.inFlight = [], this.refresh(), n.length && await this.controlledDelay(workerId, 500);
                }
            }
            imageOrigin(imageUrl) {
                try {
                    const url = new URL(imageUrl);
                    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : "";
                } catch (error) {
                    return "";
                }
            }
            async waitForImageDelay(workerId, deadline, label) {
                for (;;) {
                    await this.waitUntilRunnable(workerId);
                    const remaining = deadline - this.now();
                    if (remaining <= 0) return;
                    this.setStage(workerId, `${label}，约 ${Math.ceil(remaining / 1e3)} 秒后继续`);
                    await this.sleep(Math.min(1e3, remaining), this.assertActive(workerId).abortController.signal);
                }
            }
            async waitForImageOrigin(workerId, origin) {
                for (;;) {
                    const cooldown = this.imageCooldowns.get(origin);
                    if (!cooldown) return "";
                    const remaining = cooldown.until - this.now();
                    if (remaining <= 0) {
                        this.imageCooldowns.delete(origin);
                        return "";
                    }
                    if (remaining > (this.retryPolicy?.MAX_AUTO_WAIT_MS || 6e5)) return `服务器要求等待约 ${Math.ceil(remaining / 1e3)} 秒，超出自动等待上限，请稍后手动重试`;
                    await this.waitForImageDelay(workerId, cooldown.until, "正在等待服务器恢复");
                }
            }
            async fetchValidatedImage(workerId, imageUrl, headers, firstAttempt = 0, imageIndex = 0) {
                const worker = this.assertActive(workerId);
                const origin = this.imageOrigin(imageUrl);
                let attempt = Math.max(0, Number(firstAttempt) || 0);
                for (;;) {
                    await this.waitUntilRunnable(workerId);
                    const blocked = await this.waitForImageOrigin(workerId, origin);
                    if (blocked) return {
                        response: null,
                        failure: blocked
                    };
                    await this.waitUntilRunnable(workerId);
                    const admittedWorker = this.assertActive(workerId);
                    if (admittedWorker.paused || (this.imageCooldowns.get(origin)?.until || 0) > this.now()) continue;
                    this.setStage(workerId, attempt > firstAttempt ? `正在重试图片（${attempt}/${this.retryPolicy.MAX_RETRIES}）` : worker.downType ? "正在获取图片数据" : "正在保存图片");
                    let response;
                    try {
                        response = await this.downloads.WY({
                            method: "get",
                            url: imageUrl,
                            responseType: "blob",
                            headers: headers || {
                                referer: worker.url
                            },
                            timeout: 6e4,
                            signal: worker.abortController.signal
                        });
                    } catch (error) {
                        this.assertActive(workerId);
                        response = "onerror";
                        this.addDiagnostic(workerId, "图片请求", error, {
                            imgIndex: imageIndex,
                            url: imageUrl
                        });
                    }
                    this.assertActive(workerId);
                    const failure = await this.requestFailure(response);
                    this.assertActive(workerId);
                    if (!failure) return {
                        response: response,
                        failure: ""
                    };
                    const decision = this.retryPolicy?.decide({
                        url: imageUrl,
                        response: response,
                        failure: failure,
                        attempt: attempt,
                        now: this.wallNow()
                    }) || {
                        retry: false,
                        cooldownMs: 0
                    };
                    if (origin && decision.cooldownMs > 0) {
                        const previous = this.imageCooldowns.get(origin);
                        this.imageCooldowns.set(origin, {
                            until: Math.max(previous?.until || 0, this.now() + decision.cooldownMs)
                        });
                    }
                    if (!decision.retry) return {
                        response: response,
                        failure: decision.reason ? `${failure}；${decision.reason}` : failure
                    };
                    this.addDiagnostic(workerId, "图片重试", `${failure}；第 ${attempt + 1}/${this.retryPolicy.MAX_RETRIES} 次重试`, {
                        imgIndex: imageIndex,
                        url: imageUrl,
                        category: decision.category,
                        delayMs: decision.delayMs
                    });
                    await this.waitForImageDelay(workerId, this.now() + decision.delayMs, `等待第 ${attempt + 1} 次重试`);
                    attempt++;
                }
            }
            async addImgDownPromise(workerId, imageUrl, imageIndex, headers, firstAttempt = 0) {
                const worker = this.assertActive(workerId);
                await this.waitUntilRunnable(workerId);
                if (!imageUrl) {
                    this.addFailure(workerId, imageUrl, imageIndex, "图片地址为空");
                    this.advance(workerId, imageUrl, imageIndex);
                    return false;
                }
                const pathPrefix = this.downloads.pN(worker.comicName) + "\\" + this.downloads.pN(worker.downChapterName) + "\\" + this.downloads.xo(imageIndex, this.imgIndexBitNum) + ".";
                const {response: response, failure: failure} = await this.fetchValidatedImage(workerId, imageUrl, headers, firstAttempt, imageIndex);
                const directSave = worker.directFlow === 1 && worker.directRemoteDownload && !worker.useDirectory && /^https?:\/\//i.test(String(imageUrl));
                if (!failure && directSave) {
                    const saved = await this.downloads.zd({
                        url: response.response,
                        name: pathPrefix + this.getSuffix(imageUrl, response),
                        headers: headers || {
                            referer: worker.url
                        },
                        signal: worker.abortController.signal
                    });
                    this.assertActive(workerId);
                    if (saved) {
                        worker.directRemoteCount++;
                        this.advance(workerId, imageUrl, imageIndex, response.response.size, true, true);
                        return true;
                    }
                    this.addDiagnostic(workerId, "快速直连", "直接保存失败，已回退兼容流程", {
                        url: imageUrl,
                        imgIndex: imageIndex
                    });
                }
                worker.compatDownloadCount++;
                if (failure) this.addFailure(workerId, imageUrl, imageIndex, failure);
                const data = failure ? new Blob([ imageUrl ], {
                    type: "text/plain"
                }) : response.response;
                const suffix = failure ? "txt" : this.getSuffix(response.finalUrl || imageUrl, response);
                await this.waitUntilRunnable(workerId);
                const saved = await this.downloads.zd({
                    url: data,
                    name: pathPrefix + suffix,
                    signal: worker.abortController.signal
                });
                this.assertActive(workerId);
                if (!saved && !failure) this.addFailure(workerId, imageUrl, imageIndex, "文件写入失败，请检查目录权限");
                const succeeded = Boolean(saved && !failure);
                this.advance(workerId, imageUrl, imageIndex, failure ? 0 : data.size, succeeded, succeeded);
                return succeeded;
            }
            async addImgPromise(workerId, imageUrl, headers, firstAttempt = 0, imageIndex = 0) {
                this.assertActive(workerId);
                await this.waitUntilRunnable(workerId);
                if (!imageUrl) {
                    this.addFailure(workerId, imageUrl, imageIndex, "图片地址为空");
                    this.advance(workerId, imageUrl, imageIndex);
                    return {
                        blob: 1,
                        imgurl: imageUrl,
                        suffix: "",
                        imgIndex: imageIndex
                    };
                }
                const {response: response, failure: failure} = await this.fetchValidatedImage(workerId, imageUrl, headers, firstAttempt, imageIndex);
                if (failure) {
                    this.addFailure(workerId, imageUrl, imageIndex, failure);
                    this.advance(workerId, imageUrl, imageIndex);
                    return {
                        blob: 1,
                        imgurl: imageUrl,
                        suffix: "",
                        imgIndex: imageIndex
                    };
                }
                this.advance(workerId, imageUrl, imageIndex, response.response.size, true);
                return {
                    blob: response.response,
                    imgurl: imageUrl,
                    suffix: this.getSuffix(response.finalUrl || imageUrl, response),
                    imgIndex: imageIndex
                };
            }
            async requestFailure(response) {
                const failure = "abort" === response ? "请求已取消" : "timeout" === response ? "图片请求超时" : "onerror" !== response && response && "object" == typeof response ? Number(response.status) >= 400 ? "图片请求返回 HTTP " + response.status : response.response instanceof Blob ? "" : "图片响应不是有效文件" : "图片请求失败";
                if (failure) return failure;
                const blob = response.response;
                if (!blob.size) return "图片响应为空文件";
                const bytes = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
                const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
                const starts = values => values.every((value, index) => bytes[index] === value);
                let suffix = starts([ 137, 80, 78, 71, 13, 10, 26, 10 ]) ? "png" : starts([ 255, 216, 255 ]) ? "jpg" : /^GIF8[79]a/.test(ascii(0, 6)) ? "gif" : ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP" ? "webp" : ascii(0, 2) === "BM" ? "bmp" : [ "II*\0", "MM\0*" ].includes(ascii(0, 4)) ? "tiff" : starts([ 0, 0, 1, 0 ]) ? "ico" : "";
                if (!suffix && ascii(4, 4) === "ftyp") {
                    const brands = ascii(8, Math.min(56, bytes.length - 8));
                    if (/avif|avis/.test(brands)) suffix = "avif"; else if (/heic|heix|hevc|hevx|mif1/.test(brands)) suffix = "heic";
                }
                const text = (new TextDecoder).decode(bytes).replace(/^\uFEFF/, "").trimStart();
                if (!suffix && /^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(text)) suffix = "svg";
                if (!suffix) return "图片响应不是有效图片，可能是登录页、错误页或损坏文件";
                response.imageSuffix = suffix;
                return "";
            }
            getSuffix(url, response) {
                if (response && response.imageSuffix) return response.imageSuffix;
                const n = String(response && response.response && response.response.type || "").toLowerCase(), r = {
                    "image/jpeg": "jpg",
                    "image/png": "png",
                    "image/webp": "webp",
                    "image/gif": "gif",
                    "image/bmp": "bmp",
                    "image/svg+xml": "svg"
                };
                if (r[n]) return r[n];
                const a = String(url || "").toLowerCase().match(/\.(jpe?g|webp|png|gif|bmp|tiff?|svg|ico)(?:$|[?#])/);
                return a ? a[1].replace("jpeg", "jpg") : "jpg";
            }
            async finalizeOutput(workerId) {
                const t = this.assertActive(workerId);
                1 === t.downType ? await this.makeZip(workerId) : 2 === t.downType && await this.combineImages(workerId);
            }
            async makeZip(workerId) {
                const t = this.assertActive(workerId), r = this.workerDownInfo[workerId];
                this.setStage(workerId, "正在打包章节");
                try {
                    if (!await (0, this.downloads.zM)((0, this.downloads.pN)(t.comicName) + "\\" + (0, 
                    this.downloads.pN)(t.downChapterName) + ".zip", r, this.imgIndexBitNum, (e, n) => {
                        t.stage = "正在打包 " + e + "/" + n, this.refresh();
                    }, t.abortController && t.abortController.signal)) throw new Error("压缩下载需要先选择保存目录；请重新选择目录或改用原图下载");
                    t.writtenNum = t.successNum, t.outputFiles = 1, this.refresh();
                    await this.yieldToBrowser(0), await this.waitUntilRunnable(workerId);
                } finally {
                    r.forEach(e => {
                        e.blob = null;
                    });
                }
            }
            async combineImages(workerId) {
                const t = this.assertActive(workerId), a = Number((0, this.config.cF)("maxSplicingHeight")) || 2e4, o = e => Math.max(1, Math.min(a, 32760, Math.floor(4e7 / Math.max(1, e))));
                let s = null, c = 0, f = null, g = new Set, savedPages = new Set;
                const d = async e => {
                    if ("function" == typeof createImageBitmap) try {
                        return await createImageBitmap(e);
                    } catch (e) {}
                    return new Promise((t, n) => {
                        const r = URL.createObjectURL(e), a = document.createElement("img");
                        a.onload = () => {
                            URL.revokeObjectURL(r), t(a);
                        }, a.onerror = () => {
                            URL.revokeObjectURL(r), n(new Error("浏览器无法解码图片"));
                        }, a.src = r;
                    });
                }, l = async r => {
                    if (!s || !s.parts.length) return;
                    await this.waitUntilRunnable(workerId), this.setStage(workerId, "正在生成拼接图 " + (c + 1));
                    const a = document.createElement("canvas");
                    a.width = s.width, a.height = s.height;
                    const o = a.getContext("2d", {
                        alpha: !1
                    });
                    if (!o) throw new Error("浏览器无法创建图片拼接画布");
                    o.fillStyle = "#ffffff", o.fillRect(0, 0, a.width, a.height);
                    let d = 0;
                    for (const e of s.parts) o.drawImage(e.image, 0, e.sourceY, e.width, e.height, 0, d, e.width, e.height), 
                    d += e.height;
                    const l = await new Promise((e, t) => {
                        a.toBlob(n => n ? e(n) : t(new Error("画布导出失败")), "image/jpeg", .88);
                    }), u = (0, this.downloads.pN)(t.comicName) + "\\" + (0, this.downloads.pN)(t.downChapterName) + "\\" + (0, 
                    this.downloads.xo)(++c, this.imgIndexBitNum) + ".jpg";
                    if (!await (0, this.downloads.zd)(l, u)) throw new Error("拼接图 " + c + " 写入失败");
                    this.assertActive(workerId);
                    for (const part of s.parts) if (part.endsPage) savedPages.add(part.imgIndex);
                    t.writtenNum = savedPages.size, t.outputFiles = c, this.refresh();
                    for (const e of s.resources) e !== r && "function" == typeof e.close && e.close();
                    a.width = 1, a.height = 1, s = null, await this.yieldToBrowser(0);
                }, u = this.workerDownInfo[workerId];
                try {
                    for (let y = 0; y < u.length; y += this.pictureNum) {
                        await this.waitUntilRunnable(workerId);
                        const r = u.slice(y, y + this.pictureNum), a = await Promise.all(r.map(async (r, a) => {
                            const i = y + a, o = r.imgIndex || i + 1;
                            if (!r.blob || 1 === r.blob || 0 === r.blob) return {
                                item: r,
                                imgIndex: o,
                                invalid: !0
                            };
                            const s = r.blob;
                            r.blob = null;
                            try {
                                const e = await d(s);
                                return g.add(e), {
                                    item: r,
                                    imgIndex: o,
                                    bitmap: e
                                };
                            } catch (e) {
                                return {
                                    item: r,
                                    imgIndex: o,
                                    error: e
                                };
                            }
                        }));
                        for (const v of a) {
                            await this.waitUntilRunnable(workerId);
                            const r = v.item, a = v.imgIndex;
                            if (v.invalid) {
                                this.addFailure(workerId, r.imgurl, a, "图片数据无效，无法参与拼接"), await (0, this.downloads.zd)(new Blob([ r.imgurl || "" ], {
                                    type: "text/plain"
                                }), (0, this.downloads.pN)(t.comicName) + "\\" + (0, this.downloads.pN)(t.downChapterName) + "\\error_" + (0, 
                                this.downloads.xo)(a, this.imgIndexBitNum) + ".txt"), r.blob = null;
                                continue;
                            }
                            if (v.error) {
                                t.successNum = Math.max(0, t.successNum - 1), t.failedNum++;
                                this.addFailure(workerId, r.imgurl, a, v.error.message);
                                continue;
                            }
                            const i = v.bitmap;
                            g.delete(i), f = i;
                            const p = i.width, h = i.height;
                            if (!p || !h) {
                                t.successNum = Math.max(0, t.successNum - 1), t.failedNum++;
                                this.addFailure(workerId, r.imgurl, a, "图片尺寸无效"), "function" == typeof i.close && i.close(), 
                                f = null;
                                continue;
                            }
                            s && s.width !== p && await l();
                            let m = 0;
                            for (;m < h; ) {
                                s || (s = {
                                    width: p,
                                    height: 0,
                                    parts: [],
                                    resources: new Set
                                });
                                const e = o(p), t = Math.min(h - m, e - s.height);
                                s.parts.push({
                                    imgIndex: a,
                                    endsPage: m + t === h,
                                    image: i,
                                    sourceY: m,
                                    width: p,
                                    height: t
                                }), s.resources.add(i), f = null, s.height += t, m += t;
                                if (s.height >= e) {
                                    const e = m < h ? i : null;
                                    await l(e), f = e;
                                }
                            }
                        }
                    }
                    await l();
                    if (!c && !t.failures.length) throw new Error("没有可用于拼接的图片");
                } finally {
                    if (s) {
                        for (const e of s.resources) if ("function" == typeof e.close) try {
                            e.close();
                        } catch (e) {}
                        s = null;
                    }
                    if (f && "function" == typeof f.close) try {
                        f.close();
                    } catch (e) {}
                    for (const e of g) if ("function" == typeof e.close) try {
                        e.close();
                    } catch (e) {}
                }
            }
            async controlledDelay(index, milliseconds) {
                await this.yieldToBrowser(milliseconds), await this.waitUntilRunnable(index);
            }
            async finishWorker(index) {
                const t = this.assertActive(index);
                t.status = t.hasError ? "partial" : "completed", t.stage = t.hasError ? "下载完成，部分图片失败" : t.retryOnly ? "失败图片补下载完成" : "下载完成";
                this.completeWorker(index, t, true);
            }
            failWorker(index, error) {
                const n = this.worker[index];
                if (!n) return;
                const r = n.cancelled || error instanceof this.CancelledError;
                r || (n.hasError = !0, this.addDiagnostic(index, n.stage || "下载任务", error), console.error("10漫画：下载任务异常终止。", error)), 
                n.status = r ? "cancelled" : "failed", n.stage = r ? "任务已取消" : "任务失败";
                this.completeWorker(index, n, !r);
            }
            completeWorker(index, worker, notify) {
                try {
                    this.saveHistory(worker);
                    if (notify && typeof this.events.onComplete === "function") try {
                        this.events.onComplete(worker);
                    } catch (error) {
                        console.warn("10漫画：完成通知失败。", error);
                    }
                } finally {
                    for (const entry of this.workerDownInfo[index] || []) entry.blob = null;
                    this.worker[index] = void 0, this.workerDownInfo[index] = void 0;
                    this.refresh();
                    this.schedule(() => this.run(), 350);
                }
            }
            saveHistory(worker) {
                let t = [];
                try {
                    t = this.historyFallback || JSON.parse(this.historyStorage.getItem("ylComicDownHistory") || "[]"), 
                    Array.isArray(t) || (t = []);
                } catch (e) {
                    t = [];
                }
                const n = worker.failures.map(({url: e, imgIndex: t, reason: n}) => ({
                    url: e,
                    imgIndex: t,
                    reason: n
                })), timing = this.taskTiming(worker), completedAt = (new Date).toISOString(), a = {
                    id: 100 * Date.now() + this.historySequence++ % 100,
                    comicName: worker.comicName,
                    downChapterName: worker.downChapterName,
                    comicPageUrl: this.location.href,
                    hasError: worker.hasError || "failed" === worker.status,
                    status: worker.status,
                    processedNum: worker.processedNum,
                    successNum: worker.successNum,
                    failedNum: worker.failedNum,
                    writtenNum: worker.writtenNum,
                    outputFiles: worker.outputFiles,
                    stage: worker.stage,
                    durationMs: timing.activeMs,
                    totalDurationMs: timing.totalMs,
                    pausedDurationMs: timing.pausedMs,
                    completedAt: completedAt,
                    directFlow: Number(worker.directFlow) || 0,
                    flowUsed: Number(worker.directRemoteCount) > 0 ? Number(worker.compatDownloadCount) > 0 ? "混合流程" : "校验后直存" : "兼容流程",
                    failedImages: n,
                    diagnostics: worker.diagnostics,
                    task: worker.task
                };
                t = t.filter(e => DownloadQueue.historyKey(e) !== DownloadQueue.historyKey(a)), 
                t.unshift(a);
                const i = Math.max(10, Math.min(500, Number((0, this.config.cF)("historyLimit")) || 100));
                t = t.slice(0, i);
                try {
                    this.historyStorage.setItem("ylComicDownHistory", JSON.stringify(t));
                    this.historyFallback = null;
                } catch (error) {
                    this.historyFallback = t;
                    this.reportStorageError(error);
                }
                try {
                    this.events.onHistory?.();
                } catch (error) {
                    this.reportStorageError(error);
                }
            }
        }
        class RecoveryStore {
            constructor(storage, options) {
                this.storage = storage;
                this.host = options.host;
                this.origin = options.origin;
                this.id = options.id;
                this.key = "pendingTasks.session." + this.id;
                this.locks = options.locks;
                this.protected = Boolean(this.locks && this.locks.request);
                this.closed = false;
                this.transfers = {};
                this.ready = new Promise(resolve => {
                    if (!this.protected) return resolve();
                    try {
                        this.locks.request(this.lockName(this.key), {
                            ifAvailable: true
                        }, lock => {
                            if (!lock) {
                                this.protected = false;
                                resolve();
                                return;
                            }
                            return new Promise(release => {
                                this.release = release;
                                resolve();
                            });
                        }).catch(() => {
                            this.protected = false;
                            resolve();
                        });
                    } catch (error) {
                        this.protected = false;
                        resolve();
                    }
                });
            }
            lockName(key) {
                return "10comic-recovery:" + key;
            }
            persist(tasks) {
                if (this.closed) return;
                if (!tasks.length && !Object.keys(this.transfers).length) {
                    this.storage.remove(this.key);
                    return;
                }
                const previous = this.storage.get(this.key);
                const next = {
                    version: 1,
                    host: this.host,
                    origin: this.origin,
                    updatedAt: Date.now(),
                    protected: this.protected,
                    transfers: {
                        ...this.transfers
                    },
                    tasks: tasks
                };
                if (previous && JSON.stringify(previous.tasks) === JSON.stringify(tasks) && JSON.stringify(previous.transfers || {}) === JSON.stringify(this.transfers) && Date.now() - previous.updatedAt < 3e4) return;
                this.storage.set(this.key, next);
            }
            read(key) {
                if (key === "pendingTasks.legacy." + this.host) {
                    const source = this.storage.get("pendingTasks"), marker = this.storage.get(key) || {};
                    const tasks = (Array.isArray(source) ? source : []).filter(task => {
                        let host = task && task.originHost;
                        if (!host) try {
                            host = new URL(task.url).hostname;
                        } catch (ignored) {}
                        return String(host || "").toLowerCase() === this.host;
                    });
                    const fingerprint = JSON.stringify(tasks);
                    if (!tasks.length || marker.consumed === fingerprint) return null;
                    return {
                        claimedBy: marker.claimedBy,
                        updatedAt: marker.updatedAt,
                        host: this.host,
                        origin: this.origin,
                        tasks: tasks,
                        legacy: true,
                        fingerprint: fingerprint
                    };
                }
                const record = this.storage.get(key);
                return record && record.host === this.host && Array.isArray(record.tasks) && record.tasks.length ? record : null;
            }
            async available(key, record, callback) {
                const owner = record.claimedBy || key;
                if (owner === this.key) return callback();
                if (this.protected && (!record.origin || record.origin === this.origin) && (record.protected || record.claimedBy || record.legacy)) {
                    return this.locks.request(this.lockName(owner), {
                        ifAvailable: true
                    }, lock => lock ? callback() : null);
                }
                if ((!record.legacy || record.claimedBy) && Date.now() - (record.updatedAt || 0) < 12e4) return null;
                return callback();
            }
            async candidates() {
                await this.ready;
                const keys = this.storage.keys().filter(key => key.startsWith("pendingTasks.session."));
                keys.push("pendingTasks.legacy." + this.host);
                const found = [];
                for (const key of keys) {
                    if (key === this.key) continue;
                    const record = this.read(key);
                    if (!record) continue;
                    const owner = record.claimedBy && this.storage.get(record.claimedBy);
                    if (owner?.transfers?.[key] === JSON.stringify(record.tasks)) continue;
                    await this.available(key, record, () => {
                        found.push({
                            key: key,
                            version: JSON.stringify(record),
                            tasks: record.tasks.map((task, index) => ({
                                ...task,
                                taskId: task.taskId || key + ":" + index
                            }))
                        });
                    });
                }
                return found;
            }
            async claim(refs, adopt, discard = false) {
                await this.ready;
                this.warnings = [];
                let count = 0;
                for (const ref of refs) {
                    const record = this.read(ref.key);
                    if (!record || JSON.stringify(record) !== ref.version) continue;
                    await this.available(ref.key, record, async () => {
                        const fresh = this.read(ref.key);
                        if (!fresh || JSON.stringify(fresh) !== ref.version) return;
                        const owner = fresh.claimedBy && this.storage.get(fresh.claimedBy);
                        if (owner?.transfers?.[ref.key] === JSON.stringify(fresh.tasks)) return;
                        const claimed = {
                            ...record,
                            claimedBy: this.key,
                            updatedAt: Date.now()
                        };
                        this.storage.set(ref.key, claimed);
                        if (!discard) this.transfers[ref.key] = JSON.stringify(record.tasks);
                        try {
                            if (!discard) await adopt(ref.tasks);
                        } catch (error) {
                            delete this.transfers[ref.key];
                            this.storage.set(ref.key, record);
                            throw error;
                        }
                        try {
                            if (record.legacy) this.storage.set(ref.key, {
                                consumed: record.fingerprint
                            }); else this.storage.remove(ref.key);
                            delete this.transfers[ref.key];
                        } catch (error) {
                            if (discard) {
                                this.storage.set(ref.key, record);
                                throw error;
                            }
                            this.warnings.push(error);
                        }
                        count += ref.tasks.length;
                    });
                }
                return count;
            }
            close() {
                this.closed = true;
                this.release && this.release();
            }
        }
        class RuleRepository {
            constructor(storage, model) {
                this.storage = storage;
                this.model = model;
                this.key = "userWebInfo";
                this.historyKey = "tenComic.ruleHistory.v1";
                this.draftPrefix = "tenComic.ruleDraft.v1:";
                this.warnings = [];
            }
            clone(value) {
                const seen = new WeakSet;
                const copy = (value, depth = 0) => {
                    if (depth > 30) throw new Error("规则数据嵌套过深");
                    if (typeof value === "function") return value.toString();
                    if (!value || typeof value !== "object") return value;
                    if (Object.prototype.toString.call(value) === "[object RegExp]") return new RegExp(value.source, value.flags);
                    if (seen.has(value)) throw new Error("规则包含循环引用，不能保存");
                    seen.add(value);
                    const result = Array.isArray(value) ? value.map(item => copy(item, depth + 1)) : Object.fromEntries(Object.entries(value).filter(([key]) => ![ "__proto__", "prototype", "constructor" ].includes(key)).map(([key, item]) => [ key, copy(item, depth + 1) ]));
                    seen.delete(value);
                    return result;
                };
                return copy(value);
            }
            read() {
                return this.model.migrate(this.clone(this.storage.get(this.key) || []));
            }
            stamp() {
                return JSON.stringify(this.read(), (_key, value) => Object.prototype.toString.call(value) === "[object RegExp]" ? {
                    source: value.source,
                    flags: value.flags
                } : value);
            }
            history() {
                const records = this.storage.get(this.historyKey);
                return (Array.isArray(records) ? records : []).filter(entry => entry && Array.isArray(entry.before) && (entry.state === "committed" || JSON.stringify(this.read()) === JSON.stringify(entry.after)));
            }
            commit(next, reason, expectedStamp) {
                if (expectedStamp !== undefined && expectedStamp !== this.stamp()) throw new Error("规则列表已变化，请重新预览后应用");
                const before = this.read(), after = this.model.migrate(this.clone(next));
                const history = this.history();
                const entry = {
                    id: this.model.createId(),
                    updatedAt: this.model.now(),
                    reason: reason,
                    before: before,
                    after: after,
                    state: "prepared"
                };
                this.warnings = [];
                this.storage.set(this.historyKey, [ entry, ...history ].slice(0, 20));
                try {
                    this.storage.set(this.key, after);
                } catch (error) {
                    try {
                        this.storage.set(this.historyKey, history);
                    } catch (ignored) {}
                    throw error;
                }
                try {
                    this.storage.set(this.historyKey, [ {
                        ...entry,
                        state: "committed"
                    }, ...history ].slice(0, 20));
                } catch (error) {
                    this.warnings.push(error);
                }
                return after;
            }
            save(input, options = {}) {
                const result = this.model.validate(input);
                if (result.errors.length) throw new Error(result.errors.map(error => error.message).join("；"));
                const list = this.read(), index = options.id ? list.findIndex(rule => rule.id === options.id) : -1;
                if (options.id && index < 0) throw new Error("该规则已删除，请另存副本");
                if (index >= 0 && list[index].version !== options.baseVersion) throw new Error("规则已在其他位置修改，版本冲突，请恢复最新内容或另存副本");
                const rule = {
                    ...result.rule,
                    id: index >= 0 ? list[index].id : this.model.createId(),
                    version: index >= 0 ? list[index].version + 1 : 1,
                    updatedAt: this.model.now()
                };
                if (index >= 0) list[index] = rule; else list.unshift(rule);
                this.commit(list, index >= 0 ? "编辑规则：" + rule.webName : "新增规则：" + rule.webName);
                return rule;
            }
            update(id, changes, reason) {
                const list = this.read(), index = list.findIndex(rule => rule.id === id);
                if (index < 0) throw new Error("规则不存在或已被删除");
                list[index] = {
                    ...list[index],
                    ...changes,
                    id: id,
                    version: list[index].version + 1,
                    updatedAt: this.model.now()
                };
                return this.commit(list, reason);
            }
            remove(id) {
                return this.commit(this.read().filter(rule => rule.id !== id), "删除规则");
            }
            restore(id) {
                const snapshot = this.history().find(entry => entry.id === id);
                if (!snapshot) throw new Error("恢复点不存在或已过期");
                const current = this.read();
                const restored = this.model.migrate(snapshot.before).map(rule => ({
                    ...rule,
                    version: Math.max(rule.version, current.find(item => item.id === rule.id)?.version || 0) + 1,
                    updatedAt: this.model.now()
                }));
                return this.commit(restored, "恢复规则版本");
            }
            applyImport(rows, expectedStamp) {
                const list = this.read();
                const replaced = new Set;
                for (const row of rows) {
                    if (row.action === "skip") continue;
                    if (row.kind === "invalid" || row.errors?.length) throw new Error("不能导入无效规则");
                    const result = this.model.validate(row.rule);
                    if (result.errors.length) throw new Error(result.errors[0].message);
                    if (row.action === "replace") {
                        const id = row.targetId || row.targets?.[0]?.id;
                        const index = list.findIndex(rule => rule.id === id);
                        if (index < 0 || replaced.has(id)) throw new Error("替换目标不存在或被重复选择，请重新预览");
                        replaced.add(id);
                        list[index] = {
                            ...result.rule,
                            id: id,
                            version: list[index].version + 1,
                            updatedAt: this.model.now()
                        };
                    } else if (row.action === "add") list.unshift({
                        ...result.rule,
                        id: this.model.createId(),
                        version: 1,
                        updatedAt: this.model.now()
                    }); else throw new Error("导入操作无效");
                }
                return this.commit(list, "选择性导入规则", expectedStamp);
            }
            saveDraft(id, draft) {
                this.storage.set(this.draftPrefix + id, this.clone({
                    ...draft,
                    id: id
                }));
                const drafts = this.drafts(draft.host);
                for (const old of drafts.slice(10)) this.removeDraft(old.id);
            }
            drafts(host) {
                return this.storage.keys().filter(key => key.startsWith(this.draftPrefix)).map(key => this.storage.get(key)).filter(draft => draft && draft.host === host && draft.fields).sort((a, b) => b.updatedAt - a.updatedAt);
            }
            removeDraft(id) {
                this.storage.remove(this.draftPrefix + id);
            }
        }
        const ruleModel = __webpack_require__(516);
        var siteRules = __webpack_require__(872);
        const ROOT_ID = "ten-comic-root", PANEL_ID = "ten-panel", LAUNCHER_ID = "ten-comic-launcher", PENDING_TASKS_KEY = "pendingTasks", BACKUP_KEYS = [ "appLoadDefault", "maxChapterNum", "maxPictureNum", "downType", "directDownloadFlow", "sanitizePathNames", "maxSplicingHeight", "imgIndexBitNum", "imgSplicingFlag", "imgDownRange", "historyLimit", "downloadNotification", "effectLevel", "themePreset", "appearanceAxes" ], THEMES = {
            aurora: [ "极光流银", "冰透流光 · 银蓝折射" ],
            mist: [ "晨雾晶璃", "白色玻璃 · 柔光折射" ],
            cloud: [ "云白浮雕", "柔白拟态 · 轻盈触感" ],
            obsidian: [ "黑曜鎏金", "深邃烟晶 · 香槟金辉" ],
            carbon: [ "霓虹炭黑", "蓝粉边光 · 精密组件" ],
            titanium: [ "深空钛蓝", "冷峻钛金 · 钢蓝微光" ]
        }, TAB_ORDER = [ "sites", "chapters", "tasks", "settings" ], TAB_TITLES = {
            sites: [ "漫画站点", "站点索引" ],
            chapters: [ "章节选择", "章节管理" ],
            tasks: [ "下载任务", "下载队列" ],
            settings: [ "偏好设置", "系统设置" ]
        }, state = {
            ready: !1,
            visible: !1,
            launcherVisible: !1,
            pendingLauncher: !1,
            activeTab: "chapters",
            sourceMode: 0,
            searchSites: [],
            selectedSearchIndex: -1,
            comicName: "------",
            webName: "未匹配",
            chapters: [],
            chaptersLoading: !1,
            lastSelected: null,
            editMode: !1,
            optionsOpen: !1,
            searching: !1,
            editRuleIndex: -1,
            editRuleBase: null,
            ruleReadType: 1,
            rulePicking: null,
            rulePickElement: null,
            rulePickFrame: null,
            iconTipTarget: null,
            iconTipTimer: null,
            miniNodes: null,
            drawerAnchor: null,
            drawerContent: null,
            toastUndo: null,
            queue: null,
            dirHandle: null,
            toastTimer: null,
            confirmResolve: null,
            diagnosticItem: null,
            recoveryTasks: [],
            persistTimer: null,
            lastHistoryId: null,
            historyFilter: "all",
            historyRaw: null,
            historyCache: [],
            historyRenderKey: "",
            particleCount: -1,
            settings: null
        };
        function normalizeThemePreset(value) {
            const aliases = {
                glass: "aurora",
                liquid: "obsidian",
                expressive: "obsidian",
                garden: "titanium",
                ink: "titanium",
                paper: "titanium",
                porcelain: "cloud"
            };
            const preset = Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] : value;
            return Object.prototype.hasOwnProperty.call(THEMES, preset) ? preset : "aurora";
        }
        function readSettings() {
            const e = safeGet("appLoadDefault", {}), t = e && "object" == typeof e ? e : {}, n = safeGet("imgDownRange", [ 1, -1 ]), r = Array.isArray(n) && n.length >= 2 ? n : [ 1, -1 ], a = safeGet("themePreset", "glass"), i = safeGet("appearanceAxes", {}), o = i && "object" == typeof i ? i : {};
            return {
                autoOpen: Boolean(t.isShowUI),
                hotkey: String(t.loadHotKey || "V").slice(0, 1).toUpperCase(),
                scale: boundedNumber(t.rightSize, 100, 75, 125),
                maxChapters: boundedNumber(safeGet("maxChapterNum", 2), 2, 1, 3),
                concurrentImages: boundedNumber(safeGet("maxPictureNum", 3), 3, 1, 5),
                downloadType: boundedNumber(safeGet("downType", 0), 0, 0, 2),
                directFlow: boundedNumber(safeGet("directDownloadFlow", 0), 0, 0, 1),
                sanitizePaths: Boolean(safeGet("sanitizePathNames", !0)),
                maxSplicingHeight: boundedNumber(safeGet("maxSplicingHeight", 2e4), 2e4, 1e4, 65530),
                digits: boundedNumber(safeGet("imgIndexBitNum", 3), 3, 1, 8),
                historyLimit: boundedNumber(safeGet("historyLimit", 100), 100, 10, 500),
                notifyComplete: Boolean(safeGet("downloadNotification", !0)),
                effectLevel: boundedNumber(safeGet("effectLevel", 1), 1, 0, 2),
                themePreset: normalizeThemePreset(a),
                appearance: {
                    density: [ "compact", "standard", "comfortable" ].includes(o.density) ? o.density : "standard",
                    shape: [ "sharp", "standard", "round" ].includes(o.shape) ? o.shape : "standard",
                    motion: [ "calm", "standard", "spring" ].includes(o.motion) ? o.motion : "standard"
                },
                imageRange: r,
                splicePage: Boolean(safeGet("imgSplicingFlag", !0))
            };
        }
        function boundedNumber(e, t, n, r) {
            const a = Number(e);
            return Number.isFinite(a) ? Math.max(n, Math.min(r, a)) : t;
        }
        function safeGet(e, t) {
            try {
                const n = (0, configModule.cF)(e);
                return null == n ? t : n;
            } catch (e) {
                return t;
            }
        }
        function expandRuleEditor() {
            const editor = byId("ten-rule-editor-card");
            if (editor) editor.open = true;
        }
        function openUnsupportedRuleEditor() {
            initializeAppStorage();
            state.settings || (state.settings = readSettings()), injectStyle(), showUI(), activateTab("settings"), 
            expandRuleEditor();
            const e = window.location.hostname.toLowerCase();
            byId("ten-rule-domain").value || (byId("ten-rule-domain").value = e), byId("ten-rule-homepage").value || (byId("ten-rule-homepage").value = `${window.location.protocol}//${window.location.host}/`), 
            setTimeout(() => byId("ten-rule-editor-card").scrollIntoView({
                behavior: "smooth",
                block: "start"
            }), 80), toast("已进入当前网站规则编辑，可使用可视化选择");
        }
        function handleGlobalHotkey(e) {
            if (handleModalKeydown(e)) return;
            if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
            const t = String(e.key || "").toUpperCase(), n = String(e.code || "").toUpperCase(), r = state.settings ? state.settings.hotkey : "V";
            "V" !== t && "KEYV" !== n && t !== r && n !== `KEY${r}` || (e.preventDefault(), 
            e.stopPropagation(), toggleUI());
        }
        function renderShell() {
            return [ [ '<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">\n    <symbol id="ten-i-globe" viewBox="0 0 24 24"><circle cx="12" \
cy="12" r="9"/><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18"/></symbol>\n    <symbol id="ten-i-layers" viewBox="0 0 24 24"><path d="m12 3 9 \
5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5', ' 9-5"/></symbol>\n    <symbol id="ten-i-download" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></symbol>\n    <symbol id="ten-i-settings" \
viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 \
1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 ', "8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 \
0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 \
2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.3", '8.37.72.6 1 .3.35.7.5 1.1.5h.1v4h-.1c-.42 0-.8.15-1.1.5-.23.28-.44.62-.6 1Z"/></symbol>\n    <symbol id="ten-i-close" viewBox="0 0 24 24"><path d="M6 6l12 \
12M18 6 6 18"/></symbol>\n    <symbol id="ten-i-github" viewBox="0 0 24 24"><path d="M12 2.8a9.2 9.2 0 0 0-2.9 \
17.93c.46.08.63-.2.63-.45v-1.78c-2.57.56-3.11-1.09-3.11-1.09-.42-1.07-1.03-1.35-1.03-1.35-.84-.57.06-.56.06-.56.93.07 1.42.95 1.42.95.83 1.42 2.17 1.01 \
2.7.77.08-.6.32-1.01.59-1.25-2.05-.23-4.21-1.03-4.21-4.56 0-1.01.36-1.84.95-2.49-.1-.23-.41-1.18.09-2.46 0 0 .77-.25 2.53.95A8.8 8.8 0 0 1 12 6.7c.78 0 1.57.1 \
2.3.31 1.76-1.2 2.53-.95 2.53-.95.5 1.28.19 2.23.09 2.46.59.65.95 1.48.95 2.49 0 3.54-2.16 4.32-4.22 4.55.33.29.63.85.63 1.71v2.54c0 .25.17.54.64.45A9.2 9.2 0 0 \
0 12 2.8Z"/></symbol>\n    <symbol id="ten-i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></symbol>\n    <symbol \
id="ten-i-refresh" viewBox="0 0 24 24"><path d', '="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A8 8 0 0 1 20 12M17.9 16A8 8 0 0 1 4 12"/></symbol>\n    <symbol id="ten-i-sliders" viewBox="0 0 24 24"><path d="M4 \
6h10M18 6h2M4 12h3M11 12h9M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></symbol>\n    <symbol \
id="ten-i-sort" viewBox="0 0 24 24"><path d="M8 ', '6h12M8 12h9M8 18h6M4 4v16m0 0-2.5-2.5M4 20l2.5-2.5"/></symbol>\n    <symbol id="ten-i-edit" viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 \
4"/></symbol>\n    <symbol id="ten-i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></symbol>\n    <symbol \
id="ten-i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 ', '5v14"/></symbol>\n    <symbol id="ten-i-play" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></symbol>\n    <symbol id="ten-i-info" viewBox="0 0 24 \
24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></symbol>\n    <symbol id="ten-i-up" viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"/></symbol>\n    \
<symbol id="ten-i-down" viewBox="0 0 24 24"><path d="', 'm6 10 6 6 6-6"/></symbol>\n    <symbol id="ten-i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 \
2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>\n    <symbol id="ten-i-backup" viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5V4Z"/><path d="M8 4v6h8V4M8 \
20v-6h8v6"/></symbol>\n    <symbol id="ten-i-guide" viewBo', 'x="0 0 24 24"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/><path \
d="m17 7 .5 1.2L19 9l-1.5.8L17 11l-.5-1.2L15 9l1.5-.8L17 7Z"/></symbol>\n    <symbol id="ten-i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" \
r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 1', '9v3M2 12h3M19 12h3"/></symbol>\n  </svg>' ].join(""), `<button id="${LAUNCHER_ID}" class="is-hidden" type="button" aria-label="打开 10漫画" title="打开 10漫画"><span>10漫</span></button>`, `<div id="ten-mini-task" class="ten-mini-task is-hidden" aria-hidden="true"><button id="ten-mini-open" class="ten-mini-open" type="button" \
aria-label="打开下载任务"><span class="ten-mini-icon">${icon("download")}</span><span class="ten-mini-copy"><strong id="ten-mini-title">正在下载</strong><small id="ten-mini-meta">准备任务</small><span class="ten-mini-progress"><i \
id="ten-mini-progress"></i></span></span></button><button id="ten-mini-toggle" class="ten-mini-toggle" type="button" aria-label="全部暂停" title="全部暂停">${icon("pause")}</button></div>`, `<div id="ten-rule-pick-layer" class="ten-rule-pick-layer is-hidden" aria-hidden="true"><div id="ten-rule-pick-box" class="ten-rule-pick-box"></div><div \
class="ten-rule-pick-hud"><span class="ten-rule-pick-symbol">${icon("target")}</span><span><strong id="ten-rule-pick-title">选择网页元素</strong><small id="ten-rule-pick-selector">移动鼠标并点击，Esc 取消</small></span><button id="ten-rule-pick-cancel" \
type="button">取消</button></div></div>`, '<div id="ten-icon-tooltip" class="ten-icon-tooltip" role="tooltip" aria-hidden="true"></div>', `<aside id="${PANEL_ID}" inert aria-hidden="true"><div id="ten-particle-field" aria-hidden="true"></div>`, `<header class="ten-header"><span class="ten-brand-mark">10</span><div class="ten-heading"><div id="ten-title" class="ten-title">章节选择</div><div id="ten-subtitle" \
class="ten-subtitle">章节管理</div></div><a id="ten-github-link" class="ten-icon-btn" href="https://github.com/JY525712/10Comic-remastered" target="_blank" \
rel="noopener noreferrer" aria-label="打开 GitHub 仓库" title="GitHub 仓库">${icon("github")}</a><button id="ten-close" class="ten-icon-btn" type="button" aria-label="收起面板">${icon("close")}</button></header>`, '<main class="ten-content">', `<section class="ten-view" data-view="sites">\n    <div class="ten-toolbar">\n      <div class="ten-source"><button type="button" \
data-source="0">内置站点</button><button type="button" data-source="1">导入规则</button></div>\n    </div>\n    <div id="ten-rule-manage" class="ten-rule-manage" \
hidden><span id="ten-rule-count">已导入 0 条规则</span><button id="ten-rule-clear-all" class="ten-btn is-danger is-small" type="button">清空全部</button></div>\n    <div \
class="ten-toolbar ten-search-toolbar"><div id="ten-search-site-picker" class="ten-search-site-picker"><button id="ten-search-site-trigger" type="button" \
aria-haspopup="listbox" aria-expanded="false"><span id="ten-search-site-label">全部站点</span><span class="ten-picker-arrow"></span></button><div \
id="ten-search-site-menu" class="ten-search-site-menu" role="listbox" hidden></div></div><input id="ten-search-input" class="ten-input" \
placeholder="搜索漫画"><button id="ten-search-btn" class="ten-btn is-primary ten-icon-label" type="button">${icon("search")}<span>搜索</span></button></div>\n    <div id="ten-site-list" class="ten-list"></div>\n  </section>`, `<section class="ten-view" data-view="chapters">\n    <div id="ten-chapter-status" class="ten-status">正在识别当前页面…</div>\n    <div class="ten-chapter-tools">\n      \
<div class="ten-row ten-chapter-select-group"><button id="ten-select-all" class="ten-btn is-small" type="button" disabled>全选</button><button \
id="ten-clear-select" class="ten-btn is-small" type="button" disabled>取消</button></div>\n      <button id="ten-toggle-options" class="ten-btn is-small \
ten-icon-label" type="button">${icon("sliders")}<span>下载选项</span></button>\n      <button id="ten-download-selected" class="ten-btn is-primary is-small" type="button" disabled>下载</button>\n    </div>\n    \
<div id="ten-options" class="ten-card ten-options">\n      <div class="ten-card-title">下载方式</div>\n      <div class="ten-mode-grid"><button class="ten-mode" \
data-mode="0">直接下载</button><button class="ten-mode" data-mode="1">压缩下载</button><button class="ten-mode" data-mode="2">图片拼接</button></div>\n      <div \
class="ten-grid-2" style="margin-top:8px"><label class="ten-list-item"><input id="ten-add-sequence" type="checkbox"> 补充序号</label><label \
class="ten-list-item"><input id="ten-reverse-sequence" type="checkbox"> 序号反转</label></div>\n      <div class="ten-section-title">当前阅读章节</div>\n      <div \
class="ten-grid-2"><input id="ten-current-comic" class="ten-input" placeholder="漫画名"><input id="ten-current-chapter" class="ten-input" \
placeholder="章节名"></div>\n      <button id="ten-download-current" class="ten-btn" type="button" style="margin-top:8px;width:100%">获取并下载当前章节</button>\n    \
</div>\n    <div class="ten-chapter-reload"><button id="ten-reload-chapters" type="button">${icon("refresh")}<span>重载列表</span></button></div>\n    <div id="ten-chapter-empty" class="ten-chapter-empty">\n      <div class="ten-empty-orbit">${icon("layers")}</div>\n      <div class="ten-empty-title">尚未加载章节</div>\n      <div class="ten-meta">确认漫画信息后加载当前页面的章节列表</div>\n      <button id="ten-load-chapters" \
class="ten-btn is-primary" type="button">加载章节</button>\n      <div class="ten-comic-info"><span>网站</span><strong \
id="ten-info-site">未匹配</strong><span>漫画</span><strong id="ten-info-comic">------</strong></div>\n    </div>\n    <div id="ten-chapter-loaded" hidden>\n      \
<div class="ten-chapter-list-head"><span id="ten-chapter-count">章节列表</span><div class="ten-row"><button id="ten-reverse-list" class="ten-icon-btn" type="button" title="反向排序">${icon("sort")}</button><button id="ten-edit-list" class="ten-icon-btn" type="button" title="编辑名称">${icon("edit")}</button></div></div>\n      <div id="ten-chapter-list" class="ten-chapter-list"></div>\n    </div>\n  </section>`, [ [ '<section class="ten-view" data-view="tasks"><div id="ten-recovery" class="ten-recovery" hidden><div><strong>发现未完成任务</strong><span \
id="ten-recovery-count"></span></div><div class="ten-row"><button id="ten-recovery-discard" class="ten-btn is-danger is-small" type="button">放弃</button><button \
id="ten-recovery-restore" class="ten-btn is-primary is-small" type="bu', 'tton">恢复</button></div></div><div class="ten-task-group" data-task-group="active"><div class="ten-task-header"><button class="ten-task-title-button" \
type="button" aria-expanded="false"><span>正在下载</span><span id="ten-active-count" class="ten-task-count">0</span></button><div \
class="ten-task-control-group"><button id="ten-toggle-all-active" class="ten-btn is-s', 'mall ten-task-bulk" type="button" hidden>全部暂停</button><button id="ten-cancel-all-active" class="ten-btn is-danger is-small ten-task-bulk" type="button" \
hidden>全部取消</button><button class="ten-task-arrow-button" type="button" aria-label="展开或收起正在下载" aria-expanded="false"><span \
class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div id', '="ten-active-tasks" class="ten-list"></div></div></div>' ].join(""), '<div class="ten-task-group" data-task-group="waiting"><div class="ten-task-header"><button class="ten-task-title-button" type="button" \
aria-expanded="false"><span>等待下载</span><span id="ten-waiting-count" class="ten-task-count">0</span></button><div class="ten-task-control-group"><button \
id="ten-remove-all-waiting" class="ten-btn is-danger is-small ten-task-bulk" type="button" hidden>全部移出</button><button class="ten-task-arrow-button" \
type="button" aria-label="展开或收起等待下载" aria-expanded="false"><span class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div \
id="ten-waiting-tasks" class="ten-list"></div></div></div>', '<div class="ten-task-group" data-task-group="history"><div class="ten-task-header"><button class="ten-task-title-button" type="button" \
aria-expanded="false"><span>下载记录</span><span id="ten-history-count" class="ten-task-count">0</span></button><div class="ten-task-control-group"><button \
id="ten-clear-history" class="ten-icon-btn" type="button" title="清空记录">', icon("trash"), '</button><button class="ten-task-arrow-button" type="button" aria-label="展开或收起下载记录" aria-expanded="false"><span \
class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div class="ten-list ten-history-wrap"><div id="ten-history-filter" \
class="ten-history-filter" role="group" aria-label="下载记录筛选"><button type="button" data-history-filter="all">全部</button><button type="button" \
data-history-filter="completed">完成</button><button type="button" data-history-filter="failed">失败</button><button type="button" \
data-history-filter="cancelled">取消</button></div><div id="ten-history" class="ten-list"></div></div></div></div></section>' ].join(""), [ '<section class="ten-view" data-view="settings">', renderThemeSettings(), [ '<details id="ten-download-settings" class="ten-card ten-settings-card ten-settings-download ten-settings-disclosure" open><summary \
class="ten-settings-summary">下载</summary><div class="ten-settings-disclosure-body"><div class="ten-setting"><label for="ten-max-chapters">同时下载章节</label><input \
id="ten-max-chapters" class="ten-input" type="number" min="1" max="3"></div><div class="ten-setting"><label for="ten-concurrent-images">每章并发图片</label><input \
id="ten-concurrent-images" cl', 'ass="ten-input" type="number" min="1" max="5"></div><div class="ten-setting"><label for="ten-default-mode-trigger">默认方式</label><div id="ten-default-mode" \
class="ten-setting-select"><button id="ten-default-mode-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span \
id="ten-default-mode-label">直接下载</span><span class="ten-picker-arrow"></spa', 'n></button><div id="ten-default-mode-menu" class="ten-setting-select-menu" role="listbox" hidden><button type="button" data-default-mode="0"><span \
class="ten-mode-option-mark"></span><span><strong>直接下载</strong><small>逐张保存图片</small></span></button><button type="button" data-default-mode="1"><span \
class="ten-mode-option-mark"></span><span><strong>压缩下载</strong>', '<small>打包为章节 ZIP</small></span></button><button type="button" data-default-mode="2"><span \
class="ten-mode-option-mark"></span><span><strong>图片拼接</strong><small>输出连续长图</small></span></button></div></div></div><div class="ten-setting \
ten-direct-flow-setting"><label>直接下载流程</label><div class="ten-direct-flow-options" role="group" aria-label="直接下载流程"><button type="button" \
data-direct-flow="0"><strong>兼容流程</strong><small>GM_xmlhttpRequest → Blob → 保存；兼容性优先</small></button><button type="button" \
data-direct-flow="1"><strong>快速直连</strong><small>先校验图片 → GM_download 保存；失败回退兼容流程</small></button></div></div><div class="ten-setting ten-setting-check \
ten-path-sanitize-setting"><div><label for="ten-sanitize-paths">自动清理文件夹和文件名</label><small>默认开启；修正系统和浏览器不兼容名称，仅影响保存路径</small></div><input id="ten-sanitize-paths" \
type="checkbox"></div>' ].join(""), '<div class="ten-setting"><label for="ten-max-height">拼接最大高度</label><input id="ten-max-height" class="ten-input" type="number" min="10000" \
max="65530"></div><div class="ten-setting"><label for="ten-digits">图片序号位数</label><input id="ten-digits" class="ten-input" type="number" min="1" \
max="8"></div><div class="ten-setting"><label>图片下载范围</label><div class="ten-grid-2"><input id="ten-range-start" class="ten-input" type="number" min="1"><input \
id="ten-range-end" class="ten-input" type="number" min="-1"></div></div>', settingCheck("ten-splice-page", "网站图片连续阅读"), settingCheck("ten-notify-complete", "下载完成通知"), '<div class="ten-setting"><label for="ten-history-limit">下载记录上限</label><input id="ten-history-limit" class="ten-input" type="number" min="10" \
max="500"></div><div class="ten-setting"><label>本地保存目录</label><div class="ten-dir-control"><button id="ten-choose-dir" class="ten-btn is-small" \
type="button">选择目录</button><span id="ten-dir-name" class="ten-file-name"></span></div></div></div></details>', renderCustomRuleEditorAndBackup() ].join(""), '</main><nav class="ten-nav" aria-label="功能导航">', navButton("sites", "globe", "站点"), navButton("chapters", "layers", "章节"), navButton("tasks", "download", "任务"), navButton("settings", "settings", "设置"), '</nav><div id="ten-toast" class="ten-toast" role="status" aria-live="polite"><span id="ten-toast-text"></span><button id="ten-toast-action" type="button" hidden>撤销</button></div>', `<div id="ten-confirm" inert class="ten-confirm" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-confirm-cancel \
aria-label="取消"></button><div class="ten-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ten-confirm-title" \
aria-describedby="ten-confirm-message"><div class="ten-confirm-icon">${icon("trash")}</div><div id="ten-confirm-title" class="ten-confirm-title">确认操作</div><div id="ten-confirm-message" class="ten-confirm-message"></div><div \
class="ten-confirm-actions"><button id="ten-confirm-cancel" class="ten-btn" type="button" data-confirm-cancel>取消</button><button id="ten-confirm-ok" \
class="ten-btn is-danger" type="button">确认</button></div></div></div>`, `<div id="ten-diagnostic" inert class="ten-diagnostic" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-diagnostic-close \
aria-label="关闭诊断"></button><div class="ten-diagnostic-dialog" role="dialog" aria-modal="true" aria-labelledby="ten-diagnostic-title"><div \
class="ten-diagnostic-head"><div class="ten-confirm-icon is-info">${icon("info")}</div><div><div id="ten-diagnostic-title" class="ten-confirm-title">下载诊断</div><div id="ten-diagnostic-summary" class="ten-meta"></div></div><button \
class="ten-icon-btn" type="button" data-diagnostic-close aria-label="关闭">${icon("close")}</button></div><pre id="ten-diagnostic-content"></pre><div class="ten-diagnostic-actions"><button id="ten-copy-failures" class="ten-btn" \
type="button">复制失败清单</button><button id="ten-diagnostic-copy" class="ten-btn" type="button">复制诊断信息</button><button class="ten-btn is-primary" type="button" \
data-diagnostic-close>完成</button></div></div></div>`, `<div id="ten-rule-guide" inert class="ten-diagnostic ten-rule-guide" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-rule-guide-close \
aria-label="关闭方法说明"></button><div class="ten-diagnostic-dialog ten-rule-guide-dialog" role="dialog" aria-modal="true" \
aria-labelledby="ten-rule-guide-title"><div class="ten-diagnostic-head"><div class="ten-confirm-icon is-info">${icon("guide")}</div><div><div id="ten-rule-guide-title" class="ten-confirm-title">自定义站点设置方法</div><div class="ten-meta">填写 · 测试 · 管理</div></div><button class="ten-icon-btn" \
type="button" data-rule-guide-close aria-label="关闭">${icon("close")}</button></div><div class="ten-rule-guide-content">\n<section><h3>一、快速上手</h3><ol><li>打开漫画目录页，填写站点名称、域名和选择器。</li><li>可先选模板，再用“选择标题／章节／图片”点选网页元素；用“高亮”核对范围，模板可撤销。</li><li>先测试目录，再预览一章图片，确认后保存并重载章节列表。</li></ol></section>\n<section><h3>二、字段怎么填</h3><dl><dt>站点名称</dt><dd>列表中显示的名字，如“示例漫画”。</dd><dt>域名</dt><dd><code>example.com</code>；多个用逗号分隔，不填章节路径。</dd><dt>漫画标题</dt><dd>标题元素，如 \
<code>h1.title</code>。</dd><dt>章节列表</dt><dd>包含章节链接的容器，如 <code>.chapter-list</code>。</dd><dt>章节图片</dt><dd>阅读页的漫画图片，如 <code>.reader \
img</code>；避开封面和广告。</dd></dl></section>\n<section><h3>三、测试、预览与生效</h3><ul><li>“测试当前页面”检查格式、域名、标题和目录，不执行高级函数；目录页没有漫画图片属正常情况。</li><li>“预览章节图片”可选一章或当前阅读页，最多加载6张样本，不保存文件；解析出地址不代表图片都能加载。</li><li>预览可取消，整体限时60秒。保存后点章节页的重载按钮；已入队任务沿用原规则。</li></ul></section>\n<section><h3>四、按需调整</h3><dl><dt>常用选项</dt><dd>留空自动识别。图片属性按填写顺序尝试，如 \
<code>data-original, src</code>；可排除广告图片／容器，或按地址包含、排除条件筛选章节。</dd><dt>动态页面</dt><dd>图片需网页脚本生成时开启“隐藏页面读取”，可设置等待元素及1～60秒超时；跨域页面可能无法读取。</dd><dt>复杂站点</dt><dd>翻页阅读需高级解析函数；普通选择器无法提取图片时再使用函数。常用图片选项用于简单选择器解析。</dd></dl></section>\n<section><h3>五、导入与规则管理</h3><ul><li>默认粘贴 \
JSON 数组，先预览，再逐条跳过、新增或替换；重复、域名冲突和无效项会标出。列表变化后需重新预览。</li><li>旧版 JavaScript 对象需勾选兼容并确认执行；导入备份时可选择是否一并恢复设置。</li><li>站点页切换到“导入规则”，可筛选、启停、编辑、复制、导出或删除。副本默认停用；默认内置优先，勾选“优先”后按自定义列表顺序匹配。</li></ul></section>\n<section><h3>六、草稿与恢复</h3><ul><li>编辑自动保留当前网站最近10份草稿，不会直接应用；可选择恢复或删除。</li><li>规则变更前保留恢复点，最多20次。编辑发生版本冲突时，可重新编辑最新规则或另存副本。</li></ul></section>\n<section><h3>七、问题速查</h3><ul><li><b>章节为0：</b>检查容器内是否有真实章节链接，以及地址筛选是否过严。</li><li><b>图片为0／混入广告：</b>在阅读页高亮核对图片范围，检查懒加载属性、排除条件及等待元素。</li><li><b>有地址但加载失败：</b>先确认网站本身能正常阅读，再检查登录状态、请求限制或规则是否失效。</li></ul></section>\n<div \
class="ten-rule-guide-warning">仅导入已审阅的可信规则；高级函数会执行代码，同步死循环无法由预览超时强制终止。</div></div><button class="ten-btn is-primary" type="button" data-rule-guide-close>我知道了</button></div></div>`, "</aside>", `<aside id="ten-search-panel" aria-hidden="true">\n    <header class="ten-search-panel-header"><div><div class="ten-title">搜索结果</div><div \
id="ten-search-panel-subtitle" class="ten-subtitle">全部站点</div></div><button id="ten-search-close" class="ten-icon-btn" type="button" aria-label="关闭搜索结果">${icon("close")}</button></header>\n    <div id="ten-search-results" class="ten-search-panel-content"></div>\n  </aside>`, '<div id="ten-mobile-drawer" inert class="ten-mobile-drawer" aria-hidden="true"><button class="ten-mobile-drawer-backdrop" type="button" data-drawer-close \
aria-label="关闭抽屉"></button><section class="ten-mobile-drawer-sheet" role="dialog" aria-modal="true" aria-labelledby="ten-mobile-drawer-title"><div \
class="ten-mobile-drawer-handle"></div><header><div id="ten-mobile-drawer-title">下载选项</div><button type="button" class="ten-icon-btn" data-drawer-close aria-label="关闭">' + icon("close") + '</button></header><div id="ten-mobile-drawer-content"></div></section></div>' ].join("");
        }
        function renderThemeSettings() {
            return `<details id="ten-theme-settings" class="ten-card ten-settings-card ten-settings-disclosure">\n      <summary class="ten-settings-summary">主题</summary>\n      \
<div class="ten-settings-disclosure-body">\n        <section class="ten-settings-section">\n          <div class="ten-card-title">预设选择</div>\n          <div \
class="ten-theme-presets" role="group" aria-label="主题预设">\n            ${Object.entries(THEMES).map(([key, theme]) => `<button class="ten-theme-choice" data-theme-choice="${key}" type="button"><strong>${theme[0]}</strong><small>${theme[1]}</small></button>`).join("")}\n          </div>\n        </section>\n        ${appearanceAxesSection()}\n        <section class="ten-settings-section">\n          <div class="ten-card-title">界面设置</div>\n          ${settingCheck("ten-auto-open", "随网页打开界面")}\n          <div class="ten-setting"><label for="ten-hotkey">快捷键（Alt +）</label><input id="ten-hotkey" class="ten-input" maxlength="1"></div>\n          <div \
class="ten-setting"><label for="ten-scale">界面缩放</label><div class="ten-row"><input id="ten-scale" type="range" min="75" max="125" step="1"><span \
id="ten-scale-value" class="ten-setting-value"></span></div></div>\n          <div class="ten-setting"><label>特效强度</label><div class="ten-effect-level" \
role="group" aria-label="特效强度"><button type="button" data-effect-level="0">关闭</button><button type="button" data-effect-level="1">轻量</button><button \
type="button" data-effect-level="2">标准</button></div></div>\n        </section>\n      </div>\n    </details>`;
        }
        function renderSites() {
            const e = (0, siteRules.eT)(), t = Array.isArray(e.originalInfo) ? e.originalInfo.slice() : [], n = ruleRepository().read(), r = 0 === state.sourceMode ? t : n;
            one(".ten-source").style.setProperty("--source", state.sourceMode), all(".ten-source button").forEach(e => e.classList.toggle("is-active", Number(e.dataset.source) === state.sourceMode)), 
            byId("ten-rule-manage").hidden = 0 === state.sourceMode, byId("ten-rule-count").textContent = `已导入 ${n.length} 条规则 · 可逐条删除`, 
            function(e = []) {
                state.searchSites = (Array.isArray(e) ? e : []).map((e, t) => ({
                    site: e,
                    order: t
                })).sort((e, t) => Number(Boolean(t.site?.searchTemplate_1)) - Number(Boolean(e.site?.searchTemplate_1)) || e.order - t.order).map(e => e.site), 
                state.selectedSearchIndex = -1;
                const t = state.searchSites.filter(e => e && e.searchTemplate_1).length, n = 0 === state.sourceMode ? "全部内置站点" : "全部导入站点";
                byId("ten-search-site-label").textContent = n, byId("ten-search-btn").disabled = 0 === t, 
                byId("ten-search-site-menu").innerHTML = [ `<button class="ten-search-site-option is-all is-selected" type="button" role="option" data-search-index="-1" ${t ? "" : "disabled"}><span>${n}</span><small>${t} 个可搜索</small></button>`, ...state.searchSites.map((e, t) => `<button class="ten-search-site-option" type="button" role="option" data-search-index="${t}" ${e.searchTemplate_1 ? "" : "disabled"}><span>${escapeHtml(e.webName)}</span><small>${e.searchTemplate_1 ? "可搜索" : "仅浏览"}</small></button>`) ].join(""), 
                closeSearchSiteMenu();
            }(r.filter(rule => rule.enabled !== false)), byId("ten-site-list").innerHTML = state.sourceMode === 1 ? renderManagedRuleList(r) : r.map(e => `<button class="ten-list-item" type="button" data-url="${escapeAttr(e.homepage)}"><span class="ten-name">${escapeHtml(e.webName)}</span><span class="ten-site-kind">内置</span><span class="ten-meta">${escapeHtml(e.webDesc || "打开站点")}</span></button>`).join("");
            refreshRuleMatchStatus();
        }
        function deleteImportedRule(event) {
            return handleManagedRuleAction(event);
        }
        async function searchComics() {
            const e = byId("ten-search-input").value.trim();
            if (!e || state.searching) return;
            const t = state.searchSites.filter(e => e && e.searchTemplate_1), n = state.selectedSearchIndex >= 0 ? state.searchSites[state.selectedSearchIndex] : null, r = n && n.searchTemplate_1 ? [ n ] : t;
            if (!r.length) return void toast(0 === state.sourceMode ? "当前没有可搜索的内置站点" : "导入规则没有配置搜索功能");
            state.searching = !0, closeSearchSiteMenu();
            const a = byId("ten-search-results"), i = n ? n.webName : 0 === state.sourceMode ? "全部内置站点" : "全部导入站点";
            !function(e) {
                const t = byId("ten-search-panel");
                byId("ten-search-panel-subtitle").textContent = e, t.classList.add("is-open"), t.setAttribute("aria-hidden", "false");
            }(i), a.innerHTML = `<div class="ten-status">${r.length > 1 ? "正在搜索多个站点…" : `正在搜索 ${escapeHtml(i)}…`}</div>`;
            const o = [];
            for (const t of r) {
                try {
                    const n = await (0, siteRules.Ni)(t, e);
                    n && n.length && o.push({
                        site: t.webName,
                        results: n
                    });
                } catch (e) {
                    console.warn(`10漫画：${t.webName} 搜索失败。`, e);
                }
                renderSearchGroups(o, a);
            }
            o.length || (a.innerHTML = empty("没有找到结果")), state.searching = !1;
        }
        function toggleSearchSiteMenu(e) {
            e.stopPropagation();
            const t = byId("ten-search-site-menu"), n = t.hidden;
            t.hidden = !n, byId("ten-search-site-picker").classList.toggle("is-open", n), byId("ten-search-site-trigger").setAttribute("aria-expanded", String(n));
            n && (closeDefaultModeMenu(), fitPickerMenu(t, byId("ten-search-site-trigger")));
        }
        function handleSearchSiteChoice(e) {
            const t = e.target.closest("[data-search-index]");
            if (!t || t.disabled) return;
            const n = Number(t.dataset.searchIndex);
            state.selectedSearchIndex = n, byId("ten-search-site-label").textContent = n < 0 ? 0 === state.sourceMode ? "全部内置站点" : "全部导入站点" : state.searchSites[n].webName, 
            all(".ten-search-site-option").forEach(e => e.classList.toggle("is-selected", Number(e.dataset.searchIndex) === n)), 
            closeSearchSiteMenu();
        }
        function closeSearchSiteMenuOnOutsideClick(e) {
            const t = byId("ten-search-site-picker");
            t && !t.contains(e.target) && closeSearchSiteMenu();
        }
        function closeSearchSiteMenu() {
            const e = byId("ten-search-site-menu");
            e && (e.hidden = !0, byId("ten-search-site-picker").classList.remove("is-open"), 
            byId("ten-search-site-trigger").setAttribute("aria-expanded", "false"));
        }
        function closeSearchPanel() {
            const e = byId("ten-search-panel");
            e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
        }
        function renderSearchGroups(e, t) {
            t.innerHTML = e.map(e => `<div class="ten-section-title">${escapeHtml(e.site)}</div><div class="ten-result-grid">${e.results.map(e => `<button class="ten-result" type="button" data-url="${escapeAttr(e.url || "")}"><img src="${escapeAttr(e.imageUrl || "")}" alt="" loading="lazy"><span>${escapeHtml(e.name || "未命名")}</span></button>`).join("")}</div>`).join(""), 
            all(".ten-result", t).forEach(e => e.addEventListener("click", () => window.open(e.dataset.url, "_blank")));
        }
        function detectComicInfo(e = 0) {
            if ((0, siteRules.HL)(window.location.href), !siteRules.Po) return state.webName = "未匹配", 
            void updateChapterStatus();
            state.webName = siteRules.Po.webName;
            try {
                const e = document.querySelector(siteRules.Po.comicNameCss), t = e && String(e.innerText || e.textContent || "").split("\n")[0].trim();
                if (t) return state.comicName = t, byId("ten-current-comic").value = t, void updateChapterStatus();
            } catch (e) {
                console.warn("10漫画：漫画名称识别失败。", e);
            }
            updateChapterStatus(), e < 2 && setTimeout(() => detectComicInfo(e + 1), 1500);
        }
        function updateChapterStatus(e) {
            refreshRuleMatchStatus();
            const t = byId("ten-chapter-status");
            t && (t.textContent = e || `${state.webName} · ${state.comicName}`, t.classList.toggle("is-ready", Boolean(siteRules.Po && "------" !== state.comicName)), 
            byId("ten-info-site").textContent = state.webName, byId("ten-info-comic").textContent = state.comicName);
        }
        async function loadChapters() {
            if (state.chaptersLoading) return;
            if (!siteRules.Po) return void toast("当前网站没有匹配规则");
            state.chaptersLoading = !0;
            const e = byId("ten-load-chapters");
            e.disabled = !0, e.textContent = "正在加载…", updateChapterStatus("正在读取章节列表…");
            try {
                let e = null;
                "function" == typeof siteRules.Po.getComicInfo && (e = await siteRules.Po.getComicInfo(state.comicName)), 
                Array.isArray(e) || (e = function() {
                    const e = [];
                    return collectFromSelector(siteRules.Po.chapterCss, "one", e), siteRules.Po.chapterCss_2 && collectFromSelector(siteRules.Po.chapterCss_2, "many", e), 
                    e;
                }()), String(siteRules.Po.homepage || "").includes("zerobyw33.com") && e[0]?.comicName && (state.comicName = e[0].comicName, 
                byId("ten-current-comic").value = state.comicName), state.chapters = e.map(normalizeChapter).filter(e => e.chapterName), 
                state.lastSelected = null, await renderChapters(), updateChapterStatus(`${state.webName} · ${state.comicName} · ${state.chapters.length} 章`);
            } catch (e) {
                console.error("10漫画：章节加载失败。", e), updateChapterStatus("章节读取失败，请检查站点规则"), toast("网站规则可能已经失效");
            } finally {
                state.chaptersLoading = !1, e.disabled = !1, e.textContent = "重新加载章节";
                if (state.chaptersReloadRequested) state.chaptersReloadRequested = !1, reloadChapters();
            }
        }
        function collectFromSelector(e, t, r) {
            document.querySelectorAll(e).forEach(e => {
                e.querySelectorAll("a").forEach(e => {
                    if (e.closest("#ten-comic-root")) return;
                    if (siteRules.Po.chapterUrlIncludes && !e.href.includes(siteRules.Po.chapterUrlIncludes)) return;
                    if (siteRules.Po.chapterUrlExcludes && e.href.includes(siteRules.Po.chapterUrlExcludes)) return;
                    let a = "";
                    try {
                        a = siteRules.Po.chapterNameReg ? (e.outerHTML.match(siteRules.Po.chapterNameReg) || [])[1] : e.innerText, 
                        a = (0, downloadUtils.Sc)(a || "");
                    } catch (e) {
                        a = "";
                    }
                    let i = !1;
                    siteRules.Po.hasSpend && e.parentElement && (i = e.parentElement.outerHTML.indexOf(siteRules.Po.payKey) > 0), 
                    r.push({
                        comicName: (0, downloadUtils.Sc)(state.comicName),
                        chapterNumStr: "",
                        chapterName: a,
                        downChapterName: "",
                        url: e.href,
                        characterType: t,
                        readtype: siteRules.Po.readtype,
                        isPay: i,
                        isSelect: !1
                    });
                });
            });
        }
        function normalizeChapter(e) {
            return Object.assign({
                comicName: (0, downloadUtils.Sc)(state.comicName),
                chapterNumStr: "",
                chapterName: "",
                downChapterName: "",
                url: "",
                characterType: "one",
                readtype: siteRules.Po.readtype,
                isPay: !1,
                isUnavailable: !1,
                unavailableReason: "",
                isSelect: !1
            }, e);
        }
        function canSelectChapter(e) {
            return Boolean(e && e.url && "javascript:void();" !== e.url && !e.isUnavailable);
        }
        function handleChapterClick(event) {
            const row = event.target.closest("[data-index]");
            if (!row || !event.currentTarget.contains(row) || event.target.closest(".ten-chapter-name")) return;
            const index = Number(row.dataset.index);
            const chapter = state.chapters[index];
            if (!canSelectChapter(chapter)) return;
            const selected = !chapter.isSelect;
            if (event.shiftKey && state.lastSelected !== null && selected) {
                const first = Math.min(state.lastSelected, index);
                const last = Math.max(state.lastSelected, index);
                for (let cursor = first; cursor <= last; cursor++) {
                    if (canSelectChapter(state.chapters[cursor])) setChapterSelected(state.chapters[cursor], true);
                }
            } else setChapterSelected(chapter, selected);
            state.lastSelected = selected ? index : null;
            syncChapterControls(byId("ten-chapter-list"));
        }
        function handleChapterNameChange(event) {
            if (!event.target.matches(".ten-chapter-name")) return;
            const row = event.target.closest("[data-index]");
            const chapter = state.chapters[Number(row && row.dataset.index)];
            if (chapter) chapter.chapterName = event.target.value;
        }
        function syncChapterControls(list) {
            const hasChapters = state.chapters.length > 0;
            byId("ten-chapter-empty").hidden = hasChapters;
            byId("ten-chapter-loaded").hidden = !hasChapters;
            byId("ten-select-all").disabled = !list._tenSelectableCount;
            byId("ten-clear-select").disabled = !list._tenSelectedCount;
            byId("ten-download-selected").disabled = !list._tenSelectedCount;
            setText(byId("ten-chapter-count"), hasChapters ? `章节列表 · ${state.chapters.length}` : "章节列表");
            byId("ten-edit-list").classList.toggle("is-active", state.editMode);
        }
        function setChapterSelected(chapter, selected) {
            if (Boolean(chapter.isSelect) === selected) return;
            const list = byId("ten-chapter-list");
            chapter.isSelect = selected;
            if (canSelectChapter(chapter)) list._tenSelectedCount += selected ? 1 : -1;
            const row = list._tenRows?.get(chapter);
            if (row) {
                row._tenCheckbox.checked = selected;
                row.classList.toggle("is-selected", selected && canSelectChapter(chapter));
            }
        }
        async function renderChapters() {
            const list = byId("ten-chapter-list"), chapters = state.chapters.slice();
            const generation = list._tenRenderGeneration = (list._tenRenderGeneration || 0) + 1;
            const rows = list._tenRows || (list._tenRows = new Map), retained = new Set(chapters);
            list._tenSelectableCount = 0, list._tenSelectedCount = 0;
            for (const [chapter, row] of rows) if (!retained.has(chapter)) row.remove(), rows.delete(chapter);
            chapters.forEach((chapter, index) => {
                if (canSelectChapter(chapter)) list._tenSelectableCount++, chapter.isSelect && list._tenSelectedCount++;
                const row = rows.get(chapter);
                if (row) setAttribute(row, "data-index", index);
            });
            syncChapterControls(list);
            if (!list._tenEventsBound) {
                list.addEventListener("click", handleChapterClick);
                list.addEventListener("change", handleChapterNameChange);
                list._tenEventsBound = true;
            }
            setAttribute(list, "aria-busy", chapters.length >= 500 ? "true" : "false");
            let anchor = list.firstElementChild, sliceStarted = performance.now(), sliceRows = 0;
            for (let index = 0; index < chapters.length; index++) {
                const chapter = chapters[index];
                let row = rows.get(chapter);
                if (!row) {
                    row = document.createElement("div");
                    row.className = "ten-list-item";
                    row.innerHTML = '<input type="checkbox"><span class="ten-chapter-label"></span><span class="ten-meta"></span>';
                    row._tenCheckbox = row.firstElementChild;
                    row._tenLabel = row.children[1];
                    row._tenMeta = row.lastElementChild;
                }
                const disabled = !canSelectChapter(chapter);
                const name = showChapterName(chapter);
                setAttribute(row, "data-index", index);
                row.classList.toggle("is-disabled", disabled);
                row.classList.toggle("is-selected", Boolean(chapter.isSelect && !disabled));
                row._tenCheckbox.checked = Boolean(chapter.isSelect);
                row._tenCheckbox.disabled = disabled;
                setAttribute(row._tenCheckbox, "aria-label", chapter.isUnavailable ? chapter.unavailableReason || "当前账号未解锁" : `选择章节：${name}`);
                const editMode = Boolean(state.editMode);
                if (row._tenEditMode !== editMode) {
                    row._tenLabel.replaceChildren();
                    const label = document.createElement(editMode ? "input" : "span");
                    label.className = editMode ? "ten-input ten-chapter-name" : "ten-name";
                    if (editMode) label.setAttribute("aria-label", "章节名称");
                    row._tenLabel.appendChild(label);
                    row._tenName = label;
                    row._tenEditMode = editMode;
                }
                if (editMode) {
                    if (document.activeElement !== row._tenName && row._tenName.value !== chapter.chapterName) row._tenName.value = chapter.chapterName;
                } else setText(row._tenName, name);
                setAttribute(row._tenName, "title", name);
                setText(row._tenMeta, chapter.isUnavailable ? chapter.unavailableReason || "未解锁" : chapter.isPay ? "付费" : chapter.characterType === "many" ? "分卷" : "");
                rows.set(chapter, row);
                if (anchor !== row) list.insertBefore(row, anchor);
                anchor = row.nextElementSibling;
                sliceRows++;
                if (chapters.length >= 500 && index + 1 < chapters.length && (sliceRows >= 200 || sliceRows % 50 === 0 && performance.now() - sliceStarted >= 8)) {
                    await yieldToBrowser(0);
                    if (!list.isConnected || generation !== list._tenRenderGeneration) return;
                    sliceStarted = performance.now(), sliceRows = 0;
                }
            }
            setAttribute(list, "aria-busy", "false");
        }
        function reloadChapters() {
            if (state.chaptersLoading) return void (state.chaptersReloadRequested = !0);
            state.chapters = [], state.lastSelected = null, state.editMode = !1, byId("ten-edit-list").classList.remove("is-active"), 
            renderChapters(), detectComicInfo(), loadChapters();
        }
        function selectAllChapters(e) {
            state.chapters.forEach(t => {
                setChapterSelected(t, Boolean(e && canSelectChapter(t)));
            }), state.lastSelected = null, syncChapterControls(byId("ten-chapter-list"));
        }
        function reverseChapters() {
            state.chapters.reverse(), state.lastSelected = null, updateChapterSequence();
        }
        function toggleChapterEdit() {
            state.editMode = !state.editMode, byId("ten-edit-list").classList.toggle("is-active", state.editMode), 
            byId("ten-edit-list").title = state.editMode ? "完成编辑" : "编辑名称", renderChapters();
        }
        let taskRenderFrame = null;
        function scheduleTaskRender() {
            state.visible && "tasks" !== state.activeTab || taskRenderFrame || (taskRenderFrame = requestAnimationFrame(() => {
                taskRenderFrame = null, renderTasks();
            }));
        }
        function renderTasks() {
            if (!state.ready) return;
            const e = state.queue ? state.queue.worker.map((e, t) => e ? {
                item: e,
                index: t
            } : null).filter(Boolean) : [], t = state.queue ? state.queue.list.length : 0;
            syncMiniTaskBar(e, t);
            if (!state.visible || "tasks" !== state.activeTab) return;
            setText(byId("ten-active-count"), e.length), setText(byId("ten-waiting-count"), t), 
            function(e, t) {
                const n = byId("ten-toggle-all-active"), r = e.map(e => e.item).filter(e => !e.cancelled && "cancelling" !== e.status), a = r.length > 0 && r.every(e => e.paused || "paused" === e.status);
                n.hidden = 0 === r.length, byId("ten-cancel-all-active").hidden = 0 === r.length;
                const i = a ? "resume" : "pause";
                n.dataset.bulkAction !== i && (n.dataset.bulkAction = i), setText(n, a ? "全部继续" : "全部暂停"), 
                byId("ten-remove-all-waiting").hidden = 0 === t;
            }(e, t), function(e) {
                const t = byId("ten-active-tasks");
                if (!e.length) return void renderStaticTaskList("ten-active-tasks", [], empty("当前没有下载任务"));
                delete t.dataset.renderKey;
                const n = new Set(e.map(e => String(e.index)));
                all("[data-worker-card]", t).forEach(e => {
                    n.has(e.dataset.workerCard) || e.remove();
                }), one(".ten-empty", t)?.remove(), e.forEach(({item: e, index: n}, r) => {
                    let a = one(`[data-worker-card="${n}"]`, t);
                    if (!a || a._tenTask !== e) {
                        const r = document.createElement("template");
                        r.innerHTML = taskCard(e, "active", n);
                        const i = r.content.firstElementChild;
                        a ? a.replaceWith(i) : t.appendChild(i), a = i, a._tenTask = e, a._tenNodes = taskCardNodes(a);
                    }
                    !function(e, t) {
                        const n = e._tenNodes || (e._tenNodes = taskCardNodes(e)), r = Math.max(0, Math.min(100, Number(t.progress || 0)));
                        setText(n.title, t.downChapterName || t.chapterName || "未命名章节");
                        const a = n.progress;
                        setStyle(a, "width", `${r}%`), setStyle(a, "--ten-energy-duration", `${energyFlowDuration(t.speedBps)}s`), 
                        a.classList.toggle("is-paused", Boolean(t.paused)), setText(n.stage, t.stage || "正在下载"), 
                        setText(n.stats, `${t.processedNum ?? t.successNum ?? 0}/${t.totalNumber || "?"} · ${r}%`), 
                        setText(n.results, formatTaskCounts(t)), setText(n.speed, t.paused ? "已暂停" : formatSpeed(t.speedBps)), 
                        setText(n.eta, t.paused ? "剩余 --" : formatEta(t.etaSeconds));
                        const i = t.status || (t.paused ? "paused" : "running"), o = e.dataset.taskStatus;
                        !o || o === i || "paused" !== i && "running" !== i || playStateAnimation(e, "paused" === i ? "pause" : "resume"), 
                        e.dataset.taskStatus !== i && (e.dataset.taskStatus = i);
                        const s = n.toggle, c = "paused" === t.status, d = c ? "resume" : "pause";
                        s.dataset.taskAction !== d && (s.dataset.taskAction = d, s.title = c ? "继续" : "暂停", 
                        s.innerHTML = icon(c ? "play" : "pause"));
                    }(a, e);
                    const i = t.children[r];
                    i !== a && t.insertBefore(a, i || null);
                });
            }(e), renderWaitingTasks(state.queue), function() {
                const e = readHistory(), t = `${state.historyFilter}|${state.historyRaw}`;
                if (t === state.historyRenderKey) return;
                state.historyRenderKey = t;
                const n = function(e) {
                    return "completed" === state.historyFilter ? e.filter(e => "completed" === e.status || !e.status && !e.hasError) : "failed" === state.historyFilter ? e.filter(e => "failed" === e.status || "partial" === e.status || e.hasError) : "cancelled" === state.historyFilter ? e.filter(e => "cancelled" === e.status) : e;
                }(e);
                setText(byId("ten-history-count"), e.length), renderHistoryRows(n, e.length), all("[data-history-filter]").forEach(e => {
                    const t = e.dataset.historyFilter === state.historyFilter;
                    e.classList.toggle("is-active", t), setAttribute(e, "aria-pressed", String(t));
                }), function(e) {
                    const t = e[0], n = t && Number(t.id) || 0;
                    if (null !== state.lastHistoryId) {
                        if (n > state.lastHistoryId && "cancelled" !== t.status) {
                            const e = "completed" === t.status || !t.status && !t.hasError;
                            playStateAnimation(one('[data-task-group="history"]'), e ? "success" : "danger");
                        }
                        state.lastHistoryId = n;
                    } else state.lastHistoryId = n;
                }(e);
            }(), syncTaskGroup("active", e.length), syncTaskGroup("waiting", t);
        }
        function syncMiniTaskBar(e, t) {
            if (!state.ready && !byId("ten-mini-task")) return;
            const n = (state.miniNodes?.root?.isConnected || (state.miniNodes = {
                root: byId("ten-mini-task"),
                launcher: byId(LAUNCHER_ID),
                title: byId("ten-mini-title"),
                meta: byId("ten-mini-meta"),
                progress: byId("ten-mini-progress"),
                toggle: byId("ten-mini-toggle")
            }), state.miniNodes), r = Array.isArray(e) ? e.map(e => e.item) : state.queue ? state.queue.worker.filter(Boolean) : [], a = r.filter(e => !e.cancelled && "cancelling" !== e.status), i = Number.isFinite(t) ? t : state.queue ? state.queue.list.length : 0, o = n.root, s = Boolean((r.length || i) && !state.visible && !state.rulePicking);
            if (o.classList.toggle("is-hidden", !s), o.setAttribute("aria-hidden", String(!s)), 
            s ? n.launcher.classList.add("is-hidden") : n.launcher.classList.toggle("is-hidden", state.visible || !state.launcherVisible), 
            !s) return;
            const c = a.length > 0 && a.every(e => e.paused || "paused" === e.status), d = a.reduce((e, t) => e + (Number(t.speedBps) || 0), 0), u = a.reduce((e, t) => Math.max(e, Number(t.etaSeconds) || 0), 0), p = r.filter(e => Number(e.totalNumber) > 0), h = p.length ? p.reduce((e, t) => e + Math.min(Number(t.successNum) || 0, Number(t.totalNumber)), 0) / p.reduce((e, t) => e + Number(t.totalNumber), 0) * 100 : r.length ? r.reduce((e, t) => e + (Number(t.progress) || 0), 0) / r.length : 0;
            setText(n.title, r.length ? c ? `${r.length} 个章节已暂停` : `${r.length} 个章节下载中` : `${i} 个章节等待`), 
            setText(n.meta, r.length ? c ? (i ? `${i} 个等待 · ` : "") + "点击继续" : `${formatSpeed(d)} · ${formatEta(u)}` : "打开任务页查看队列"), 
            setStyle(n.progress, "width", `${Math.max(0, Math.min(100, h))}%`);
            const m = n.toggle;
            m.hidden = 0 === a.length;
            const g = c ? "resume" : "pause", f = c ? "全部继续" : "全部暂停";
            setAttribute(m, "aria-label", f), m.dataset.action !== g && (m.dataset.action = g, 
            m.title = f, m.innerHTML = icon(c ? "play" : "pause"));
        }
        function toggleMiniTasks() {
            if (!state.queue) return;
            const e = state.queue.worker.filter(e => e && !e.cancelled && "cancelling" !== e.status);
            if (!e.length) return;
            const t = e.every(e => e.paused || "paused" === e.status), n = state.queue.setAllPaused(!t);
            n && toast(t ? `已继续 ${n} 个任务` : `已暂停 ${n} 个任务`), renderTasks();
        }
        function iconTipButton(e) {
            return e instanceof Element ? e.closest(".ten-icon-btn, .ten-task-arrow-button, .ten-mini-toggle, .ten-number-steps button") : null;
        }
        function scheduleIconTooltip(e) {
            const t = iconTipButton(e.target);
            t && t !== state.iconTipTarget && (clearTimeout(state.iconTipTimer), state.iconTipTimer = setTimeout(() => showIconTooltip({
                target: t
            }), 320));
        }
        function showIconTooltip(e) {
            const t = iconTipButton(e.target);
            if (!t) return;
            const n = t.getAttribute("title");
            n && (t.dataset.tenTip = n, t.removeAttribute("title"));
            const r = t.dataset.tenTip || t.getAttribute("aria-label");
            if (!r) return;
            clearTimeout(state.iconTipTimer), hideIconTooltip(), state.iconTipTarget = t, t.setAttribute("aria-describedby", "ten-icon-tooltip");
            const a = byId("ten-icon-tooltip");
            a.textContent = r, a.classList.add("is-show"), a.setAttribute("aria-hidden", "false"), 
            requestAnimationFrame(() => function(e, t) {
                if (e !== state.iconTipTarget || !e.isConnected) return;
                const n = e.getBoundingClientRect(), r = t.getBoundingClientRect(), a = Math.max(8, Math.min(window.innerWidth - r.width - 8, n.left + n.width / 2 - r.width / 2)), i = n.top - r.height - 8;
                t.style.left = `${a}px`, t.style.top = `${i >= 8 ? i : n.bottom + 8}px`;
            }(t, a));
        }
        function handleIconTooltipLeave(e) {
            const t = iconTipButton(e.target);
            t && e.relatedTarget instanceof Node && t.contains(e.relatedTarget) || (clearTimeout(state.iconTipTimer), 
            state.iconTipTimer = null, t && t !== state.iconTipTarget || hideIconTooltip());
        }
        function hideIconTooltip() {
            clearTimeout(state.iconTipTimer), state.iconTipTimer = null, state.iconTipTarget && state.iconTipTarget.removeAttribute("aria-describedby"), 
            state.iconTipTarget = null;
            const e = byId("ten-icon-tooltip");
            e && (e.classList.remove("is-show"), e.setAttribute("aria-hidden", "true"));
        }
        function toggleTaskGroup(e) {
            const t = e.closest(".ten-task-group");
            if (!t) return;
            const n = t.classList.toggle("is-open");
            one(".ten-task-title-button", t)?.setAttribute("aria-expanded", String(n)), one(".ten-task-arrow-button", t)?.setAttribute("aria-expanded", String(n));
        }
        function renderStaticTaskList(e, t, n) {
            const r = byId(e), a = JSON.stringify(t);
            r.dataset.renderKey !== a && (r.innerHTML = "function" == typeof n ? n() : n, r.dataset.renderKey = a);
        }
        const waitingTaskIds = new WeakMap;
        let waitingTaskSequence = 0;
        function renderTaskRows(id, entries, emptyMarkup) {
            const list = byId(id), previous = list._tenKeyedRows || new Map, current = new Map;
            if (!entries.length) {
                if (list._tenEmptyMarkup !== emptyMarkup || previous.size) list.innerHTML = emptyMarkup;
                list._tenEmptyMarkup = emptyMarkup, list._tenKeyedRows = current;
                return;
            }
            one(".ten-empty", list)?.remove(), delete list._tenEmptyMarkup;
            let anchor = list.firstElementChild;
            for (const entry of entries) {
                let row = previous.get(entry.key);
                if (!row || row.signature !== entry.signature) {
                    const template = document.createElement("template");
                    template.innerHTML = entry.render();
                    const node = template.content.firstElementChild;
                    if (row) {
                        if (anchor === row.node) anchor = node;
                        row.node.replaceWith(node);
                    }
                    row = {
                        node: node,
                        signature: entry.signature
                    };
                }
                if (anchor !== row.node) list.insertBefore(row.node, anchor);
                anchor = row.node.nextElementSibling;
                current.set(entry.key, row);
            }
            for (const [key, row] of previous) if (!current.has(key)) row.node.remove();
            list._tenKeyedRows = current;
        }
        function renderWaitingTasks(queue) {
            const list = byId("ten-waiting-tasks"), count = queue ? queue.list.length : 0, revision = queue ? queue.waitingRevision || 0 : 0;
            if (list._tenWaitingQueue === queue && list._tenWaitingRevision === revision && list._tenWaitingCount === count) return;
            const entries = [];
            for (let index = count - 1; index >= 0; index--) {
                const task = queue.list[index], position = count - 1 - index;
                if (!waitingTaskIds.has(task)) waitingTaskIds.set(task, ++waitingTaskSequence);
                entries.push({
                    key: waitingTaskIds.get(task),
                    signature: JSON.stringify([ index, position === 0, position === count - 1, task.url, task.comicName, task.downChapterName, task.chapterName ]),
                    render: () => taskCard(task, "waiting", index, position, count)
                });
            }
            renderTaskRows("ten-waiting-tasks", entries, empty("等待队列为空"));
            list._tenWaitingQueue = queue, list._tenWaitingRevision = revision, list._tenWaitingCount = count;
        }
        function renderHistoryRows(records, total) {
            const entries = [], occurrences = new Map;
            for (const record of records) {
                const base = JSON.stringify([ record.id, record.comicName, record.downChapterName ]), occurrence = occurrences.get(base) || 0;
                occurrences.set(base, occurrence + 1);
                entries.push({
                    key: base + "|" + occurrence,
                    signature: JSON.stringify([ record.id, record.downChapterName, record.status, record.hasError, record.flowUsed, record.durationMs, record.totalDurationMs, record.pausedDurationMs, record.completedAt, record.processedNum, record.successNum, record.failedNum, record.writtenNum, Array.isArray(record.failedImages) ? record.failedImages.filter(image => image && image.url).length : 0 ]),
                    render: () => historyCard(record)
                });
            }
            renderTaskRows("ten-history", entries, empty(total ? "没有符合筛选条件的记录" : "暂无下载记录"));
        }
        function taskCardNodes(e) {
            return {
                title: one("[data-task-title]", e),
                results: one("[data-task-results]", e),
                progress: one("[data-task-progress]", e),
                stage: one("[data-task-stage]", e),
                stats: one("[data-task-stats]", e),
                speed: one("[data-task-speed]", e),
                eta: one("[data-task-eta]", e),
                toggle: one("[data-task-toggle]", e)
            };
        }
        function playStateAnimation(e, t) {
            e && 0 !== state.settings.effectLevel && (clearTimeout(e._tenStateTimer), e.classList.remove("ten-state-animate", "is-state-pause", "is-state-resume", "is-state-success", "is-state-danger"), 
            e.offsetWidth, e.classList.add("ten-state-animate", `is-state-${t}`), e._tenStateTimer = setTimeout(() => {
                e.classList.remove("ten-state-animate", `is-state-${t}`);
            }, 2 === state.settings.effectLevel ? 800 : 1e3));
        }
        function formatSpeed(e) {
            const t = Number(e) || 0;
            return t <= 0 ? "速度计算中" : t < 1024 ? `${Math.round(t)} B/s` : t < 1048576 ? `${(t / 1024).toFixed(1)} KB/s` : `${(t / 1024 / 1024).toFixed(1)} MB/s`;
        }
        function formatTaskCounts(task) {
            if (task.processedNum === undefined) return "";
            return `成功取图 ${task.successNum || 0} · 失败 ${task.failedNum || 0} · 已保存 ${task.writtenNum || 0} 页`;
        }
        function energyFlowDuration(e) {
            const t = Math.max(0, Number(e) || 0), n = Math.log2(1 + t / 32768);
            let r = Math.max(1.6, Math.min(6.6, 6.6 - .75 * n));
            return 1 === state.settings.effectLevel && (r *= 1.2), r.toFixed(2);
        }
        function formatDurationValue(e) {
            const t = Number(e);
            if (!Number.isFinite(t) || t < 0) return "";
            const n = Math.max(0, Math.round(t / 1e3));
            return n < 60 ? `${n}秒` : n < 3600 ? `${Math.floor(n / 60)}分${n % 60}秒` : `${Math.floor(n / 3600)}时${Math.floor(n % 3600 / 60)}分`;
        }
        function formatCompletedAt(e) {
            if (!e) return "";
            const t = new Date(e);
            return Number.isNaN(t.getTime()) ? "" : `完成 ${t.toLocaleString()}`;
        }
        function formatHistoryTiming(e) {
            const t = [ formatTaskDuration(e.durationMs) ], n = formatDurationValue(e.totalDurationMs), r = formatDurationValue(e.pausedDurationMs), a = formatCompletedAt(e.completedAt);
            return n && t.push(`总历时 ${n}`), Number.isFinite(Number(e.pausedDurationMs)) && r && t.push(`暂停 ${r}`), 
            a && t.push(a), t.join(" · ");
        }
        function formatTaskDuration(e) {
            const t = formatDurationValue(e);
            return t ? `用时 ${t}` : "用时未记录";
        }
        function formatEta(e) {
            if (!Number.isFinite(e)) return "剩余时间估算中";
            const t = Math.max(0, Math.round(e));
            return t <= 1 ? "即将完成" : t < 60 ? `剩余 ${t} 秒` : t < 3600 ? `剩余 ${Math.floor(t / 60)}分${t % 60}秒` : `剩余 ${Math.floor(t / 3600)}时${Math.ceil(t % 3600 / 60)}分`;
        }
        function syncTaskGroup(e, t) {
            const n = one(`[data-task-group="${e}"]`);
            if (!n) return;
            n.classList.toggle("has-scroll", t > 5), t > 0 && "true" !== n.dataset.seen && (n.dataset.seen = "true", 
            n.classList.add("is-open")), 0 === t && (delete n.dataset.seen, "waiting" !== e && n.classList.remove("is-open"));
            const r = String(n.classList.contains("is-open"));
            setAttribute(one(".ten-task-title-button", n), "aria-expanded", r), setAttribute(one(".ten-task-arrow-button", n), "aria-expanded", r);
        }
        function toggleAllActiveTasks(e) {
            if (!state.queue) return;
            const t = "resume" !== e.currentTarget.dataset.bulkAction, n = state.queue.setAllPaused(t);
            n && toast(t ? `已暂停 ${n} 个任务` : `已继续 ${n} 个任务`), renderTasks();
        }
        async function cancelAllActiveTasks() {
            if (!state.queue) return;
            const e = state.queue.worker.filter(e => e && !e.cancelled).length;
            if (!e || !await showConfirm("取消全部下载任务", `确认取消当前正在进行的 ${e} 个任务？`, "全部取消")) return;
            const t = state.queue.cancelAll();
            renderTasks(), t && toast(`正在取消 ${t} 个任务`);
        }
        async function removeAllWaitingTasks() {
            if (!state.queue || !state.queue.list.length) return;
            const e = state.queue.list.length;
            if (!await showConfirm("移出全部等待任务", `确认将等待队列中的 ${e} 个任务全部移出？`, "全部移出")) return;
            const t = state.queue.list.slice(), n = state.queue.clearWaiting();
            renderTasks(), n && toast(`已移出 ${n} 个等待任务`, () => restoreWaitingTasks(t));
        }
        function restoreWaitingTasks(e) {
            state.queue && e.length && (state.queue.list.push(...e), state.queue.waitingRevision = (state.queue.waitingRevision || 0) + 1, 
            state.queue.run(), renderTasks());
        }
        function taskCard(e, t, n, r = 0, a = 0) {
            const i = Math.max(0, Math.min(100, Number(e.progress || 0))), o = "active" === t, s = "paused" === e.status, c = o ? `<div class="ten-task-actions"><button class="ten-icon-btn" type="button" data-task-toggle data-task-action="${s ? "resume" : "pause"}" data-worker-index="${n}" title="${s ? "继续" : "暂停"}">${icon(s ? "play" : "pause")}</button><button class="ten-icon-btn" type="button" data-task-action="diagnostic" data-worker-index="${n}" title="诊断信息">${icon("info")}</button><button class="ten-icon-btn is-danger" type="button" data-task-action="cancel" data-worker-index="${n}" title="取消任务">${icon("close")}</button></div>` : `<div class="ten-task-actions"><button class="ten-icon-btn" type="button" data-task-action="waiting-up" data-waiting-index="${n}" title="提前一个位置" ${0 === r ? "disabled" : ""}>${icon("up")}</button><button class="ten-icon-btn" type="button" data-task-action="waiting-down" data-waiting-index="${n}" title="延后一个位置" ${r === a - 1 ? "disabled" : ""}>${icon("down")}</button><button class="ten-icon-btn is-danger" type="button" data-task-action="cancel-waiting" data-waiting-index="${n}" title="移出队列">${icon("close")}</button></div>`;
            return `<div class="ten-list-item ten-task-card"${o ? ` data-worker-card="${n}"` : ""}><div class="ten-name"><div class="ten-task-title"${o ? " data-task-title" : ""}>${escapeHtml(e.downChapterName || e.chapterName || "未命名章节")}</div>${o ? `<div class="ten-progress"><i data-task-progress${e.paused ? ' class="is-paused"' : ""} style="width:${i}%;--ten-energy-duration:${energyFlowDuration(e.speedBps)}s"></i></div><div class="ten-task-meta"><span data-task-stage>${escapeHtml(e.stage || "正在下载")}</span><span data-task-stats>${e.processedNum ?? e.successNum ?? 0}/${e.totalNumber || "?"} · ${i}%</span></div><div class="ten-task-performance"><span data-task-speed>${formatSpeed(e.speedBps)}</span><span data-task-eta>${formatEta(e.etaSeconds)}</span></div><div class="ten-meta" data-task-results>${formatTaskCounts(e)}</div>` : '<div class="ten-meta">等待开始</div>'}</div>${c}</div>`;
        }
        function historyCard(e) {
            const t = {
                completed: "已完成",
                partial: "部分失败",
                failed: "失败",
                cancelled: "已取消"
            }[e.status] || (e.hasError ? "存在错误" : "已完成"), n = Array.isArray(e.failedImages) ? e.failedImages.filter(e => e && e.url) : [];
            return `<div class="ten-list-item ten-history-card"><div class="ten-name"><div class="ten-task-title">${escapeHtml(e.downChapterName || "未命名章节")}</div><div class="ten-task-meta"><span>${formatHistoryTiming(e)}</span><span>${escapeHtml(e.flowUsed || "流程未记录")}</span><span class="ten-task-state is-${escapeAttr(e.status || (e.hasError ? "failed" : "completed"))}">${t}</span></div>${e.processedNum !== undefined ? `<div class="ten-meta">${formatTaskCounts(e)}</div>` : ""}</div><div class="ten-task-actions">${n.length ? `<button class="ten-icon-btn" type="button" data-retry-history="${e.id}" title="仅重试 ${n.length} 张失败图片">${icon("refresh")}</button><button class="ten-icon-btn" type="button" data-copy-failures="${e.id}" title="复制失败清单">${icon("copy")}</button>` : ""}<button class="ten-icon-btn" type="button" data-diagnostic-history="${e.id}" title="诊断信息">${icon("info")}</button><button class="ten-icon-btn" type="button" data-delete-history="${e.id}" title="删除记录">${icon("trash")}</button></div></div>`;
        }
        function handleHistoryFilter(e) {
            const t = e.target.closest("[data-history-filter]");
            t && t.dataset.historyFilter !== state.historyFilter && (state.historyFilter = t.dataset.historyFilter, 
            renderTasks());
        }
        async function handleTaskAction(e) {
            const t = e.target.closest("[data-task-action]");
            if (!t || !state.queue) return;
            const n = t.dataset.taskAction;
            if ("waiting-up" === n || "waiting-down" === n) return state.queue.moveWaiting(Number(t.dataset.waitingIndex), "waiting-up" === n ? "up" : "down"), 
            renderTasks();
            if ("cancel-waiting" === n) {
                const e = Number(t.dataset.waitingIndex), n = state.queue.list[e];
                return state.queue.cancelWaiting(e) && toast("任务已移出等待队列", () => restoreWaitingTasks([ n ])), 
                renderTasks();
            }
            const r = Number(t.dataset.workerIndex), a = state.queue.worker[r];
            a && ("pause" === n && state.queue.pause(r), "resume" === n && state.queue.resume(r), 
            "diagnostic" === n && openDiagnostic(a), "cancel" === n && await showConfirm("取消下载任务", `确认取消“${a.comicName} · ${a.downChapterName}”？`, "取消任务") && state.queue.cancel(r), 
            renderTasks());
        }
        function readHistory() {
            let e;
            const fallback = state.queue?.historyFallback || state.historyVolatile;
            try {
                e = fallback ? JSON.stringify(fallback) : localStorage.getItem("ylComicDownHistory") || "[]";
            } catch (error) {
                reportTaskStorageError(error);
                return state.historyCache;
            }
            if (e === state.historyRaw) return state.historyCache;
            try {
                const t = JSON.parse(e);
                if (!Array.isArray(t)) return writeHistory([]);
                let n = !1;
                const r = 100 * Date.now();
                t.forEach((e, t) => {
                    e && void 0 === e.id && (e.id = r - t, n = !0);
                });
                const a = new Set, i = t.filter(e => {
                    const t = DownloadQueue.historyKey(e);
                    return !a.has(t) && (a.add(t), !0);
                }).slice(0, state.settings ? state.settings.historyLimit : boundedNumber(safeGet("historyLimit", 100), 100, 10, 500)), o = n || i.length !== t.length ? JSON.stringify(i) : e;
                if (o !== e && !fallback) try {
                    localStorage.setItem("ylComicDownHistory", o);
                } catch (error) {
                    state.historyVolatile = i;
                    reportTaskStorageError(error);
                }
                return state.historyRaw = o, state.historyCache = i, i;
            } catch (t) {
                return state.historyRaw = e, state.historyCache = [], state.historyCache;
            }
        }
        function writeHistory(e) {
            const t = Array.isArray(e) ? e : [], n = JSON.stringify(t);
            try {
                localStorage.setItem("ylComicDownHistory", n);
                state.historyVolatile = null;
                if (state.queue) state.queue.historyFallback = null;
            } catch (error) {
                if (state.queue) state.queue.historyFallback = t, state.historyVolatile = null; else state.historyVolatile = t;
                reportTaskStorageError(error);
            }
            return state.historyRaw = n, state.historyCache = t, state.historyRenderKey = "", 
            t;
        }
        async function handleHistoryClick(e) {
            const t = e.target.closest("[data-diagnostic-history]"), n = e.target.closest("[data-retry-history]"), r = e.target.closest("[data-copy-failures]"), a = e.target.closest("[data-delete-history]"), i = readHistory();
            if (t) return openDiagnostic(i.find(e => String(e.id) === t.dataset.diagnosticHistory));
            if (n) return function(e) {
                const t = Array.isArray(e && e.failedImages) ? e.failedImages.filter(e => e && e.url) : [];
                if (!t.length) return toast("没有可重试的失败图片");
                const n = e.task && "object" == typeof e.task ? e.task : {};
                enqueueDownloads([ {
                    ...n,
                    comicName: e.comicName,
                    chapterName: e.downChapterName,
                    downChapterName: e.downChapterName,
                    url: n.url || e.comicPageUrl,
                    readtype: void 0 === n.readtype ? 1 : n.readtype,
                    downType: 0,
                    retryImages: t
                } ]), toast(`已加入 ${t.length} 张失败图片`);
            }(i.find(e => String(e.id) === n.dataset.retryHistory));
            if (r) return copyFailureList(i.find(e => String(e.id) === r.dataset.copyFailures));
            if (!a) return;
            const o = i.findIndex(e => String(e.id) === a.dataset.deleteHistory), s = i[o];
            s && await showConfirm("删除下载记录", `确认删除“${s.comicName || "未命名漫画"} · ${s.downChapterName || "未命名章节"}”？`, "删除") && (i.splice(o, 1), 
            writeHistory(i), renderTasks(), toast("下载记录已删除", () => function(e, t) {
                if (!e) return;
                const n = readHistory().slice();
                n.some(t => String(t.id) === String(e.id)) || (n.splice(Math.max(0, Math.min(t, n.length)), 0, e), 
                writeHistory(n), renderTasks());
            }(s, o)));
        }
        function trimHistory() {
            writeHistory(readHistory().slice(0, state.settings.historyLimit)), renderTasks();
        }
        async function clearHistory() {
            const e = readHistory();
            if (!e.length) return toast("当前没有下载记录");
            await showConfirm("清空下载记录", `将删除全部 ${e.length} 条下载记录，此操作无法撤销。`, "全部清空") && (writeHistory([]), 
            renderTasks(), toast("下载记录已清空"));
        }
        const RULE_PICK_CONFIG = {
            title: {
                field: "ten-rule-title-selector",
                label: "漫画标题",
                role: "title"
            },
            chapters: {
                field: "ten-rule-chapter-selector",
                label: "章节列表",
                role: "chapters"
            },
            images: {
                field: "ten-rule-image-selector",
                label: "章节图片",
                role: "images"
            }
        }, RULE_TEMPLATES = {
            basic: {
                name: "基础卷轴",
                imageCss: ".reader img, .viewer img, .comic-content img",
                readtype: 1,
                useFrame: !1
            },
            lazy: {
                name: "懒加载阅读",
                imageCss: "img[data-src], img[data-original], img[data-url], img[data-lazy-src]",
                readtype: 1,
                useFrame: !1
            },
            frame: {
                name: "隐藏页面",
                imageCss: ".reader img, .viewer img, .comic-content img",
                readtype: 1,
                useFrame: !0
            },
            paged: {
                name: "翻页阅读",
                imageCss: "",
                readtype: 0,
                useFrame: !1
            }
        };
        function handleRulePickMove(e) {
            if (!state.rulePicking || byId(ROOT_ID).contains(e.target)) return;
            const t = normalizeRulePickTarget(e.target, state.rulePicking.role);
            t && t !== state.rulePickElement && (state.rulePickElement = t, cancelAnimationFrame(state.rulePickFrame), 
            state.rulePickFrame = requestAnimationFrame(refreshRulePickBox));
        }
        function refreshRulePickBox() {
            if (!state.rulePicking || !state.rulePickElement?.isConnected) return;
            const e = state.rulePickElement.getBoundingClientRect();
            byId("ten-rule-pick-box").style.cssText = `left:${e.left}px;top:${e.top}px;width:${e.width}px;height:${e.height}px`, 
            byId("ten-rule-pick-selector").textContent = buildRuleSelector(state.rulePickElement, state.rulePicking.role) || "无法生成选择器，请选择其他元素";
        }
        function handleRulePickClick(e) {
            if (!state.rulePicking || byId(ROOT_ID).contains(e.target)) return;
            e.preventDefault(), e.stopImmediatePropagation();
            const t = buildRuleSelector(normalizeRulePickTarget(e.target, state.rulePicking.role), state.rulePicking.role);
            if (!t) return;
            const n = state.rulePicking;
            finishRulePicking();
            const r = byId(n.field);
            r.value = t, r.dispatchEvent(new Event("input", {
                bubbles: !0
            })), byId("ten-rule-editor-card").scrollIntoView({
                behavior: "smooth",
                block: "start"
            }), setTimeout(() => r.focus(), 260), toast(`已选择${n.label}：${t}`);
        }
        function handleRulePickKey(e) {
            "Escape" === e.key && (e.preventDefault(), e.stopImmediatePropagation(), cancelRulePicking());
        }
        function cancelRulePicking() {
            state.rulePicking && (finishRulePicking(), toast("已取消可视化选择"));
        }
        function finishRulePicking() {
            cancelAnimationFrame(state.rulePickFrame), state.rulePickFrame = null, state.rulePicking = null, 
            state.rulePickElement = null, document.removeEventListener("pointermove", handleRulePickMove, !0), 
            document.removeEventListener("click", handleRulePickClick, !0), document.removeEventListener("keydown", handleRulePickKey, !0), 
            window.removeEventListener("scroll", refreshRulePickBox, !0), window.removeEventListener("resize", refreshRulePickBox, !0), 
            byId(ROOT_ID).classList.remove("is-rule-picking"), document.documentElement.classList.remove("ten-rule-picking-page");
            const e = byId("ten-rule-pick-layer");
            e.classList.add("is-hidden"), e.setAttribute("aria-hidden", "true"), byId("ten-rule-pick-box").removeAttribute("style"), 
            syncMiniTaskBar();
        }
        function normalizeRulePickTarget(e, t) {
            if (!(e instanceof Element)) return null;
            if ("images" === t) return e.closest("img") || e.querySelector("img") || e;
            if ("chapters" !== t) return e;
            let n = e.closest("a") || e;
            n.matches("a") && (n = n.parentElement);
            for (let e = 0; n && e < 5; e++, n = n.parentElement) if (n.querySelectorAll("a[href]").length > 1) return n;
            return e;
        }
        function buildRuleSelector(e, t) {
            if (!e) return "";
            if ("images" === t && e.matches("img")) {
                let container = e.parentElement;
                for (let depth = 0; container && depth < 5 && !container.matches("body,html"); depth++, 
                container = container.parentElement) {
                    if (container.querySelectorAll("img").length < 2) continue;
                    const scope = uniqueRuleSelector(container);
                    if (scope) return `${scope} img`;
                }
                const t = stableRuleClasses(e);
                for (const e of t) {
                    const t = `img.${escapeCss(e)}`;
                    if (selectorCount(t) > 1) return t;
                }
                let n = e.parentElement;
                for (let e = 0; n && e < 5; e++, n = n.parentElement) {
                    if (n.querySelectorAll("img").length < 2) continue;
                    const e = uniqueRuleSelector(n);
                    if (e) return `${e} img`;
                }
            }
            return uniqueRuleSelector(e);
        }
        function uniqueRuleSelector(e) {
            if (!e || !e.tagName) return "";
            if (e.id) {
                const t = `#${escapeCss(e.id)}`;
                if (!/\d{4,}/.test(e.id) && 1 === selectorCount(t)) return t;
            }
            for (const attribute of [ "data-testid", "data-role", "itemprop", "role" ]) {
                const value = e.getAttribute(attribute);
                if (!value || value.length > 64 || /\d{4,}/.test(value)) continue;
                const selector = e.tagName.toLowerCase() + `[${attribute}=${JSON.stringify(value)}]`;
                if (selectorCount(selector) === 1) return selector;
            }
            const t = e.tagName.toLowerCase(), n = stableRuleClasses(e);
            for (let e = 1; e <= Math.min(2, n.length); e++) {
                const r = t + n.slice(0, e).map(e => `.${escapeCss(e)}`).join("");
                if (1 === selectorCount(r)) return r;
            }
            const r = [];
            let a = e;
            for (let e = 0; a && a !== document.documentElement && e < 6; e++, a = a.parentElement) {
                let e = a.tagName.toLowerCase();
                const t = stableRuleClasses(a);
                t.length && (e += `.${escapeCss(t[0])}`);
                const n = a.parentElement ? Array.from(a.parentElement.children).filter(e => e.tagName === a.tagName) : [];
                n.length > 1 && (e += `:nth-of-type(${n.indexOf(a) + 1})`), r.unshift(e);
                const i = r.join(" > ");
                if (1 === selectorCount(i)) return i;
            }
            return r.join(" > ");
        }
        function stableRuleClasses(e) {
            return Array.from(e.classList || []).filter(e => e.length <= 36 && !/\d{4,}|(^|[-_])(active|selected|current|hover|focus|open|loading|show|hide)([-_]|$)/i.test(e)).slice(0, 3);
        }
        function selectorCount(e) {
            try {
                return [ ...document.querySelectorAll(e) ].filter(node => !node.closest("#ten-comic-root")).length;
            } catch (e) {
                return 0;
            }
        }
        function escapeCss(e) {
            return window.CSS && "function" == typeof window.CSS.escape ? window.CSS.escape(String(e)) : String(e).replace(/[^a-zA-Z0-9_-]/g, e => `\\${e}`);
        }
        function setRuleReadType(e) {
            state.ruleReadType = 0 === Number(e) ? 0 : 1;
            const t = one(".ten-rule-readtype");
            t && t.style.setProperty("--rule-type", 1 === state.ruleReadType ? 0 : 1), all("[data-rule-readtype]").forEach(e => e.classList.toggle("is-active", Number(e.dataset.ruleReadtype) === state.ruleReadType));
        }
        const RULE_FORM_IDS = {
            webName: "ten-rule-name",
            domain: "ten-rule-domain",
            homepage: "ten-rule-homepage",
            webDesc: "ten-rule-desc",
            comicNameCss: "ten-rule-title-selector",
            chapterCss: "ten-rule-chapter-selector",
            imageCss: "ten-rule-image-selector",
            getImgs: "ten-rule-getimgs",
            readySelector: "ten-rule-ready-selector",
            waitTimeoutMs: "ten-rule-wait-seconds",
            imageAttributes: "ten-rule-image-attributes",
            imageExcludeCss: "ten-rule-image-exclude",
            chapterUrlIncludes: "ten-rule-chapter-include",
            chapterUrlExcludes: "ten-rule-chapter-exclude"
        };
        function renderCustomRuleEditorAndBackup() {
            return `<details id="ten-rule-editor-card" class="ten-card ten-settings-card ten-settings-disclosure"><summary class="ten-settings-summary">自定义规则</summary><div \
class="ten-settings-disclosure-body">\n      <div class="ten-card-head"><span class="ten-meta">站点解析与规则导入</span><button id="ten-rule-guide-open" \
class="ten-rule-guide-open" type="button" aria-label="自定义站点设置方法">${icon("guide")}<span>方法</span></button></div>\n      <div class="ten-rule-intro"><strong>简单填写</strong><span>填写基本信息、选择页面元素，再检查和预览；复杂函数仍可使用。</span></div>\n      <div \
id="ten-rule-match-status" class="ten-rule-note" role="status"></div>\n      <div class="ten-rule-toolbar"><button id="ten-rule-new" class="ten-btn is-small" \
type="button">新建规则</button><button id="ten-rule-template-undo" class="ten-btn is-small" type="button" disabled>撤销模板</button></div>\n      <div \
id="ten-rule-draft-status" class="ten-meta" role="status">尚未编辑</div>\n      <div class="ten-rule-toolbar"><select id="ten-rule-drafts" class="ten-input" \
aria-label="已保存草稿"><option value="">选择草稿</option></select><button id="ten-rule-draft-restore" class="ten-btn is-small" type="button">恢复草稿</button><button \
id="ten-rule-draft-discard" class="ten-btn is-small" type="button">删除草稿</button></div>\n      <div class="ten-rule-fields">\n        <div \
class="ten-grid-2"><label>站点名称<input id="ten-rule-name" class="ten-input" placeholder="例如：示例漫画"></label><label>域名<input id="ten-rule-domain" class="ten-input" \
placeholder="example.com，可填写多个域名"></label></div>\n        <div class="ten-grid-2"><label>漫画标题选择器<input id="ten-rule-title-selector" class="ten-input" \
placeholder="例如：h1.title"></label><label>章节列表选择器<input id="ten-rule-chapter-selector" class="ten-input" placeholder="例如：.chapter-list"></label></div>\n        \
<label>章节图片选择器<input id="ten-rule-image-selector" class="ten-input" placeholder="例如：.reader img"></label>\n        <div class="ten-rule-toolbar"><button \
class="ten-btn is-small" data-rule-highlight="comicNameCss" type="button">高亮标题</button><button class="ten-btn is-small" data-rule-highlight="chapterCss" \
type="button">高亮章节</button><button class="ten-btn is-small" data-rule-highlight="imageCss" type="button">高亮图片</button></div><div id="ten-rule-selector-hint" \
class="ten-meta" role="status"></div>\n        <div class="ten-rule-simple-hint">图片地址默认自动识别；相对地址会补全。常用选项只作用于简单选择器解析。</div>\n        <details \
id="ten-rule-common" class="ten-rule-advanced"><summary>常用解析选项 <span>可选，留空保持自动</span></summary><div class="ten-rule-advanced-body">\n          <div \
class="ten-grid-2"><label>等待元素<input id="ten-rule-ready-selector" class="ten-input" placeholder="可选，例如 .reader.loaded"></label><label>等待超时（秒）<input \
id="ten-rule-wait-seconds" class="ten-input" type="number" min="1" max="60" value="10"></label></div>\n          <label>图片地址属性<input \
id="ten-rule-image-attributes" class="ten-input" placeholder="留空自动；例如 data-original, src"></label>\n          <label>排除图片或容器<input id="ten-rule-image-exclude" \
class="ten-input" placeholder="可选，例如 .ad, .cover"></label>\n          <div class="ten-grid-2"><label>章节地址包含<input id="ten-rule-chapter-include" \
class="ten-input" placeholder="可选，例如 /chapter/"></label><label>章节地址排除<input id="ten-rule-chapter-exclude" class="ten-input" placeholder="可选，例如 \
/preview/"></label></div>\n          <div class="ten-meta">动态等待用于隐藏页面或当前阅读页；地址属性按填写顺序尝试，多个属性用逗号分隔。</div>\n        </div></details>\n        <details \
id="ten-rule-advanced" class="ten-rule-advanced"><summary>复杂站点设置 <span>翻页、隐藏页面或自定义解析</span></summary><div class="ten-rule-advanced-body">\n          \
<label>站点首页<input id="ten-rule-homepage" class="ten-input" placeholder="留空根据域名生成"></label><label>规则说明<input id="ten-rule-desc" class="ten-input" \
placeholder="可选：使用提示"></label>\n          <div><span class="ten-rule-label">阅读方式</span><div class="ten-rule-readtype"><button type="button" \
data-rule-readtype="1">卷轴阅读</button><button type="button" data-rule-readtype="0">翻页阅读</button></div></div>\n          <div class="ten-setting \
ten-rule-frame"><label for="ten-rule-use-frame">使用隐藏页面读取</label><input id="ten-rule-use-frame" type="checkbox"></div>\n          <label>图片解析函数<textarea \
id="ten-rule-getimgs" class="ten-textarea ten-rule-function" placeholder="留空使用图片选择器；支持 function 或 async function" spellcheck="false"></textarea></label>\n       \
 </div></details>\n      </div>\n      <div class="ten-rule-actions"><button id="ten-rule-test" class="ten-btn" type="button">测试当前页面</button><button \
id="ten-rule-save" class="ten-btn is-primary" type="button">保存规则</button><button id="ten-rule-save-copy" class="ten-btn" type="button">另存副本</button><button \
id="ten-rule-cancel-edit" class="ten-btn is-danger" type="button" hidden>取消编辑</button></div>\n      <div id="ten-rule-test-result" class="ten-rule-test-result" \
role="status" hidden></div>\n      <div class="ten-rule-preview-controls"><select id="ten-rule-preview-chapter" class="ten-input" aria-label="预览章节"><option \
value="">当前阅读页</option></select><button id="ten-rule-preview" class="ten-btn" type="button">预览章节图片</button><button id="ten-rule-preview-cancel" class="ten-btn \
is-small" type="button" hidden>取消预览</button></div><div id="ten-rule-preview-result" class="ten-rule-preview-result" role="status"></div>\n      <details \
class="ten-rule-json"><summary>规则导入 <span>先预览，再选择合并</span></summary><textarea id="ten-rule-text" class="ten-textarea" placeholder="粘贴 JSON 规则数组" \
autocomplete="off" spellcheck="false"></textarea>\n        <label class="ten-rule-check"><input id="ten-rule-legacy-import" type="checkbox">旧版 JavaScript \
对象兼容（会执行代码）</label><button id="ten-import-rules" class="ten-btn" type="button">预览导入</button>\n      </details>\n      <div id="ten-rule-import-preview" \
class="ten-rule-import-preview" hidden></div>\n      <details class="ten-rule-json"><summary>规则恢复点 <span>最近20次变更</span></summary><select id="ten-rule-history" \
class="ten-input" aria-label="规则恢复点"><option value="">选择恢复点</option></select><div id="ten-rule-history-info" class="ten-meta"></div><button \
id="ten-rule-history-restore" class="ten-btn" type="button">恢复所选版本</button></details>\n    </div></details>\n    <div class="ten-card ten-settings-card"><div \
class="ten-card-title">设置与规则备份</div><div class="ten-backup-actions"><button id="ten-backup-export" class="ten-btn" type="button">导出备份</button><button \
id="ten-backup-import" class="ten-btn is-primary" type="button">导入备份</button></div><input id="ten-backup-file" type="file" accept="application/json,.json" \
hidden><div class="ten-settings-hint">包含界面、下载设置和自定义规则；导入前可选择规则</div></div><button id="ten-reset" class="ten-btn is-danger" type="button" \
style="width:100%">重置全部设置</button></section>`;
        }
        function ruleRepository() {
            return state.ruleRepository || (state.ruleRepository = new RuleRepository({
                get: key => GM_getValue(key),
                set: (key, value) => GM_setValue(key, value),
                remove: key => GM_deleteValue(key),
                keys: () => typeof GM_listValues === "function" ? GM_listValues() : []
            }, ruleModel));
        }
        function readRuleForm() {
            const fields = {
                ...state.editRuleBase || {}
            };
            for (const [field, id] of Object.entries(RULE_FORM_IDS)) fields[field] = byId(id)?.value || "";
            fields.domain = fields.domain.trim();
            fields.imageAttributes = fields.imageAttributes.split(/[,，\s]+/).filter(Boolean);
            fields.waitTimeoutMs = Number(fields.waitTimeoutMs || 10) * 1e3;
            fields.readtype = state.ruleReadType;
            fields.useFrame = Boolean(byId("ten-rule-use-frame")?.checked);
            fields.simpleRule = !fields.getImgs.trim() && Boolean(fields.imageCss.trim());
            if (state.editRuleId) fields.id = state.editRuleId; else delete fields.id;
            return fields;
        }
        function paintRuleForm(fields = {}) {
            for (const [field, id] of Object.entries(RULE_FORM_IDS)) {
                let value = fields[field] || "";
                if (field === "domain") value = Array.isArray(value) ? value.join(", ") : value;
                if (field === "imageAttributes") value = Array.isArray(value) ? value.join(", ") : value;
                if (field === "waitTimeoutMs") value = Number(fields.waitTimeoutMs || 1e4) / 1e3;
                if (field === "getImgs" && fields.simpleRule) value = "";
                if (byId(id)) byId(id).value = value;
            }
            byId("ten-rule-use-frame").checked = Boolean(fields.useFrame);
            setRuleReadType(fields.readtype === 0 ? 0 : 1);
            byId("ten-rule-save").textContent = state.editRuleId ? "更新规则" : "保存规则";
            byId("ten-rule-cancel-edit").hidden = !state.editRuleId;
            byId("ten-rule-advanced").open = Boolean(fields.getImgs && !fields.simpleRule || fields.readtype === 0 || fields.useFrame);
            clearRuleFieldErrors();
        }
        function clearRuleFieldErrors() {
            all("[data-rule-error]").forEach(node => node.remove());
            for (const id of Object.values(RULE_FORM_IDS)) {
                byId(id)?.removeAttribute("aria-invalid");
                byId(id)?.removeAttribute("aria-describedby");
            }
        }
        function validateRuleForm() {
            clearRuleFieldErrors();
            const result = ruleModel.validate(readRuleForm());
            for (const error of result.errors) {
                const input = byId(RULE_FORM_IDS[error.field]);
                if (!input) continue;
                const disclosure = input.closest("details");
                if (disclosure) disclosure.open = true;
                input.setAttribute("aria-invalid", "true");
                const message = document.createElement("small");
                message.className = "ten-rule-field-error";
                message.dataset.ruleError = error.field;
                message.id = input.id + "-error";
                message.textContent = error.message;
                input.setAttribute("aria-describedby", message.id);
                input.insertAdjacentElement("afterend", message);
            }
            return result;
        }
        function readRuleEditor() {
            const result = validateRuleForm();
            if (result.errors.length) throw new Error(result.errors.map(error => error.message).join("；"));
            return result.rule;
        }
        function stopRulePreview(clear = false) {
            state.rulePreviewGeneration = (state.rulePreviewGeneration || 0) + 1;
            state.rulePreviewController?.abort();
            state.rulePreviewController = null;
            for (const url of state.rulePreviewObjectUrls || []) URL.revokeObjectURL(url);
            state.rulePreviewObjectUrls = new Set;
            if (state.rulePreviewCleanup) {
                try {
                    state.rulePreviewCleanup();
                } catch (error) {}
                state.rulePreviewCleanup = null;
            }
            if (state.rulePreviewFrameCleanup) {
                state.rulePreviewFrameCleanup();
                state.rulePreviewFrameCleanup = null;
            }
            if (byId("ten-rule-preview-cancel")) byId("ten-rule-preview-cancel").hidden = true;
            if (byId("ten-rule-preview")) byId("ten-rule-preview").disabled = false;
            if (clear && byId("ten-rule-preview-result")) byId("ten-rule-preview-result").replaceChildren();
        }
        function resetRuleEditor() {
            stopRulePreview(true);
            clearRuleHighlights();
            clearTimeout(state.ruleDraftTimer);
            state.ruleDraftFields = null;
            state.rulePreviewLinks = null;
            state.editRuleId = null;
            state.editRuleBase = null;
            state.editRuleIndex = -1;
            state.ruleDirty = false;
            state.ruleDraftId = null;
            if (!byId("ten-rule-name")) return;
            paintRuleForm();
            byId("ten-rule-test-result").hidden = true;
            byId("ten-rule-draft-status").textContent = "尚未编辑";
            state.ruleTemplateUndo = null;
            if (byId("ten-rule-template-undo")) byId("ten-rule-template-undo").disabled = true;
        }
        function scheduleRuleDraft() {
            state.ruleDirty = true;
            state.ruleDraftId ||= newTaskId();
            state.ruleDraftFields = readRuleForm();
            clearTimeout(state.ruleDraftTimer);
            state.ruleDraftTimer = setTimeout(flushRuleDraft, 300);
            byId("ten-rule-draft-status").textContent = "有未应用的修改，正在保存草稿…";
            stopRulePreview(true);
            if (!byId("ten-rule-test-result").hidden) byId("ten-rule-test-result").textContent = "规则已修改，请重新检查与预览。";
        }
        function flushRuleDraft() {
            clearTimeout(state.ruleDraftTimer);
            state.ruleDraftTimer = null;
            if (!state.ruleDirty) return;
            const fields = byId("ten-rule-name") ? readRuleForm() : state.ruleDraftFields;
            if (!fields) return;
            try {
                ruleRepository().saveDraft(state.ruleDraftId || (state.ruleDraftId = newTaskId()), {
                    host: location.hostname,
                    fields: fields,
                    base: state.editRuleBase,
                    ruleId: state.editRuleId,
                    updatedAt: Date.now()
                });
                if (byId("ten-rule-draft-status")) byId("ten-rule-draft-status").textContent = "草稿已保存，尚未应用；可稍后恢复。";
                refreshRuleRecoveryLists();
            } catch (error) {
                if (byId("ten-rule-draft-status")) byId("ten-rule-draft-status").textContent = "草稿保存失败：" + error.message;
            }
        }
        function refreshRuleRecoveryLists() {
            if (!byId("ten-rule-drafts")) return;
            try {
                const drafts = ruleRepository().drafts(location.hostname), selected = byId("ten-rule-drafts").value;
                byId("ten-rule-drafts").innerHTML = '<option value="">选择草稿</option>' + drafts.map(draft => `<option value="${escapeAttr(draft.id)}">${escapeHtml(draft.fields.webName || "未命名")} · ${escapeHtml(new Date(draft.updatedAt).toLocaleString())}</option>`).join("");
                if (drafts.some(draft => draft.id === selected)) byId("ten-rule-drafts").value = selected;
                if (!state.ruleDirty && drafts.length) byId("ten-rule-draft-status").textContent = `发现 ${drafts.length} 份草稿，可选择恢复；尚未应用。`;
                const history = ruleRepository().history(), previous = byId("ten-rule-history").value;
                byId("ten-rule-history").innerHTML = '<option value="">选择恢复点</option>' + history.map(entry => `<option value="${escapeAttr(entry.id)}">${escapeHtml(entry.reason)} · ${escapeHtml(new Date(entry.updatedAt).toLocaleString())}</option>`).join("");
                if (history.some(entry => entry.id === previous)) byId("ten-rule-history").value = previous;
            } catch (error) {
                byId("ten-rule-draft-status").textContent = "无法读取规则恢复记录：" + error.message;
            }
        }
        async function beginRuleEdit(id) {
            if (state.ruleDirty && !await showConfirm("切换编辑规则", "当前修改会保留为草稿。", "保留草稿并切换", "继续编辑")) return;
            flushRuleDraft();
            closeMobileDrawer();
            const rule = ruleRepository().read().find(rule => rule.id === id);
            if (!rule) return toast("规则已删除，请刷新列表");
            resetRuleEditor();
            state.editRuleId = rule.id;
            state.editRuleBase = rule;
            paintRuleForm(rule);
            activateTab("settings");
            expandRuleEditor();
            byId("ten-rule-editor-card").scrollIntoView({
                block: "start",
                behavior: "smooth"
            });
            refreshRuleRecoveryLists();
        }
        async function startNewRule() {
            if (state.ruleDirty && !await showConfirm("新建规则", "当前修改会保留为草稿。", "保留草稿并新建", "继续编辑")) return;
            flushRuleDraft();
            closeMobileDrawer();
            resetRuleEditor();
            refreshRuleRecoveryLists();
        }
        function applyRuleTemplate(name) {
            const template = RULE_TEMPLATES[name];
            if (!template) return;
            state.ruleTemplateUndo = {
                fields: readRuleForm(),
                advanced: byId("ten-rule-advanced").open
            };
            if (template.imageCss) byId("ten-rule-image-selector").value = template.imageCss;
            byId("ten-rule-use-frame").checked = template.useFrame;
            setRuleReadType(template.readtype);
            byId("ten-rule-advanced").open = template.readtype === 0 || template.useFrame;
            all("[data-rule-template]").forEach(button => button.classList.toggle("is-active", button.dataset.ruleTemplate === name));
            byId("ten-rule-template-undo").disabled = false;
            scheduleRuleDraft();
            toast("已应用" + template.name + "，可撤销");
        }
        function saveRuleEditor(asCopy = false) {
            asCopy = asCopy === true;
            try {
                const rule = readRuleEditor();
                ruleRepository().save(rule, asCopy ? {} : state.editRuleId ? {
                    id: state.editRuleId,
                    baseVersion: state.editRuleBase.version
                } : {});
                if (state.ruleDraftId) ruleRepository().removeDraft(state.ruleDraftId);
                clearTimeout(state.ruleDraftTimer);
                resetRuleEditor();
                state.sourceMode = 1;
                renderSites();
                refreshRuleRecoveryLists();
                activateTab("sites");
                toast("规则已保存，重载章节列表后生效；当前任务保留原规则");
            } catch (error) {
                toast(error.message || "规则保存失败");
            }
        }
        function ruleChapterLinks(rule) {
            if (!rule.chapterCss) return [];
            const found = [], seen = new Set;
            for (const container of document.querySelectorAll(rule.chapterCss)) for (const link of container.querySelectorAll("a[href]")) {
                if (link.closest("#ten-comic-root") || !/^https?:/i.test(link.href) || seen.has(link.href)) continue;
                if (rule.chapterUrlIncludes && !link.href.includes(rule.chapterUrlIncludes) || rule.chapterUrlExcludes && link.href.includes(rule.chapterUrlExcludes)) continue;
                seen.add(link.href);
                found.push({
                    url: link.href,
                    name: String(link.textContent || link.getAttribute("title") || "未命名章节").trim()
                });
            }
            return found;
        }
        function testRuleEditor() {
            const result = byId("ten-rule-test-result");
            result.hidden = false;
            result.classList.remove("is-success", "is-error");
            try {
                const rule = readRuleEditor(), matched = ruleModel.matches(rule.domain, location.hostname), links = ruleChapterLinks(rule);
                const title = rule.comicNameCss ? document.querySelector(rule.comicNameCss) : null;
                const imageCount = rule.imageCss ? [ ...document.querySelectorAll(rule.imageCss) ].filter(image => !image.closest("#ten-comic-root") && (!rule.imageExcludeCss || !image.matches(rule.imageExcludeCss) && !image.closest(rule.imageExcludeCss))).length : 0;
                result.textContent = `格式检查：通过\n域名匹配：${matched ? "当前页面已匹配" : "当前页面不属于该规则，仅检查当前DOM"}\n漫画标题：${title ? String(title.textContent || "").trim().slice(0, 80) : "未找到／尚未验证"}\n目录识别：${links.length} 个有效章节链接\n当前页图片：${imageCount} 张\n阅读页解析：未验证，请点击“预览章节图片”\n${rule.simpleRule ? "使用简单选择器解析" : "高级函数仅检查语法，尚未执行"}`;
                state.rulePreviewLinks = links;
                byId("ten-rule-preview-chapter").innerHTML = '<option value="">当前阅读页</option>' + links.slice(0, 500).map((link, index) => `<option value="${index}">${escapeHtml(link.name || link.url)}</option>`).join("");
                if (links.length) byId("ten-rule-preview-chapter").value = "0";
            } catch (error) {
                result.textContent = "检查失败：" + error.message;
                result.classList.add("is-error");
            }
            refreshRuleMatchStatus();
        }
        async function previewRuleEditor() {
            let rule;
            try {
                rule = readRuleEditor();
            } catch (error) {
                testRuleEditor();
                return;
            }
            if (!ruleModel.matches(rule.domain, location.hostname)) return toast("请在该规则匹配的网站中进行阅读页预览");
            if (!state.rulePreviewLinks) testRuleEditor();
            if (!rule.simpleRule && !await showConfirm("运行高级解析预览", "将执行你填写的解析函数。预览不加入下载队列；仅运行自己编写或已审阅的代码。", "运行预览", "取消")) return;
            stopRulePreview(true);
            const generation = state.rulePreviewGeneration, controller = new AbortController;
            state.rulePreviewController = controller;
            byId("ten-rule-preview").disabled = true;
            byId("ten-rule-preview-cancel").hidden = false;
            byId("ten-rule-preview-result").textContent = "正在解析预览…";
            const selected = byId("ten-rule-preview-chapter").value;
            const chapter = selected === "" ? null : state.rulePreviewLinks?.[Number(selected)];
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, 6e4);
            try {
                const adapter = ruleModel.compile(rule, {
                    request: downloadUtils.WY,
                    trimSpecial: downloadUtils.Sc,
                    funstrToData: downloadUtils.D
                });
                const parsed = await downloadUtils.gJ({
                    url: chapter?.url || location.href,
                    document: chapter ? undefined : document,
                    signal: controller.signal,
                    adapter: adapter,
                    preview: true,
                    retainPreviewFrame: release => {
                        if (generation === state.rulePreviewGeneration && !controller.signal.aborted) state.rulePreviewFrameCleanup = release; else release();
                    }
                });
                if (controller.signal.aborted || generation !== state.rulePreviewGeneration) {
                    parsed?.otherData?.cleanup?.();
                    return;
                }
                if (parsed?.otherData?.cleanup) state.rulePreviewCleanup = () => parsed.otherData.cleanup();
                const urls = Array.isArray(parsed) ? parsed : parsed?.imgUrlArr;
                if (!Array.isArray(urls) || !urls.length || urls.some(url => typeof url !== "string")) throw new Error("解析未返回有效图片地址列表");
                const container = byId("ten-rule-preview-result");
                container.replaceChildren();
                const summary = document.createElement("div");
                let loaded = 0, failed = 0;
                const sampleCount = Math.min(6, urls.length);
                const updateSummary = () => {
                    summary.textContent = `已解析 ${urls.length} 个图片地址${parsed?.nextPageUrl ? `（当前批次，声明总数 ${parsed.imgCount || "未知"}）` : ""} · ${chapter?.name || "当前阅读页"}；样本加载成功 ${loaded}，加载失败 ${failed}，待验证 ${sampleCount - loaded - failed}（仅检查前6张，不保存文件；完整章节尚未验证）`;
                };
                updateSummary();
                container.append(summary);
                const gallery = document.createElement("div");
                gallery.className = "ten-rule-preview-grid";
                for (const [index, url] of urls.slice(0, 6).entries()) {
                    const figure = document.createElement("figure"), image = document.createElement("img"), caption = document.createElement("figcaption");
                    image.alt = `图片 ${index + 1}`;
                    caption.textContent = `${index + 1} · 等待加载`;
                    figure.append(image, caption);
                    gallery.append(figure);
                }
                container.append(gallery);
                // Small, bounded sample requests use the rule's own headers and never consume host-owned blob URLs.
                                for (const [index, url] of urls.slice(0, 6).entries()) {
                    if (controller.signal.aborted || generation !== state.rulePreviewGeneration) break;
                    const figure = gallery.children[index], image = figure.querySelector("img"), caption = figure.querySelector("figcaption");
                    try {
                        let blob;
                        if (/^https?:/i.test(url)) {
                            const response = await downloadUtils.WY({
                                method: "get",
                                url: url,
                                responseType: "blob",
                                headers: rule.downHeaders || rule.headers || {
                                    referer: chapter?.url || location.href
                                },
                                signal: controller.signal,
                                timeout: 15e3
                            });
                            if (!response || typeof response !== "object" || response.status >= 400) throw new Error("图片请求失败");
                            blob = response.response;
                        } else if (/^blob:|^data:image\//i.test(url)) blob = await (await fetch(url, {
                            signal: controller.signal
                        })).blob(); else throw new Error("图片地址协议无效");
                        if (controller.signal.aborted || generation !== state.rulePreviewGeneration) break;
                        if (!(blob instanceof Blob) || !blob.size) throw new Error("图片内容为空");
                        const objectUrl = URL.createObjectURL(blob);
                        state.rulePreviewObjectUrls.add(objectUrl);
                        image.src = objectUrl;
                        await image.decode();
                        if (controller.signal.aborted || generation !== state.rulePreviewGeneration) break;
                        loaded++;
                        caption.textContent = `${index + 1} · 加载成功`;
                    } catch (error) {
                        if (controller.signal.aborted || generation !== state.rulePreviewGeneration) break;
                        failed++;
                        caption.textContent = `${index + 1} · 加载失败`;
                    }
                    updateSummary();
                }
                if (controller.signal.aborted && generation === state.rulePreviewGeneration) throw new Error("预览已取消");
            } catch (error) {
                if (generation === state.rulePreviewGeneration) {
                    stopRulePreview(true);
                    byId("ten-rule-preview-result").textContent = timedOut ? "预览超过60秒，尚未完成验证。请检查网络、等待元素或解析函数。" : controller.signal.aborted ? "预览已取消" : "预览失败：" + error.message;
                }
            } finally {
                clearTimeout(timer);
                if (generation === state.rulePreviewGeneration) {
                    state.rulePreviewController = null;
                    byId("ten-rule-preview").disabled = false;
                    byId("ten-rule-preview-cancel").hidden = true;
                    if (state.rulePreviewFrameCleanup) {
                        state.rulePreviewFrameCleanup();
                        state.rulePreviewFrameCleanup = null;
                    }
                    if (state.rulePreviewCleanup) {
                        try {
                            state.rulePreviewCleanup();
                        } catch (error) {}
                        state.rulePreviewCleanup = null;
                    }
                }
            }
        }
        function refreshRuleMatchStatus() {
            const target = byId("ten-rule-match-status");
            if (!target) return;
            try {
                const list = siteRules.eT(), resolution = ruleModel.resolve(location.href, list.originalInfo || [], ruleRepository().read());
                const actual = siteRules.Po;
                target.textContent = `当前使用：${actual?.webName || "未匹配"}（${actual?.id ? "自定义" : "内置"}）\n按已保存配置将命中：${resolution.selected?.webName || "未匹配"}（${resolution.source === "custom" ? "自定义" : resolution.source === "builtin" ? "内置" : "无"}）` + (resolution.candidates.length ? `\n同域自定义规则 ${resolution.candidates.length} 条；默认内置优先，勾选“优先”后按自定义列表顺序匹配。` : "") + "\n规则修改在重载章节列表后生效，当前任务保留原规则。";
            } catch (error) {
                target.textContent = "无法读取规则匹配信息：" + error.message;
            }
        }
        function previewRuleImport(incoming, options = {}) {
            const current = ruleRepository().read(), rows = ruleModel.previewImport(incoming, current);
            state.ruleImport = {
                rows: rows,
                stamp: ruleRepository().stamp(),
                settings: options.settings || null
            };
            activateTab("settings");
            expandRuleEditor();
            const target = byId("ten-rule-import-preview");
            target.hidden = false;
            const labels = {
                new: "新增",
                duplicate: "重复",
                conflict: "域名冲突",
                invalid: "无效"
            };
            target.innerHTML = "<strong>导入预览：选择每条规则的处理方式</strong>" + rows.map((row, index) => `<div class="ten-rule-import-row" data-import-row="${index}"><div><b>${escapeHtml(row.rule?.webName || "未命名规则")}</b> · ${labels[row.kind]}<div class="ten-meta">${escapeHtml(row.errors.map(error => error.message).join("；") || (Array.isArray(row.rule.domain) ? row.rule.domain.join(", ") : row.rule.domain) + (row.incomingConflicts?.length ? "；与本批第 " + row.incomingConflicts.join("、") + " 条规则的域名重叠" : ""))}</div></div><select class="ten-input" data-import-action="${index}" aria-label="处理规则 ${index + 1}" ${row.kind === "invalid" ? "disabled" : ""}><option value="skip">跳过</option><option value="add" ${row.action === "add" ? "selected" : ""}>新增一份</option>${row.targets.length ? '<option value="replace">替换所选目标</option>' : ""}</select>${row.targets.length ? `<select class="ten-input" data-import-target="${index}" aria-label="替换目标 ${index + 1}">${row.targets.map(rule => `<option value="${escapeAttr(rule.id)}">${escapeHtml(rule.webName)}</option>`).join("")}</select>` : ""}</div>`).join("") + (options.settings ? '<label class="ten-rule-check"><input id="ten-rule-import-settings" type="checkbox" checked>同时导入备份中的设置（覆盖对应设置）</label>' : "") + '<div class="ten-rule-toolbar"><button id="ten-rule-import-apply" class="ten-btn is-primary" type="button">应用所选内容</button><button id="ten-rule-import-cancel" \
class="ten-btn" type="button">取消导入</button></div>';
        }
        async function importRules() {
            const text = byId("ten-rule-text").value.trim();
            if (!text) return toast("请先粘贴规则数组");
            try {
                if (text.length > 2e6) throw new Error("规则文本超过大小限制");
                let incoming;
                if (byId("ten-rule-legacy-import").checked) {
                    if (!await showConfirm("旧版 JavaScript 对象兼容", "该兼容方式会执行所粘贴的代码。仅继续处理可信且已审阅的规则。", "继续解析", "取消")) return;
                    incoming = Function('"use strict";return (' + text + "\n)")();
                    if (!Array.isArray(incoming) || incoming.length > 500) throw new Error("规则必须是最多500条的数组");
                } else incoming = ruleModel.parseJSON(text);
                previewRuleImport(incoming);
            } catch (error) {
                toast("导入预览失败：" + error.message);
            }
        }
        function applyRuleImport() {
            const pending = state.ruleImport;
            if (!pending) return;
            try {
                if (pending.stamp !== ruleRepository().stamp()) throw new Error("规则列表已变化，请重新预览后应用");
                for (const [index, row] of pending.rows.entries()) {
                    row.action = one(`[data-import-action="${index}"]`).value;
                    row.targetId = one(`[data-import-target="${index}"]`)?.value;
                }
                const settingsSelected = pending.settings && byId("ten-rule-import-settings")?.checked;
                const previous = settingsSelected ? Object.fromEntries(BACKUP_KEYS.map(key => [ key, GM_getValue(key) ])) : null;
                if (settingsSelected) {
                    try {
                        for (const key of BACKUP_KEYS) if (pending.settings[key] !== undefined && pending.settings[key] !== null) configModule.po(key, pending.settings[key]);
                    } catch (error) {
                        for (const [key, value] of Object.entries(previous)) if (value !== undefined) GM_setValue(key, value); else GM_deleteValue(key);
                        throw error;
                    }
                }
                try {
                    ruleRepository().applyImport(pending.rows, pending.stamp);
                } catch (error) {
                    if (previous) for (const [key, value] of Object.entries(previous)) if (value !== undefined) GM_setValue(key, value); else GM_deleteValue(key);
                    throw error;
                }
                state.ruleImport = null;
                byId("ten-rule-import-preview").hidden = true;
                byId("ten-rule-text").value = "";
                if (settingsSelected) {
                    flushRuleDraft();
                    state.settings = readSettings();
                    applySettingsToUI();
                    trimHistory();
                }
                state.sourceMode = 1;
                renderSites();
                refreshRuleRecoveryLists();
                toast("所选内容已导入，已创建规则恢复点");
            } catch (error) {
                toast("导入未完成：" + error.message);
            }
        }
        async function clearRules() {
            if (await showConfirm("清空自定义规则", "将清空全部自定义规则，并创建恢复点。", "全部清空")) try {
                ruleRepository().commit([], "清空规则");
                renderSites();
                refreshRuleRecoveryLists();
                toast("规则已清空，可从恢复点还原");
            } catch (error) {
                toast(error.message);
            }
        }
        function initializeRuleTools() {
            if (!byId("ten-rule-name")) return;
            state.rulePreviewLinks = null;
            const root = byId(ROOT_ID);
            root.addEventListener("input", event => {
                if (Object.values(RULE_FORM_IDS).includes(event.target.id)) {
                    state.rulePreviewLinks = null;
                    scheduleRuleDraft();
                }
                if (event.target.id === "ten-rule-filter") filterManagedRules();
            });
            root.addEventListener("change", event => {
                if (event.target.id === "ten-rule-use-frame") scheduleRuleDraft();
            });
            root.addEventListener("click", event => {
                const highlight = event.target.closest("[data-rule-highlight]");
                if (highlight) highlightRuleSelector(highlight.dataset.ruleHighlight);
                if (event.target.closest("[data-rule-readtype]")) scheduleRuleDraft();
                if (event.target.closest("#ten-rule-import-apply")) applyRuleImport();
                if (event.target.closest("#ten-rule-import-cancel")) {
                    state.ruleImport = null;
                    byId("ten-rule-import-preview").hidden = true;
                }
            });
            byId("ten-rule-new").addEventListener("click", startNewRule);
            byId("ten-rule-save-copy").addEventListener("click", () => saveRuleEditor(true));
            byId("ten-rule-template-undo").addEventListener("click", () => {
                if (!state.ruleTemplateUndo) return;
                const previous = state.ruleTemplateUndo;
                paintRuleForm(previous.fields);
                byId("ten-rule-advanced").open = previous.advanced;
                state.ruleTemplateUndo = null;
                byId("ten-rule-template-undo").disabled = true;
                scheduleRuleDraft();
            });
            byId("ten-rule-preview").addEventListener("click", previewRuleEditor);
            byId("ten-rule-preview-cancel").addEventListener("click", () => {
                stopRulePreview();
                byId("ten-rule-preview-result").textContent = "预览已取消";
            });
            byId("ten-rule-draft-restore").addEventListener("click", async () => {
                const draft = ruleRepository().drafts(location.hostname).find(draft => draft.id === byId("ten-rule-drafts").value);
                if (!draft) return toast("请选择草稿");
                if (state.ruleDirty && !await showConfirm("恢复草稿", "当前修改会先保存为另一份草稿。", "保留并恢复", "继续编辑")) return;
                flushRuleDraft();
                resetRuleEditor();
                state.editRuleId = draft.ruleId;
                state.editRuleBase = draft.base;
                paintRuleForm(draft.fields);
                state.ruleDraftId = draft.id;
                state.ruleDirty = true;
                state.ruleDraftFields = readRuleForm();
                byId("ten-rule-draft-status").textContent = "草稿已恢复，尚未应用";
            });
            byId("ten-rule-draft-discard").addEventListener("click", async () => {
                const id = byId("ten-rule-drafts").value;
                if (id && await showConfirm("删除草稿", id === state.ruleDraftId ? "删除当前草稿并清空对应编辑内容；已应用规则不受影响。" : "仅删除选中的草稿。", "删除")) {
                    ruleRepository().removeDraft(id);
                    if (id === state.ruleDraftId) resetRuleEditor();
                    refreshRuleRecoveryLists();
                }
            });
            byId("ten-rule-history").addEventListener("change", () => {
                const entry = ruleRepository().history().find(entry => entry.id === byId("ten-rule-history").value);
                byId("ten-rule-history-info").textContent = entry ? `将恢复为 ${entry.before.length} 条规则；当前状态会先创建恢复点。` : "";
            });
            byId("ten-rule-history-restore").addEventListener("click", async () => {
                const id = byId("ten-rule-history").value;
                if (!id) return toast("请选择恢复点");
                if (!await showConfirm("恢复规则版本", byId("ten-rule-history-info").textContent || "恢复前会保存当前规则状态。", "恢复")) return;
                try {
                    flushRuleDraft();
                    ruleRepository().restore(id);
                    renderSites();
                    refreshRuleRecoveryLists();
                    toast("规则已恢复，重载章节后生效");
                } catch (error) {
                    toast(error.message);
                }
            });
            refreshRuleRecoveryLists();
            refreshRuleMatchStatus();
        }
        function renderManagedRuleList(rules) {
            return `<label class="ten-rule-filter">筛选自定义规则<input id="ten-rule-filter" class="ten-input" placeholder="名称或域名"></label><div id="ten-managed-rule-list">` + (rules.length ? rules.map((rule, index) => `<div class="ten-rule-item ${rule.enabled ? "" : "is-rule-disabled"}" data-rule-id="${escapeAttr(rule.id)}" data-rule-search="${escapeAttr((rule.webName + " " + (Array.isArray(rule.domain) ? rule.domain.join(" ") : rule.domain)).toLowerCase())}"><button class="ten-list-item ten-rule-open" type="button" data-url="${escapeAttr(rule.homepage)}"><span class="ten-name">${escapeHtml(rule.webName || "未命名规则")}</span><span class="ten-meta">${rule.enabled ? "启用" : "停用"}${rule.preferCustom ? " · 优先" : ""} · v${rule.version}<br>${escapeHtml(Array.isArray(rule.domain) ? rule.domain.join(", ") : rule.domain)}</span></button><div class="ten-rule-item-actions"><button class="ten-btn is-small" type="button" data-rule-action="toggle">${rule.enabled ? "停用" : "启用"}</button><button class="ten-btn is-small" type="button" data-rule-action="prefer" aria-pressed="${rule.preferCustom}">${rule.preferCustom ? "取消优先" : "优先"}</button><button class="ten-icon-btn ten-rule-edit" type="button" data-edit-rule="${index}" title="编辑规则" aria-label="编辑 ${escapeAttr(rule.webName)}">${icon("edit")}</button><button class="ten-btn is-small" type="button" data-rule-action="copy">复制</button><button class="ten-btn is-small" type="button" \
data-rule-action="export">导出</button><button class="ten-icon-btn ten-rule-delete" type="button" data-delete-rule="${index}" title="删除规则" aria-label="删除 ${escapeAttr(rule.webName)}">${icon("trash")}</button></div></div>`).join("") : empty("暂无导入规则")) + "</div>";
        }
        function filterManagedRules() {
            const query = byId("ten-rule-filter")?.value.trim().toLowerCase() || "";
            all("#ten-managed-rule-list [data-rule-id]").forEach(row => {
                row.hidden = Boolean(query && !row.dataset.ruleSearch.includes(query));
            });
        }
        async function handleManagedRuleAction(event) {
            const row = event.target.closest("[data-rule-id]"), button = event.target.closest("button");
            if (!button) return;
            if (row) {
                const rule = ruleRepository().read().find(rule => rule.id === row.dataset.ruleId);
                if (!rule) return toast("规则列表已变化，请刷新");
                try {
                    if (button.hasAttribute("data-edit-rule")) return beginRuleEdit(rule.id);
                    if (button.hasAttribute("data-delete-rule")) {
                        if (await showConfirm("删除自定义规则", `确认删除“${rule.webName}”？可从恢复点还原。`, "删除")) ruleRepository().remove(rule.id);
                    } else if (button.dataset.ruleAction === "toggle") ruleRepository().update(rule.id, {
                        enabled: !rule.enabled
                    }, "切换规则启用状态"); else if (button.dataset.ruleAction === "prefer") ruleRepository().update(rule.id, {
                        preferCustom: !rule.preferCustom
                    }, "调整规则优先级"); else if (button.dataset.ruleAction === "copy") {
                        const copy = {
                            ...rule,
                            webName: rule.webName + "（副本）",
                            enabled: false,
                            preferCustom: false
                        };
                        delete copy.id;
                        ruleRepository().save(copy);
                        toast("副本已创建并停用，可编辑后启用");
                    } else if (button.dataset.ruleAction === "export") return exportRuleJSON([ rule ], "10Comic-单条规则.json"); else if (button.dataset.url) return window.open(button.dataset.url, "_blank");
                    renderSites();
                    refreshRuleRecoveryLists();
                } catch (error) {
                    toast(error.message);
                }
            } else if (button.dataset.url) window.open(button.dataset.url, "_blank");
        }
        function exportRuleJSON(value, name) {
            const blob = new Blob([ ruleModel.serialize(value) ], {
                type: "application/json"
            }), url = URL.createObjectURL(blob);
            const cleanup = () => URL.revokeObjectURL(url);
            const fallback = () => {
                const link = document.createElement("a");
                link.href = url;
                link.download = name;
                link.hidden = true;
                document.body.append(link);
                link.click();
                link.remove();
                setTimeout(cleanup, 1e3);
            };
            try {
                GM_download({
                    url: url,
                    name: name,
                    saveAs: true,
                    onload: () => {
                        cleanup();
                        toast("规则已导出");
                    },
                    onerror: fallback,
                    ontimeout: fallback
                });
            } catch (error) {
                fallback();
            }
        }
        function clearRuleHighlights() {
            clearTimeout(state.ruleHighlightTimer);
            cancelAnimationFrame(state.ruleHighlightFrame);
            state.ruleHighlightFrame = null;
            window.removeEventListener("scroll", scheduleRuleHighlights, true);
            window.removeEventListener("resize", scheduleRuleHighlights);
            byId("ten-rule-match-layer")?.remove();
            state.ruleHighlightNodes = null;
        }
        function scheduleRuleHighlights() {
            if (state.ruleHighlightFrame) return;
            state.ruleHighlightFrame = requestAnimationFrame(() => {
                state.ruleHighlightFrame = null;
                paintRuleHighlights();
            });
        }
        function paintRuleHighlights() {
            const layer = byId("ten-rule-match-layer");
            if (!layer) return;
            layer.replaceChildren();
            for (const node of state.ruleHighlightNodes || []) if (node.isConnected) {
                const rect = node.getBoundingClientRect();
                if (!rect.width || !rect.height) continue;
                const box = document.createElement("div");
                box.className = "ten-rule-match-box";
                box.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
                layer.append(box);
            }
        }
        function highlightRuleSelector(field) {
            clearRuleHighlights();
            const selector = byId(RULE_FORM_IDS[field])?.value.trim();
            if (!selector) return toast("请先填写选择器");
            try {
                const nodes = [ ...document.querySelectorAll(selector) ].filter(node => !node.closest("#ten-comic-root"));
                const fragile = /:nth-|\d{4,}|(?:css|jsx|sc)[-_][\w-]{5,}/i.test(selector);
                byId("ten-rule-selector-hint").textContent = `命中 ${nodes.length} 项${nodes.length > 50 ? "，仅高亮前50项" : ""}；${fragile ? "包含位置、数字或动态类名，可能易失效" : "请检查是否包含封面、广告等误选"}`;
                const layer = document.createElement("div");
                layer.id = "ten-rule-match-layer";
                layer.setAttribute("aria-hidden", "true");
                byId(ROOT_ID).append(layer);
                state.ruleHighlightNodes = nodes.slice(0, 50);
                paintRuleHighlights();
                window.addEventListener("scroll", scheduleRuleHighlights, true);
                window.addEventListener("resize", scheduleRuleHighlights);
                state.ruleHighlightTimer = setTimeout(clearRuleHighlights, 5e3);
            } catch (error) {
                byId("ten-rule-selector-hint").textContent = "选择器无效：" + error.message;
            }
        }
        // One focus stack is shared by confirmation, diagnostics, help and drawers.
                const modalFocusStack = [];
        let modalFocusListenersReady = false;
        function resetModalFocus() {
            modalFocusStack.length = 0;
            document.removeEventListener("keydown", handleModalKeydown, true);
            document.removeEventListener("focusin", keepModalFocus, true);
            modalFocusListenersReady = false;
        }
        function modalFocusables(dialog) {
            return [ ...dialog.querySelectorAll("button, input, select, textarea, a[href], [tabindex]") ].filter(element => element.tabIndex >= 0 && !element.disabled && !element.closest("[inert]") && element.getClientRects().length && getComputedStyle(element).visibility === "visible");
        }
        function activateModalFocus(id, preferredSelector) {
            const overlay = byId(id);
            const dialog = overlay?.querySelector('[role="dialog"], [role="alertdialog"]');
            if (!dialog) return;
            overlay.inert = false;
            if (!modalFocusStack.some(entry => entry.id === id)) {
                modalFocusStack.push({
                    id: id,
                    dialog: dialog,
                    returnFocus: document.activeElement
                });
            }
            if (!modalFocusListenersReady) {
                document.addEventListener("keydown", handleModalKeydown, true);
                document.addEventListener("focusin", keepModalFocus, true);
                modalFocusListenersReady = true;
            }
            dialog.setAttribute("tabindex", "-1");
            const target = preferredSelector && dialog.querySelector(preferredSelector);
            (target || modalFocusables(dialog)[0] || dialog).focus({
                preventScroll: true
            });
        }
        function releaseModalFocus(id) {
            const index = modalFocusStack.findIndex(entry => entry.id === id);
            byId(id) && (byId(id).inert = true);
            if (index < 0) return;
            const wasTop = index === modalFocusStack.length - 1;
            const [entry] = modalFocusStack.splice(index, 1);
            if (!wasTop) return;
            const top = modalFocusStack[modalFocusStack.length - 1];
            const target = entry.returnFocus;
            if (target?.isConnected && !target.closest("[inert]") && target.getClientRects().length && (!top || top.dialog.contains(target))) {
                target.focus({
                    preventScroll: true
                });
            } else if (top) (modalFocusables(top.dialog)[0] || top.dialog).focus({
                preventScroll: true
            });
        }
        function keepModalFocus(event) {
            const entry = modalFocusStack[modalFocusStack.length - 1];
            if (entry && !entry.dialog.contains(event.target)) {
                (modalFocusables(entry.dialog)[0] || entry.dialog).focus({
                    preventScroll: true
                });
            }
        }
        function handleModalKeydown(event) {
            const entry = modalFocusStack[modalFocusStack.length - 1];
            if (!entry || event.defaultPrevented) return false;
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                if (entry.id === "ten-confirm") closeConfirm(false); else if (entry.id === "ten-diagnostic") closeDiagnostic(); else if (entry.id === "ten-rule-guide") closeRuleGuide(); else if (entry.id === "ten-mobile-drawer") closeMobileDrawer();
                return true;
            }
            if (event.key !== "Tab") return false;
            const focusables = modalFocusables(entry.dialog);
            const index = focusables.indexOf(document.activeElement);
            if (!focusables.length || index < 0 || (event.shiftKey ? index === 0 : index === focusables.length - 1)) {
                event.preventDefault();
                event.stopPropagation();
                (focusables[event.shiftKey ? focusables.length - 1 : 0] || entry.dialog).focus({
                    preventScroll: true
                });
                return true;
            }
            return false;
        }
        function injectStyle() {
            if (!document.body) return;
            const e = document.getElementById(ROOT_ID);
            if (e && state.ready) return;
            flushRuleDraft();
            stopRulePreview(true);
            clearRuleHighlights();
            resetModalFocus();
            e && e.remove(), function() {
                if (document.getElementById("ten-comic-style")) return;
                const e = document.createElement("style");
                e.id = "ten-comic-style", e.textContent = '/* Component isolation uses :where() to preserve the original cascade specificity. */\n#ten-comic-root {\n  --ten-bg: rgba(5, 12, 25, .78);\n  --ten-surface: \
rgba(23, 38, 62, .55);\n  --ten-surface-strong: rgba(31, 50, 78, .76);\n  --ten-line: rgba(137, 225, 255, .2);\n  --ten-text: #eefaff;\n  --ten-muted: \
#89a2b7;\n  --ten-cyan: #5ff6ff;\n  --ten-blue: #5b8cff;\n  --ten-violet: #9c6cff;\n  --ten-pink: #ff5fac;\n  --ten-danger: #ff6174;\n  --ten-success: \
#55efb6;\n  --ten-panel-bg: linear-gradient(150deg, rgba(20,42,67,.68), rgba(9,18,36,.78));\n  --ten-panel-border: rgba(133,233,255,.28);\n  --ten-panel-shadow: \
0 30px 90px rgba(0,5,15,.5), 0 0 0 1px rgba(255,255,255,.05) inset, 0 0 42px rgba(91,140,255,.12);\n  --ten-header-bg: rgba(4,12,25,.48);\n  --ten-card-bg: \
rgba(23,38,62,.55);\n  --ten-card-border: rgba(137,225,255,.2);\n  --ten-card-shadow: inset 0 1px rgba(255,255,255,.06);\n  --ten-task-bg: rgba(10,25,46,.52);\n \
 --ten-list-bg: rgba(23,38,62,.46);\n  --ten-list-hover-bg: rgba(36,61,91,.6);\n  --ten-control-bg: \
linear-gradient(110deg,rgba(39,68,101,.72),rgba(80,47,123,.65),rgba(31,92,112,.72));\n  --ten-control-hover-bg: rgba(95,246,255,.09);\n  --ten-control-border: \
rgba(111,220,255,.2);\n  --ten-primary-bg: linear-gradient(110deg,#5ff6ff,#7fb1ff,#c078ff,#5ff6ff);\n  --ten-primary-text: #04131c;\n  --ten-primary-border: \
rgba(160,255,255,.72);\n  --ten-danger-bg: rgba(255,97,116,.12);\n  --ten-danger-text: #ffdfe5;\n  --ten-danger-border: rgba(255,97,116,.3);\n  --ten-input-bg: \
rgba(2,10,22,.42);\n  --ten-popover-bg: linear-gradient(150deg,rgba(28,51,75,.98),rgba(10,22,40,.98));\n  --ten-empty-bg: rgba(11,27,49,.38);\n  --ten-info-bg: \
rgba(2,10,22,.25);\n  --ten-mini-bg: linear-gradient(145deg,rgba(28,51,75,.94),rgba(20,28,52,.95));\n  --ten-overlay-bg: rgba(2,8,19,.62);\n  --ten-tooltip-bg: \
rgba(5,15,29,.97);\n  --ten-tooltip-text: #eefaff;\n  --ten-tooltip-border: rgba(95,246,255,.28);\n  --ten-tooltip-shadow: 0 10px 28px rgba(0,5,15,.38), inset 0 \
1px rgba(255,255,255,.08);\n  --ten-toast-bg: rgba(5,15,29,.94);\n  --ten-toast-text: #eefaff;\n  --ten-toast-border: rgba(95,246,255,.3);\n  --ten-launcher-bg: \
linear-gradient(145deg,rgba(28,72,108,.88),rgba(91,54,148,.86));\n  --ten-launcher-border: rgba(111,236,255,.48);\n  --ten-launcher-shadow: 0 12px 34px \
rgba(4,14,30,.3),0 0 25px rgba(95,246,255,.2),inset 0 1px rgba(255,255,255,.18);\n  --ten-radius-launcher: 18px;\n  --ten-focus-ring: 0 0 0 3px \
rgba(95,246,255,.1);\n  --ten-scroll-thumb: rgba(95,246,255,.3);\n  --ten-radius-panel: 24px;\n  --ten-radius-card: 15px;\n  --ten-radius-control: 11px;\n  \
--ten-scale: 1;\n  position: fixed;\n  z-index: 2147483645;\n  inset: 0;\n  pointer-events: none;\n  color: var(--ten-text);\n  font: 13px/1.5 Inter, "PingFang \
SC", "Microsoft YaHei", sans-serif;\n}\n#ten-comic-root *,\n#ten-comic-root *::before,\n#ten-comic-root *::after { box-sizing: border-box; \
}\n:where(#ten-comic-root) #ten-comic-launcher {\n  all: initial;\n  position: fixed;\n  z-index: 2147483646;\n  top: 50%;\n  right: 12px;\n  width: 52px;\n  \
height: 52px;\n  display: grid;\n  place-items: center;\n  transform: translateY(-50%);\n  overflow: hidden;\n  color: #efffff;\n  font: 800 12px/1 Inter, \
"Segoe UI", sans-serif;\n  letter-spacing: .06em;\n  cursor: pointer;\n  pointer-events: auto;\n  border: 1px solid var(--ten-launcher-border);\n  \
border-radius: var(--ten-radius-launcher);\n  background: var(--ten-launcher-bg);\n  box-shadow: var(--ten-launcher-shadow);\n  backdrop-filter: blur(22px) \
saturate(1.4);\n  -webkit-backdrop-filter: blur(22px) saturate(1.4);\n  transition: opacity .12s ease, transform .18s cubic-bezier(.22,1,.36,1), box-shadow \
.2s;\n}\n:where(#ten-comic-root) #ten-comic-launcher::before { content: ""; position: absolute; inset: -65%; background: conic-gradient(from 90deg, transparent, \
rgba(95,246,255,.52), transparent 30%); animation: ten-launcher-orbit 5s linear infinite; }\n:where(#ten-comic-root) #ten-comic-launcher span { position: \
relative; z-index: 1; }\n:where(#ten-comic-root) #ten-comic-launcher:hover { transform: translateY(-50%) scale(1.08); box-shadow: 0 15px 40px rgba(4,14,30,.38), \
0 0 34px rgba(95,246,255,.28); }\n:where(#ten-comic-root) #ten-comic-launcher:active { transform: translateY(-50%) scale(.95); }\n:where(#ten-comic-root) \
#ten-comic-launcher.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; transform: translate(20px,-50%) scale(.72); }\n:where(#ten-comic-root) \
.ten-mini-task { position: fixed; z-index: 2147483646; top: 50%; right: 12px; width: min(292px,calc(100vw - 24px)); min-height: 58px; display: grid; \
grid-template-columns: minmax(0,1fr) 42px; align-items: stretch; overflow: hidden; pointer-events: auto; border: 1px solid var(--ten-panel-border); \
border-radius: var(--ten-radius-card); background: var(--ten-mini-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: blur(24px) saturate(1.3); \
transform: translateY(-50%); transition: opacity .2s ease,transform .28s cubic-bezier(.22,1,.36,1),visibility .2s; }\n:where(#ten-comic-root) \
.ten-mini-task.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; transform: translate(22px,-50%) scale(.9); }\n:where(#ten-comic-root) \
.ten-mini-open,\n:where(#ten-comic-root) .ten-mini-toggle { min-width: 0; padding: 0; color: var(--ten-text); font: inherit; cursor: pointer; border: 0; \
background: transparent; }\n:where(#ten-comic-root) .ten-mini-open { display: grid; grid-template-columns: 32px minmax(0,1fr); align-items: center; gap: 8px; \
padding: 8px 5px 8px 10px; text-align: left; }\n:where(#ten-comic-root) .ten-mini-icon { width: 31px; height: 31px; display: grid; place-items: center; color: \
var(--ten-cyan); border: 1px solid rgba(95,246,255,.22); border-radius: 10px; background: rgba(95,246,255,.08); }\n:where(#ten-comic-root) .ten-mini-icon \
.ten-icon { width: 17px; height: 17px; }\n:where(#ten-comic-root) .ten-mini-copy { min-width: 0; display: grid; gap: 1px; }\n:where(#ten-comic-root) \
.ten-mini-copy strong,\n:where(#ten-comic-root) .ten-mini-copy small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; \
}\n:where(#ten-comic-root) .ten-mini-copy strong { font-size: 10px; }\n:where(#ten-comic-root) .ten-mini-copy small { color: var(--ten-muted); font-size: 9px; \
}\n:where(#ten-comic-root) .ten-mini-progress { height: 3px; margin-top: 3px; overflow: hidden; border-radius: 4px; background: rgba(255,255,255,.09); \
}\n:where(#ten-comic-root) .ten-mini-progress i { display: block; width: 0; height: 100%; border-radius: inherit; background: \
linear-gradient(90deg,var(--ten-cyan),var(--ten-violet)); box-shadow: 0 0 8px rgba(95,246,255,.36); transition: width .35s ease; }\n:where(#ten-comic-root) \
.ten-mini-toggle { display: grid; place-items: center; border-left: 1px solid var(--ten-line); transition: color .18s,background .18s; \
}\n:where(#ten-comic-root) .ten-mini-toggle:hover { color: var(--ten-cyan); background: rgba(95,246,255,.08); }\n:where(#ten-comic-root) \
.ten-mini-toggle[hidden] { display: none; }\n:where(#ten-comic-root) .ten-icon-tooltip { position: fixed; z-index: 2147483647; left: 0; top: 0; max-width: \
min(240px,calc(100vw - 16px)); padding: 5px 8px; overflow: hidden; color: var(--ten-tooltip-text); font: 10px/1.4 Inter,"PingFang SC","Microsoft \
YaHei",sans-serif; white-space: nowrap; text-overflow: ellipsis; pointer-events: none; opacity: 0; visibility: hidden; border: 1px solid \
var(--ten-tooltip-border); border-radius: 8px; background: var(--ten-tooltip-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: blur(14px) \
saturate(1.2); transform: translateY(3px) scale(.96); transition: opacity .14s ease,transform .18s cubic-bezier(.22,1,.36,1),visibility .14s; \
}\n:where(#ten-comic-root) .ten-icon-tooltip.is-show { opacity: 1; visibility: visible; transform: translateY(0) scale(1); }\n:where(#ten-comic-root) \
.ten-rule-pick-layer { position: fixed; z-index: 2147483647; inset: 0; pointer-events: none; }\n:where(#ten-comic-root) .ten-rule-pick-layer.is-hidden { \
display: none; }\n:where(#ten-comic-root) .ten-rule-pick-box { position: fixed; border: 2px solid var(--ten-cyan); border-radius: 7px; background: \
rgba(95,246,255,.1); box-shadow: 0 0 0 9999px rgba(2,8,18,.12),0 0 22px rgba(95,246,255,.42); transition: left .08s,top .08s,width .08s,height .08s; \
}\n:where(#ten-comic-root) .ten-rule-pick-hud { position: fixed; top: 16px; left: 50%; width: min(420px,calc(100vw - 24px)); min-height: 56px; display: grid; \
grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 8px 9px; color: var(--ten-text); border: 1px solid \
var(--ten-panel-border); border-radius: var(--ten-radius-card); background: var(--ten-mini-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: \
blur(22px); transform: translateX(-50%); }\n:where(#ten-comic-root) .ten-rule-pick-symbol { width: 32px; height: 32px; display: grid; place-items: center; \
color: var(--ten-cyan); border: 1px solid rgba(95,246,255,.25); border-radius: 10px; background: rgba(95,246,255,.08); }\n:where(#ten-comic-root) \
.ten-rule-pick-hud > span:nth-child(2) { min-width: 0; display: grid; }\n:where(#ten-comic-root) .ten-rule-pick-hud strong,\n:where(#ten-comic-root) \
.ten-rule-pick-hud small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n:where(#ten-comic-root) .ten-rule-pick-hud strong { font-size: \
11px; }\n:where(#ten-comic-root) .ten-rule-pick-hud small { color: var(--ten-muted); font: 9px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace; \
}\n:where(#ten-comic-root) .ten-rule-pick-hud button { min-height: 30px; padding: 4px 10px; color: var(--ten-text); font: inherit; font-size: 10px; cursor: \
pointer; pointer-events: auto; border: 1px solid rgba(255,97,116,.28); border-radius: 9px; background: rgba(255,97,116,.11); }\n#ten-comic-root.is-rule-picking \
#ten-panel { opacity: 0; pointer-events: none; transform: translate(34px,-50%) scale(.94); }\n#ten-comic-root.is-rule-picking \
#ten-comic-launcher,\n#ten-comic-root.is-rule-picking .ten-mini-task { opacity: 0; visibility: hidden; pointer-events: none; \
}\nhtml.ten-rule-picking-page,\nhtml.ten-rule-picking-page * { cursor: crosshair !important; user-select: none !important; }\nhtml.ten-rule-picking-page \
#ten-rule-pick-cancel { cursor: pointer !important; }\n:where(#ten-comic-root) #ten-panel {\n  position: fixed;\n  top: 50%;\n  right: 14px;\n  width: \
min(430px, calc(100vw - 44px));\n  height: min(780px, calc(100vh - 28px));\n  display: grid;\n  grid-template-rows: 58px minmax(0,1fr) 66px;\n  transform: \
translate(28px,-50%) scale(var(--ten-scale));\n  transform-origin: right center;\n  opacity: 0;\n  pointer-events: none;\n  overflow: hidden;\n  isolation: \
isolate;\n  border: 1px solid var(--ten-panel-border);\n  border-radius: var(--ten-radius-panel);\n  background: var(--ten-panel-bg);\n  box-shadow: \
var(--ten-panel-shadow);\n  backdrop-filter: blur(32px) saturate(1.45);\n  -webkit-backdrop-filter: blur(32px) saturate(1.45);\n  transition: transform .42s \
cubic-bezier(.22,1,.36,1), opacity .22s ease;\n}\n:where(#ten-comic-root) #ten-panel.is-open { transform: translate(0,-50%) scale(var(--ten-scale)); opacity: 1; \
pointer-events: auto; }\n:where(#ten-comic-root) #ten-panel::before {\n  content: "";\n  position: absolute;\n  z-index: 1;\n  inset: 0;\n  pointer-events: \
none;\n  background: radial-gradient(circle at 85% 0, rgba(95,246,255,.17), transparent 30%), radial-gradient(circle at 0 90%, rgba(156,108,255,.17), \
transparent 34%);\n}\n:where(#ten-comic-root) #ten-particle-field { position: absolute; z-index: 1; inset: 0; overflow: hidden; pointer-events: none; \
}\n:where(#ten-comic-root) #ten-particle-field i {\n  position: absolute;\n  left: var(--x);\n  top: var(--y);\n  width: var(--s);\n  height: var(--s);\n  \
border-radius: 50%;\n  opacity: .45;\n  background: var(--c);\n  box-shadow: 0 0 10px var(--c);\n  animation: ten-particle var(--d) ease-in-out var(--delay) \
infinite alternate;\n}\n#ten-comic-root[data-effects="0"] #ten-particle-field { display: none; }\n#ten-comic-root[data-effects="0"] #ten-comic-launcher::before \
{ animation: none; opacity: 0; }\n#ten-comic-root[data-effects="1"] #ten-particle-field i { opacity: .28; }\n#ten-comic-root[data-effects="1"] \
#ten-particle-field i:nth-child(n+12) { display: none; }\n#ten-comic-root[data-effects="1"] #ten-comic-launcher::before { animation-duration: 8s; opacity: .6; \
}\n:where(#ten-comic-root) #ten-search-panel {\n  position: fixed;\n  z-index: 2147483644;\n  top: 50%;\n  right: 456px;\n  width: min(680px, calc(100vw - \
486px));\n  height: min(720px, calc(100vh - 44px));\n  display: grid;\n  grid-template-rows: 58px minmax(0,1fr);\n  transform: translate(22px,-50%) \
scale(.98);\n  transform-origin: right center;\n  overflow: hidden;\n  opacity: 0;\n  visibility: hidden;\n  pointer-events: none;\n  color: var(--ten-text);\n  \
border: 1px solid rgba(133,233,255,.25);\n  border-radius: 22px;\n  background: radial-gradient(circle at 100% 0, rgba(95,246,255,.14), transparent 34%), \
linear-gradient(150deg, rgba(20,42,67,.74), rgba(7,17,34,.84));\n  box-shadow: 0 26px 80px rgba(0,5,15,.44), inset 0 1px rgba(255,255,255,.07);\n  \
backdrop-filter: blur(30px) saturate(1.4);\n  -webkit-backdrop-filter: blur(30px) saturate(1.4);\n  transition: transform .38s cubic-bezier(.22,1,.36,1), \
opacity .24s ease, visibility .24s;\n}\n:where(#ten-comic-root) #ten-search-panel.is-open { transform: translate(0,-50%) scale(1); opacity: 1; visibility: \
visible; pointer-events: auto; }\n:where(#ten-comic-root) .ten-search-panel-header { display: flex; align-items: center; justify-content: space-between; \
padding: 0 13px 0 17px; border-bottom: 1px solid var(--ten-line); background: var(--ten-header-bg); }\n:where(#ten-comic-root) .ten-search-panel-content { \
min-height: 0; padding: 13px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(95,246,255,.35) transparent; }\n:where(#ten-comic-root) \
.ten-search-panel-content::-webkit-scrollbar { width: 6px; }\n:where(#ten-comic-root) .ten-search-panel-content::-webkit-scrollbar-thumb { border-radius: 9px; \
background: var(--ten-scroll-thumb); }\n:where(#ten-comic-root) .ten-header,\n:where(#ten-comic-root) .ten-content,\n:where(#ten-comic-root) .ten-nav { \
position: relative; z-index: 2; }\n:where(#ten-comic-root) .ten-header { display: flex; align-items: center; gap: 11px; padding: 0 14px 0 16px; border-bottom: \
1px solid var(--ten-line); background: var(--ten-header-bg); }\n:where(#ten-comic-root) .ten-brand-mark { width: 31px; height: 31px; display: grid; place-items: \
center; border: 1px solid rgba(95,246,255,.48); border-radius: 11px; color: var(--ten-cyan); font-weight: 900; background: rgba(95,246,255,.08); box-shadow: 0 0 \
20px rgba(95,246,255,.14); }\n:where(#ten-comic-root) .ten-heading { min-width: 0; flex: 1; }\n:where(#ten-comic-root) .ten-title { font-size: 14px; \
font-weight: 750; letter-spacing: .04em; }\n:where(#ten-comic-root) .ten-subtitle { color: var(--ten-muted); font-size: 10px; letter-spacing: .12em; \
text-transform: uppercase; }\n:where(#ten-comic-root) .ten-icon-btn { width: 34px; height: 34px; display: grid; place-items: center; padding: 0; color: \
var(--ten-muted); cursor: pointer; border: 1px solid transparent; border-radius: 11px; background: transparent; transition: .2s ease; }\n:where(#ten-comic-root) \
.ten-icon-btn:hover { color: var(--ten-cyan); border-color: var(--ten-line); background: var(--ten-control-hover-bg); transform: translateY(-1px); \
}\n:where(#ten-comic-root) .ten-icon { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: \
round; }\n:where(#ten-comic-root) .ten-content { min-height: 0; overflow: hidden; font-size: inherit !important; }\n:where(#ten-comic-root) .ten-view { display: \
none; height: 100%; padding: 13px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(95,246,255,.35) transparent; }\n:where(#ten-comic-root) \
.ten-view.is-active { display: block; animation: ten-view-in .28s ease; }\n:where(#ten-comic-root) .ten-view::-webkit-scrollbar { width: 6px; \
}\n:where(#ten-comic-root) .ten-view::-webkit-scrollbar-thumb { border-radius: 9px; background: var(--ten-scroll-thumb); }\n:where(#ten-comic-root) .ten-nav { \
--tab: 1; display: grid; grid-template-columns: repeat(4,1fr); padding: 7px; border-top: 1px solid var(--ten-line); background: var(--ten-header-bg); \
}\n:where(#ten-comic-root) .ten-nav::before { content: ""; position: absolute; z-index: 0; top: 7px; bottom: 7px; left: 7px; width: calc((100% - 14px)/4); \
border: 1px solid rgba(95,246,255,.28); border-radius: 14px; background: linear-gradient(145deg, rgba(95,246,255,.13), rgba(156,108,255,.12)); box-shadow: 0 7px \
20px rgba(0,0,0,.18), inset 0 1px rgba(255,255,255,.12); transform: translateX(calc(var(--tab)*100%)); transition: transform .38s cubic-bezier(.22,1,.36,1); \
}\n:where(#ten-comic-root) .ten-tab { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: \
2px; color: var(--ten-muted); font: inherit; font-size: 10px; cursor: pointer; border: 0; background: transparent; transition: color .2s, transform .2s; \
}\n:where(#ten-comic-root) .ten-tab:hover { color: var(--ten-text); }\n:where(#ten-comic-root) .ten-tab.is-active { color: var(--ten-cyan); \
}\n:where(#ten-comic-root) .ten-tab.is-active .ten-icon { transform: translateY(-1px) scale(1.08); }\n:where(#ten-comic-root) \
.ten-toolbar,\n:where(#ten-comic-root) .ten-row { display: flex; align-items: center; gap: 8px; }\n:where(#ten-comic-root) .ten-toolbar { margin-bottom: 11px; \
}\n:where(#ten-comic-root) .ten-spacer { flex: 1; }\n:where(#ten-comic-root) .ten-card { margin-bottom: 9px; padding: 11px; border: 1px solid \
var(--ten-card-border); border-radius: var(--ten-radius-card); background: var(--ten-card-bg); box-shadow: var(--ten-card-shadow); backdrop-filter: blur(18px); \
}\n:where(#ten-comic-root) .ten-card-title { margin-bottom: 7px; color: var(--ten-cyan); font-size: 11px; font-weight: 750; letter-spacing: .08em; \
text-transform: uppercase; }\n:where(#ten-comic-root) .ten-card-head { min-height: 30px; display: flex; align-items: center; justify-content: space-between; \
gap: 8px; margin-bottom: 7px; }\n:where(#ten-comic-root) .ten-card-head .ten-card-title { margin-bottom: 0; }\n:where(#ten-comic-root) .ten-btn { position: \
relative; min-height: 35px; padding: 7px 12px; overflow: hidden; color: var(--ten-text); font: inherit; font-weight: 650; cursor: pointer; border: 1px solid \
var(--ten-control-border); border-radius: var(--ten-radius-control); background: var(--ten-control-bg); background-size: 220% 100%; transition: transform .18s, \
border-color .18s, box-shadow .18s, background-position .35s; }\n:where(#ten-comic-root) .ten-btn::before { content: ""; position: absolute; top: -70%; left: \
-35%; width: 26%; height: 240%; opacity: 0; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent); transform: \
rotate(18deg); transition: left .45s cubic-bezier(.22,1,.36,1), opacity .2s; }\n:where(#ten-comic-root) .ten-btn:hover:not(:disabled) { transform: \
translateY(-2px); border-color: rgba(95,246,255,.5); background-position: 100% 50%; box-shadow: 0 9px 24px rgba(29,117,165,.18); }\n:where(#ten-comic-root) \
.ten-btn:hover::before { left: 112%; opacity: .75; }\n:where(#ten-comic-root) .ten-btn:active:not(:disabled) { transform: scale(.97); }\n:where(#ten-comic-root) \
.ten-btn:disabled { opacity: .38; cursor: not-allowed; }\n:where(#ten-comic-root) .ten-btn.is-primary { color: var(--ten-primary-text); border-color: \
var(--ten-primary-border); background: var(--ten-primary-bg); background-size: 260% 100%; }\n:where(#ten-comic-root) .ten-btn.is-danger { color: \
var(--ten-danger-text); border-color: var(--ten-danger-border); background: var(--ten-danger-bg); }\n:where(#ten-comic-root) .ten-btn.is-small { min-height: \
30px; padding: 5px 9px; font-size: 11px; }\n:where(#ten-comic-root) .ten-icon-label { display: inline-flex; align-items: center; justify-content: center; gap: \
6px; }\n:where(#ten-comic-root) .ten-icon-label span { white-space: nowrap; }\n:where(#ten-comic-root) .ten-ripple { position: absolute; border-radius: 50%; \
pointer-events: none; background: rgba(255,255,255,.36); transform: scale(0); animation: ten-ripple .62s ease-out; }\n:where(#ten-comic-root) \
.ten-input,\n:where(#ten-comic-root) .ten-select,\n:where(#ten-comic-root) .ten-textarea { width: 100%; color: var(--ten-text); font: inherit; border: 1px solid \
var(--ten-line); border-radius: var(--ten-radius-control); outline: 0; background: var(--ten-input-bg); transition: border-color .2s, box-shadow .2s; \
}\n:where(#ten-comic-root) .ten-input,\n:where(#ten-comic-root) .ten-select { height: 36px; padding: 0 10px; }\n:where(#ten-comic-root) .ten-textarea { \
min-height: 110px; padding: 10px; resize: vertical; }\n:where(#ten-comic-root) input.ten-input[type="number"] { padding-right: 30px; appearance: textfield; \
-moz-appearance: textfield; }\n:where(#ten-comic-root) input.ten-input[type="number"]::-webkit-inner-spin-button,\n:where(#ten-comic-root) \
input.ten-input[type="number"]::-webkit-outer-spin-button { margin: 0; appearance: none; -webkit-appearance: none; }\n:where(#ten-comic-root) \
.ten-number-control { position: relative; min-width: 0; width: 100%; }\n:where(#ten-comic-root) .ten-number-steps { position: absolute; top: 4px; right: 4px; \
bottom: 4px; width: 23px; display: grid; grid-template-rows: 1fr 1fr; overflow: hidden; border: 1px solid rgba(95,246,255,.12); border-radius: 7px; opacity: \
.42; transition: opacity .2s, border-color .2s, box-shadow .2s; }\n:where(#ten-comic-root) .ten-number-control:hover .ten-number-steps,\n:where(#ten-comic-root) \
.ten-number-control:focus-within .ten-number-steps { opacity: 1; border-color: rgba(95,246,255,.38); box-shadow: 0 0 10px rgba(95,246,255,.08); \
}\n:where(#ten-comic-root) .ten-number-steps button { position: relative; display: grid; place-items: center; padding: 0; color: var(--ten-muted); cursor: \
pointer; border: 0; background: rgba(95,246,255,.035); transition: color .16s, background .16s; }\n:where(#ten-comic-root) .ten-number-steps button + button { \
border-top: 1px solid rgba(95,246,255,.12); }\n:where(#ten-comic-root) .ten-number-steps button:hover { color: var(--ten-cyan); background: \
rgba(95,246,255,.12); }\n:where(#ten-comic-root) .ten-number-steps i { width: 5px; height: 5px; border-top: 1.5px solid currentColor; border-left: 1.5px solid \
currentColor; transform: translateY(1px) rotate(45deg); }\n:where(#ten-comic-root) .ten-number-steps button:last-child i { transform: translateY(-1px) \
rotate(225deg); }\n:where(#ten-comic-root) .ten-view[data-view="settings"] .ten-settings-card { border-color: rgba(137,225,255,.2); background: \
linear-gradient(145deg, rgba(61,77,98,.9), rgba(47,60,80,.9)); box-shadow: inset 0 1px rgba(255,255,255,.075), 0 8px 22px rgba(1,9,20,.08); backdrop-filter: \
blur(18px) saturate(1.15); }\n:where(#ten-comic-root) .ten-view[data-view="settings"] .ten-input,\n:where(#ten-comic-root) .ten-view[data-view="settings"] \
.ten-select,\n:where(#ten-comic-root) .ten-view[data-view="settings"] .ten-textarea { border-color: rgba(137,225,255,.18); background: rgba(6,18,34,.42); \
}\n:where(#ten-comic-root) .ten-input:focus,\n:where(#ten-comic-root) .ten-select:focus,\n:where(#ten-comic-root) .ten-textarea:focus { border-color: \
var(--ten-cyan); box-shadow: var(--ten-focus-ring); }\n:where(#ten-comic-root) .ten-select option { color: #eafaff; background: #0c1829; \
}\n:where(#ten-comic-root) .ten-source { --source: 0; position: relative; display: grid; grid-template-columns: repeat(2,1fr); flex: 1; padding: 3px; \
border-radius: 12px; background: rgba(2,10,22,.34); }\n:where(#ten-comic-root) .ten-source::before { content: ""; position: absolute; inset: 3px auto 3px 3px; \
width: calc(50% - 3px); border: 1px solid rgba(95,246,255,.25); border-radius: 9px; background: linear-gradient(145deg, rgba(95,246,255,.14), \
rgba(156,108,255,.13)); transform: translateX(calc(var(--source)*100%)); transition: transform .35s cubic-bezier(.22,1,.36,1); }\n:where(#ten-comic-root) \
.ten-source button { position: relative; z-index: 1; min-height: 33px; color: var(--ten-muted); font: inherit; font-size: 11px; cursor: pointer; border: 0; \
background: transparent; }\n:where(#ten-comic-root) .ten-source button.is-active { color: var(--ten-cyan); }\n:where(#ten-comic-root) .ten-search-toolbar \
.ten-input { width: auto; min-width: 0; flex: 1 1 auto; }\n:where(#ten-comic-root) .ten-search-site-picker { position: relative; z-index: 30; flex: 0 0 126px; \
width: 126px; min-width: 0; }\n:where(#ten-comic-root) #ten-search-site-trigger { width: 100%; height: 36px; display: flex; align-items: center; gap: 7px; \
padding: 0 10px 0 11px; overflow: hidden; color: var(--ten-text); font: inherit; font-size: 11px; cursor: pointer; border: 1px solid rgba(95,246,255,.24); \
border-radius: 11px; background: linear-gradient(145deg, rgba(18,47,70,.76), rgba(36,38,76,.72)); box-shadow: inset 0 1px rgba(255,255,255,.08); transition: \
border-color .2s, box-shadow .2s; }\n:where(#ten-comic-root) #ten-search-site-trigger:hover,\n:where(#ten-comic-root) .ten-search-site-picker.is-open \
#ten-search-site-trigger { border-color: rgba(95,246,255,.58); box-shadow: 0 0 0 3px rgba(95,246,255,.08), inset 0 1px rgba(255,255,255,.1); \
}\n:where(#ten-comic-root) #ten-search-site-label { min-width: 0; flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: left; \
}\n:where(#ten-comic-root) .ten-picker-arrow { width: 7px; height: 7px; flex: 0 0 7px; border-right: 1.5px solid var(--ten-cyan); border-bottom: 1.5px solid \
var(--ten-cyan); transform: rotate(45deg) translateY(-2px); transition: transform .28s cubic-bezier(.22,1,.36,1); }\n:where(#ten-comic-root) \
.ten-search-site-picker.is-open .ten-picker-arrow { transform: rotate(225deg) translate(-1px,-1px); }\n:where(#ten-comic-root) .ten-search-site-menu { position: \
absolute; z-index: 40; top: 43px; left: 0; width: 252px; max-height: 300px; padding: 6px; overflow-y: auto; border: 1px solid var(--ten-panel-border); \
border-radius: var(--ten-radius-card); background: var(--ten-popover-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: blur(26px) saturate(1.35); \
-webkit-backdrop-filter: blur(26px) saturate(1.35); animation: ten-picker-in .22s cubic-bezier(.22,1,.36,1); scrollbar-width: thin; scrollbar-color: \
var(--ten-scroll-thumb) transparent; }\n:where(#ten-comic-root) .ten-search-site-menu[hidden] { display: none !important; }\n:where(#ten-comic-root) \
.ten-search-site-menu::-webkit-scrollbar { width: 5px; }\n:where(#ten-comic-root) .ten-search-site-menu::-webkit-scrollbar-thumb { border-radius: 8px; \
background: rgba(95,246,255,.32); }\n:where(#ten-comic-root) .ten-search-site-option { width: 100%; min-height: 38px; display: grid; grid-template-columns: \
minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 7px 9px; color: var(--ten-text); font: inherit; font-size: 11px; text-align: left; cursor: pointer; \
border: 1px solid transparent; border-radius: 9px; background: transparent; transition: color .18s, border-color .18s, background .18s, transform .18s; \
}\n:where(#ten-comic-root) .ten-search-site-option + .ten-search-site-option { margin-top: 3px; }\n:where(#ten-comic-root) .ten-search-site-option span { \
min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n:where(#ten-comic-root) .ten-search-site-option small { color: \
var(--ten-muted); font-size: 9px; }\n:where(#ten-comic-root) .ten-search-site-option:hover:not(:disabled) { color: var(--ten-cyan); border-color: \
rgba(95,246,255,.18); background: rgba(95,246,255,.07); transform: translateX(2px); }\n:where(#ten-comic-root) .ten-search-site-option.is-selected { color: \
var(--ten-cyan); border-color: rgba(95,246,255,.28); background: linear-gradient(100deg, rgba(95,246,255,.11), rgba(156,108,255,.08)); \
}\n:where(#ten-comic-root) .ten-search-site-option:disabled { opacity: .43; cursor: not-allowed; }\n:where(#ten-comic-root) .ten-search-toolbar #ten-search-btn \
{ flex: 0 0 76px; width: 76px; padding: 7px 10px; white-space: nowrap; }\n:where(#ten-comic-root) .ten-search-toolbar #ten-search-btn .ten-icon { flex: 0 0 \
17px; width: 17px; height: 17px; }\n:where(#ten-comic-root) .ten-rule-manage { display: flex; align-items: center; justify-content: space-between; gap: 8px; \
margin: -2px 0 10px; padding: 7px 8px 7px 11px; color: var(--ten-muted); font-size: 10px; border: 1px solid var(--ten-line); border-radius: 12px; background: \
rgba(5,16,31,.3); }\n:where(#ten-comic-root) .ten-rule-manage[hidden] { display: none !important; }\n:where(#ten-comic-root) .ten-rule-item { display: grid; \
grid-template-columns: minmax(0,1fr) 34px 34px; align-items: center; gap: 5px; }\n:where(#ten-comic-root) .ten-rule-item .ten-list-item { min-width: 0; \
}\n:where(#ten-comic-root) .ten-rule-edit { color: var(--ten-cyan); border-color: rgba(95,246,255,.16); background: rgba(95,246,255,.06); \
}\n:where(#ten-comic-root) .ten-rule-delete { color: var(--ten-danger); border-color: rgba(255,97,116,.18); background: rgba(255,97,116,.07); \
}\n:where(#ten-comic-root) .ten-list { display: grid; gap: 7px; }\n:where(#ten-comic-root) .ten-list-item { display: flex; align-items: center; gap: 9px; width: \
100%; min-height: 43px; padding: 9px 11px; color: var(--ten-text); text-align: left; cursor: pointer; border: 1px solid var(--ten-line); border-radius: \
var(--ten-radius-control); background: var(--ten-list-bg); transition: .2s ease; }\n:where(#ten-comic-root) .ten-list-item:hover { border-color: \
var(--ten-cyan); background: var(--ten-list-hover-bg); transform: translateX(2px); }\n:where(#ten-comic-root) .ten-list-item.is-disabled { opacity: .4; cursor: \
not-allowed; }\n:where(#ten-comic-root) .ten-list-item input[type="checkbox"] { accent-color: var(--ten-cyan); }\n:where(#ten-comic-root) .ten-site-kind { flex: \
0 0 auto; padding: 1px 6px; color: var(--ten-cyan); font-size: 9px; border: 1px solid rgba(95,246,255,.2); border-radius: 999px; background: \
rgba(95,246,255,.06); }\n:where(#ten-comic-root) .ten-name { min-width: 0; flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; \
}\n:where(#ten-comic-root) .ten-meta { color: var(--ten-muted); font-size: 10px; }\n:where(#ten-comic-root) .ten-empty { display: grid; place-items: center; \
min-height: 250px; color: var(--ten-muted); text-align: center; }\n:where(#ten-comic-root) .ten-status { margin-bottom: 10px; padding: 9px 11px; color: \
var(--ten-muted); border: 1px solid var(--ten-line); border-radius: var(--ten-radius-control); background: var(--ten-list-bg); }\n:where(#ten-comic-root) \
.ten-status.is-ready { color: var(--ten-success); }\n:where(#ten-comic-root) .ten-options { max-height: 0; margin-bottom: 0; padding: 0 11px; overflow: hidden; \
opacity: 0; border-width: 0; transition: max-height .42s cubic-bezier(.22,1,.36,1), opacity .2s, margin .2s, padding .2s, border-width .2s; \
}\n:where(#ten-comic-root) .ten-options.is-open { max-height: 390px; margin-bottom: 10px; padding: 11px; opacity: 1; border-width: 1px; \
}\n:where(#ten-comic-root) .ten-mode-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }\n:where(#ten-comic-root) .ten-mode { min-height: \
36px; color: var(--ten-muted); font: inherit; font-size: 11px; cursor: pointer; border: 1px solid var(--ten-line); border-radius: 10px; background: \
rgba(4,13,27,.3); transition: .2s; }\n:where(#ten-comic-root) .ten-mode.is-active { color: var(--ten-cyan); border-color: rgba(95,246,255,.48); background: \
rgba(95,246,255,.1); box-shadow: 0 0 18px rgba(95,246,255,.08); }\n:where(#ten-comic-root) .ten-chapter-tools { position: sticky; z-index: 8; top: -13px; \
display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; margin: 0 -5px 9px; padding: 7px 5px; border: 1px solid rgba(137,225,255,.16); border-radius: \
13px; background: linear-gradient(145deg,rgba(61,77,98,.94),rgba(47,60,80,.94)); box-shadow: 0 8px 20px rgba(1,9,20,.15), inset 0 1px rgba(255,255,255,.07); \
backdrop-filter: blur(18px) saturate(1.15); }\n:where(#ten-comic-root) .ten-chapter-tools > :last-child { justify-self: end; }\n:where(#ten-comic-root) \
.ten-chapter-reload { position: relative; display: grid; place-items: center; min-height: 34px; margin: 3px 0 9px; }\n:where(#ten-comic-root) \
.ten-chapter-reload::before { content: ""; position: absolute; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, \
rgba(95,246,255,.28), transparent); }\n:where(#ten-comic-root) .ten-chapter-reload button { position: relative; display: inline-flex; align-items: center; gap: \
6px; padding: 4px 10px; color: var(--ten-cyan); font: inherit; font-size: 10px; cursor: pointer; border: 1px solid rgba(95,246,255,.17); border-radius: 999px; \
background: rgba(9,24,44,.82); transition: .22s ease; }\n:where(#ten-comic-root) .ten-chapter-reload button:hover { border-color: rgba(95,246,255,.42); \
box-shadow: 0 0 17px rgba(95,246,255,.1); }\n:where(#ten-comic-root) .ten-chapter-empty { display: grid; justify-items: center; gap: 8px; padding: 26px 16px \
17px; text-align: center; border: 1px solid var(--ten-line); border-radius: var(--ten-radius-card); background: var(--ten-empty-bg); }\n:where(#ten-comic-root) \
.ten-chapter-empty[hidden],\n:where(#ten-comic-root) #ten-chapter-loaded[hidden] { display: none !important; }\n:where(#ten-comic-root) .ten-empty-orbit { \
width: 52px; height: 52px; display: grid; place-items: center; color: var(--ten-cyan); border: 1px solid rgba(95,246,255,.28); border-radius: 17px; background: \
linear-gradient(145deg, rgba(95,246,255,.1), rgba(156,108,255,.1)); box-shadow: 0 0 24px rgba(95,246,255,.1); }\n:where(#ten-comic-root) .ten-empty-orbit \
.ten-icon { width: 24px; height: 24px; }\n:where(#ten-comic-root) .ten-empty-title { font-weight: 700; }\n:where(#ten-comic-root) .ten-chapter-empty .ten-btn { \
margin-top: 4px; }\n:where(#ten-comic-root) .ten-comic-info { width: min(290px,100%); display: grid; grid-template-columns: 52px minmax(0,1fr); gap: 1px; \
margin-top: 6px; overflow: hidden; text-align: left; border: 1px solid var(--ten-line); border-radius: var(--ten-radius-control); background: \
var(--ten-info-bg); }\n:where(#ten-comic-root) .ten-comic-info span,\n:where(#ten-comic-root) .ten-comic-info strong { padding: 7px 9px; border-bottom: 1px \
solid rgba(95,246,255,.08); }\n:where(#ten-comic-root) .ten-comic-info span { color: var(--ten-muted); font-size: 10px; }\n:where(#ten-comic-root) \
.ten-comic-info strong { min-width: 0; overflow: hidden; color: var(--ten-text); font-size: 11px; font-weight: 600; white-space: nowrap; text-overflow: \
ellipsis; }\n:where(#ten-comic-root) .ten-chapter-list-head { display: flex; align-items: center; justify-content: space-between; min-height: 39px; \
margin-bottom: 6px; padding: 3px 5px 3px 11px; color: var(--ten-muted); font-size: 10px; border: 1px solid var(--ten-line); border-radius: 12px; background: \
rgba(9,24,44,.38); }\n:where(#ten-comic-root) .ten-chapter-list-head .ten-icon-btn.is-active { color: var(--ten-cyan); border-color: rgba(95,246,255,.35); \
background: rgba(95,246,255,.1); }\n:where(#ten-comic-root) .ten-chapter-list { display: grid; gap: 5px; max-height: none; overflow: visible; \
}\n:where(#ten-comic-root) .ten-progress { height: 5px; margin-top: 7px; overflow: hidden; border-radius: 9px; background: rgba(255,255,255,.08); \
}\n:where(#ten-comic-root) .ten-progress > i { position: relative; display: block; height: 100%; overflow: hidden; border-radius: inherit; background: \
linear-gradient(90deg, var(--ten-cyan), var(--ten-violet)); box-shadow: 0 0 12px rgba(95,246,255,.4); transition: width .35s; }\n:where(#ten-comic-root) \
.ten-progress > i::after { content: ""; position: absolute; inset: 0; width: 42%; pointer-events: none; opacity: 0; background: \
linear-gradient(90deg,transparent,rgba(255,255,255,.9),rgba(95,246,255,.45),transparent); transform: translateX(-140%); }\n#ten-comic-root[data-effects="1"] \
.ten-progress > i::after { opacity: .34; animation: ten-energy-flow var(--ten-energy-duration,7s) linear infinite; }\n#ten-comic-root[data-effects="2"] \
.ten-progress > i::after { opacity: .62; animation: ten-energy-flow var(--ten-energy-duration,5.8s) linear infinite; }\n:where(#ten-comic-root) .ten-progress > \
i.is-paused::after { opacity: 0 !important; animation-play-state: paused !important; }\n:where(#ten-comic-root) .ten-task-title { min-width: 0; overflow: \
hidden; font-weight: 650; white-space: nowrap; text-overflow: ellipsis; }\n:where(#ten-comic-root) .ten-task-group { margin-bottom: 9px; overflow: hidden; \
border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-card); background: var(--ten-task-bg); box-shadow: var(--ten-card-shadow); \
}\n:where(#ten-comic-root) .ten-task-header { min-height: 48px; display: flex; align-items: center; padding: 5px 8px 5px 13px; }\n:where(#ten-comic-root) \
.ten-task-title-button { min-width: 0; flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 0; color: var(--ten-text); font: inherit; \
font-weight: 700; text-align: left; cursor: pointer; border: 0; background: transparent; }\n:where(#ten-comic-root) .ten-task-bulk { flex: 0 0 auto; min-height: \
29px; margin-left: 4px; padding: 4px 9px; font-size: 9px; white-space: nowrap; }\n:where(#ten-comic-root) .ten-task-bulk[hidden] { display: none; \
}\n:where(#ten-comic-root) .ten-task-control-group { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; margin-left: 4px; }\n:where(#ten-comic-root) \
.ten-task-control-group .ten-task-bulk { margin-left: 0; }\n:where(#ten-comic-root) .ten-task-arrow-button { width: 31px; height: 31px; flex: 0 0 31px; display: \
grid; place-items: center; padding: 0; color: var(--ten-muted); cursor: pointer; border: 1px solid transparent; border-radius: 9px; background: transparent; \
transition: color .2s, border-color .2s, background .2s; }\n:where(#ten-comic-root) .ten-task-arrow-button:hover { color: var(--ten-cyan); border-color: \
rgba(95,246,255,.2); background: rgba(95,246,255,.07); }\n:where(#ten-comic-root) .ten-task-arrow-button .ten-task-arrow { margin: 0; }\n:where(#ten-comic-root) \
.ten-task-count { min-width: 22px; padding: 1px 7px; color: var(--ten-cyan); font-size: 10px; text-align: center; border: 1px solid rgba(95,246,255,.2); \
border-radius: 999px; background: rgba(95,246,255,.07); }\n:where(#ten-comic-root) .ten-task-arrow { width: 8px; height: 8px; margin-left: auto; margin-right: \
5px; border-right: 1.5px solid var(--ten-muted); border-bottom: 1.5px solid var(--ten-muted); transform: rotate(45deg) translateY(-2px); transition: transform \
.5s cubic-bezier(.22,1,.36,1); }\n:where(#ten-comic-root) .ten-task-group.is-open .ten-task-arrow { transform: rotate(225deg) translate(-2px,-2px); \
}\n:where(#ten-comic-root) .ten-task-body { min-width: 0; display: grid; grid-template-rows: 0fr; padding: 0 10px; overflow: hidden; opacity: 0; border-top: 0 \
solid var(--ten-line); transition: grid-template-rows .5s cubic-bezier(.22,1,.36,1), opacity .5s ease, padding .5s ease, border-width .5s ease; \
}\n:where(#ten-comic-root) .ten-task-body > .ten-list { min-width: 0; width: 100%; min-height: 0; overflow: hidden; }\n:where(#ten-comic-root) \
.ten-task-group.is-open .ten-task-body { grid-template-rows: 1fr; padding: 9px 10px 10px; opacity: 1; border-top-width: 1px; }\n:where(#ten-comic-root) \
.ten-task-group.is-open .ten-task-body > .ten-list { max-height: none; overflow: visible; }\n:where(#ten-comic-root) .ten-task-group.is-open.has-scroll \
.ten-task-body > .ten-list { max-height: 400px; overflow-y: auto; }\n:where(#ten-comic-root) .ten-task-body .ten-empty { min-height: 72px; \
}\n:where(#ten-comic-root) .ten-task-meta { min-width: 0; display: flex; justify-content: space-between; gap: 8px; margin-top: 5px; color: var(--ten-muted); \
font-size: 10px; }\n:where(#ten-comic-root) .ten-task-meta > span:first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; \
}\n:where(#ten-comic-root) .ten-task-meta > span:last-child { flex: 0 0 auto; white-space: nowrap; }\n:where(#ten-comic-root) .ten-task-performance { min-width: \
0; display: flex; justify-content: space-between; gap: 8px; margin-top: 3px; color: rgba(190,216,231,.72); font-size: 9px; font-variant-numeric: tabular-nums; \
}\n:where(#ten-comic-root) .ten-task-performance > span:first-child { color: rgba(95,246,255,.86); }\n:where(#ten-comic-root) .ten-task-performance > \
span:last-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: right; }\n:where(#ten-comic-root) .ten-effect-level { position: \
relative; display: grid; gap: 3px; padding: 3px; border-radius: 11px; background: rgba(3,14,28,.38); }\n:where(#ten-comic-root) .ten-effect-level { \
grid-template-columns: repeat(3,minmax(0,1fr)); }\n:where(#ten-comic-root) .ten-effect-level button { min-width: 0; min-height: 29px; padding: 3px 5px; color: \
var(--ten-muted); font: inherit; font-size: 9px; cursor: pointer; border: 1px solid transparent; border-radius: 8px; background: transparent; transition: color \
.18s, border-color .18s, background .18s, box-shadow .18s; }\n:where(#ten-comic-root) .ten-effect-level button.is-active { color: var(--ten-cyan); border-color: \
rgba(95,246,255,.28); background: linear-gradient(145deg,rgba(95,246,255,.12),rgba(156,108,255,.11)); box-shadow: inset 0 1px rgba(255,255,255,.06); \
}\n:where(#ten-comic-root) .ten-state-animate { --ten-state-rgb: 95,246,255; position: relative; }\n:where(#ten-comic-root) .ten-state-animate.is-state-pause { \
--ten-state-rgb: 156,108,255; }\n:where(#ten-comic-root) .ten-state-animate.is-state-resume { --ten-state-rgb: 95,246,255; }\n:where(#ten-comic-root) \
.ten-state-animate.is-state-success { --ten-state-rgb: 85,239,182; }\n:where(#ten-comic-root) .ten-state-animate.is-state-danger { --ten-state-rgb: 255,97,116; \
}\n:where(#ten-comic-root) .ten-state-animate::after { content: ""; position: absolute; z-index: 4; top: 0; bottom: 0; left: -42%; width: 38%; pointer-events: \
none; opacity: 0; border-radius: inherit; background: linear-gradient(90deg,transparent,rgba(var(--ten-state-rgb),.38),transparent); \
}\n#ten-comic-root[data-effects="1"] .ten-state-animate { animation: ten-state-border .9s ease-out 1; }\n#ten-comic-root[data-effects="1"] \
.ten-state-animate::after { animation: ten-state-scan .86s cubic-bezier(.22,1,.36,1) 1; }\n#ten-comic-root[data-effects="2"] .ten-state-animate { animation: \
ten-state-border .68s ease-out 1; }\n#ten-comic-root[data-effects="2"] .ten-state-animate::after { background: \
linear-gradient(90deg,transparent,rgba(var(--ten-state-rgb),.62),transparent); animation: ten-state-scan .62s cubic-bezier(.22,1,.36,1) 1; \
}\n:where(#ten-comic-root) .ten-setting { display: grid; grid-template-columns: minmax(0,1fr) minmax(120px,1fr); align-items: center; gap: 10px; margin-bottom: \
9px; }\n:where(#ten-comic-root) .ten-setting label { color: #c9dce8; }\n#ten-comic-root .ten-setting label,\n#ten-comic-root .ten-rule-fields label { position: \
static !important; inset: auto !important; transform: none !important; }\n:where(#ten-comic-root) .ten-appearance-card { padding-bottom: 7px; \
}\n:where(#ten-comic-root) .ten-appearance-setting { margin-bottom: 7px; }\n:where(#ten-comic-root) .ten-appearance-axis { display: grid; grid-template-columns: \
repeat(3,minmax(0,1fr)); gap: 3px; padding: 3px; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-control); background: \
var(--ten-input-bg); }\n:where(#ten-comic-root) .ten-appearance-axis button { min-width: 0; min-height: 29px; padding: 3px 4px; color: var(--ten-muted); font: \
inherit; font-size: 9px; cursor: pointer; border: 1px solid transparent; border-radius: 8px; background: transparent; transition: color .18s, border-color .18s, \
background .18s, transform .18s; }\n:where(#ten-comic-root) .ten-appearance-axis button:hover { color: var(--ten-text); background: var(--ten-control-hover-bg); \
}\n:where(#ten-comic-root) .ten-appearance-axis button.is-active { color: var(--ten-cyan); border-color: var(--ten-control-border); background: \
var(--ten-control-hover-bg); box-shadow: inset 0 1px rgba(255,255,255,.06); }\n:where(#ten-comic-root) .ten-settings-download .ten-setting { min-height: 36px; \
margin-bottom: 10px; }\n:where(#ten-comic-root) .ten-settings-download .ten-setting > label { font-size: 11px; line-height: 1.5; }\n:where(#ten-comic-root) \
.ten-settings-download .ten-setting-check { min-height: 30px; margin-top: 2px; margin-bottom: 11px; }\n:where(#ten-comic-root) .ten-direct-flow-setting { \
display: block !important; min-height: 0 !important; }\n:where(#ten-comic-root) .ten-direct-flow-setting > label { display: block; margin-bottom: 6px; \
}\n:where(#ten-comic-root) .ten-direct-flow-options { display: grid; gap: 6px; }\n:where(#ten-comic-root) .ten-direct-flow-options button { width: 100%; \
padding: 8px 10px; color: var(--ten-text); font: inherit; text-align: left; cursor: pointer; border: 1px solid var(--ten-control-border); border-radius: 10px; \
background: var(--ten-input-bg); transition: border-color .18s, background .18s, transform .18s; }\n:where(#ten-comic-root) .ten-direct-flow-options \
button:hover { transform: translateY(-1px); background: var(--ten-control-hover-bg); }\n:where(#ten-comic-root) .ten-direct-flow-options button.is-active { \
border-color: var(--ten-cyan); box-shadow: 0 0 0 3px rgba(95,246,255,.08); }\n:where(#ten-comic-root) .ten-direct-flow-options strong,\n:where(#ten-comic-root) \
.ten-direct-flow-options small { display: block; }\n:where(#ten-comic-root) .ten-direct-flow-options small { margin-top: 3px; color: var(--ten-muted); \
font-size: 10px; line-height: 1.45; }\n:where(#ten-comic-root) .ten-path-sanitize-setting { align-items: center; }\n:where(#ten-comic-root) \
.ten-path-sanitize-setting > div { min-width: 0; }\n:where(#ten-comic-root) .ten-path-sanitize-setting label,\n:where(#ten-comic-root) \
.ten-path-sanitize-setting small { display: block; }\n:where(#ten-comic-root) .ten-path-sanitize-setting small { margin-top: 3px; color: var(--ten-muted); \
font-size: 9px; line-height: 1.4; }\n:where(#ten-comic-root) .ten-setting .ten-input { text-align: center; font-variant-numeric: tabular-nums; \
}\n:where(#ten-comic-root) .ten-setting .ten-select { text-align: center; text-align-last: center; }\n:where(#ten-comic-root) .ten-setting-select { position: \
relative; z-index: 12; min-width: 0; width: 100%; }\n:where(#ten-comic-root) #ten-default-mode-trigger { width: 100%; height: 36px; display: flex; align-items: \
center; gap: 8px; padding: 0 11px; color: var(--ten-text); font: inherit; cursor: pointer; border: 1px solid rgba(137,225,255,.2); border-radius: 11px; \
background: rgba(6,18,34,.42); box-shadow: inset 0 1px rgba(255,255,255,.045); transition: border-color .2s, box-shadow .2s, background .2s; \
}\n:where(#ten-comic-root) #ten-default-mode-trigger:hover,\n:where(#ten-comic-root) .ten-setting-select.is-open #ten-default-mode-trigger { border-color: \
rgba(95,246,255,.55); background: rgba(9,27,46,.58); box-shadow: 0 0 0 3px rgba(95,246,255,.08), inset 0 1px rgba(255,255,255,.07); }\n:where(#ten-comic-root) \
#ten-default-mode-label { min-width: 0; flex: 1; text-align: center; }\n:where(#ten-comic-root) .ten-setting-select.is-open .ten-picker-arrow { transform: \
rotate(225deg) translate(-1px,-1px); }\n:where(#ten-comic-root) .ten-setting-select-menu { position: absolute; z-index: 45; top: 42px; right: 0; left: 0; \
padding: 6px; border: 1px solid var(--ten-panel-border); border-radius: var(--ten-radius-card); background: var(--ten-popover-bg); box-shadow: \
var(--ten-tooltip-shadow); backdrop-filter: blur(24px) saturate(1.35); animation: ten-picker-in .22s cubic-bezier(.22,1,.36,1); }\n:where(#ten-comic-root) \
.ten-setting-select-menu[hidden] { display: none !important; }\n:where(#ten-comic-root) .ten-setting-select-menu button { width: 100%; min-height: 43px; \
display: grid; grid-template-columns: 16px minmax(0,1fr); align-items: center; gap: 8px; padding: 6px 8px; color: var(--ten-text); font: inherit; text-align: \
left; cursor: pointer; border: 1px solid transparent; border-radius: 9px; background: transparent; transition: border-color .18s, background .18s, transform \
.18s; }\n:where(#ten-comic-root) .ten-setting-select-menu button + button { margin-top: 3px; }\n:where(#ten-comic-root) .ten-setting-select-menu button:hover { \
border-color: rgba(95,246,255,.2); background: rgba(95,246,255,.08); transform: translateX(2px); }\n:where(#ten-comic-root) .ten-setting-select-menu \
button.is-selected { border-color: rgba(95,246,255,.28); background: linear-gradient(100deg, rgba(95,246,255,.13), rgba(156,108,255,.09)); \
}\n:where(#ten-comic-root) .ten-setting-select-menu button > span:last-child { min-width: 0; display: grid; gap: 1px; }\n:where(#ten-comic-root) \
.ten-setting-select-menu strong { font-size: 11px; font-weight: 700; }\n:where(#ten-comic-root) .ten-setting-select-menu small { color: var(--ten-muted); \
font-size: 9px; }\n:where(#ten-comic-root) .ten-mode-option-mark { width: 10px; height: 10px; border: 1px solid rgba(137,225,255,.35); border-radius: 50%; \
box-shadow: inset 0 0 0 2px rgba(7,18,34,.9); transition: background .18s, box-shadow .18s; }\n:where(#ten-comic-root) .ten-setting-select-menu \
button.is-selected .ten-mode-option-mark { background: var(--ten-cyan); box-shadow: 0 0 10px rgba(95,246,255,.48), inset 0 0 0 2px rgba(7,18,34,.82); \
}\n:where(#ten-comic-root) .ten-setting input[type="checkbox"] { justify-self: end; accent-color: var(--ten-cyan); width: 18px; height: 18px; \
}\n:where(#ten-comic-root) .ten-setting input[type="range"] { width: 100%; accent-color: var(--ten-cyan); }\n:where(#ten-comic-root) .ten-setting-value { color: \
var(--ten-cyan); font-variant-numeric: tabular-nums; text-align: right; }\n:where(#ten-comic-root) .ten-grid-2 { display: grid; grid-template-columns: \
repeat(2,minmax(0,1fr)); gap: 7px; }\n:where(#ten-comic-root) .ten-toast { position: absolute; z-index: 20; left: 50%; bottom: 78px; max-width: 86%; display: \
flex; align-items: center; gap: 8px; padding: 9px 10px 9px 13px; color: var(--ten-toast-text); border: 1px solid var(--ten-toast-border); border-radius: \
var(--ten-radius-control); background: var(--ten-toast-bg); box-shadow: var(--ten-tooltip-shadow); transform: translate(-50%,12px); opacity: 0; pointer-events: \
none; transition: .22s; }\n:where(#ten-comic-root) .ten-toast.is-show { transform: translate(-50%,0); opacity: 1; }\n:where(#ten-comic-root) #ten-toast-text { \
min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n:where(#ten-comic-root) .ten-toast button { flex: 0 0 auto; min-height: 27px; \
padding: 4px 9px; color: var(--ten-cyan); font: inherit; font-size: 10px; font-weight: 700; cursor: pointer; pointer-events: auto; border: 1px solid \
var(--ten-control-border); border-radius: 8px; background: var(--ten-control-hover-bg); }\n:where(#ten-comic-root) .ten-toast button[hidden] { display: none; \
}\n:where(#ten-comic-root) .ten-confirm { position: absolute; z-index: 50; inset: 0; display: grid; place-items: center; padding: 22px; visibility: hidden; \
opacity: 0; pointer-events: none; transition: opacity .24s ease, visibility .24s; }\n:where(#ten-comic-root) .ten-confirm.is-open { visibility: visible; \
opacity: 1; pointer-events: auto; }\n:where(#ten-comic-root) .ten-confirm-backdrop { position: absolute; inset: 0; padding: 0; cursor: default; border: 0; \
background: var(--ten-overlay-bg); backdrop-filter: blur(7px); }\n:where(#ten-comic-root) .ten-confirm-dialog { position: relative; width: min(310px,100%); \
padding: 18px; text-align: center; border: 1px solid var(--ten-panel-border); border-radius: var(--ten-radius-card); background: var(--ten-popover-bg); \
box-shadow: var(--ten-tooltip-shadow); transform: translateY(10px) scale(.96); transition: transform .28s cubic-bezier(.22,1,.36,1); }\n:where(#ten-comic-root) \
.ten-confirm.is-open .ten-confirm-dialog { transform: translateY(0) scale(1); }\n:where(#ten-comic-root) .ten-confirm-icon { width: 42px; height: 42px; display: \
grid; place-items: center; margin: 0 auto 10px; color: #ff9aac; border: 1px solid rgba(255,97,116,.3); border-radius: 14px; background: rgba(255,97,116,.11); \
box-shadow: 0 0 22px rgba(255,97,116,.1); }\n:where(#ten-comic-root) .ten-confirm-title { margin-bottom: 6px; font-size: 14px; font-weight: 750; \
}\n:where(#ten-comic-root) .ten-confirm-message { min-height: 34px; color: #c5d8e5; font-size: 11px; line-height: 1.55; word-break: break-word; \
}\n:where(#ten-comic-root) .ten-confirm-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; margin-top: 14px; \
}\n:where(#ten-comic-root) .ten-diagnostic { position: absolute; z-index: 51; inset: 0; display: grid; place-items: center; padding: 18px; visibility: hidden; \
opacity: 0; pointer-events: none; transition: opacity .24s ease, visibility .24s; }\n:where(#ten-comic-root) .ten-diagnostic.is-open { visibility: visible; \
opacity: 1; pointer-events: auto; }\n:where(#ten-comic-root) .ten-diagnostic-dialog { position: relative; width: 100%; max-height: 78%; display: grid; \
grid-template-rows: auto minmax(0,1fr) auto; gap: 11px; padding: 15px; border: 1px solid var(--ten-panel-border); border-radius: var(--ten-radius-card); \
background: var(--ten-popover-bg); box-shadow: var(--ten-tooltip-shadow); transform: translateY(10px) scale(.97); transition: transform .28s \
cubic-bezier(.22,1,.36,1); }\n:where(#ten-comic-root) .ten-diagnostic.is-open .ten-diagnostic-dialog { transform: translateY(0) scale(1); \
}\n:where(#ten-comic-root) .ten-diagnostic-head { display: grid; grid-template-columns: 42px minmax(0,1fr) 34px; align-items: center; gap: 10px; text-align: \
left; }\n:where(#ten-comic-root) .ten-diagnostic-head .ten-confirm-icon { margin: 0; }\n:where(#ten-comic-root) .ten-confirm-icon.is-info { color: \
var(--ten-cyan); border-color: rgba(95,246,255,.3); background: rgba(95,246,255,.1); box-shadow: 0 0 22px rgba(95,246,255,.1); }\n:where(#ten-comic-root) \
#ten-diagnostic-content { min-height: 140px; margin: 0; padding: 11px; overflow: auto; color: #c9dce8; font: 10px/1.65 ui-monospace, SFMono-Regular, Consolas, \
monospace; white-space: pre-wrap; word-break: break-all; border: 1px solid rgba(137,225,255,.16); border-radius: 12px; background: rgba(3,13,27,.52); \
scrollbar-width: thin; scrollbar-color: rgba(95,246,255,.34) transparent; }\n:where(#ten-comic-root) .ten-diagnostic-actions { display: grid; \
grid-template-columns: repeat(auto-fit,minmax(88px,1fr)); gap: 8px; }\n:where(#ten-comic-root) .ten-rule-guide-dialog { position: absolute; inset: 18px; width: \
auto; max-height: none; overflow: hidden; }\n:where(#ten-comic-root) .ten-rule-guide-content { min-height: 0; padding-right: 4px; overflow-y: auto; color: \
#c9dce8; font-size: 10px; line-height: 1.65; scrollbar-width: thin; scrollbar-color: rgba(95,246,255,.34) transparent; }\n:where(#ten-comic-root) \
.ten-rule-guide-content section { padding: 9px 10px; border: 1px solid rgba(137,225,255,.13); border-radius: 11px; background: rgba(3,13,27,.34); \
}\n:where(#ten-comic-root) .ten-rule-guide-content section + section { margin-top: 7px; }\n:where(#ten-comic-root) .ten-rule-guide-content h3 { margin: 0 0 5px; \
color: var(--ten-cyan); font-size: 10px; letter-spacing: .04em; }\n:where(#ten-comic-root) .ten-rule-guide-content ol,\n:where(#ten-comic-root) \
.ten-rule-guide-content ul { margin: 0; padding-left: 18px; }\n:where(#ten-comic-root) .ten-rule-guide-content li + li { margin-top: 3px; \
}\n:where(#ten-comic-root) .ten-rule-guide-content dl { display: grid; grid-template-columns: 78px minmax(0,1fr); gap: 4px 7px; margin: 0; \
}\n:where(#ten-comic-root) .ten-rule-guide-content dt { color: var(--ten-text); font-weight: 700; }\n:where(#ten-comic-root) .ten-rule-guide-content dd { \
margin: 0; }\n:where(#ten-comic-root) .ten-rule-guide-content code { padding: 1px 4px; color: var(--ten-cyan); border: 1px solid rgba(95,246,255,.13); \
border-radius: 5px; background: rgba(95,246,255,.06); font: 9px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }\n:where(#ten-comic-root) \
.ten-rule-guide-example > code { display: block; padding: 7px 8px; color: #bffbff; border-radius: 8px; background: rgba(2,10,22,.46); }\n:where(#ten-comic-root) \
.ten-rule-guide-warning { margin-top: 8px; padding: 7px 9px; color: #ffd0d9; border: 1px solid rgba(255,97,116,.24); border-radius: 9px; background: \
rgba(255,97,116,.08); }\n:where(#ten-comic-root) .ten-task-card,\n:where(#ten-comic-root) .ten-history-card { min-width: 0; display: grid; \
grid-template-columns: minmax(0,1fr) auto; gap: 7px; contain: paint; cursor: default; transform: none !important; transition: border-color .24s ease, \
background-color .24s ease, box-shadow .24s ease; }\n:where(#ten-comic-root) .ten-task-card:hover,\n:where(#ten-comic-root) .ten-history-card:hover { \
border-color: rgba(95,246,255,.3); background: rgba(27,46,70,.52); box-shadow: inset 0 1px rgba(255,255,255,.04); transform: none; }\n:where(#ten-comic-root) \
.ten-task-card .ten-name,\n:where(#ten-comic-root) .ten-history-card .ten-name { min-width: 0; width: 100%; }\n:where(#ten-comic-root) .ten-task-actions { \
min-width: max-content; flex: 0 0 auto; display: flex; align-items: center; gap: 1px; }\n:where(#ten-comic-root) .ten-task-actions .ten-icon-btn { width: 29px; \
height: 29px; border-radius: 9px; }\n:where(#ten-comic-root) .ten-task-actions .ten-icon-btn.is-danger { color: #ff9aac; }\n:where(#ten-comic-root) \
.ten-task-actions .ten-icon-btn:focus-visible { outline: 2px solid var(--ten-cyan); outline-offset: 1px; }\n:where(#ten-comic-root) .ten-task-actions \
.ten-icon-btn:disabled { opacity: .24; cursor: default; }\n:where(#ten-comic-root) .ten-history-card .ten-task-actions .ten-icon-btn { width: 27px; height: \
27px; }\n:where(#ten-comic-root) .ten-history-wrap { gap: 7px; }\n:where(#ten-comic-root) .ten-history-filter { display: grid; grid-template-columns: \
repeat(4,minmax(0,1fr)); gap: 4px; padding: 3px; border: 1px solid rgba(137,225,255,.12); border-radius: 11px; background: rgba(3,14,28,.3); \
}\n:where(#ten-comic-root) .ten-history-filter button { min-width: 0; min-height: 29px; padding: 3px 5px; color: var(--ten-muted); font: inherit; font-size: \
9px; cursor: pointer; border: 1px solid transparent; border-radius: 8px; background: transparent; transition: color .18s, border-color .18s, background .18s; \
}\n:where(#ten-comic-root) .ten-history-filter button:hover { color: var(--ten-text); background: rgba(95,246,255,.05); }\n:where(#ten-comic-root) \
.ten-history-filter button.is-active { color: var(--ten-cyan); border-color: rgba(95,246,255,.24); background: \
linear-gradient(145deg,rgba(95,246,255,.11),rgba(156,108,255,.09)); }\n:where(#ten-comic-root) .ten-recovery { margin-bottom: 9px; padding: 10px 11px; display: \
flex; align-items: center; justify-content: space-between; gap: 9px; border: 1px solid rgba(95,246,255,.28); border-radius: 14px; background: \
linear-gradient(145deg,rgba(35,73,91,.72),rgba(59,48,91,.68)); box-shadow: inset 0 1px rgba(255,255,255,.08); }\n:where(#ten-comic-root) .ten-recovery[hidden] { \
display: none; }\n:where(#ten-comic-root) .ten-recovery > div:first-child { min-width: 0; display: grid; gap: 2px; }\n:where(#ten-comic-root) .ten-recovery \
strong { color: var(--ten-text); font-size: 11px; }\n:where(#ten-comic-root) .ten-recovery span { color: var(--ten-muted); font-size: 9px; \
}\n:where(#ten-comic-root) .ten-recovery .ten-btn { min-height: 30px; padding: 5px 9px; }\n:where(#ten-comic-root) .ten-task-state { padding: 1px 6px; border: \
1px solid rgba(137,225,255,.18); border-radius: 999px; font-size: 9px; }\n:where(#ten-comic-root) .ten-task-state.is-failed,\n:where(#ten-comic-root) \
.ten-task-state.is-partial { color: #ff9aac; border-color: rgba(255,97,116,.25); background: rgba(255,97,116,.08); }\n:where(#ten-comic-root) \
.ten-task-state.is-cancelled { color: #b4c2ce; }\n:where(#ten-comic-root) .ten-task-state.is-completed { color: var(--ten-cyan); }\n:where(#ten-comic-root) \
.ten-search-results { margin-top: 10px; }\n:where(#ten-comic-root) .ten-result-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(100px,1fr)); \
gap: 8px; }\n:where(#ten-comic-root) .ten-result { padding: 6px; overflow: hidden; color: var(--ten-text); cursor: pointer; border: 1px solid var(--ten-line); \
border-radius: 12px; background: var(--ten-surface); }\n:where(#ten-comic-root) .ten-result img { width: 100%; aspect-ratio: 2/3; object-fit: cover; \
border-radius: 8px; background: rgba(255,255,255,.05); }\n:where(#ten-comic-root) .ten-result span { display: block; margin-top: 5px; overflow: hidden; \
white-space: nowrap; text-overflow: ellipsis; font-size: 10px; }\n:where(#ten-comic-root) .ten-section-title { margin: 13px 2px 7px; color: var(--ten-muted); \
font-size: 10px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }\n:where(#ten-comic-root) .ten-file-name { min-width: 0; overflow: hidden; \
white-space: nowrap; text-overflow: ellipsis; color: var(--ten-muted); font-size: 10px; }\n:where(#ten-comic-root) .ten-dir-control { min-width: 0; display: \
flex; align-items: center; justify-content: flex-end; gap: 8px; }\n:where(#ten-comic-root) .ten-dir-control .ten-btn { flex: 0 0 auto; margin: 0; \
}\n:where(#ten-comic-root) .ten-dir-control .ten-file-name { flex: 1 1 auto; max-width: 92px; text-align: left; }\n:where(#ten-comic-root) .ten-settings-hint { \
color: var(--ten-muted); font-size: 9px; line-height: 1.5; text-align: right; }\n:where(#ten-comic-root) .ten-rule-fields { display: grid; gap: 8px; \
}\n:where(#ten-comic-root) .ten-rule-fields label { min-width: 0; display: grid; gap: 4px; color: #c9dce8; font-size: 10px; }\n:where(#ten-comic-root) \
.ten-rule-fields .ten-input { height: 34px; text-align: left; }\n:where(#ten-comic-root) .ten-rule-intro { display: grid; grid-template-columns: auto 1fr; \
align-items: center; gap: 8px; margin-bottom: 9px; padding: 8px 10px; color: var(--ten-muted); font-size: 9px; line-height: 1.45; border: 1px solid \
var(--ten-card-border); border-radius: var(--ten-radius-control); background: var(--ten-list-bg); }\n:where(#ten-comic-root) .ten-rule-intro strong { color: \
var(--ten-cyan); font-size: 10px; white-space: nowrap; }\n:where(#ten-comic-root) .ten-rule-pick-actions { display: grid; grid-template-columns: \
repeat(3,minmax(0,1fr)); gap: 7px; margin: 0 0 8px; }\n:where(#ten-comic-root) .ten-rule-templates { margin: 0 0 8px; overflow: hidden; border: 1px solid \
var(--ten-card-border); border-radius: var(--ten-radius-control); background: var(--ten-list-bg); }\n:where(#ten-comic-root) .ten-rule-templates summary { \
display: flex; align-items: center; gap: 8px; padding: 9px 10px; color: var(--ten-text); font-size: 10px; cursor: pointer; list-style: none; \
}\n:where(#ten-comic-root) .ten-rule-templates summary::-webkit-details-marker { display: none; }\n:where(#ten-comic-root) .ten-rule-templates summary::after { \
content: ""; width: 6px; height: 6px; flex: 0 0 auto; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) \
translateY(-2px); transition: transform .2s; }\n:where(#ten-comic-root) .ten-rule-templates summary span { margin-left: auto; overflow: hidden; color: \
var(--ten-muted); font-size: 9px; white-space: nowrap; text-overflow: ellipsis; }\n:where(#ten-comic-root) .ten-rule-templates[open] summary { color: \
var(--ten-cyan); border-bottom: 1px solid var(--ten-card-border); }\n:where(#ten-comic-root) .ten-rule-templates[open] summary::after { transform: \
rotate(225deg) translate(-1px,-1px); }\n:where(#ten-comic-root) .ten-rule-template-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: \
6px; padding: 8px; animation: ten-picker-in .22s ease both; }\n:where(#ten-comic-root) .ten-rule-template-grid button { min-width: 0; min-height: 48px; display: \
grid; align-content: center; gap: 2px; padding: 7px 8px; color: var(--ten-text); font: inherit; text-align: left; cursor: pointer; border: 1px solid \
var(--ten-control-border); border-radius: var(--ten-radius-control); background: var(--ten-input-bg); transition: border-color .18s, background .18s, transform \
.18s; }\n:where(#ten-comic-root) .ten-rule-template-grid button:hover,\n:where(#ten-comic-root) .ten-rule-template-grid button.is-active { color: \
var(--ten-cyan); border-color: var(--ten-cyan); background: var(--ten-control-hover-bg); transform: translateY(-1px); }\n:where(#ten-comic-root) \
.ten-rule-template-grid strong { overflow: hidden; font-size: 10px; white-space: nowrap; text-overflow: ellipsis; }\n:where(#ten-comic-root) \
.ten-rule-template-grid small { overflow: hidden; color: var(--ten-muted); font-size: 8px; white-space: nowrap; text-overflow: ellipsis; \
}\n:where(#ten-comic-root) .ten-mobile-drawer { display: none; }\n:where(#ten-comic-root) .ten-rule-pick-actions button { min-height: 32px; display: \
inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 7px; color: var(--ten-text); font: inherit; font-size: 9px; cursor: pointer; \
border: 1px solid var(--ten-control-border); border-radius: var(--ten-radius-control); background: var(--ten-input-bg); }\n:where(#ten-comic-root) \
.ten-rule-pick-actions button .ten-icon { width: 14px; height: 14px; color: var(--ten-cyan); }\n:where(#ten-comic-root) .ten-rule-pick-actions button:hover { \
color: var(--ten-cyan); border-color: rgba(95,246,255,.42); background: rgba(95,246,255,.09); box-shadow: inset 0 1px rgba(255,255,255,.06); \
}\n:where(#ten-comic-root) .ten-rule-guide-open { min-height: 28px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; color: \
var(--ten-cyan); font: inherit; font-size: 9px; cursor: pointer; border: 1px solid rgba(95,246,255,.2); border-radius: 9px; background: rgba(95,246,255,.07); \
transition: transform .18s, border-color .18s, background .18s, box-shadow .18s; }\n:where(#ten-comic-root) .ten-rule-guide-open .ten-icon { width: 15px; \
height: 15px; }\n:where(#ten-comic-root) .ten-rule-guide-open:hover { transform: translateY(-1px); border-color: rgba(95,246,255,.5); background: \
rgba(95,246,255,.12); box-shadow: 0 6px 16px rgba(5,25,43,.14); }\n:where(#ten-comic-root) .ten-rule-simple-hint { margin-top: -3px; color: var(--ten-muted); \
font-size: 9px; line-height: 1.45; }\n:where(#ten-comic-root) .ten-rule-advanced { overflow: hidden; border: 1px solid var(--ten-card-border); border-radius: \
var(--ten-radius-control); background: var(--ten-input-bg); }\n:where(#ten-comic-root) .ten-rule-advanced summary { display: flex; align-items: center; \
justify-content: space-between; gap: 8px; padding: 9px 10px; color: #c9dce8; font-size: 10px; cursor: pointer; list-style: none; }\n:where(#ten-comic-root) \
.ten-rule-advanced summary::-webkit-details-marker { display: none; }\n:where(#ten-comic-root) .ten-rule-advanced summary::after { content: ""; width: 6px; \
height: 6px; flex: 0 0 auto; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-2px); \
transition: transform .25s ease; }\n:where(#ten-comic-root) .ten-rule-advanced[open] summary { color: var(--ten-cyan); border-bottom: 1px solid \
rgba(137,225,255,.12); }\n:where(#ten-comic-root) .ten-rule-advanced[open] summary::after { transform: rotate(225deg) translate(-1px,-1px); \
}\n:where(#ten-comic-root) .ten-rule-advanced summary span,\n:where(#ten-comic-root) .ten-rule-json summary span { margin-left: auto; color: var(--ten-muted); \
font-size: 9px; font-weight: 400; }\n:where(#ten-comic-root) .ten-rule-advanced-body { display: grid; gap: 8px; padding: 9px; animation: ten-picker-in .24s ease \
both; }\n:where(#ten-comic-root) .ten-rule-frame { min-height: 34px; padding: 0 2px; }\n:where(#ten-comic-root) .ten-rule-function { min-height: 96px; font: \
9px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }\n:where(#ten-comic-root) .ten-rule-label { display: block; margin-bottom: 4px; color: #c9dce8; \
font-size: 10px; }\n:where(#ten-comic-root) .ten-rule-readtype { --rule-type: 0; position: relative; display: grid; grid-template-columns: repeat(2,1fr); \
padding: 3px; border-radius: 11px; background: rgba(3,14,28,.38); }\n:where(#ten-comic-root) .ten-rule-readtype::before { content: ""; position: absolute; \
inset: 3px 50% 3px 3px; border: 1px solid rgba(95,246,255,.25); border-radius: 8px; background: linear-gradient(145deg, rgba(95,246,255,.14), \
rgba(156,108,255,.12)); transform: translateX(calc(var(--rule-type)*100%)); transition: transform .28s cubic-bezier(.22,1,.36,1); }\n:where(#ten-comic-root) \
.ten-rule-readtype button { position: relative; z-index: 1; min-height: 30px; color: var(--ten-muted); font: inherit; font-size: 10px; cursor: pointer; border: \
0; background: transparent; }\n:where(#ten-comic-root) .ten-rule-readtype button.is-active { color: var(--ten-cyan); }\n:where(#ten-comic-root) \
.ten-rule-test-result { margin-top: 9px; padding: 9px; color: #c9dce8; font: 9px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; \
border: 1px solid rgba(137,225,255,.18); border-radius: 10px; background: rgba(3,14,28,.4); }\n:where(#ten-comic-root) .ten-rule-test-result.is-success { color: \
#a9fff0; border-color: rgba(95,246,255,.3); }\n:where(#ten-comic-root) .ten-rule-test-result.is-error { color: #ffc0cb; border-color: rgba(255,97,116,.3); \
}\n:where(#ten-comic-root) .ten-rule-actions { display: grid; grid-template-columns: repeat(auto-fit,minmax(88px,1fr)); gap: 7px; margin-top: 9px; \
}\n:where(#ten-comic-root) .ten-backup-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; margin-bottom: 7px; \
}\n:where(#ten-comic-root) .ten-rule-json { margin-top: 10px; border-top: 1px solid rgba(137,225,255,.13); }\n:where(#ten-comic-root) .ten-rule-json summary { \
padding: 9px 2px 7px; color: var(--ten-muted); font-size: 10px; cursor: pointer; }\n:where(#ten-comic-root) .ten-rule-json[open] summary { color: \
var(--ten-cyan); }\n:where(#ten-comic-root) .ten-rule-json .ten-textarea { min-height: 96px; }\n:where(#ten-comic-root) .ten-rule-json .ten-btn { width: 100%; \
margin-top: 7px; }\n@keyframes ten-particle { from { transform: translate3d(0,0,0) scale(.7); opacity: .15; } to { transform: translate3d(var(--tx),var(--ty),0) \
scale(1.2); opacity: .7; } }\n@keyframes ten-launcher-orbit { to { transform: rotate(360deg); } }\n@keyframes ten-view-in { from { opacity: 0; transform: \
translateY(7px); } to { opacity: 1; transform: translateY(0); } }\n@keyframes ten-ripple { to { transform: scale(4); opacity: 0; } }\n@keyframes ten-picker-in { \
from { opacity: 0; transform: translateY(-7px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }\n@keyframes ten-energy-flow { to { \
transform: translateX(340%); } }\n@keyframes ten-state-scan { from { left: -42%; opacity: 0; } 24% { opacity: 1; } to { left: 108%; opacity: 0; } }\n@keyframes \
ten-state-border { 0% { box-shadow: 0 0 0 rgba(var(--ten-state-rgb),0); } 35% { box-shadow: 0 0 18px rgba(var(--ten-state-rgb),.18), inset 0 0 12px \
rgba(var(--ten-state-rgb),.06); } 100% { box-shadow: 0 0 0 rgba(var(--ten-state-rgb),0); } }\n@media (max-width: 560px), (max-height: 720px) \
{\n:where(#ten-comic-root) #ten-panel { right: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px); border-radius: 19px; }\n:where(#ten-comic-root) \
#ten-comic-launcher { right: 8px; }\n:where(#ten-comic-root) .ten-mobile-drawer { position: fixed; z-index: 2147483647; inset: 0; display: block; visibility: \
hidden; pointer-events: none; }\n:where(#ten-comic-root) .ten-mobile-drawer.is-open { visibility: visible; pointer-events: auto; }\n:where(#ten-comic-root) \
.ten-mobile-drawer-backdrop { position: absolute; inset: 0; width: 100%; padding: 0; border: 0; background: var(--ten-overlay-bg); backdrop-filter: blur(5px); \
opacity: 0; transition: opacity .22s; }\n:where(#ten-comic-root) .ten-mobile-drawer.is-open .ten-mobile-drawer-backdrop { opacity: 1; }\n:where(#ten-comic-root) \
.ten-mobile-drawer-sheet { position: absolute; right: 0; bottom: 0; left: 0; max-height: min(78vh,620px); display: grid; grid-template-rows: auto auto \
minmax(0,1fr); padding: 7px 12px 14px; overflow: hidden; border: 1px solid var(--ten-panel-border); border-radius: 22px 22px 0 0; background: \
var(--ten-popover-bg); box-shadow: 0 -18px 48px rgba(0,5,15,.28); transform: translateY(104%); transition: transform .3s cubic-bezier(.22,1,.36,1); \
}\n:where(#ten-comic-root) .ten-mobile-drawer.is-open .ten-mobile-drawer-sheet { transform: translateY(0); }\n:where(#ten-comic-root) .ten-mobile-drawer-handle \
{ width: 34px; height: 4px; margin: 0 auto 5px; border-radius: 999px; background: var(--ten-scroll-thumb); }\n:where(#ten-comic-root) .ten-mobile-drawer-sheet \
header { min-height: 38px; display: flex; align-items: center; justify-content: space-between; color: var(--ten-text); font-size: 12px; font-weight: 750; \
}\n:where(#ten-comic-root) #ten-mobile-drawer-content { min-height: 0; overflow-y: auto; padding: 2px 1px; }\n:where(#ten-comic-root) #ten-mobile-drawer-content \
.ten-options { max-height: none; margin: 0; padding: 10px; opacity: 1; border-width: 1px; }\n:where(#ten-comic-root) #ten-mobile-drawer-content \
.ten-options.is-mobile-drawer-content { background: var(--ten-card-bg); }\n:where(#ten-comic-root) #ten-mobile-drawer-content .ten-rule-advanced-body { padding: \
10px; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-card); background: var(--ten-card-bg); }\n}\n@media (min-width: 561px) \
{\n:where(#ten-comic-root) .ten-mobile-drawer { display: none; }\n}\n@media (max-width: 1000px) {\n:where(#ten-comic-root) #ten-search-panel { z-index: \
2147483647; right: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px); border-radius: 19px; }\n}\n@media (prefers-reduced-motion: reduce) \
{\n#ten-comic-root *,\n#ten-comic-root *::before,\n#ten-comic-root *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; \
}\n:where(#ten-comic-root) #ten-particle-field { display: none; }\n}\n:where(#ten-comic-root) .ten-theme-presets { display: grid; grid-template-columns: \
repeat(2,minmax(0,1fr)); gap: 7px; }\n#ten-comic-root .ten-theme-choice { min-width: 0; min-height: 58px; display: grid; align-content: center; gap: 2px; \
padding: 8px 10px; color: var(--ten-preview-text); font: inherit; text-align: left; cursor: pointer; border: 1px solid var(--ten-preview-border); border-radius: \
13px; background: var(--ten-preview-bg); box-shadow: inset 3px 0 var(--ten-preview-accent); transition: border-color .2s, transform .18s; }\n#ten-comic-root \
.ten-theme-choice[data-theme-choice="aurora"] { --ten-preview-bg: #e2f1ff; --ten-preview-text: #163b62; --ten-preview-muted: #45637e; --ten-preview-border: \
#9bc7e7; --ten-preview-accent: #317eb5; }\n#ten-comic-root .ten-theme-choice[data-theme-choice="mist"] { --ten-preview-bg: #edf7ff; --ten-preview-text: #183247; \
--ten-preview-muted: #45647d; --ten-preview-border: #b7d2e5; --ten-preview-accent: #3685a8; }\n\n#ten-comic-root .ten-theme-choice[data-theme-choice="cloud"] { \
--ten-preview-bg: #f4f7fc; --ten-preview-text: #26354a; --ten-preview-muted: #53647a; --ten-preview-border: #d0dceb; --ten-preview-accent: #5577a2; \
}\n#ten-comic-root .ten-theme-choice[data-theme-choice="obsidian"] { --ten-preview-bg: #252117; --ten-preview-text: #f8efd8; --ten-preview-muted: #d8c7a5; \
--ten-preview-border: #927c49; --ten-preview-accent: #d7b96c; }\n#ten-comic-root .ten-theme-choice[data-theme-choice="carbon"] { --ten-preview-bg: #171f30; \
--ten-preview-text: #eef3ff; --ten-preview-muted: #b8c6df; --ten-preview-border: #4c5974; --ten-preview-accent: #ef78bd; }\n#ten-comic-root \
.ten-theme-choice[data-theme-choice="titanium"] { --ten-preview-bg: #1a2b42; --ten-preview-text: #edf6ff; --ten-preview-muted: #b0c2d7; --ten-preview-border: \
#557da5; --ten-preview-accent: #7cc5ff; }\n\n#ten-comic-root .ten-theme-choice:hover { border-color: var(--ten-preview-accent); transform: translateY(-1px); \
}\n#ten-comic-root .ten-theme-choice[aria-pressed="true"] { border-color: var(--ten-preview-accent); outline: 2px solid var(--ten-preview-accent); \
outline-offset: 1px; }\n#ten-comic-root .ten-theme-choice:focus-visible { outline: 2px dashed var(--ten-preview-accent); outline-offset: 3px; \
}\n:where(#ten-comic-root) .ten-theme-choice strong { overflow: hidden; font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }\n#ten-comic-root \
.ten-theme-choice small { overflow: hidden; color: var(--ten-preview-muted); font-size: 8px; white-space: nowrap; text-overflow: ellipsis; \
}\n#ten-comic-root[data-theme="mist"] { --ten-bg: rgba(241,248,253,.76); --ten-surface: rgba(255,255,255,.5); --ten-surface-strong: rgba(255,255,255,.74); \
--ten-line: rgba(67,112,148,.18); --ten-text: #183247; --ten-muted: #667d90; --ten-cyan: #168eaf; --ten-blue: #4d7edc; --ten-violet: #7c69ca; --ten-pink: \
#c45e91; --ten-danger: #ce4f6d; --ten-success: #278768; }\n#ten-comic-root[data-theme="mist"] #ten-comic-launcher { color: #183247; border-color: \
rgba(255,255,255,.84); border-radius: 20px; background: linear-gradient(145deg,rgba(255,255,255,.82),rgba(219,237,250,.68)); box-shadow: 0 14px 38px \
rgba(49,91,123,.2),0 0 24px rgba(86,168,213,.16),inset 0 1px rgba(255,255,255,.96); }\n#ten-comic-root[data-theme="mist"] #ten-panel { border-color: \
rgba(255,255,255,.86); border-radius: 27px; background: radial-gradient(circle at 90% 2%,rgba(151,129,232,.17),transparent 31%),radial-gradient(circle at 2% \
88%,rgba(66,177,218,.14),transparent 32%),linear-gradient(155deg,rgba(244,250,255,.78),rgba(224,236,248,.7)); box-shadow: 0 30px 86px rgba(43,73,99,.24),inset 0 \
1px rgba(255,255,255,.96); backdrop-filter: blur(38px) saturate(1.28); }\n#ten-comic-root[data-theme="mist"] #ten-panel::before { opacity: .5; background: \
radial-gradient(circle at 86% 4%,rgba(117,95,214,.14),transparent 28%),radial-gradient(circle at 6% 90%,rgba(37,155,198,.13),transparent 32%); \
}\n#ten-comic-root[data-theme="mist"] .ten-header,\n#ten-comic-root[data-theme="mist"] .ten-nav { border-color: rgba(70,111,143,.14); background: \
rgba(248,252,255,.58); backdrop-filter: blur(23px) saturate(1.2); }\n#ten-comic-root[data-theme="mist"] .ten-card,\n#ten-comic-root[data-theme="mist"] \
.ten-task-group { border-color: rgba(255,255,255,.76); border-radius: 18px; background: linear-gradient(145deg,rgba(255,255,255,.58),rgba(224,237,247,.42)); \
box-shadow: 0 10px 25px rgba(54,88,112,.1),inset 0 1px rgba(255,255,255,.88); backdrop-filter: blur(18px) saturate(1.18); }\n#ten-comic-root[data-theme="mist"] \
.ten-list-item,\n#ten-comic-root[data-theme="mist"] .ten-status,\n#ten-comic-root[data-theme="mist"] .ten-chapter-list-head { border-color: \
rgba(78,119,150,.16); border-radius: 14px; background: rgba(255,255,255,.46); box-shadow: inset 0 1px rgba(255,255,255,.8); \
}\n#ten-comic-root[data-theme="mist"] .ten-list-item:hover { border-color: rgba(22,142,175,.4); background: rgba(255,255,255,.68); \
}\n#ten-comic-root[data-theme="mist"] .ten-btn { color: #183247; border-color: rgba(77,126,174,.2); border-radius: 13px; background: \
linear-gradient(115deg,rgba(208,235,248,.86),rgba(228,220,249,.8),rgba(213,240,242,.82)); box-shadow: inset 0 1px rgba(255,255,255,.9); \
}\n#ten-comic-root[data-theme="mist"] .ten-btn.is-danger { color: #a53e5c; background: rgba(255,232,239,.72); }\n#ten-comic-root[data-theme="mist"] \
.ten-input,\n#ten-comic-root[data-theme="mist"] .ten-select,\n#ten-comic-root[data-theme="mist"] .ten-textarea,\n#ten-comic-root[data-theme="mist"] \
.ten-setting-select > button,\n#ten-comic-root[data-theme="mist"] .ten-source,\n#ten-comic-root[data-theme="mist"] \
.ten-effect-level,\n#ten-comic-root[data-theme="mist"] .ten-history-filter,\n#ten-comic-root[data-theme="mist"] .ten-rule-readtype { color: #183247; \
border-color: rgba(70,111,143,.16); background: rgba(255,255,255,.45); }\n#ten-comic-root[data-theme="mist"] .ten-setting \
label,\n#ten-comic-root[data-theme="mist"] .ten-rule-fields label,\n#ten-comic-root[data-theme="mist"] .ten-rule-label { color: #29455a; \
}\n#ten-comic-root[data-theme="mist"] .ten-setting-select-menu,\n#ten-comic-root[data-theme="mist"] .ten-search-site-menu,\n#ten-comic-root[data-theme="mist"] \
.ten-confirm-dialog,\n#ten-comic-root[data-theme="mist"] .ten-diagnostic-dialog { color: #183247; border-color: rgba(77,126,174,.2); background: \
linear-gradient(145deg,rgba(250,253,255,.96),rgba(226,237,247,.96)); box-shadow: 0 22px 55px rgba(44,76,102,.22),inset 0 1px rgba(255,255,255,.9); \
}\n#ten-comic-root[data-theme="mist"] #ten-diagnostic-content { color: #29455a; background: rgba(255,255,255,.52); }\n#ten-comic-root[data-theme="mist"] \
.ten-select option { color: #183247; background: #f4f9fc; }\n#ten-comic-root[data-theme="mist"] .ten-progress { background: rgba(50,85,111,.12); \
}\n#ten-comic-root[data-theme="mist"] .ten-progress > i { background: linear-gradient(90deg,#48b9d2,#65a4ea,#9c7cdd); box-shadow: 0 0 10px rgba(62,157,203,.25); \
}\n#ten-comic-root[data-theme="mist"] .ten-nav::before { border-color: rgba(45,140,184,.24); border-radius: 17px; background: \
linear-gradient(145deg,rgba(181,229,246,.56),rgba(213,198,246,.52)); box-shadow: 0 7px 19px rgba(57,102,132,.1),inset 0 1px rgba(255,255,255,.88); \
}\n#ten-comic-root[data-theme="mist"] .ten-chapter-tools { border-color: rgba(255,255,255,.76); border-radius: 16px; background: \
linear-gradient(145deg,rgba(255,255,255,.84),rgba(226,238,248,.76)); box-shadow: 0 8px 20px rgba(54,88,112,.1),inset 0 1px rgba(255,255,255,.9); \
}\n#ten-comic-root[data-theme="mist"] #ten-search-panel { color: #183247; border-color: rgba(255,255,255,.82); background: \
linear-gradient(155deg,rgba(246,251,255,.94),rgba(225,237,247,.95)); box-shadow: 0 26px 70px rgba(43,73,99,.23),inset 0 1px rgba(255,255,255,.9); \
}\n#ten-comic-root[data-theme="mist"] #ten-particle-field { opacity: .22; filter: saturate(.65); }\n#ten-comic-root[data-theme="mist"] .ten-rule-intro { \
border-color: rgba(70,111,143,.16); background: linear-gradient(145deg,rgba(255,255,255,.58),rgba(218,235,246,.46)); box-shadow: inset 0 1px \
rgba(255,255,255,.78); }\n#ten-comic-root[data-theme="mist"] .ten-rule-advanced { border-color: rgba(70,111,143,.17); background: rgba(250,253,255,.5); \
box-shadow: inset 0 1px rgba(255,255,255,.72); }\n#ten-comic-root[data-theme="mist"] .ten-rule-advanced summary { color: #29455a; \
}\n#ten-comic-root[data-theme="mist"] .ten-rule-advanced[open] summary { color: #126f8b; border-bottom-color: rgba(70,111,143,.14); background: \
rgba(223,241,249,.46); }\n#ten-comic-root[data-theme="mist"] .ten-rule-guide-open { color: #126f8b; border-color: rgba(22,142,175,.24); background: \
rgba(225,244,252,.7); box-shadow: inset 0 1px rgba(255,255,255,.84); }\n#ten-comic-root[data-theme="mist"] #ten-search-site-trigger { color: #29455a; \
border-color: rgba(70,111,143,.18); background: linear-gradient(145deg,rgba(255,255,255,.72),rgba(220,238,248,.62)); box-shadow: inset 0 1px \
rgba(255,255,255,.9),0 5px 14px rgba(54,88,112,.08); }\n#ten-comic-root[data-theme="mist"] .ten-rule-manage { border-color: rgba(70,111,143,.16); background: \
rgba(255,255,255,.46); }\n#ten-comic-root[data-theme="mist"] .ten-chapter-reload button { border-color: rgba(22,142,175,.2); background: rgba(247,252,255,.82); \
box-shadow: inset 0 1px rgba(255,255,255,.9); }\n#ten-comic-root[data-theme="mist"] .ten-chapter-empty { border-color: rgba(255,255,255,.78); background: \
linear-gradient(145deg,rgba(255,255,255,.62),rgba(222,237,247,.48)); box-shadow: 0 9px 23px rgba(54,88,112,.09),inset 0 1px rgba(255,255,255,.9); \
}\n#ten-comic-root[data-theme="mist"] .ten-empty-orbit { border-color: rgba(22,142,175,.22); background: \
linear-gradient(145deg,rgba(230,248,253,.82),rgba(231,226,250,.7)); box-shadow: 0 8px 20px rgba(54,110,142,.1),inset 0 1px rgba(255,255,255,.9); \
}\n#ten-comic-root[data-theme="mist"] .ten-comic-info { border-color: rgba(70,111,143,.16); background: rgba(255,255,255,.5); box-shadow: inset 0 1px \
rgba(255,255,255,.82); }\n#ten-comic-root[data-theme="mist"] .ten-comic-info span,\n#ten-comic-root[data-theme="mist"] .ten-comic-info strong { \
border-bottom-color: rgba(70,111,143,.1); }\n#ten-comic-root[data-theme="mist"] .ten-mini-task,\n#ten-comic-root[data-theme="mist"] .ten-rule-pick-hud { color: \
#183247; border-color: rgba(255,255,255,.86); background: linear-gradient(145deg,rgba(250,253,255,.94),rgba(222,237,248,.92)); box-shadow: 0 16px 42px \
rgba(43,73,99,.2),inset 0 1px rgba(255,255,255,.94); }\n#ten-comic-root[data-theme="mist"] .ten-mini-icon,\n#ten-comic-root[data-theme="mist"] \
.ten-rule-pick-symbol { border-color: rgba(22,142,175,.2); background: rgba(225,244,252,.74); }\n#ten-comic-root[data-theme="mist"] .ten-mini-progress { \
background: rgba(50,85,111,.12); }\n#ten-comic-root[data-theme="mist"] .ten-rule-pick-actions button { color: #29455a; border-color: rgba(70,111,143,.16); \
background: rgba(255,255,255,.5); }\n#ten-comic-root[data-theme="mist"] .ten-mode { color: var(--ten-muted); border-color: var(--ten-line); background: \
rgba(255,255,255,.48); }\n#ten-comic-root[data-theme="mist"] .ten-mode.is-active { color: var(--ten-cyan); border-color: var(--ten-cyan); background: \
rgba(72,133,174,.1); }\n#ten-comic-root[data-theme="mist"] .ten-confirm-message,\n#ten-comic-root[data-theme="mist"] \
.ten-rule-test-result,\n#ten-comic-root[data-theme="mist"] .ten-task-performance { color: #53697a; }\n#ten-comic-root[data-theme="mist"] .ten-toast { color: \
#f3f9fc; border-color: rgba(67,112,148,.32); background: rgba(30,48,63,.94); }\n#ten-comic-root[data-theme="mist"] .ten-confirm-backdrop { background: \
rgba(34,48,60,.36); }\n#ten-comic-root[data-theme="mist"] .ten-task-actions .ten-icon-btn.is-danger { color: #bc4d66; }\n#ten-comic-root[data-theme="mist"] \
.ten-rule-guide-content { color: #53697a; }\n#ten-comic-root[data-theme="mist"] .ten-rule-guide-content section { border-color: var(--ten-line); background: \
rgba(255,255,255,.5); }\n#ten-comic-root[data-theme="mist"] .ten-rule-guide-content dt { color: var(--ten-text); }\n#ten-comic-root[data-theme="mist"] \
.ten-rule-guide-content code { color: var(--ten-cyan); border-color: var(--ten-line); background: rgba(66,112,148,.07); }\n#ten-comic-root[data-theme="mist"] \
.ten-rule-guide-example > code { color: #29455a; background: rgba(232,241,247,.7); }\n#ten-comic-root[data-theme="mist"] .ten-rule-guide-warning { color: \
#a53e5c; border-color: rgba(190,77,103,.22); background: rgba(255,232,239,.68); }\n#ten-comic-root[data-theme="carbon"] { --ten-bg: rgba(5,8,13,.94); \
--ten-surface: rgba(15,20,29,.78); --ten-surface-strong: rgba(20,27,39,.9); --ten-line: rgba(85,145,190,.3); --ten-text: #edf5ff; --ten-muted: #7f8b9e; \
--ten-cyan: #2c9cff; --ten-blue: #287fff; --ten-violet: #8b4cff; --ten-pink: #ff4f96; --ten-danger: #ff5d83; --ten-success: #55e5bb; \
}\n#ten-comic-root[data-theme="carbon"] #ten-comic-launcher { border-color: rgba(45,157,255,.72); border-radius: 15px; background: \
linear-gradient(145deg,#111824,#080b11); box-shadow: -4px 0 22px rgba(41,143,255,.3),4px 0 22px rgba(255,66,144,.2),inset 0 0 0 1px rgba(255,255,255,.05); \
}\n#ten-comic-root[data-theme="carbon"] #ten-panel { border-color: rgba(49,153,230,.55); border-radius: 17px; background: linear-gradient(155deg,#111821,#070a0f \
76%); box-shadow: -2px 0 25px rgba(37,137,238,.22),2px 0 25px rgba(255,57,139,.15),0 30px 80px rgba(0,0,0,.58),inset -1px 0 rgba(255,65,143,.45),inset 1px 0 \
rgba(45,157,255,.55); }\n#ten-comic-root[data-theme="carbon"] #ten-panel::before { opacity: .45; background: \
linear-gradient(90deg,rgba(41,148,255,.08),transparent 24%,transparent 76%,rgba(255,64,145,.07)); }\n#ten-comic-root[data-theme="carbon"] \
.ten-header,\n#ten-comic-root[data-theme="carbon"] .ten-nav { background: rgba(5,8,13,.82); }\n#ten-comic-root[data-theme="carbon"] \
.ten-card,\n#ten-comic-root[data-theme="carbon"] .ten-task-group { border-color: rgba(83,119,149,.38); border-radius: 14px; background: \
linear-gradient(145deg,rgba(24,31,42,.9),rgba(8,12,18,.88)); box-shadow: inset 1px 0 rgba(44,156,255,.15),inset -1px 0 rgba(255,79,150,.09),0 8px 20px \
rgba(0,0,0,.24); }\n#ten-comic-root[data-theme="carbon"] .ten-list-item { border-color: rgba(79,112,142,.34); border-radius: 11px; background: \
rgba(7,11,17,.77); box-shadow: inset 2px 0 rgba(44,156,255,.6); }\n#ten-comic-root[data-theme="carbon"] [data-task-group="waiting"] .ten-list-item { box-shadow: \
inset 2px 0 rgba(255,79,150,.56); }\n#ten-comic-root[data-theme="carbon"] .ten-btn { border-radius: 10px; background: \
linear-gradient(110deg,rgba(23,82,133,.75),rgba(46,35,94,.72),rgba(116,27,71,.62)); }\n#ten-comic-root[data-theme="carbon"] .ten-progress > i { background: \
linear-gradient(90deg,#208dff,#2fa6ff,#9d4cff); box-shadow: 0 0 13px rgba(44,156,255,.48); }\n#ten-comic-root[data-theme="carbon"] .ten-nav { border-top-color: \
rgba(61,112,151,.38); }\n#ten-comic-root[data-theme="carbon"] .ten-nav::before { border-color: rgba(40,142,255,.65); border-radius: 12px; background: \
rgba(16,28,43,.78); box-shadow: -4px 0 14px rgba(39,143,255,.18),4px 0 14px rgba(255,65,143,.12),inset 0 0 0 1px rgba(255,255,255,.04); \
}\n#ten-comic-root[data-theme="carbon"] #ten-search-panel { border-color: rgba(49,153,230,.48); background: linear-gradient(155deg,#111821,#070a0f 78%); \
box-shadow: -2px 0 22px rgba(37,137,238,.18),2px 0 22px rgba(255,57,139,.12),0 25px 70px rgba(0,0,0,.55); }\n#ten-comic-root[data-theme="carbon"] \
.ten-chapter-tools { border-color: rgba(49,153,230,.4); border-radius: 11px; background: linear-gradient(145deg,rgba(24,31,42,.96),rgba(8,12,18,.96)); \
}\n#ten-comic-root[data-theme="carbon"] .ten-mini-task,\n#ten-comic-root[data-theme="carbon"] .ten-rule-pick-hud { border-color: rgba(49,153,230,.48); \
border-radius: 14px; background: linear-gradient(145deg,#111821,#070a0f); box-shadow: -2px 0 18px rgba(37,137,238,.18),2px 0 18px rgba(255,57,139,.12),0 18px \
46px rgba(0,0,0,.48); }\n#ten-comic-root[data-theme="carbon"] .ten-rule-pick-actions button { border-color: rgba(83,119,149,.38); background: rgba(7,11,17,.78); \
}\n#ten-comic-root[data-theme="mist"] { --ten-panel-bg:radial-gradient(circle at 90% 2%,rgba(151,129,232,.17),transparent 31%),radial-gradient(circle at 2% \
88%,rgba(66,177,218,.14),transparent 32%),linear-gradient(155deg,rgba(244,250,255,.78),rgba(224,236,248,.7)); --ten-panel-border:rgba(255,255,255,.86); \
--ten-panel-shadow:0 30px 86px rgba(43,73,99,.24),inset 0 1px rgba(255,255,255,.96); --ten-header-bg:rgba(248,252,255,.58); \
--ten-card-bg:linear-gradient(145deg,rgba(255,255,255,.58),rgba(224,237,247,.42)); --ten-card-border:rgba(255,255,255,.76); --ten-card-shadow:0 10px 25px \
rgba(54,88,112,.1),inset 0 1px rgba(255,255,255,.88); --ten-task-bg:linear-gradient(145deg,rgba(255,255,255,.58),rgba(224,237,247,.42)); \
--ten-list-bg:rgba(255,255,255,.46); --ten-list-hover-bg:rgba(255,255,255,.68); --ten-control-bg:linear-gradient(115deg,rgba(208,235,248,.86),rgba(228,220,249,.8),rgba(213,240,242,.82)); \
--ten-control-hover-bg:rgba(225,244,252,.8); --ten-control-border:rgba(77,126,174,.2); --ten-primary-bg:linear-gradient(115deg,#8de7ef,#9bbdf4,#c5b3ef); \
--ten-primary-text:#183247; --ten-primary-border:rgba(22,142,175,.3); --ten-danger-bg:rgba(255,232,239,.72); --ten-danger-text:#a53e5c; \
--ten-danger-border:rgba(206,79,109,.24); --ten-input-bg:rgba(255,255,255,.45); --ten-popover-bg:linear-gradient(145deg,rgba(250,253,255,.97),rgba(226,237,247,.97)); \
--ten-empty-bg:linear-gradient(145deg,rgba(255,255,255,.62),rgba(222,237,247,.48)); --ten-info-bg:rgba(255,255,255,.5); \
--ten-mini-bg:linear-gradient(145deg,rgba(250,253,255,.94),rgba(222,237,248,.92)); --ten-overlay-bg:rgba(34,48,60,.36); --ten-tooltip-bg:rgba(250,253,255,.98); \
--ten-tooltip-text:#183247; --ten-tooltip-border:rgba(77,126,174,.24); --ten-tooltip-shadow:0 10px 28px rgba(43,73,99,.2),inset 0 1px rgba(255,255,255,.92); \
--ten-focus-ring:0 0 0 3px rgba(22,142,175,.12); --ten-scroll-thumb:rgba(22,142,175,.28); --ten-radius-panel:27px; --ten-radius-card:18px; \
--ten-radius-control:13px; }\n#ten-comic-root[data-theme="carbon"] { --ten-panel-bg:linear-gradient(155deg,#111821,#070a0f 76%); \
--ten-panel-border:rgba(49,153,230,.55); --ten-panel-shadow:-2px 0 25px rgba(37,137,238,.22),2px 0 25px rgba(255,57,139,.15),0 30px 80px rgba(0,0,0,.58),inset \
-1px 0 rgba(255,65,143,.45),inset 1px 0 rgba(45,157,255,.55); --ten-header-bg:rgba(5,8,13,.82); \
--ten-card-bg:linear-gradient(145deg,rgba(24,31,42,.9),rgba(8,12,18,.88)); --ten-card-border:rgba(83,119,149,.38); --ten-card-shadow:inset 1px 0 \
rgba(44,156,255,.15),inset -1px 0 rgba(255,79,150,.09),0 8px 20px rgba(0,0,0,.24); --ten-task-bg:linear-gradient(145deg,rgba(24,31,42,.9),rgba(8,12,18,.88)); \
--ten-list-bg:rgba(7,11,17,.77); --ten-list-hover-bg:rgba(15,25,37,.88); --ten-control-bg:linear-gradient(110deg,rgba(23,82,133,.75),rgba(46,35,94,.72),rgba(116,27,71,.62)); \
--ten-control-hover-bg:rgba(44,156,255,.1); --ten-control-border:rgba(85,145,190,.3); --ten-primary-bg:linear-gradient(110deg,#208dff,#9d4cff,#ff4f96); \
--ten-primary-text:#f6fbff; --ten-primary-border:rgba(44,156,255,.55); --ten-danger-bg:rgba(255,79,150,.12); --ten-danger-text:#ffddea; \
--ten-danger-border:rgba(255,79,150,.3); --ten-input-bg:rgba(4,8,13,.8); --ten-popover-bg:linear-gradient(155deg,#111821,#070a0f); \
--ten-empty-bg:rgba(8,13,20,.78); --ten-info-bg:rgba(7,11,17,.8); --ten-mini-bg:linear-gradient(145deg,#111821,#070a0f); --ten-overlay-bg:rgba(0,0,0,.7); \
--ten-tooltip-bg:#070a0f; --ten-tooltip-text:#edf5ff; --ten-tooltip-border:rgba(49,153,230,.48); --ten-tooltip-shadow:-2px 0 14px rgba(37,137,238,.18),2px 0 \
14px rgba(255,57,139,.12),0 12px 28px rgba(0,0,0,.48); --ten-focus-ring:0 0 0 3px rgba(44,156,255,.1); --ten-scroll-thumb:rgba(44,156,255,.32); \
--ten-radius-panel:17px; --ten-radius-card:14px; --ten-radius-control:10px; }\n#ten-comic-root[data-theme="mist"] { --ten-toast-bg:rgba(250,253,255,.98); \
--ten-toast-text:#183247; --ten-toast-border:rgba(77,126,174,.24); --ten-launcher-bg:linear-gradient(145deg,rgba(255,255,255,.82),rgba(219,237,250,.68)); \
--ten-launcher-border:rgba(255,255,255,.84); --ten-launcher-shadow:0 14px 38px rgba(49,91,123,.2),0 0 24px rgba(86,168,213,.16),inset 0 1px \
rgba(255,255,255,.96); --ten-radius-launcher:20px; }\n#ten-comic-root[data-theme="carbon"] { --ten-toast-bg:#070a0f; --ten-toast-text:#edf5ff; \
--ten-toast-border:rgba(49,153,230,.48); --ten-launcher-bg:linear-gradient(145deg,#111824,#080b11); --ten-launcher-border:rgba(45,157,255,.72); \
--ten-launcher-shadow:-4px 0 22px rgba(41,143,255,.3),4px 0 22px rgba(255,66,144,.2),inset 0 0 0 1px rgba(255,255,255,.05); --ten-radius-launcher:15px; \
}\n#ten-comic-root[data-theme] #ten-panel,\n#ten-comic-root[data-theme] #ten-search-panel { border-color:var(--ten-panel-border); \
border-radius:var(--ten-radius-panel); background:var(--ten-panel-bg); box-shadow:var(--ten-panel-shadow); }\n#ten-comic-root[data-theme] \
.ten-header,\n#ten-comic-root[data-theme] .ten-nav,\n#ten-comic-root[data-theme] .ten-search-panel-header { background:var(--ten-header-bg); \
}\n#ten-comic-root[data-theme] .ten-card { border-color:var(--ten-card-border); border-radius:var(--ten-radius-card); background:var(--ten-card-bg); \
box-shadow:var(--ten-card-shadow); }\n#ten-comic-root[data-theme] .ten-task-group { border-color:var(--ten-card-border); border-radius:var(--ten-radius-card); \
background:var(--ten-task-bg); box-shadow:var(--ten-card-shadow); }\n#ten-comic-root[data-theme] .ten-list-item,\n#ten-comic-root[data-theme] \
.ten-status,\n#ten-comic-root[data-theme] .ten-chapter-list-head { background:var(--ten-list-bg); }\n#ten-comic-root[data-theme] .ten-list-item:hover { \
background:var(--ten-list-hover-bg); }\n#ten-comic-root[data-theme] .ten-btn:not(.is-primary):not(.is-danger) { color:var(--ten-text); \
border-color:var(--ten-control-border); border-radius:var(--ten-radius-control); background:var(--ten-control-bg); }\n#ten-comic-root[data-theme] \
.ten-btn.is-primary { color:var(--ten-primary-text); border-color:var(--ten-primary-border); background:var(--ten-primary-bg); }\n#ten-comic-root[data-theme] \
.ten-btn.is-danger { color:var(--ten-danger-text); border-color:var(--ten-danger-border); background:var(--ten-danger-bg); }\n#ten-comic-root[data-theme] \
.ten-input,\n#ten-comic-root[data-theme] .ten-select,\n#ten-comic-root[data-theme] .ten-textarea,\n#ten-comic-root[data-theme] .ten-setting-select > button { \
background:var(--ten-input-bg); }\n#ten-comic-root[data-theme] .ten-setting-select-menu,\n#ten-comic-root[data-theme] \
.ten-search-site-menu,\n#ten-comic-root[data-theme] .ten-confirm-dialog,\n#ten-comic-root[data-theme] .ten-diagnostic-dialog { color:var(--ten-text); \
border-color:var(--ten-panel-border); background:var(--ten-popover-bg); box-shadow:var(--ten-tooltip-shadow); }\n#ten-comic-root[data-theme] .ten-chapter-empty \
{ border-color:var(--ten-card-border); background:var(--ten-empty-bg); box-shadow:var(--ten-card-shadow); }\n#ten-comic-root[data-theme] .ten-comic-info { \
border-color:var(--ten-card-border); background:var(--ten-info-bg); }\n#ten-comic-root[data-theme] .ten-mini-task,\n#ten-comic-root[data-theme] \
.ten-rule-pick-hud { color:var(--ten-text); border-color:var(--ten-panel-border); border-radius:var(--ten-radius-card); background:var(--ten-mini-bg); \
box-shadow:var(--ten-tooltip-shadow); }\n#ten-comic-root[data-theme] .ten-rule-intro { border-color:var(--ten-card-border); \
border-radius:var(--ten-radius-control); background:var(--ten-list-bg); }\n#ten-comic-root[data-theme] .ten-rule-advanced,\n#ten-comic-root[data-theme] \
.ten-rule-pick-actions button { color:var(--ten-text); border-color:var(--ten-control-border); border-radius:var(--ten-radius-control); \
background:var(--ten-input-bg); }\n#ten-comic-root[data-theme] .ten-icon-tooltip { color:var(--ten-tooltip-text); border-color:var(--ten-tooltip-border); \
background:var(--ten-tooltip-bg); box-shadow:var(--ten-tooltip-shadow); }\n#ten-comic-root[data-theme] .ten-toast { color:var(--ten-toast-text); \
border-color:var(--ten-toast-border); background:var(--ten-toast-bg); box-shadow:var(--ten-tooltip-shadow); }\n#ten-comic-root[data-theme] #ten-comic-launcher { \
border-color:var(--ten-launcher-border); border-radius:var(--ten-radius-launcher); background:var(--ten-launcher-bg); box-shadow:var(--ten-launcher-shadow); \
}\n/*\nWhite themes adapted and recomposed from Uiverse components:\nhttps://uiverse.io/adamgiebl/lucky-donkey-6\nhttps://uiverse.io/adamgiebl/hot-cat-14\nhttps://uiverse.io/0xnihilism/thin-crab-36\nhttps://uiverse.io/0xnihilism/calm-baboon-55\n\nMIT \
License\nCopyright (c) 2026 adamgiebl (Adam Giebl)\nCopyright (c) 2026 0xnihilism (0xNihilist)\n\nPermission is hereby granted, free of charge, to any person \
obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without \
limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the \
Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies \
or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO \
THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY \
CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR \
OTHER DEALINGS IN\nTHE SOFTWARE.\n*/\n\n#ten-comic-root[data-theme="cloud"] {\n  color-scheme: light;\n  --ten-bg: #f2f5fa; --ten-surface: #f9fbff; \
--ten-surface-strong: #ffffff;\n  --ten-text: #26354a; --ten-muted: #53647a; --ten-line: #d5deea;\n  --ten-cyan: #2559a7; --ten-blue: #356bc0; --ten-violet: \
#626ba8; --ten-pink: #ae4572;\n  --ten-danger: #b4233b; --ten-success: #15715c;\n  --ten-panel-bg: #f2f5fa; --ten-panel-border: #d3ddea;\n  --ten-panel-shadow: \
12px 16px 38px rgba(47,66,94,.2),inset 1px 1px 0 #ffffff;\n  --ten-header-bg: #f8faff;\n  --ten-card-bg: #f9fbff; --ten-card-border: #dce4ee;\n  \
--ten-card-shadow: 5px 5px 13px rgba(70,92,122,.12),-5px -5px 13px #ffffff;\n  --ten-task-bg: #f9fbff; --ten-list-bg: #f5f8fc; --ten-list-hover-bg: #eaf1fc;\n  \
--ten-control-bg: #f3f6fb; --ten-control-hover-bg: #e8effa; --ten-control-border: #d3dfed;\n  --ten-primary-bg: #e6efff; --ten-primary-text: #204b92; \
--ten-primary-border: #b9cdee;\n  --ten-danger-bg: #fff0f3; --ten-danger-text: #ad1d39; --ten-danger-border: #efc3cc;\n  --ten-input-bg: #f7f9fd; \
--ten-popover-bg: #ffffff;\n  --ten-empty-bg: #f9fbff; --ten-info-bg: #f4f7fc; --ten-mini-bg: #f9fbff;\n  --ten-overlay-bg: rgba(30,45,70,.28);\n  \
--ten-tooltip-bg: #ffffff; --ten-tooltip-text: #26354a; --ten-tooltip-border: #cad7e8;\n  --ten-tooltip-shadow: 5px 7px 18px rgba(47,66,94,.16),inset 1px 1px 0 \
#ffffff;\n  --ten-toast-bg: #ffffff; --ten-toast-text: #26354a; --ten-toast-border: #cad7e8;\n  --ten-launcher-bg: #f5f8fd; --ten-launcher-border: #cfdaea;\n  \
--ten-launcher-shadow: 5px 5px 12px rgba(47,66,94,.18),-3px -3px 10px #ffffff;\n  --ten-radius-panel: 25px; --ten-radius-card: 18px; --ten-radius-control: 12px; \
--ten-radius-launcher: 18px;\n  --ten-focus-ring: 0 0 0 3px rgba(37,89,167,.17); --ten-scroll-thumb: #a4b6cd;\n  --ten-component-shadow: 4px 4px 9px \
rgba(70,92,122,.16),-4px -4px 9px #ffffff;\n  --ten-input-shadow: inset 2px 2px 5px rgba(70,92,122,.12),inset -2px -2px 5px \
#ffffff;\n}\n\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) #ten-panel,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
#ten-search-panel,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-card,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-task-group,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-mini-task { backdrop-filter: none; -webkit-backdrop-filter: none; \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) #ten-panel::before,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
#ten-particle-field,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) #ten-comic-launcher::before { display: none; \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) #ten-comic-launcher { color: var(--ten-cyan); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-brand-mark { color: var(--ten-cyan); border-color: var(--ten-line); background: \
var(--ten-list-bg); box-shadow: var(--ten-input-shadow); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-chapter-tools { border-color: \
var(--ten-card-border); background: var(--ten-card-bg); box-shadow: var(--ten-card-shadow); backdrop-filter: none; \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-chapter-reload button { border-color: var(--ten-control-border); background: \
var(--ten-control-bg); box-shadow: var(--ten-component-shadow); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-input,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-select,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-textarea,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-setting-select > button { color: var(--ten-text); border-color: \
var(--ten-control-border); box-shadow: var(--ten-input-shadow); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
:is(input,textarea)::placeholder { color: var(--ten-muted); opacity: 1; }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
:is(input,textarea,select):focus { border-color: var(--ten-cyan); box-shadow: var(--ten-input-shadow),var(--ten-focus-ring); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-select option { color: var(--ten-text); background: #ffffff; \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-setting label,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-rule-fields label,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-rule-label,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-confirm-message { color: var(--ten-text); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) #ten-diagnostic-content { color: var(--ten-text); border-color: var(--ten-line); background: \
var(--ten-input-bg); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-btn { box-shadow: var(--ten-component-shadow); background-size: 100% \
100%; }\n#ten-comic-root[data-theme="cloud"] .ten-btn:hover:not(:disabled) { transform: translateY(-1px); border-color: #aebfd8; box-shadow: 5px 5px 12px \
rgba(70,92,122,.17),-4px -4px 10px #ffffff; }\n#ten-comic-root[data-theme="cloud"] .ten-btn:active:not(:disabled) { transform: translateY(0); box-shadow: \
var(--ten-input-shadow); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-actions .is-danger { color: var(--ten-danger); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-state.is-failed,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-task-state.is-partial { color: var(--ten-danger); border-color: var(--ten-danger-border); background: var(--ten-danger-bg); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-state.is-cancelled { color: var(--ten-muted); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-card:hover,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-history-card:hover { border-color: var(--ten-control-border); background: var(--ten-list-hover-bg); box-shadow: var(--ten-card-shadow); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-performance { color: var(--ten-muted); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-performance > span:first-child { color: var(--ten-cyan); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-progress,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-mini-progress { background: #dfe7f3; box-shadow: inset 1px 1px 3px rgba(47,66,94,.12); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-progress > i,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-mini-progress > i { background: \
linear-gradient(90deg,var(--ten-cyan),var(--ten-blue)); box-shadow: none; }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-nav::before { \
border-color: var(--ten-line); border-radius: var(--ten-radius-control); background: var(--ten-list-hover-bg); box-shadow: var(--ten-input-shadow); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-source,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-effect-level,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-history-filter,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-rule-readtype,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-appearance-axis { border-color: var(--ten-line); background: \
var(--ten-input-bg); box-shadow: var(--ten-input-shadow); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-source::before { border-color: \
var(--ten-line); background: var(--ten-list-hover-bg); box-shadow: none; }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-appearance-axis \
button.is-active,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-effect-level \
button.is-active,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-history-filter \
button.is-active,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-readtype button.is-active { color: var(--ten-cyan); border-color: \
var(--ten-primary-border); background: var(--ten-list-hover-bg); box-shadow: inset 0 0 0 1px var(--ten-line); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-mode,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-direct-flow-options button,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-rule-templates,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-template-grid button { color: var(--ten-text); border-color: \
var(--ten-line); background: var(--ten-input-bg); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-mode.is-active,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-direct-flow-options \
button.is-active,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-template-grid button.is-active { color: var(--ten-cyan); \
border-color: var(--ten-cyan); background: var(--ten-list-hover-bg); box-shadow: var(--ten-focus-ring); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) #ten-search-site-trigger { color: var(--ten-text); border-color: var(--ten-control-border); \
background: var(--ten-input-bg); box-shadow: var(--ten-input-shadow); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-search-site-option.is-selected { color: var(--ten-cyan); border-color: var(--ten-line); background: var(--ten-list-hover-bg); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-empty-orbit { color: var(--ten-cyan); border-color: var(--ten-line); background: \
var(--ten-list-hover-bg); box-shadow: var(--ten-component-shadow); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-rule-manage,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-advanced { border-color: var(--ten-line); background: \
var(--ten-input-bg); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-advanced \
summary,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-templates summary { color: var(--ten-text); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-advanced[open] summary { color: var(--ten-cyan); border-color: var(--ten-line); \
background: var(--ten-list-bg); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-guide-open { color: var(--ten-cyan); border-color: \
var(--ten-primary-border); background: var(--ten-primary-bg); box-shadow: var(--ten-component-shadow); \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-guide-content,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-rule-guide-content dd { color: var(--ten-text); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-guide-content section { \
border-color: var(--ten-line); background: var(--ten-list-bg); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-guide-content code { \
color: var(--ten-cyan); border-color: var(--ten-line); background: var(--ten-list-hover-bg); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-rule-guide-example,\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-guide-example code { color: var(--ten-text); border-color: \
var(--ten-line); background: var(--ten-list-bg); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-guide-warning { color: #854d0e; \
border-color: #e8cb7c; background: #fffbea; }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-test-result { color: var(--ten-text); \
border-color: var(--ten-line); background: var(--ten-input-bg); }\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-rule-test-result.is-success { color: var(--ten-success); border-color: #a5d4c5; background: #f0fdf7; \
}\n#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-rule-test-result.is-error { color: var(--ten-danger); border-color: \
var(--ten-danger-border); background: var(--ten-danger-bg); }\n\n@media (max-width: 400px) {\n  #ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-task-group:not([data-task-group="history"]) .ten-task-header { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 5px 8px; }\n  \
#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-group:not([data-task-group="history"]) .ten-task-title-button { grid-column: 1; \
grid-row: 1; white-space: nowrap; }\n  #ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-group:not([data-task-group="history"]) \
.ten-task-control-group { display: contents; }\n  #ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-task-group:not([data-task-group="history"]) .ten-task-arrow-button { grid-column: 2; grid-row: 1; justify-self: end; }\n  \
#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-bulk { grid-row: 2; width: 100%; }\n  \
#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-card,\n  #ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) \
.ten-history-card { display: flex; flex-wrap: wrap; }\n  #ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-card > .ten-name,\n  \
#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-history-card > .ten-name { flex: 1 0 100%; min-width: 0; }\n  \
#ten-comic-root:is([data-theme="cloud"],[data-theme="aurora"]) .ten-task-actions { min-width: 0; max-width: 100%; margin-left: auto; flex-wrap: wrap; }\n}\n\n/* \
Aurora glass, obsidian gold and titanium blue components. */\n#ten-comic-root[data-theme="aurora"] {\n  color-scheme: light;\n  --ten-bg: #eaf2f8; \
--ten-surface: rgba(255,255,255,.68); --ten-surface-strong: rgba(255,255,255,.88);\n  --ten-text: #1b3b50; --ten-muted: #4b6376; --ten-line: \
rgba(69,108,138,.22);\n  --ten-cyan: #126487; --ten-blue: #427fa8; --ten-violet: #647b9b; --ten-pink: #a45277;\n  --ten-danger: #b12743; --ten-success: \
#22694f;\n  --ten-panel-bg: radial-gradient(ellipse at 4% 0,rgba(255,255,255,.96),transparent 46%),radial-gradient(ellipse at 106% \
62%,rgba(189,220,244,.6),transparent 52%),linear-gradient(145deg,rgba(241,249,255,.9),rgba(223,236,246,.86) 48%,rgba(246,251,255,.92)) #eaf3ff;\n  \
--ten-panel-border: rgba(255,255,255,.96);\n  --ten-panel-shadow: 0 24px 64px rgba(47,95,151,.2),-3px 0 20px rgba(103,226,245,.15),3px 2px 22px \
rgba(155,142,234,.16),0 0 0 1px rgba(85,128,159,.16),inset 1px 1px 0 #ffffff,inset -1px -1px 0 rgba(180,204,223,.5);\n  --ten-header-bg: \
linear-gradient(115deg,rgba(255,255,255,.74),rgba(235,246,255,.42));\n  --ten-card-bg: linear-gradient(135deg,rgba(255,255,255,.88),rgba(255,255,255,.48) \
54%,rgba(241,249,255,.7)) #eff7ff;\n  --ten-card-border: rgba(255,255,255,.94);\n  --ten-card-shadow: inset 1px 1px 0 #ffffff,inset -1px -1px 0 \
rgba(187,211,229,.42),0 7px 20px rgba(45,83,112,.08);\n  --ten-task-bg: rgba(250,253,255,.86); --ten-list-bg: #f4faff; --ten-list-hover-bg: #edf7fd;\n  \
--ten-control-bg: linear-gradient(135deg,#ffffff,#e0f2ff 54%,#f1edff);\n  --ten-control-hover-bg: #e5f2fa; --ten-control-border: rgba(83,127,158,.28);\n  \
--ten-primary-bg: linear-gradient(125deg,#ecfcff,#cce9f8); --ten-primary-text: #164f6a; --ten-primary-border: #a0c8dd;\n  --ten-danger-bg: #fff1f4; \
--ten-danger-text: #a82640; --ten-danger-border: #e9bfca;\n  --ten-input-bg: rgba(255,255,255,.86); --ten-popover-bg: \
linear-gradient(135deg,rgba(255,255,255,.99),rgba(235,246,255,.98)) #f5faff;\n  --ten-empty-bg: rgba(255,255,255,.7); --ten-info-bg: rgba(247,252,255,.8); \
--ten-mini-bg: rgba(245,251,255,.97);\n  --ten-overlay-bg: rgba(34,58,78,.28);\n  --ten-tooltip-bg: #f7fcff; --ten-tooltip-text: #1b3b50; --ten-tooltip-border: \
#c1d7e6;\n  --ten-tooltip-shadow: 0 14px 34px rgba(38,74,103,.16),inset 1px 1px 0 #ffffff;\n  --ten-toast-bg: #f7fcff; --ten-toast-text: #1b3b50; \
--ten-toast-border: #c1d7e6;\n  --ten-launcher-bg: linear-gradient(140deg,#ffffff,rgba(227,243,255,.94) 48%,#f7fcff); --ten-launcher-border: #ffffff;\n  \
--ten-launcher-shadow: inset 1px 1px 0 #ffffff,inset -1px -1px 0 #b4ccdd,0 8px 24px rgba(38,74,103,.22);\n  --ten-radius-panel: 29px; --ten-radius-card: 20px; \
--ten-radius-control: 13px; --ten-radius-launcher: 20px;\n  --ten-focus-ring: 0 0 0 3px rgba(18,100,135,.16); --ten-scroll-thumb: #9bb8cc;\n  \
--ten-component-shadow: inset 0 1px 0 #ffffff,inset 0 -1px 0 rgba(160,190,211,.22),0 3px 8px rgba(45,83,112,.09);\n  --ten-input-shadow: inset 0 1px 3px \
rgba(45,83,112,.07),0 1px 0 #ffffff;\n}\n#ten-comic-root[data-theme="aurora"] #ten-panel,\n#ten-comic-root[data-theme="aurora"] #ten-search-panel { \
backdrop-filter: blur(32px) saturate(1.45); -webkit-backdrop-filter: blur(32px) saturate(1.45); }\n#ten-comic-root[data-theme="aurora"] \
.ten-card,\n#ten-comic-root[data-theme="aurora"] .ten-task-group { backdrop-filter: blur(10px) saturate(1.12); -webkit-backdrop-filter: blur(10px) \
saturate(1.12); }\n#ten-comic-root[data-theme="aurora"] .ten-brand-mark { border-color: #ffffff; background: linear-gradient(145deg,#ffffff,#d9ecfa); \
box-shadow: var(--ten-component-shadow); }\n#ten-comic-root[data-theme="aurora"] .ten-header { border-bottom-color: rgba(255,255,255,.9); box-shadow: 0 1px 0 \
rgba(106,144,172,.13); }\n#ten-comic-root[data-theme="aurora"] .ten-nav { border-top-color: rgba(255,255,255,.95); box-shadow: 0 -1px 0 rgba(106,144,172,.12); \
}\n#ten-comic-root[data-theme="aurora"] .ten-nav::before { border-color: #ffffff; background: \
linear-gradient(145deg,rgba(255,255,255,.96),rgba(207,231,248,.78)); box-shadow: inset 0 1px 0 #ffffff,0 3px 9px rgba(45,83,112,.12); \
}\n#ten-comic-root[data-theme="aurora"] .ten-btn:hover:not(:disabled) { transform: translateY(-1px); border-color: #90b7cf; box-shadow: inset 0 1px 0 #ffffff,0 \
5px 12px rgba(45,83,112,.14); }\n#ten-comic-root[data-theme="aurora"] .ten-btn:active:not(:disabled) { transform: translateY(0); box-shadow: \
var(--ten-input-shadow); }\n#ten-comic-root[data-theme="aurora"] .ten-settings-summary { background: \
linear-gradient(110deg,rgba(255,255,255,.8),rgba(235,246,255,.35)); }\n#ten-comic-root[data-theme="aurora"] .ten-progress { background: #d4e3ef; box-shadow: \
inset 0 1px 2px rgba(45,83,112,.12); }\n#ten-comic-root[data-theme="aurora"] .ten-progress > i { background: linear-gradient(90deg,#397e9d,#5aa8c2,#76a6c9); \
}\n#ten-comic-root[data-theme="aurora"] .ten-mobile-drawer-sheet { box-shadow: 0 -12px 36px rgba(38,74,103,.18),inset 0 1px 0 #ffffff; }\n#ten-comic-root \
.ten-theme-choice[data-theme-choice="aurora"] { background-image: linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,255,255,.16) 43%,rgba(154,205,234,.2) \
58%,rgba(255,255,255,.72)); box-shadow: inset 3px 0 var(--ten-preview-accent),inset 0 1px 0 #ffffff,0 3px 8px rgba(45,83,112,.08); }\n@supports not \
((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {\n  #ten-comic-root[data-theme="aurora"] { --ten-panel-bg: #edf4f9; --ten-card-bg: \
#f9fcff; --ten-task-bg: #f9fcff; --ten-popover-bg: #f5faff; }\n}\n\n#ten-comic-root[data-theme="obsidian"] {\n  color-scheme: dark;\n  --ten-bg: #15130f; \
--ten-surface: #211e18; --ten-surface-strong: #2c271e;\n  --ten-text: #f8efd8; --ten-muted: #c8b999; --ten-line: #64563d;\n  --ten-cyan: #edd08c; --ten-blue: \
#b59a61; --ten-violet: #b7a27b; --ten-pink: #dc9aa8;\n  --ten-danger: #ff9baf; --ten-success: #8bd2b1;\n  --ten-panel-bg: radial-gradient(ellipse at 4% \
0,rgba(234,195,109,.16),transparent 43%),linear-gradient(150deg,#252218,#12110e 80%) #15130f;\n  --ten-panel-border: #9b824c;\n  --ten-panel-shadow: 0 24px 70px \
rgba(8,6,2,.52),0 0 20px rgba(215,179,92,.12),inset 0 1px 0 rgba(255,230,176,.28),inset 0 -1px 0 #080705;\n  --ten-header-bg: \
linear-gradient(120deg,rgba(65,55,32,.6),rgba(20,19,15,.7));\n  --ten-card-bg: linear-gradient(145deg,rgba(63,55,38,.45),rgba(28,26,21,.7)) #211e18;\n  \
--ten-card-border: #6d5c3e; --ten-card-shadow: inset 0 1px 0 rgba(255,233,180,.09),0 8px 22px rgba(0,0,0,.16);\n  --ten-task-bg: #211f19; --ten-list-bg: \
#28251d; --ten-list-hover-bg: #332e23;\n  --ten-control-bg: linear-gradient(140deg,#3c3424,#211f19); --ten-control-hover-bg: #3b3322; --ten-control-border: \
#81704b;\n  --ten-primary-bg: linear-gradient(125deg,#69542e,#3d3422); --ten-primary-text: #fff0c7; --ten-primary-border: #b99a53;\n  --ten-danger-bg: #392027; \
--ten-danger-text: #ffd3dc; --ten-danger-border: #aa596c;\n  --ten-input-bg: #191815; --ten-popover-bg: \
linear-gradient(140deg,rgba(51,44,30,.5),rgba(25,24,20,.4)) #201d17;\n  --ten-empty-bg: #211e18; --ten-info-bg: #242118; --ten-mini-bg: #242118;\n  \
--ten-overlay-bg: rgba(8,7,4,.72);\n  --ten-tooltip-bg: #242118; --ten-tooltip-text: #f8efd8; --ten-tooltip-border: #9b824c;\n  --ten-tooltip-shadow: 0 12px \
34px rgba(0,0,0,.44),inset 0 1px 0 rgba(255,230,176,.12);\n  --ten-toast-bg: #242118; --ten-toast-text: #f8efd8; --ten-toast-border: #9b824c;\n  \
--ten-launcher-bg: linear-gradient(145deg,#49402b,#171510); --ten-launcher-border: #b49a5e;\n  --ten-launcher-shadow: inset 0 1px 0 #cfb57a,0 8px 24px \
rgba(0,0,0,.35),0 0 18px rgba(214,178,94,.13);\n  --ten-radius-panel: 25px; --ten-radius-card: 17px; --ten-radius-control: 12px; --ten-radius-launcher: 18px;\n  \
--ten-focus-ring: 0 0 0 3px rgba(225,191,112,.2); --ten-scroll-thumb: #917e54;\n  --ten-component-shadow: inset 0 1px 0 rgba(255,229,169,.16),0 3px 8px \
rgba(0,0,0,.22);\n  --ten-input-shadow: inset 0 2px 4px rgba(0,0,0,.25),0 1px 0 rgba(255,229,169,.06);\n  --ten-button-sheen: \
rgba(255,222,151,.22);\n}\n#ten-comic-root[data-theme="titanium"] {\n  color-scheme: dark;\n  --ten-bg: #101c2e; --ten-surface: #1a2b42; --ten-surface-strong: \
#243b55;\n  --ten-text: #edf6ff; --ten-muted: #b0c2d7; --ten-line: #496683;\n  --ten-cyan: #7cc5ff; --ten-blue: #438cd5; --ten-violet: #7c92b4; --ten-pink: \
#df8eaf;\n  --ten-danger: #ff9cab; --ten-success: #82d6ba;\n  --ten-panel-bg: radial-gradient(ellipse at 96% 0,rgba(73,139,194,.18),transparent \
44%),linear-gradient(155deg,#20364e,#0c1423 83%) #101c2e;\n  --ten-panel-border: #6a9bc0;\n  --ten-panel-shadow: 0 24px 70px rgba(1,8,19,.5),0 0 24px \
rgba(91,166,224,.14),inset 0 1px 0 #9dbed7,inset 0 -1px 0 #050b14;\n  --ten-header-bg: linear-gradient(110deg,rgba(48,76,104,.56),rgba(13,25,41,.75));\n  \
--ten-card-bg: linear-gradient(145deg,rgba(51,80,112,.4),rgba(16,31,49,.6)) #1a2b42;\n  --ten-card-border: #496c8d; --ten-card-shadow: inset 0 1px 0 \
rgba(184,215,239,.12),0 7px 20px rgba(0,6,17,.2);\n  --ten-task-bg: #182a40; --ten-list-bg: #1a2c43; --ten-list-hover-bg: #243d59;\n  --ten-control-bg: \
linear-gradient(145deg,#2c4866,#15273c); --ten-control-hover-bg: #29435f; --ten-control-border: #557da5;\n  --ten-primary-bg: \
linear-gradient(125deg,#305d88,#173752); --ten-primary-text: #eaf6ff; --ten-primary-border: #6da9d7;\n  --ten-danger-bg: #3b2336; --ten-danger-text: #ffd7df; \
--ten-danger-border: #ad627b;\n  --ten-input-bg: #101f32; --ten-popover-bg: linear-gradient(145deg,rgba(43,72,101,.45),rgba(12,27,44,.5)) #16283f;\n  \
--ten-empty-bg: #182a40; --ten-info-bg: #17283d; --ten-mini-bg: #182c43;\n  --ten-overlay-bg: rgba(2,9,20,.72);\n  --ten-tooltip-bg: #182c43; \
--ten-tooltip-text: #edf6ff; --ten-tooltip-border: #638eaf;\n  --ten-tooltip-shadow: 0 12px 34px rgba(0,5,15,.44),inset 0 1px 0 rgba(183,214,238,.16);\n  \
--ten-toast-bg: #182c43; --ten-toast-text: #edf6ff; --ten-toast-border: #638eaf;\n  --ten-launcher-bg: linear-gradient(145deg,#2c4b6b,#0e1a2b); \
--ten-launcher-border: #7eaed3;\n  --ten-launcher-shadow: inset 0 1px 0 #a1c6e2,0 8px 24px rgba(0,5,15,.38),0 0 18px rgba(88,160,219,.17);\n  \
--ten-radius-panel: 20px; --ten-radius-card: 13px; --ten-radius-control: 9px; --ten-radius-launcher: 14px;\n  --ten-focus-ring: 0 0 0 3px rgba(98,168,233,.2); \
--ten-scroll-thumb: #607f9d;\n  --ten-component-shadow: inset 0 1px 0 rgba(185,215,239,.19),inset 0 -1px 0 rgba(1,9,19,.5),0 3px 7px rgba(0,5,15,.25);\n  \
--ten-input-shadow: inset 0 2px 4px rgba(0,5,15,.35),0 1px 0 rgba(185,215,239,.07);\n  --ten-button-sheen: \
rgba(156,211,255,.22);\n}\n\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
#ten-panel::before,\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
#ten-comic-launcher::before,\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) #ten-particle-field { display: none; \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) #ten-comic-launcher { color: var(--ten-cyan); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-brand-mark { border-color: var(--ten-primary-border); background: \
var(--ten-control-bg); box-shadow: var(--ten-component-shadow); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-chapter-tools { \
border-color: var(--ten-card-border); background: var(--ten-card-bg); box-shadow: var(--ten-card-shadow); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-input,.ten-select,.ten-textarea,.ten-setting-select > button) { color: \
var(--ten-text); border-color: var(--ten-control-border); box-shadow: var(--ten-input-shadow); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(input,textarea)::placeholder { color: var(--ten-muted); opacity: 1; \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-select option { color: var(--ten-text); background: var(--ten-input-bg); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-setting label,.ten-rule-fields \
label,.ten-rule-label,.ten-confirm-message,.ten-rule-guide-content,.ten-rule-guide-content dd) { color: var(--ten-text); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(#ten-diagnostic-content,.ten-rule-manage,.ten-rule-advanced,.ten-mode,.ten-direct-flow-options \
button,.ten-rule-templates,.ten-rule-template-grid button,.ten-rule-test-result) { color: var(--ten-text); border-color: var(--ten-line); background: \
var(--ten-input-bg); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-source,.ten-effect-level,.ten-history-filter,.ten-rule-readtype,.ten-appearance-axis) { border-color: var(--ten-line); background: var(--ten-input-bg); \
box-shadow: var(--ten-input-shadow); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-appearance-axis button,.ten-effect-level \
button,.ten-history-filter button,.ten-rule-readtype button,.ten-mode,.ten-direct-flow-options button,.ten-rule-template-grid button).is-active { color: \
var(--ten-cyan); border-color: var(--ten-menu-border); background: var(--ten-menu-selected-bg); box-shadow: inset 0 0 0 1px var(--ten-line); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-source::before,\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
.ten-nav::before { border-color: var(--ten-menu-border); background: var(--ten-menu-selected-bg); box-shadow: var(--ten-component-shadow); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-task-card,.ten-history-card):hover { border-color: var(--ten-control-border); \
background: var(--ten-list-hover-bg); box-shadow: var(--ten-card-shadow); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
.ten-task-performance { color: var(--ten-muted); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-task-performance > span:first-child \
{ color: var(--ten-cyan); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-task-state.is-failed,.ten-task-state.is-partial,.ten-rule-test-result.is-error) { color: var(--ten-danger-text); border-color: \
var(--ten-danger-border); background: var(--ten-danger-bg); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-task-state.is-cancelled \
{ color: var(--ten-muted); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-task-actions .is-danger { color: var(--ten-danger); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-progress,.ten-mini-progress) { background: var(--ten-input-bg); box-shadow: \
var(--ten-input-shadow); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-progress,.ten-mini-progress) > i { background: \
linear-gradient(90deg,var(--ten-blue),var(--ten-cyan)); box-shadow: none; }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
.ten-empty-orbit { color: var(--ten-cyan); border-color: var(--ten-line); background: var(--ten-list-bg); box-shadow: var(--ten-component-shadow); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-rule-guide-content section,.ten-rule-guide-example,.ten-rule-guide-example code) \
{ color: var(--ten-text); border-color: var(--ten-line); background: var(--ten-list-bg); }\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
.ten-rule-guide-content code { color: var(--ten-cyan); border-color: var(--ten-line); background: var(--ten-input-bg); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-rule-guide-open { color: var(--ten-primary-text); border-color: \
var(--ten-primary-border); background: var(--ten-primary-bg); box-shadow: var(--ten-component-shadow); \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-rule-guide-warning { color: #f5d18d; border-color: #967a43; background: #382c18; \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-rule-test-result.is-success { color: var(--ten-success); border-color: \
var(--ten-success); background: var(--ten-list-bg); }\n\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-site-kind,.ten-task-count) { color: var(--ten-cyan); border-color: var(--ten-menu-border); background: var(--ten-menu-selected-bg); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-mini-icon,.ten-rule-pick-symbol,.ten-confirm-icon.is-info,.ten-recovery,.ten-rule-edit) { color: var(--ten-cyan); border-color: var(--ten-menu-border); \
background: var(--ten-menu-selected-bg); box-shadow: var(--ten-component-shadow); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) .ten-number-steps { border-color: var(--ten-control-border); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) .ten-number-control:is(:hover,:focus-within) .ten-number-steps { \
border-color: var(--ten-cyan); box-shadow: var(--ten-focus-ring); }\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
.ten-number-steps button { color: var(--ten-muted); background: var(--ten-input-bg); border-color: var(--ten-line); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-number-steps button,.ten-icon-btn):hover:not(:disabled) { \
color: var(--ten-cyan); border-color: var(--ten-menu-border); background: var(--ten-menu-hover-bg); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) #ten-reload-chapters { color: var(--ten-cyan); border-color: \
var(--ten-control-border); background: var(--ten-control-bg); }\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
.ten-rule-pick-box { background: rgba(255,255,255,.06); box-shadow: 0 0 0 9999px var(--ten-overlay-bg),var(--ten-focus-ring); }\n\n/* Only interaction-driven \
transitions; the effect switches also govern motion. */\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger,.ten-appearance-axis button,.ten-effect-level button) { position: relative; overflow: clip; \
box-shadow: var(--ten-component-shadow); transition: transform .16s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease; \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger)::before { content: ""; position: absolute; pointer-events: none; inset: 0 auto 0 -75%; width: \
55%; height: auto; opacity: 0; background: linear-gradient(100deg,transparent,var(--ten-button-sheen,rgba(255,255,255,.65)),transparent); transform: \
skewX(-18deg); transition: left .45s ease,opacity .2s ease; }\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger):hover:not(:disabled)::before { left: 125%; opacity: var(--ten-sheen-opacity,.8); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger,.ten-appearance-axis button,.ten-effect-level button):hover:not(:disabled) { border-color: \
var(--ten-cyan); box-shadow: var(--ten-component-shadow),var(--ten-focus-ring); transform: var(--ten-hover-move,translateY(-1px)); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger,.ten-appearance-axis button,.ten-effect-level button):active:not(:disabled) { transform: \
var(--ten-press-move,translateY(1px) scale(.98)); box-shadow: var(--ten-input-shadow); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]):is([data-effects="0"],[data-motion="calm"]) { --ten-hover-move: \
none; --ten-press-move: none; --ten-sheen-opacity: 0; }\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]):is([data-effects="0"],[data-motion="calm"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger,.ten-appearance-axis button,.ten-effect-level button) { transform: none; transition: none; \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]):is([data-effects="0"],[data-motion="calm"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger)::before { opacity: 0; transition: none; }\n@media (prefers-reduced-motion: reduce) {\n  \
#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) { --ten-hover-move: none; --ten-press-move: none; --ten-sheen-opacity: \
0; }\n  #ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger,.ten-appearance-axis button,.ten-effect-level button) { transform: none; transition: none; }\n  \
#ten-comic-root:is([data-theme="aurora"],[data-theme="obsidian"],[data-theme="titanium"]) \
:is(.ten-btn,#ten-default-mode-trigger,#ten-search-site-trigger)::before { opacity: 0; transition: none; }\n}\n@media (max-width: 400px) {\n  \
#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-task-group:not([data-task-group="history"]) .ten-task-header { display: grid; \
grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 5px 8px; }\n  #ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) \
.ten-task-group:not([data-task-group="history"]) .ten-task-title-button { grid-column: 1; grid-row: 1; white-space: nowrap; }\n  \
#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-task-group:not([data-task-group="history"]) .ten-task-control-group { display: \
contents; }\n  #ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-task-group:not([data-task-group="history"]) .ten-task-arrow-button { \
grid-column: 2; grid-row: 1; justify-self: end; }\n  #ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-task-bulk { grid-row: 2; width: \
100%; }\n  #ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-task-card,.ten-history-card) { display: flex; flex-wrap: wrap; }\n  \
#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) :is(.ten-task-card,.ten-history-card) > .ten-name { flex: 1 0 100%; min-width: 0; }\n  \
#ten-comic-root:is([data-theme="obsidian"],[data-theme="titanium"]) .ten-task-actions { min-width: 0; max-width: 100%; margin-left: auto; flex-wrap: wrap; \
}\n}\n\n/* Menu states share the current theme, including nested radio indicators. */\n#ten-comic-root {\n  --ten-menu-selected-bg: #17344b; \
--ten-menu-hover-bg: #203e55;\n  --ten-menu-border: #397b92; --ten-menu-muted: #abc3d4; --ten-menu-mark-inner: #152b40;\n  --ten-menu-filter: blur(24px) \
saturate(1.3);\n}\n#ten-comic-root[data-theme="mist"] { --ten-menu-selected-bg: #e2f3fa; --ten-menu-hover-bg: #ecf7fc; --ten-menu-border: #83bace; \
--ten-menu-muted: #526c80; --ten-menu-mark-inner: #f6fbff; }\n#ten-comic-root[data-theme="cloud"] { --ten-menu-selected-bg: #eaf1fc; --ten-menu-hover-bg: \
#f0f5fc; --ten-menu-border: #b1c5e0; --ten-menu-muted: #53647a; --ten-menu-mark-inner: #ffffff; --ten-menu-filter: none; }\n#ten-comic-root[data-theme="aurora"] \
{ --ten-menu-selected-bg: #e0f1ff; --ten-menu-hover-bg: #eef8ff; --ten-menu-border: #a0c8e2; --ten-menu-muted: #4b6376; --ten-menu-mark-inner: #f5faff; \
--ten-menu-filter: blur(28px) saturate(1.45); }\n#ten-comic-root[data-theme="obsidian"] { --ten-menu-selected-bg: #41361f; --ten-menu-hover-bg: #342f22; \
--ten-menu-border: #b69c58; --ten-menu-muted: #ded0ae; --ten-menu-mark-inner: #211e18; --ten-menu-filter: blur(24px) saturate(1.1); \
}\n#ten-comic-root[data-theme="carbon"] { --ten-menu-selected-bg: #202d42; --ten-menu-hover-bg: #19273a; --ten-menu-border: #4a7eae; --ten-menu-muted: #adbbcf; \
--ten-menu-mark-inner: #111821; }\n#ten-comic-root[data-theme="titanium"] { --ten-menu-selected-bg: #223e5b; --ten-menu-hover-bg: #1b344e; --ten-menu-border: \
#5996c6; --ten-menu-muted: #bcd1e6; --ten-menu-mark-inner: #16283f; --ten-menu-filter: blur(24px) saturate(1.1); }\n#ten-comic-root[data-theme] \
.ten-setting-select-menu,\n#ten-comic-root[data-theme] .ten-search-site-menu { overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; \
scrollbar-color: var(--ten-scroll-thumb) transparent; backdrop-filter: var(--ten-menu-filter); -webkit-backdrop-filter: var(--ten-menu-filter); \
}\n#ten-comic-root[data-theme] #ten-default-mode-trigger,\n#ten-comic-root[data-theme] #ten-search-site-trigger { color: var(--ten-text); border-color: \
var(--ten-control-border); background: var(--ten-input-bg); border-radius: var(--ten-radius-control); }\n#ten-comic-root[data-theme] \
#ten-default-mode-trigger:hover,\n#ten-comic-root[data-theme] .ten-setting-select.is-open #ten-default-mode-trigger,\n#ten-comic-root[data-theme] \
#ten-search-site-trigger:hover,\n#ten-comic-root[data-theme] .ten-search-site-picker.is-open #ten-search-site-trigger { border-color: var(--ten-cyan); \
background: var(--ten-input-bg); box-shadow: var(--ten-focus-ring); }\n#ten-comic-root[data-theme] .ten-setting-select-menu button,\n#ten-comic-root[data-theme] \
.ten-search-site-option { color: var(--ten-text); border-radius: max(7px,calc(var(--ten-radius-control) - 3px)); }\n#ten-comic-root[data-theme] \
.ten-setting-select-menu button small,\n#ten-comic-root[data-theme] .ten-search-site-option small { color: var(--ten-menu-muted); }\n#ten-comic-root[data-theme] \
.ten-setting-select-menu button:hover,\n#ten-comic-root[data-theme] .ten-search-site-option:hover:not(:disabled) { color: var(--ten-text); border-color: \
var(--ten-menu-border); background: var(--ten-menu-hover-bg); }\n#ten-comic-root[data-theme] .ten-setting-select-menu \
button.is-selected,\n#ten-comic-root[data-theme] .ten-search-site-option.is-selected { color: var(--ten-text); border-color: var(--ten-menu-border); background: \
var(--ten-menu-selected-bg); }\n#ten-comic-root[data-theme] .ten-mode-option-mark { border-color: var(--ten-menu-border); background: transparent; box-shadow: \
inset 0 0 0 2px var(--ten-menu-mark-inner); }\n#ten-comic-root[data-theme] .ten-setting-select-menu button.is-selected .ten-mode-option-mark { border-color: \
var(--ten-cyan); background: var(--ten-cyan); box-shadow: inset 0 0 0 2px var(--ten-menu-mark-inner); }\n#ten-comic-root[data-theme] \
.ten-search-site-menu::-webkit-scrollbar-thumb { background: var(--ten-scroll-thumb); }\n\n/*\nMinimized launcher effects adapted and recomposed \
from:\nhttps://uiverse.io/aadium/bright-lion-66\nhttps://uiverse.io/imtausef/neat-donkey-42\n\nMIT License\nCopyright (c) 2026 aadium (Aadi Umrani)\nCopyright \
(c) 2026 imtausef (Muhammad Tauseef)\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated \
documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, \
publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the \
following conditions:\n\nThe above copyright notice and this permission notice shall be included in\nall copies or substantial portions of the Software.\n\nTHE \
SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A \
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN \
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\nTHE \
SOFTWARE.\n*/\n\n#ten-comic-root[data-theme="aurora"] {\n  --ten-launcher-fx-name: ten-launcher-fx-aurora;\n  --ten-launcher-fx-period: 7s;\n  \
--ten-launcher-fx-gradient: conic-gradient(from 90deg,#8aeaff,#a8c3ff 28%,#dbbaff 52%,#b1eeff 78%,#8aeaff);\n  --ten-launcher-fx-line: \
rgba(255,255,255,.75);\n}\n#ten-comic-root[data-theme="cloud"] {\n  --ten-launcher-fx-name: ten-launcher-fx-cloud;\n  --ten-launcher-fx-period: 5.4s;\n  \
--ten-launcher-fx-gradient: radial-gradient(ellipse at 50% 50%,transparent 55%,#a1bddf 90%);\n  --ten-launcher-fx-line: \
rgba(255,255,255,.9);\n}\n#ten-comic-root[data-theme="obsidian"] {\n  --ten-launcher-fx-name: ten-launcher-fx-obsidian;\n  --ten-launcher-fx-period: 8s;\n  \
--ten-launcher-fx-gradient: conic-gradient(from 30deg,transparent 0deg 230deg,#765f32 260deg,#ffe7a3 280deg,#bda15c 300deg,transparent 330deg 360deg);\n  \
--ten-launcher-fx-line: rgba(255,222,151,.18);\n}\n#ten-comic-root[data-theme="carbon"] {\n  --ten-launcher-fx-name: ten-launcher-fx-carbon;\n  \
--ten-launcher-fx-period: 4.8s;\n  --ten-launcher-fx-gradient: conic-gradient(from 0deg,transparent 0deg 55deg,#46bcff 85deg,transparent 125deg 235deg,#ff66b0 \
265deg,transparent 305deg 360deg);\n  --ten-launcher-fx-line: rgba(117,180,232,.2);\n}\n#ten-comic-root[data-theme="titanium"] {\n  --ten-launcher-fx-name: \
ten-launcher-fx-titanium;\n  --ten-launcher-fx-period: 6s;\n  --ten-launcher-fx-gradient: linear-gradient(110deg,transparent 32%,rgba(124,197,255,.12) \
42%,#b4e5ff 50%,rgba(124,197,255,.12) 58%,transparent 68%);\n  --ten-launcher-fx-line: rgba(158,203,237,.2);\n}\n\n/* Mist is deliberately excluded; keep its \
original launcher unchanged. */\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) \
#ten-comic-launcher { isolation: isolate; }\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) \
#ten-comic-launcher::before {\n  content: ""; display: block; position: absolute; z-index: 0; inset: -65%; pointer-events: none;\n  border: 0; border-radius: 0; \
background: var(--ten-launcher-fx-gradient);\n  opacity: var(--ten-launcher-fx-alpha,.9);\n  animation: var(--ten-launcher-fx-name) \
calc(var(--ten-launcher-fx-period) * var(--ten-launcher-fx-speed,1)) linear infinite;\n}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) \
#ten-comic-launcher::after {\n  content: ""; display: block; position: absolute; z-index: 1; inset: 2px; pointer-events: none;\n  border: 1px solid \
var(--ten-launcher-fx-line); border-radius: max(4px,calc(var(--ten-radius-launcher) - 2px)); background: \
var(--ten-launcher-bg);\n}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) \
#ten-comic-launcher span { z-index: 2; }\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) \
#ten-comic-launcher:hover { box-shadow: var(--ten-launcher-shadow),var(--ten-focus-ring); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"])[data-effects="1"] { \
--ten-launcher-fx-speed: 1.6; --ten-launcher-fx-alpha: .52; }\n#ten-comic-root[data-theme="cloud"] #ten-comic-launcher::before { inset: 0; border-radius: \
inherit; animation-timing-function: ease-in-out; }\n#ten-comic-root[data-theme="titanium"] #ten-comic-launcher::before { inset: -30%; animation-timing-function: \
ease-in-out; }\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) \
#ten-comic-launcher.is-hidden::before { animation-play-state: paused; }\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]):is([data-effects="0"],[data-motion="calm"]) \
#ten-comic-launcher::before,\n#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]):is([data-effects="0"],[data-motion="calm"]) \
#ten-comic-launcher::after { display: none; animation: none; }\n\n@keyframes ten-launcher-fx-aurora { to { transform: rotate(360deg); } }\n@keyframes \
ten-launcher-fx-cloud {\n  0%,100% { transform: scale(.94); opacity: calc(var(--ten-launcher-fx-alpha,.9) * .3); }\n  50% { transform: scale(1); opacity: \
var(--ten-launcher-fx-alpha,.9); }\n}\n@keyframes ten-launcher-fx-obsidian { to { transform: rotate(360deg); } }\n@keyframes ten-launcher-fx-carbon { to { \
transform: rotate(-360deg); } }\n@keyframes ten-launcher-fx-titanium {\n  0%,12% { transform: translateX(-100%) skewX(-18deg); opacity: 0; }\n  25% { opacity: \
var(--ten-launcher-fx-alpha,.9); }\n  65% { transform: translateX(100%) skewX(-18deg); opacity: var(--ten-launcher-fx-alpha,.9); }\n  72%,100% { transform: \
translateX(140%) skewX(-18deg); opacity: 0; }\n}\n@media (prefers-reduced-motion: reduce) {\n  \
#ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) \
#ten-comic-launcher::before,\n  #ten-comic-root:is([data-theme="aurora"],[data-theme="cloud"],[data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) \
#ten-comic-launcher::after { display: none; animation: none; }\n}\n\n#ten-comic-root[data-shape="sharp"] { --ten-radius-panel: 14px; --ten-radius-card: 10px; \
--ten-radius-control: 7px; --ten-radius-launcher: 10px; }\n#ten-comic-root[data-shape="round"] { --ten-radius-panel: 30px; --ten-radius-card: 22px; \
--ten-radius-control: 15px; --ten-radius-launcher: 22px; }\n#ten-comic-root[data-density="compact"] #ten-panel { grid-template-rows: 52px minmax(0,1fr) 58px; \
}\n#ten-comic-root[data-density="compact"] .ten-view { padding: 9px; }\n#ten-comic-root[data-density="compact"] .ten-card { margin-bottom: 6px; padding: 9px; \
}\n#ten-comic-root[data-density="compact"] .ten-list { gap: 5px; }\n#ten-comic-root[data-density="compact"] .ten-list-item { min-height: 38px; padding: 7px 9px; \
}\n#ten-comic-root[data-density="comfortable"] .ten-view { padding: 16px; }\n#ten-comic-root[data-density="comfortable"] .ten-card { margin-bottom: 12px; \
padding: 13px; }\n#ten-comic-root[data-density="comfortable"] .ten-list { gap: 9px; }\n#ten-comic-root[data-density="comfortable"] .ten-list-item { min-height: \
47px; padding: 11px 13px; }\n#ten-comic-root[data-motion="calm"] #ten-panel { transition-duration: .25s; }\n#ten-comic-root[data-motion="calm"] .ten-task-body { \
transition-duration: .32s; }\n#ten-comic-root[data-motion="spring"] #ten-panel { transition-timing-function: cubic-bezier(.16,1.35,.3,1); \
}\n#ten-comic-root[data-motion="spring"] .ten-task-body { transition-timing-function: cubic-bezier(.16,1.25,.3,1); }\n\n@media (max-width: 380px) \
{\n:where(#ten-comic-root) .ten-theme-presets { grid-template-columns: 1fr; }\n}\n\n#ten-comic-root #ten-panel { width: min(430px, calc((100vw - 28px) / \
var(--ten-scale))); height: min(780px, calc((100vh - 28px) / var(--ten-scale))); }\n/* Shared interaction and layout refinements. Theme values remain \
authoritative. */\n#ten-comic-root {\n  --ten-space-1: 4px;\n  --ten-space-2: 8px;\n  --ten-space-3: 12px;\n  --ten-space-4: 16px;\n  \
--ten-readable-line-height: 1.6;\n  -webkit-tap-highlight-color: transparent;\n}\n#ten-comic-root .ten-confirm,\n#ten-comic-root .ten-diagnostic { transition: \
opacity .2s ease; }\n#ten-comic-root :is(button, input, select, textarea, summary):focus-visible {\n  outline: 2px solid var(--ten-cyan);\n  outline-offset: \
3px;\n}\n#ten-comic-root .ten-card-title { line-height: 1.5; letter-spacing: .02em; }\n#ten-comic-root .ten-meta,\n#ten-comic-root \
.ten-settings-hint,\n#ten-comic-root .ten-rule-simple-hint { line-height: var(--ten-readable-line-height); }\n#ten-comic-root .ten-chapter-label { min-width: 0; \
overflow: hidden; }\n#ten-comic-root .ten-chapter-label .ten-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \
}\n#ten-comic-root .ten-chapter-label .ten-input { width: 100%; min-width: 0; }\n#ten-comic-root .ten-list-item { transition: background-color .16s, \
border-color .16s; }\n#ten-comic-root .ten-list-item.is-selected { border-color: var(--ten-cyan); background: var(--ten-list-hover-bg); }\n#ten-comic-root \
.ten-list-item:focus-within { box-shadow: var(--ten-focus-ring); }\n#ten-comic-root input[type="checkbox"] { accent-color: var(--ten-cyan); }\n#ten-comic-root \
.ten-result { min-width: 0; }\n#ten-comic-root .ten-result > span { overflow-wrap: anywhere; }\n#ten-comic-root .ten-task-title { line-height: 1.55; \
}\n#ten-comic-root .ten-settings-card { scroll-margin-block: var(--ten-space-3); }\n#ten-comic-root .ten-settings-card .ten-card-title { margin-bottom: \
var(--ten-space-3); }\n#ten-comic-root .ten-setting > label { min-width: 0; overflow-wrap: anywhere; }\n#ten-comic-root #ten-rule-guide .ten-rule-guide-content \
{ min-height: 0; overscroll-behavior: contain; }\n#ten-comic-root .ten-view,\n#ten-comic-root .ten-search-panel-content,\n#ten-comic-root \
#ten-mobile-drawer-content { overscroll-behavior: contain; scrollbar-gutter: stable; }\n#ten-comic-root #ten-panel:not(.is-open) *,\n#ten-comic-root \
#ten-panel:not(.is-open) *::before,\n#ten-comic-root #ten-panel:not(.is-open) *::after,\n#ten-comic-root.is-page-hidden *,\n#ten-comic-root.is-page-hidden \
*::before,\n#ten-comic-root.is-page-hidden *::after { animation-play-state: paused !important; }\n@supports (height: 100dvh) {\n  #ten-comic-root #ten-panel { \
height: min(780px, calc((100dvh - 28px) / var(--ten-scale))); }\n}\n@media (max-width: 560px), (max-height: 720px) {\n  #ten-comic-root #ten-panel { width: \
calc((100vw - 16px) / var(--ten-scale)); max-width: calc(100vw - 16px); height: calc((100vh - 16px) / var(--ten-scale)); }\n  @supports (height: 100dvh) {\n    \
#ten-comic-root #ten-panel { height: calc((100dvh - 16px) / var(--ten-scale)); }\n    #ten-comic-root #ten-search-panel { height: calc(100dvh - 16px); }\n  \
}\n}\n@media (max-width: 560px) {\n  #ten-comic-root .ten-icon-btn { min-width: 40px; min-height: 40px; }\n  #ten-comic-root .ten-btn { min-height: 40px; }\n  \
#ten-comic-root .ten-list-item { min-height: 44px; }\n  #ten-comic-root .ten-list-item input[type="checkbox"] { width: 18px; height: 18px; }\n  #ten-comic-root \
.ten-search-toolbar { min-width: 0; }\n  #ten-comic-root .ten-search-toolbar > * { min-width: 0; }\n  #ten-comic-root .ten-setting { grid-template-columns: \
minmax(0, 1fr) minmax(100px, 1fr); gap: 8px; }\n  #ten-comic-root .ten-mobile-drawer-sheet { padding-bottom: max(14px, env(safe-area-inset-bottom)); }\n  \
#ten-comic-root .ten-nav { padding-bottom: env(safe-area-inset-bottom); }\n  #ten-comic-root .ten-diagnostic { padding: 10px; }\n  #ten-comic-root \
.ten-diagnostic-dialog { max-height: 94%; }\n}\n@media (max-width: 360px) {\n  #ten-comic-root .ten-grid-2 { grid-template-columns: minmax(0, 1fr); }\n  \
#ten-comic-root .ten-rule-pick-actions { grid-template-columns: minmax(0, 1fr); }\n}\n@media (max-height: 500px) {\n  #ten-comic-root #ten-panel { \
grid-template-rows: 48px minmax(0, 1fr) 50px; }\n  #ten-comic-root .ten-view { padding: 8px; }\n  #ten-comic-root .ten-diagnostic-dialog { max-height: 100%; \
gap: 8px; padding: 10px; }\n  #ten-comic-root #ten-diagnostic-content { min-height: 0; }\n  #ten-comic-root .ten-mobile-drawer-sheet { max-height: calc(100vh - \
16px); }\n}\n\n#ten-comic-root #ten-chapter-list { grid-template-columns: minmax(0, 1fr); }\n#ten-comic-root #ten-chapter-list .ten-list-item { min-width: 0; \
}\n#ten-comic-root .ten-chapter-label { flex: 1 1 0; }\n#ten-comic-root .ten-btn { white-space: nowrap; }\n#ten-comic-root .ten-icon-btn { transition: color \
.18s, background-color .18s, border-color .18s, transform .18s; }\n@media (max-width: 560px) {\n  #ten-comic-root .ten-chapter-tools { grid-template-columns: \
minmax(0, 1fr) auto; }\n  #ten-comic-root .ten-chapter-tools > :last-child { grid-column: 1 / -1; width: 100%; justify-self: stretch; }\n  #ten-comic-root \
.ten-chapter-select-group { flex-wrap: nowrap; }\n}\n\n@media (max-width: 560px) {\n  #ten-comic-root .ten-search-toolbar { display: grid; \
grid-template-columns: minmax(0, 1fr) auto; }\n  #ten-comic-root .ten-search-site-picker { grid-column: 1 / -1; width: 100%; }\n  #ten-comic-root \
.ten-search-toolbar .ten-input { width: 100%; }\n}\n\n/* Settings disclosures keep their controls in the original settings scope. */\n#ten-comic-root \
.ten-settings-disclosure { padding: 0; }\n#ten-comic-root .ten-settings-disclosure > .ten-settings-summary {\n  display: flex;\n  align-items: center;\n  \
justify-content: space-between;\n  gap: 12px;\n  min-height: 46px;\n  padding: 12px 14px;\n  color: var(--ten-text);\n  font-size: 13px;\n  font-weight: 750;\n  \
line-height: 1.5;\n  list-style: none;\n  cursor: pointer;\n  user-select: none;\n  border-radius: inherit;\n}\n#ten-comic-root \
.ten-settings-summary::-webkit-details-marker { display: none; }\n#ten-comic-root .ten-settings-disclosure > .ten-settings-summary::after {\n  content: "";\n  \
flex: 0 0 7px;\n  width: 7px;\n  height: 7px;\n  margin: -3px 2px 0 0;\n  border-right: 1.5px solid currentColor;\n  border-bottom: 1.5px solid currentColor;\n  \
transform: rotate(45deg);\n  transition: transform .18s ease;\n}\n#ten-comic-root .ten-settings-disclosure > .ten-settings-summary:hover { background: \
var(--ten-control-hover-bg); }\n#ten-comic-root .ten-settings-disclosure > .ten-settings-summary:focus-visible { outline-offset: -3px; }\n#ten-comic-root \
.ten-settings-disclosure[open] > .ten-settings-summary {\n  border-bottom: 1px solid var(--ten-line);\n  border-bottom-left-radius: 0;\n  \
border-bottom-right-radius: 0;\n}\n#ten-comic-root .ten-settings-disclosure[open] > .ten-settings-summary::after { transform: rotate(225deg); margin-top: 3px; \
}\n#ten-comic-root .ten-settings-disclosure-body { min-width: 0; padding: 12px; }\n#ten-comic-root .ten-settings-section { min-width: 0; }\n#ten-comic-root \
.ten-settings-section + .ten-settings-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--ten-line); }\n#ten-comic-root \
.ten-settings-section > .ten-card-title { margin-bottom: 10px; font-size: 11px; }\n#ten-comic-root .ten-settings-section .ten-setting:last-child { \
margin-bottom: 0; }\n@media (max-width: 560px) {\n  #ten-comic-root .ten-settings-disclosure > .ten-settings-summary { min-height: 48px; padding: 12px; }\n  \
#ten-comic-root .ten-settings-disclosure-body { padding: 10px; }\n}\n\n#ten-comic-root .ten-rule-note { padding: 9px; border: 1px solid var(--ten-line); \
border-radius: var(--ten-radius-control); background: var(--ten-list-bg); color: var(--ten-muted); font-size: 10px; line-height: 1.65; white-space: pre-line; \
overflow-wrap: anywhere; }\n#ten-comic-root .ten-rule-toolbar, #ten-comic-root .ten-rule-preview-controls { display: flex; flex-wrap: wrap; align-items: center; \
gap: 6px; margin: 7px 0; min-width: 0; }\n#ten-comic-root .ten-rule-toolbar > select, #ten-comic-root .ten-rule-preview-controls > select { flex: 1 1 160px; \
min-width: 0; max-width: 100%; }\n#ten-comic-root .ten-rule-toolbar button, #ten-comic-root .ten-rule-preview-controls button { flex: 0 1 auto; \
}\n#ten-comic-root .ten-rule-field-error { display: block; margin-top: 4px; color: var(--ten-danger); font-size: 10px; overflow-wrap: anywhere; \
}\n#ten-comic-root [aria-invalid="true"] { border-color: var(--ten-danger); box-shadow: 0 0 0 1px var(--ten-danger-border); }\n#ten-comic-root .ten-rule-check { \
display: flex; align-items: center; gap: 7px; color: var(--ten-muted); font-size: 10px; line-height: 1.6; margin: 8px 0; }\n#ten-comic-root .ten-rule-check \
input { flex: 0 0 auto; width: 16px; height: 16px; accent-color: var(--ten-cyan); }\n#ten-comic-root .ten-rule-preview-result { font-size: 10px; color: \
var(--ten-muted); line-height: 1.65; overflow-wrap: anywhere; }\n#ten-comic-root .ten-rule-preview-grid { display: grid; grid-template-columns: \
repeat(3,minmax(0,1fr)); gap: 7px; margin-top: 7px; }\n#ten-comic-root .ten-rule-preview-grid figure { min-width: 0; margin: 0; border: 1px solid \
var(--ten-line); border-radius: 8px; overflow: hidden; background: var(--ten-list-bg); text-align: center; }\n#ten-comic-root .ten-rule-preview-grid img { \
display: block; width: 100%; height: 110px; object-fit: contain; }\n#ten-comic-root .ten-rule-preview-grid figcaption { padding: 2px 4px; }\n#ten-comic-root \
.ten-rule-import-preview { max-height: 360px; overflow: auto; min-width: 0; padding: 8px; border: 1px solid var(--ten-line); border-radius: \
var(--ten-radius-control); background: var(--ten-list-bg); color: var(--ten-text); font-size: 10px; }\n#ten-comic-root .ten-rule-import-row { display: grid; \
grid-template-columns: minmax(0,1fr); gap: 6px; padding: 9px 0; border-bottom: 1px solid var(--ten-line); overflow-wrap: anywhere; }\n#ten-comic-root \
.ten-rule-import-row select { min-width: 0; max-width: 100%; }\n#ten-comic-root .ten-rule-import-preview > .ten-rule-toolbar { position: sticky; bottom: 0; \
padding: 7px 0; background: var(--ten-popover-bg); }\n#ten-comic-root .ten-rule-item { display: grid; grid-template-columns: minmax(0,1fr); gap: 4px; margin: \
8px 0; padding: 7px; border: 1px solid var(--ten-line); border-radius: var(--ten-radius-control); background: var(--ten-list-bg); }\n#ten-comic-root \
.ten-rule-item .ten-rule-open { border: 0; background: transparent; }\n#ten-comic-root .ten-rule-item .ten-meta { overflow-wrap: anywhere; }\n#ten-comic-root \
.ten-rule-item-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px; }\n#ten-comic-root .is-rule-disabled \
.ten-rule-open { opacity: .62; }\n#ten-comic-root #ten-managed-rule-list [hidden] { display: none !important; }\n#ten-comic-root .ten-rule-filter { display: \
grid; gap: 5px; color: var(--ten-muted); font-size: 10px; }\n#ten-comic-root select.ten-input { appearance: auto; color: var(--ten-text); }\n#ten-comic-root \
select.ten-input option { color: var(--ten-text); background-color: var(--ten-surface-strong); \
}\n#ten-comic-root:is([data-theme="aurora"],[data-theme="mist"],[data-theme="cloud"]) select.ten-input { color-scheme: light; \
}\n#ten-comic-root:is([data-theme="obsidian"],[data-theme="carbon"],[data-theme="titanium"]) select.ten-input { color-scheme: dark; }\n#ten-comic-root \
#ten-rule-match-layer { position: fixed; inset: 0; z-index: 2147483645; pointer-events: none; overflow: hidden; }\n#ten-comic-root .ten-rule-match-box { \
position: absolute; border: 2px solid var(--ten-cyan); background: color-mix(in srgb,var(--ten-cyan) 12%,transparent); border-radius: 4px; pointer-events: none; \
}\n@media (max-width: 600px) {\n  #ten-comic-root .ten-rule-preview-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }\n  #ten-comic-root \
.ten-rule-item-actions button { min-height: 36px; }\n  #ten-comic-root .ten-rule-import-preview { max-height: 280px; }\n}\n', 
                (document.head || document.documentElement).appendChild(e);
            }(), (0, siteRules.HL)(window.location.href);
            const t = document.createElement("div");
            t.id = ROOT_ID, t.innerHTML = renderShell(), document.body.appendChild(t), state.historyRenderKey = "", 
            state.miniNodes = null, createParticles(), function() {
                const e = one(".ten-rule-intro");
                e && !byId("ten-rule-pick-actions") && e.insertAdjacentHTML("afterend", `<details id="ten-rule-template-library" class="ten-rule-templates"><summary>规则模板库 <span>先选类型，再点选网页元素</span></summary><div class="ten-rule-template-grid"><button \
type="button" data-rule-template="basic"><strong>基础卷轴</strong><small>普通图片列表</small></button><button type="button" \
data-rule-template="lazy"><strong>懒加载阅读</strong><small>data-src 等属性</small></button><button type="button" \
data-rule-template="frame"><strong>隐藏页面</strong><small>等待网页脚本渲染</small></button><button type="button" \
data-rule-template="paged"><strong>翻页阅读</strong><small>需要高级解析函数</small></button></div></details><div id="ten-rule-pick-actions" class="ten-rule-pick-actions" \
role="group" aria-label="可视化规则选择"><button type="button" data-rule-pick="title">${icon("target")}<span>选择标题</span></button><button type="button" data-rule-pick="chapters">${icon("target")}<span>选择章节</span></button><button type="button" data-rule-pick="images">${icon("target")}<span>选择图片</span></button></div>`);
            }(), byId(LAUNCHER_ID).addEventListener("click", showUI), byId("ten-mini-open").addEventListener("click", () => {
                showUI(), activateTab("tasks");
            }), byId("ten-mini-toggle").addEventListener("click", toggleMiniTasks), byId("ten-rule-pick-cancel").addEventListener("click", cancelRulePicking), 
            all("[data-rule-pick]").forEach(e => e.addEventListener("click", () => function(e) {
                const t = RULE_PICK_CONFIG[e];
                if (!t || state.rulePicking) return;
                closeRuleGuide(), state.rulePicking = t, state.rulePickElement = null, document.documentElement.classList.add("ten-rule-picking-page"), 
                byId(ROOT_ID).classList.add("is-rule-picking");
                const n = byId("ten-rule-pick-layer");
                n.classList.remove("is-hidden"), n.setAttribute("aria-hidden", "false"), byId("ten-rule-pick-title").textContent = `请选择${t.label}`, 
                byId("ten-rule-pick-selector").textContent = "移动鼠标并点击，Esc 取消", document.addEventListener("pointermove", handleRulePickMove, !0), 
                document.addEventListener("click", handleRulePickClick, !0), document.addEventListener("keydown", handleRulePickKey, !0), 
                window.addEventListener("scroll", refreshRulePickBox, !0), window.addEventListener("resize", refreshRulePickBox, !0), 
                syncMiniTaskBar();
            }(e.dataset.rulePick))), all("[data-rule-template]").forEach(button => button.addEventListener("click", () => applyRuleTemplate(button.dataset.ruleTemplate))), 
            byId(ROOT_ID).addEventListener("pointerover", scheduleIconTooltip), byId(ROOT_ID).addEventListener("pointerout", handleIconTooltipLeave), 
            byId(ROOT_ID).addEventListener("focusin", showIconTooltip), byId(ROOT_ID).addEventListener("focusout", handleIconTooltipLeave), 
            byId(ROOT_ID).addEventListener("click", hideIconTooltip), window.addEventListener("scroll", hideIconTooltip, !0), 
            window.addEventListener("resize", handleLayoutResize), byId("ten-close").addEventListener("click", hideUI), 
            byId("ten-toast-action").addEventListener("click", runToastUndo), all("[data-drawer-close]").forEach(e => e.addEventListener("click", closeMobileDrawer)), 
            one("summary", byId("ten-rule-advanced")).addEventListener("click", openRuleAdvancedDrawer), 
            all(".ten-tab").forEach(e => e.addEventListener("click", () => activateTab(e.dataset.tab))), 
            all(".ten-source button").forEach(e => e.addEventListener("click", () => {
                state.sourceMode = Number(e.dataset.source), renderSites();
            })), byId("ten-site-list").addEventListener("click", deleteImportedRule), byId("ten-rule-clear-all").addEventListener("click", clearRules), 
            byId("ten-search-site-trigger").addEventListener("click", toggleSearchSiteMenu), 
            byId("ten-search-site-menu").addEventListener("click", handleSearchSiteChoice), 
            document.addEventListener("click", closeSearchSiteMenuOnOutsideClick), byId("ten-search-btn").addEventListener("click", searchComics), 
            byId("ten-search-close").addEventListener("click", closeSearchPanel), byId("ten-search-input").addEventListener("keydown", e => {
                "Enter" === e.key && searchComics();
            }), byId("ten-load-chapters").addEventListener("click", loadChapters), byId("ten-reload-chapters").addEventListener("click", reloadChapters), 
            byId("ten-select-all").addEventListener("click", () => selectAllChapters(!0)), byId("ten-clear-select").addEventListener("click", () => selectAllChapters(!1)), 
            byId("ten-reverse-list").addEventListener("click", reverseChapters), byId("ten-edit-list").addEventListener("click", toggleChapterEdit), 
            byId("ten-toggle-options").addEventListener("click", toggleOptions), byId("ten-download-selected").addEventListener("click", downloadSelected), 
            byId("ten-download-current").addEventListener("click", downloadCurrentChapter), 
            all(".ten-mode").forEach(e => e.addEventListener("click", () => setDownloadMode(Number(e.dataset.mode)))), 
            byId("ten-add-sequence").addEventListener("change", updateChapterSequence), byId("ten-reverse-sequence").addEventListener("change", updateChapterSequence), 
            byId("ten-clear-history").addEventListener("click", clearHistory), byId("ten-toggle-all-active").addEventListener("click", toggleAllActiveTasks), 
            byId("ten-cancel-all-active").addEventListener("click", cancelAllActiveTasks), byId("ten-remove-all-waiting").addEventListener("click", removeAllWaitingTasks), 
            byId("ten-recovery-restore").addEventListener("click", restorePendingTasks), byId("ten-recovery-discard").addEventListener("click", discardPendingTasks), 
            byId("ten-active-tasks").addEventListener("click", handleTaskAction), byId("ten-waiting-tasks").addEventListener("click", handleTaskAction), 
            byId("ten-history").addEventListener("click", handleHistoryClick), byId("ten-history-filter").addEventListener("click", handleHistoryFilter), 
            byId("ten-confirm-ok").addEventListener("click", () => closeConfirm(!0)), all("[data-confirm-cancel]").forEach(e => e.addEventListener("click", () => closeConfirm(!1))), 
            all("[data-diagnostic-close]").forEach(e => e.addEventListener("click", closeDiagnostic)), 
            byId("ten-rule-guide-open").addEventListener("click", openRuleGuide), all("[data-rule-guide-close]").forEach(e => e.addEventListener("click", closeRuleGuide)), 
            byId("ten-diagnostic-copy").addEventListener("click", copyDiagnostic), byId("ten-copy-failures").addEventListener("click", () => copyFailureList(state.diagnosticItem)), 
            all(".ten-task-title-button").forEach(e => e.addEventListener("click", () => toggleTaskGroup(e))), 
            all(".ten-task-arrow-button").forEach(e => e.addEventListener("click", e => toggleTaskGroup(e.currentTarget))), 
            all('.ten-setting input[type="number"]').forEach(e => {
                if (e.parentElement.classList.contains("ten-number-control")) return;
                const t = document.createElement("div");
                t.className = "ten-number-control", e.before(t), t.appendChild(e);
                const n = document.createElement("span");
                n.className = "ten-number-steps", n.innerHTML = '<button type="button" data-number-step="1" aria-label="增加数值"><i></i></button><button type="button" data-number-step="-1" aria-label="减少数值"><i></i></button>', 
                t.appendChild(n), n.addEventListener("click", t => {
                    const n = t.target.closest("[data-number-step]");
                    n && (Number(n.dataset.numberStep) > 0 ? e.stepUp() : e.stepDown(), e.dispatchEvent(new Event("change", {
                        bubbles: !0
                    })));
                });
            }), all("[data-theme-choice]").forEach(e => e.addEventListener("click", () => setThemePreset(e.dataset.themeChoice, !0))), 
            all("[data-appearance-axis]").forEach(e => e.addEventListener("click", () => function(e, t) {
                const n = {
                    density: [ "compact", "standard", "comfortable" ],
                    shape: [ "sharp", "standard", "round" ],
                    motion: [ "calm", "standard", "spring" ]
                };
                n[e] && n[e].includes(t) && (state.settings.appearance[e] = t, applyAppearance(state.settings.appearance), 
                (0, configModule.po)("appearanceAxes", state.settings.appearance), toast("主题外观已更新"));
            }(e.dataset.appearanceAxis, e.dataset.appearanceValue))), bindChange("ten-auto-open", e => saveLoadSetting("isShowUI", e.target.checked)), 
            bindChange("ten-hotkey", e => {
                const t = String(e.target.value || "V").slice(-1).toUpperCase();
                e.target.value = t, state.settings.hotkey = t, saveLoadSetting("loadHotKey", t);
            }), byId("ten-scale").addEventListener("input", e => applyScale(Number(e.target.value), !1)), 
            byId("ten-scale").addEventListener("change", e => applyScale(Number(e.target.value), !0)), 
            all("[data-effect-level]").forEach(e => e.addEventListener("click", () => setEffectLevel(Number(e.dataset.effectLevel), !0))), 
            bindNumber("ten-max-chapters", "maxChapterNum", 1, 3, e => {
                state.settings.maxChapters = e, syncQueueLimits();
            }), bindNumber("ten-concurrent-images", "maxPictureNum", 1, 5, e => {
                state.settings.concurrentImages = e, syncQueueLimits();
            }), byId("ten-default-mode-trigger").addEventListener("click", toggleDefaultModeMenu), 
            byId("ten-default-mode-menu").addEventListener("click", chooseDefaultMode), all("[data-direct-flow]").forEach(e => e.addEventListener("click", () => setDirectFlow(Number(e.dataset.directFlow), !0))), 
            document.addEventListener("click", closeDefaultModeMenuOnOutsideClick), bindNumber("ten-max-height", "maxSplicingHeight", 1e4, 65530, e => {
                state.settings.maxSplicingHeight = e;
            }), bindNumber("ten-digits", "imgIndexBitNum", 1, 8, e => {
                state.settings.digits = e;
            }), bindNumber("ten-history-limit", "historyLimit", 10, 500, e => {
                state.settings.historyLimit = e, trimHistory();
            }), bindChange("ten-range-start", saveImageRange), bindChange("ten-range-end", saveImageRange), 
            bindChange("ten-splice-page", e => {
                state.settings.splicePage = e.target.checked, (0, configModule.po)("imgSplicingFlag", state.settings.splicePage), 
                applyPageSplicing();
            }), bindChange("ten-notify-complete", e => {
                state.settings.notifyComplete = e.target.checked, (0, configModule.po)("downloadNotification", state.settings.notifyComplete);
            }), bindChange("ten-sanitize-paths", e => {
                state.settings.sanitizePaths = e.target.checked, (0, configModule.po)("sanitizePathNames", state.settings.sanitizePaths);
            }), byId("ten-choose-dir").addEventListener("click", chooseDirectory), all("[data-rule-readtype]").forEach(e => e.addEventListener("click", () => setRuleReadType(Number(e.dataset.ruleReadtype)))), 
            byId("ten-rule-test").addEventListener("click", testRuleEditor), byId("ten-rule-save").addEventListener("click", saveRuleEditor), 
            byId("ten-rule-cancel-edit").addEventListener("click", startNewRule), byId("ten-import-rules").addEventListener("click", importRules), 
            byId("ten-backup-export").addEventListener("click", exportSettingsBackup), byId("ten-backup-import").addEventListener("click", () => byId("ten-backup-file").click()), 
            byId("ten-backup-file").addEventListener("change", importSettingsBackup), byId("ten-reset").addEventListener("click", resetSettings), 
            byId(ROOT_ID).addEventListener("click", addRipple), applySettingsToUI(), detectComicInfo(), 
            renderSites(), renderChapters(), renderTasks(), async function() {
                if ("function" != typeof window.showDirectoryPicker) return void (byId("ten-dir-name").textContent = "浏览器默认下载目录");
                const e = await (0, downloadUtils.oZ)();
                if (e) try {
                    "granted" === await e.queryPermission({
                        mode: "readwrite"
                    }) && (state.dirHandle = e, window.__tenComicDirectoryHandle = e, byId("ten-dir-name").textContent = e.name);
                } catch (e) {
                    byId("ten-dir-name").textContent = "请重新选择目录";
                }
            }(), state.ready = !0, initializeRuleTools(), initializeTaskRecovery(), activateTab(state.activeTab), 
            state.settings.autoOpen ? showUI() : state.pendingLauncher && showLauncher();
        }
        function icon(e) {
            return `<svg class="ten-icon" aria-hidden="true"><use href="#ten-i-${e}"></use></svg>`;
        }
        function navButton(e, t, n) {
            return `<button class="ten-tab" type="button" data-tab="${e}">${icon(t)}<span>${n}</span></button>`;
        }
        function appearanceAxesSection() {
            const e = (e, t, n) => `<div class="ten-setting ten-appearance-setting"><label>${t}</label><div class="ten-appearance-axis" role="group" aria-label="${t}">${n.map(([t, n]) => `<button type="button" data-appearance-axis="${e}" data-appearance-value="${t}">${n}</button>`).join("")}</div></div>`;
            return `<section class="ten-settings-section ten-appearance-card"><div class="ten-card-title">外观调整</div>${e("density", "界面密度", [ [ "compact", "紧凑" ], [ "standard", "标准" ], [ "comfortable", "舒适" ] ])}${e("shape", "圆角风格", [ [ "sharp", "利落" ], [ "standard", "标准" ], [ "round", "圆润" ] ])}${e("motion", "动效节奏", [ [ "calm", "克制" ], [ "standard", "标准" ], [ "spring", "弹性" ] ])}</section>`;
        }
        function settingCheck(e, t) {
            return `<div class="ten-setting ten-setting-check"><label for="${e}">${t}</label><input id="${e}" type="checkbox"></div>`;
        }
        function bindChange(e, t) {
            byId(e).addEventListener("change", t);
        }
        function bindNumber(e, t, n, a, i) {
            bindChange(e, e => {
                const o = Math.max(n, Math.min(a, Number(e.target.value)));
                e.target.value = o, (0, configModule.po)(t, o), i(o);
            });
        }
        function setDirectFlow(e, t = !1) {
            const n = 1 === Number(e) ? 1 : 0;
            state.settings.directFlow = n, all("[data-direct-flow]").forEach(e => {
                const t = Number(e.dataset.directFlow) === n;
                e.classList.toggle("is-active", t), e.setAttribute("aria-pressed", String(t));
            }), t && (0, configModule.po)("directDownloadFlow", n);
        }
        function syncQueueLimits() {
            state.queue && state.queue.updateLimits(state.settings.maxChapters, state.settings.concurrentImages);
        }
        function fitPickerMenu(menu, trigger) {
            for (const property of [ "top", "bottom", "left", "right", "width", "maxWidth", "maxHeight" ]) menu.style[property] = "";
            const bounds = {
                left: 0,
                top: 0,
                right: window.innerWidth,
                bottom: window.innerHeight
            };
            for (let ancestor = menu.parentElement; ancestor && ancestor.id !== ROOT_ID; ancestor = ancestor.parentElement) {
                const style = getComputedStyle(ancestor), rect = ancestor.getBoundingClientRect();
                if (/auto|scroll|hidden|clip/.test(style.overflowX)) bounds.left = Math.max(bounds.left, rect.left), 
                bounds.right = Math.min(bounds.right, rect.right);
                if (/auto|scroll|hidden|clip/.test(style.overflowY)) bounds.top = Math.max(bounds.top, rect.top), 
                bounds.bottom = Math.min(bounds.bottom, rect.bottom);
            }
            const parent = menu.offsetParent || menu.parentElement, parentRect = parent.getBoundingClientRect(), triggerRect = trigger.getBoundingClientRect();
            const scale = parent.offsetWidth ? parentRect.width / parent.offsetWidth : 1, gap = 6 * scale;
            const width = Math.min(Math.max(menu.offsetWidth, 190), Math.max(1, (bounds.right - bounds.left - gap * 2) / scale));
            menu.style.width = width + "px", menu.style.right = "auto";
            const below = Math.max(0, bounds.bottom - triggerRect.bottom - gap), above = Math.max(0, triggerRect.top - bounds.top - gap);
            const opensUp = menu.offsetHeight * scale > below && above > below, space = opensUp ? above : below;
            menu.style.maxHeight = Math.max(1, space / scale) + "px";
            const height = menu.offsetHeight * scale, left = Math.max(bounds.left + gap, Math.min(parentRect.left, bounds.right - gap - width * scale));
            menu.style.left = (left - parentRect.left) / scale + "px", menu.style.bottom = "auto";
            menu.style.top = ((opensUp ? triggerRect.top - gap - height : triggerRect.bottom + gap) - parentRect.top) / scale + "px";
            menu.style.transformOrigin = opensUp ? "bottom center" : "top center";
        }
        function toggleDefaultModeMenu(e) {
            e.stopPropagation();
            const t = byId("ten-default-mode"), n = byId("ten-default-mode-menu"), r = n.hidden;
            n.hidden = !r, t.classList.toggle("is-open", r), byId("ten-default-mode-trigger").setAttribute("aria-expanded", String(r)), 
            r && (closeSearchSiteMenu(), fitPickerMenu(n, byId("ten-default-mode-trigger")));
        }
        function chooseDefaultMode(e) {
            const t = e.target.closest("[data-default-mode]");
            t && (setDownloadMode(Number(t.dataset.defaultMode), !0), closeDefaultModeMenu());
        }
        function closeDefaultModeMenuOnOutsideClick(e) {
            const t = byId("ten-default-mode");
            t && !t.contains(e.target) && closeDefaultModeMenu();
        }
        function closeDefaultModeMenu() {
            const e = byId("ten-default-mode-menu");
            e && (e.hidden = !0, byId("ten-default-mode").classList.remove("is-open"), byId("ten-default-mode-trigger").setAttribute("aria-expanded", "false"));
        }
        function applySettingsToUI() {
            const e = state.settings;
            setThemePreset(e.themePreset, !1), applyAppearance(e.appearance), byId("ten-auto-open").checked = e.autoOpen, 
            byId("ten-hotkey").value = e.hotkey, byId("ten-scale").value = e.scale, byId("ten-scale-value").textContent = `${e.scale}%`, 
            byId("ten-max-chapters").value = e.maxChapters, byId("ten-concurrent-images").value = e.concurrentImages, 
            byId("ten-max-height").value = e.maxSplicingHeight, byId("ten-digits").value = e.digits, 
            byId("ten-history-limit").value = e.historyLimit, byId("ten-range-start").value = e.imageRange[0], 
            byId("ten-range-end").value = e.imageRange[1], byId("ten-splice-page").checked = e.splicePage, 
            byId("ten-notify-complete").checked = e.notifyComplete, byId("ten-sanitize-paths").checked = e.sanitizePaths;
            byId("ten-rule-text").value = "", resetRuleEditor(), applyScale(e.scale, !1), setEffectLevel(e.effectLevel, !1), 
            setDownloadMode(e.downloadType, !1), setDirectFlow(e.directFlow, !1), applyPageSplicing();
        }
        function showUI() {
            state.ready && (state.visible = !0, byId(PANEL_ID).inert = false, byId(PANEL_ID).classList.add("is-open"), 
            byId(PANEL_ID).setAttribute("aria-hidden", "false"), byId(LAUNCHER_ID).classList.add("is-hidden"), 
            syncMiniTaskBar(), refreshQueueOnVisibility(), state.recoveryTasks.length && toast(`发现 ${state.recoveryTasks.length} 个未完成任务`));
        }
        function hideUI() {
            flushRuleDraft();
            stopRulePreview(true);
            clearRuleHighlights();
            state.ready && (state.rulePicking && finishRulePicking(), state.visible = !1, byId(PANEL_ID).inert = true, 
            byId(PANEL_ID).classList.remove("is-open"), byId(PANEL_ID).setAttribute("aria-hidden", "true"), 
            byId(LAUNCHER_ID).classList.toggle("is-hidden", !state.launcherVisible), closeSearchPanel(), 
            closeDefaultModeMenu(), closeDiagnostic(), closeRuleGuide(), closeMobileDrawer(), 
            state.confirmResolve && closeConfirm(!1), syncMiniTaskBar(), refreshQueueOnVisibility());
        }
        function toggleUI() {
            return state.ready && !byId(PANEL_ID) && (state.ready = !1), state.ready ? state.visible ? (state.launcherVisible = !1, 
            void hideUI()) : void (state.launcherVisible ? state.ready && (state.launcherVisible = !1, 
            byId(LAUNCHER_ID).classList.add("is-hidden"), syncMiniTaskBar()) : showLauncher()) : (state.pendingLauncher = !0, 
            void injectStyle());
        }
        function showLauncher() {
            state.ready && (state.launcherVisible = !0, state.pendingLauncher = !1, byId(LAUNCHER_ID).classList.remove("is-hidden"), 
            syncMiniTaskBar());
        }
        function activateTab(e) {
            if (!TAB_ORDER.includes(e)) return;
            if (state.activeTab === "settings" && e !== "settings") {
                flushRuleDraft();
                stopRulePreview();
                clearRuleHighlights();
            }
            state.activeTab = e, all(".ten-view").forEach(t => t.classList.toggle("is-active", t.dataset.view === e)), 
            all(".ten-tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === e));
            const t = TAB_ORDER.indexOf(e);
            one(".ten-nav").style.setProperty("--tab", t), byId("ten-title").textContent = TAB_TITLES[e][0], 
            byId("ten-subtitle").textContent = TAB_TITLES[e][1], "tasks" === e && renderTasks();
        }
        function toggleOptions() {
            isNarrowLayout() ? byId("ten-mobile-drawer").classList.contains("is-open") ? closeMobileDrawer() : openMobileDrawer("下载选项", byId("ten-options")) : (state.optionsOpen = !state.optionsOpen, 
            byId("ten-options").classList.toggle("is-open", state.optionsOpen));
        }
        function handleLayoutResize() {
            hideIconTooltip();
            if (state.drawerContent && !isNarrowLayout()) closeMobileDrawer();
        }
        function isNarrowLayout() {
            return window.matchMedia("(max-width: 560px)").matches;
        }
        function openMobileDrawer(e, t) {
            if (!t || state.drawerContent) return;
            const n = byId("ten-mobile-drawer"), r = document.createComment("ten-mobile-drawer-anchor");
            t.before(r), byId("ten-mobile-drawer-content").appendChild(t), state.drawerAnchor = r, 
            state.drawerContent = t, "ten-options" === t.id && (state.optionsOpen = !0), t.classList.add("is-open", "is-mobile-drawer-content"), 
            byId("ten-mobile-drawer-title").textContent = e, n.classList.add("is-open"), n.setAttribute("aria-hidden", "false"), 
            activateModalFocus(n.id), setTimeout(() => {
                byId("ten-mobile-drawer-content").scrollTop = 0;
            }, 0);
        }
        function closeMobileDrawer() {
            const e = byId("ten-mobile-drawer");
            if (!e) return;
            e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true");
            const t = state.drawerContent;
            t && state.drawerAnchor?.parentNode && (t.classList.remove("is-open", "is-mobile-drawer-content"), 
            state.drawerAnchor.replaceWith(t)), "ten-options" === t?.id && (state.optionsOpen = !1), 
            t?.classList.contains("ten-rule-advanced-body") && (byId("ten-rule-advanced").open = !1), 
            state.drawerContent = null, state.drawerAnchor = null;
            releaseModalFocus("ten-mobile-drawer");
        }
        function openRuleAdvancedDrawer(e) {
            if (!isNarrowLayout()) return;
            e.preventDefault();
            const t = byId("ten-rule-advanced");
            t.open = !0, openMobileDrawer("复杂站点设置", one(".ten-rule-advanced-body", t));
        }
        function setDownloadMode(e, t = !1) {
            state.settings.downloadType = e, all(".ten-mode").forEach(t => t.classList.toggle("is-active", Number(t.dataset.mode) === e));
            const n = [ "直接下载", "压缩下载", "图片拼接" ];
            byId("ten-default-mode-label") && (byId("ten-default-mode-label").textContent = n[e] || n[0]), 
            all("[data-default-mode]").forEach(t => t.classList.toggle("is-selected", Number(t.dataset.defaultMode) === e)), 
            t && (0, configModule.po)("downType", e);
        }
        function updateChapterSequence() {
            const e = byId("ten-add-sequence").checked, t = byId("ten-reverse-sequence").checked, r = state.chapters.length;
            state.chapters.forEach((a, i) => {
                a.chapterNumStr = e ? (0, downloadUtils.xo)(t ? r - i : i + 1, 3) : "";
            }), renderChapters();
        }
        function showChapterName(e) {
            return e.chapterNumStr ? `${e.chapterNumStr}${e.chapterName ? `-${e.chapterName}` : ""}` : e.chapterName;
        }
        function downloadSelected() {
            const e = state.chapters.filter(e => e.isSelect && canSelectChapter(e)).map(e => function(e) {
                const t = Object.assign({}, e);
                return t.downChapterName = showChapterName(t), t.downType = state.settings.downloadType, 
                t.downHeaders = siteRules.Po && siteRules.Po.downHeaders, t.batchDelay = siteRules.Po && siteRules.Po.batchDelay, 
                t.directFlow = state.settings.directFlow, t.directRemoteDownload = Boolean(siteRules.Po && siteRules.Po.directRemoteDownload), 
                t.heavyCanvasExport = Boolean(siteRules.Po && siteRules.Po.heavyCanvasExport), t;
            }(e));
            e.length ? (enqueueDownloads(e), state.chapters.forEach(e => {
                setChapterSelected(e, !1);
            }), syncChapterControls(byId("ten-chapter-list"))) : toast("请先选择章节");
        }
        function downloadCurrentChapter() {
            if (!siteRules.Po) return void toast("当前网站没有匹配规则");
            const e = byId("ten-current-comic").value.trim(), t = byId("ten-current-chapter").value.trim();
            e && t ? (enqueueDownloads([ {
                comicName: e,
                chapterName: t,
                downChapterName: t,
                url: window.location.href,
                characterType: "one",
                readtype: siteRules.Po.readtype,
                isPay: Boolean(siteRules.Po.hasSpend),
                downType: state.settings.downloadType,
                downHeaders: siteRules.Po.downHeaders,
                batchDelay: siteRules.Po.batchDelay,
                directFlow: state.settings.directFlow,
                directRemoteDownload: Boolean(siteRules.Po.directRemoteDownload),
                heavyCanvasExport: Boolean(siteRules.Po.heavyCanvasExport)
            } ]), state.optionsOpen = !1, byId("ten-options").classList.remove("is-open")) : toast("请输入漫画名和章节名");
        }
        function enqueueDownloads(e, options = {}) {
            const pending = (state.enqueueChain || Promise.resolve()).then(() => enqueueDownloadBatch(e, options));
            state.enqueueChain = pending.catch(error => {
                console.error("10漫画：加入队列失败。", error);
                toast(error.message || "加入下载队列失败");
            });
            return pending;
        }
        async function enqueueDownloadBatch(e, options = {}) {
            const selectedAdapter = siteRules.Po ? {
                ...siteRules.Po
            } : null;
            e = e.map(task => ({
                ...task,
                adapter: selectedAdapter,
                taskId: options.recovery && task.taskId ? task.taskId : newTaskId(),
                imageRange: task.imageRange || state.settings.imageRange.slice()
            }));
            const active = state.queue ? [ ...state.queue.list, ...state.queue.worker.filter(worker => worker && !worker.cancelled).map(worker => worker.task) ] : [];
            const completed = readHistory().filter(record => record.status === "completed" && !record.hasError && record.task && !record.task.retryImages?.length).map(record => record.task);
            const keys = new Set(active.concat(completed).map(DownloadQueue.taskKey)), unique = [], duplicates = [];
            for (const task of e) {
                const key = DownloadQueue.taskKey(task);
                if (keys.has(key)) duplicates.push(task); else unique.push(task);
                keys.add(key);
            }
            let allowDuplicates = false;
            if (!options.recovery && duplicates.length) {
                allowDuplicates = await showConfirm("检测到重复下载", `${duplicates.length} 个章节已在队列、已完成或在本次选择中重复。可跳过重复章节，也可仍然下载；下载记录不代表文件仍在磁盘。`, "仍然下载", "跳过重复");
                if (!allowDuplicates) e = unique;
            }
            if (!e.length) return toast("已跳过重复章节"), false;
            siteRules.Po && void 0 !== siteRules.Po.batchDelay && e.forEach(e => {
                void 0 === e.batchDelay && (e.batchDelay = siteRules.Po.batchDelay);
            }), e.forEach(e => {
                void 0 === e.directFlow && (e.directFlow = state.settings.directFlow), void 0 === e.directRemoteDownload && (e.directRemoteDownload = Boolean(siteRules.Po && siteRules.Po.directRemoteDownload)), 
                void 0 === e.heavyCanvasExport && (e.heavyCanvasExport = Boolean(siteRules.Po && siteRules.Po.heavyCanvasExport));
            }), "function" != typeof window.showDirectoryPicker || await (0, downloadUtils.Oh)() || toast("未选择保存目录，将使用浏览器默认下载目录"), 
            e.forEach(e => {
                e.useDirectory = Boolean(window.__tenComicDirectoryHandle || window.__ylDirectoryHandle);
            }), state.queue || (state.queue = new DownloadQueue(state.settings.maxChapters, state.settings.concurrentImages, state.settings.digits, {
                onHistory: renderTasks,
                onChange: scheduleTaskRender,
                onPersist: scheduleTaskPersist,
                onStorageError: reportTaskStorageError,
                onComplete: notifyDownloadTask
            }, {
                downloads: downloadUtils,
                config: configModule,
                yieldToBrowser: yieldToBrowser,
                CancelledError: TaskCancelledError,
                location: window.location,
                historyStorage: localStorage,
                isPageHidden: () => document.hidden,
                isSettingsVisible: () => Boolean(one('#ten-panel.is-open .ten-view.is-active[data-view="settings"]')),
                schedule: (callback, milliseconds) => setTimeout(callback, milliseconds)
            })), state.historyVolatile && (state.queue.historyFallback = state.historyVolatile, 
            state.historyVolatile = null), state.queue.addList(e, allowDuplicates), state.queue.run(), 
            activateTab("tasks"), renderTasks();
            return true;
        }
        function reportTaskStorageError(error) {
            console.warn("10漫画：任务记录保存失败。", error);
            if (!state.storageWarning) state.storageWarning = true, toast("记录保存失败，任务仍会继续；本次记录暂存于当前页面，请及时备份诊断信息");
        }
        function newTaskId() {
            return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
        }
        function taskHost(e) {
            if (e && e.originHost) return String(e.originHost).toLowerCase();
            try {
                return new URL(e && e.url || "", window.location.href).hostname.toLowerCase();
            } catch (e) {
                return window.location.hostname.toLowerCase();
            }
        }
        function uniqueTaskSnapshots(e) {
            const t = new Set;
            return e.filter(e => {
                if (!e || !e.url) return !1;
                const n = e.taskId || JSON.stringify([ taskHost(e), e.comicName || "", e.downChapterName || e.chapterName || "", e.url, e.downType || 0, e.imageRange || [ 1, -1 ], e.retryImages || [] ]);
                return !t.has(n) && (t.add(n), !0);
            });
        }
        function renderRecoveryTasks() {
            state.ready && (byId("ten-recovery").hidden = 0 === state.recoveryTasks.length, 
            byId("ten-recovery-count").textContent = state.recoveryTasks.length ? `${state.recoveryTasks.length} 个任务可恢复` : "");
        }
        async function restorePendingTasks() {
            if (!state.recoveryStore || state.recoveryBusy) return;
            state.recoveryBusy = true;
            try {
                await state.recoveryStore.claim(state.recoveryRefs || [], async tasks => {
                    const previous = state.recoveryStaging || [];
                    state.recoveryStaging = uniqueTaskSnapshots(previous.concat(tasks));
                    if (!persistQueueState()) {
                        state.recoveryStaging = previous;
                        throw new Error("恢复记录保存失败，未移除原记录");
                    }
                });
                for (const error of state.recoveryStore.warnings || []) reportTaskStorageError(error);
                const tasks = (state.recoveryStaging || []).slice();
                if (tasks.length && await enqueueDownloads(tasks, {
                    recovery: true
                })) {
                    state.recoveryStaging = [], persistQueueState(), toast(`已恢复 ${tasks.length} 个任务`);
                }
            } catch (error) {
                reportTaskStorageError(error);
            } finally {
                state.recoveryBusy = false;
                await refreshRecoveryTasks();
            }
        }
        async function discardPendingTasks() {
            if (!state.recoveryTasks.length || state.recoveryBusy || !await showConfirm("放弃未完成任务", `将删除当前显示的 ${state.recoveryTasks.length} 个恢复点，其他标签页的活动任务保留。`, "放弃任务")) return;
            state.recoveryBusy = true;
            try {
                await state.recoveryStore.claim(state.recoveryRefs || [], async () => {}, true);
                state.recoveryStaging = [], persistQueueState(), toast("未完成任务已放弃");
            } catch (error) {
                reportTaskStorageError(error);
            } finally {
                state.recoveryBusy = false;
                await refreshRecoveryTasks();
            }
        }
        function initializeTaskRecovery() {
            if (!state.recoveryStore) state.recoveryStore = new RecoveryStore({
                get: key => GM_getValue(key),
                set: (key, value) => GM_setValue(key, value),
                remove: key => GM_deleteValue(key),
                keys: () => typeof GM_listValues === "function" ? GM_listValues() : []
            }, {
                id: newTaskId(),
                host: window.location.hostname.toLowerCase(),
                origin: window.location.origin,
                locks: navigator.locks
            });
            if (!state.recoveryHeartbeat) state.recoveryHeartbeat = setInterval(() => {
                if (state.queue || state.recoveryStaging?.length) persistQueueState();
                if (!state.recoveryBusy) refreshRecoveryTasks();
            }, 3e4);
            refreshRecoveryTasks();
        }
        async function refreshRecoveryTasks() {
            if (!state.recoveryStore || state.recoveryBusy) return;
            try {
                state.recoveryRefs = await state.recoveryStore.candidates();
                state.recoveryTasks = uniqueTaskSnapshots((state.recoveryStaging || []).concat(state.recoveryRefs.flatMap(ref => ref.tasks)));
                renderRecoveryTasks();
            } catch (error) {
                reportTaskStorageError(error);
            }
        }
        function scheduleTaskPersist() {
            null === state.persistTimer && (state.persistTimer = setTimeout(persistQueueState, 750));
        }
        function persistQueueState() {
            clearTimeout(state.persistTimer), state.persistTimer = null;
            try {
                const tasks = state.queue ? state.queue.pendingTasks() : [];
                state.recoveryStore?.persist(uniqueTaskSnapshots(tasks.concat(state.recoveryStaging || [])));
                return Boolean(state.recoveryStore);
            } catch (error) {
                reportTaskStorageError(error);
                return false;
            }
        }
        function handlePageHide() {
            flushRuleDraft();
            stopRulePreview();
            clearRuleHighlights();
            (state.queue || state.recoveryTasks.length) && persistQueueState();
        }
        function initializeAppStorage() {
            try {
                (0, configModule.Iq)();
            } catch (e) {
                console.warn("10漫画：初始化存储失败。", e);
            }
        }
        !function() {
            (0, siteRules.HL)(window.location.href), siteRules.Po ? (initializeAppStorage(), 
            state.settings = readSettings(), window.addEventListener("keydown", handleGlobalHotkey, {
                capture: !0,
                passive: !1
            }), window.addEventListener("pageshow", injectStyle), window.addEventListener("pagehide", handlePageHide), 
            document.addEventListener("visibilitychange", refreshQueueOnVisibility), function() {
                try {
                    GM_registerMenuCommand("显示/隐藏 10漫画入口", toggleUI, {
                        accessKey: "v",
                        autoClose: !0
                    }), GM_registerMenuCommand("重置 10漫画设置", resetSettings);
                } catch (e) {
                    console.warn("10漫画：菜单注册失败。", e);
                }
            }(), "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", injectStyle, {
                once: !0
            }) : injectStyle()) : function() {
                try {
                    GM_registerMenuCommand("为当前网站添加自定义规则", openUnsupportedRuleEditor);
                } catch (e) {
                    console.warn("10漫画：自定义规则菜单注册失败。", e);
                }
            }();
        }();
        function showConfirm(e, t, n = "确认", cancelText = "取消") {
            state.confirmResolve && closeConfirm(!1), byId("ten-confirm-title").textContent = e, 
            byId("ten-confirm-message").textContent = t, byId("ten-confirm-ok").textContent = n;
            byId("ten-confirm-cancel").textContent = cancelText;
            const r = byId("ten-confirm");
            return r.classList.add("is-open"), r.setAttribute("aria-hidden", "false"), activateModalFocus(r.id, "#ten-confirm-cancel"), 
            new Promise(e => {
                state.confirmResolve = e;
            });
        }
        function closeConfirm(e) {
            const t = state.confirmResolve;
            state.confirmResolve = null;
            const n = byId("ten-confirm");
            n && (n.classList.remove("is-open"), n.setAttribute("aria-hidden", "true")), releaseModalFocus("ten-confirm"), 
            t && t(e);
        }
        function openRuleGuide() {
            const e = byId("ten-rule-guide");
            e && (e.classList.add("is-open"), e.setAttribute("aria-hidden", "false"), activateModalFocus(e.id));
        }
        function closeRuleGuide() {
            releaseModalFocus("ten-rule-guide");
            const e = byId("ten-rule-guide");
            e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
        }
        function openDiagnostic(e) {
            if (!e) return;
            state.diagnosticItem = e;
            const t = Array.isArray(e.diagnostics) ? e.diagnostics : [], n = Array.isArray(e.failedImages) ? e.failedImages : Array.isArray(e.failures) ? e.failures : [], r = e.stage || (e.hasError ? "存在下载错误" : "没有发现错误"), a = [ `漫画：${e.comicName || "未知"}`, `章节：${e.downChapterName || e.chapterName || "未知"}`, `状态：${r}`, `页面：${e.comicPageUrl || e.url || window.location.href}`, `失败图片：${n.length} 张`, "" ];
            t.length ? (a.push("诊断详情："), t.forEach((e, t) => {
                const n = e.time ? new Date(e.time).toLocaleString() : "未知时间";
                a.push(`${t + 1}. [${n}] ${e.stage || "下载"}：${e.message || "未知错误"}`), e.imgIndex && a.push(`   图片序号：${e.imgIndex}`), 
                e.url && a.push(`   地址：${e.url}`);
            })) : a.push(e.hasError ? "这是旧版记录，没有保存详细错误信息。" : "当前没有错误详情。"), byId("ten-diagnostic-summary").textContent = `${e.comicName || "未知漫画"} · ${e.downChapterName || e.chapterName || "未知章节"}`, 
            byId("ten-diagnostic-content").textContent = a.join("\n");
            const i = byId("ten-diagnostic");
            i.classList.add("is-open"), i.setAttribute("aria-hidden", "false"), activateModalFocus(i.id);
        }
        function closeDiagnostic() {
            releaseModalFocus("ten-diagnostic");
            const e = byId("ten-diagnostic");
            e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
        }
        function copyDiagnostic() {
            copyText(byId("ten-diagnostic-content").textContent, "诊断信息已复制");
        }
        function copyFailureList(e) {
            const t = Array.isArray(e && e.failedImages) ? e.failedImages : Array.isArray(e && e.failures) ? e.failures : [];
            if (!t.length) return toast("没有失败图片可复制");
            const n = [ `漫画：${e.comicName || "未知"}`, `章节：${e.downChapterName || e.chapterName || "未知"}`, `失败图片：${t.length} 张`, "" ];
            t.forEach((e, t) => n.push(`${t + 1}. 序号：${e.imgIndex || "未知"}\n   原因：${e.reason || "未知错误"}\n   地址：${e.url || "无"}`)), 
            copyText(n.join("\n"), "失败清单已复制");
        }
        function copyText(e, t) {
            try {
                GM_setClipboard(e, "text"), toast(t);
            } catch (n) {
                navigator.clipboard && "function" == typeof navigator.clipboard.writeText ? navigator.clipboard.writeText(e).then(() => toast(t)).catch(() => toast("复制失败")) : toast("复制失败");
            }
        }
        function saveLoadSetting(e, t) {
            const n = safeGet("appLoadDefault", {}), a = n && "object" == typeof n ? n : {};
            a[e] = t, (0, configModule.po)("appLoadDefault", a), "isShowUI" === e && (state.settings.autoOpen = t);
        }
        function applyScale(e, t) {
            state.settings.scale = e, byId(PANEL_ID).style.setProperty("--ten-scale", e / 100), 
            byId("ten-scale-value").textContent = `${e}%`, t && saveLoadSetting("rightSize", e);
        }
        function setEffectLevel(e, t) {
            const n = Math.max(0, Math.min(2, Number(e) || 0));
            state.settings.effectLevel = n, byId(ROOT_ID).dataset.effects = String(n), createParticles(n), 
            all("[data-effect-level]").forEach(e => {
                const t = Number(e.dataset.effectLevel) === n;
                e.classList.toggle("is-active", t), e.setAttribute("aria-pressed", String(t));
            }), t && ((0, configModule.po)("effectLevel", n), toast([ "特效已关闭", "已切换为轻量特效", "已切换为标准特效" ][n]));
        }
        function setThemePreset(e, t) {
            const n = normalizeThemePreset(e);
            state.settings.themePreset = n, byId(ROOT_ID).dataset.theme = n, all("[data-theme-choice]").forEach(e => e.setAttribute("aria-pressed", String(e.dataset.themeChoice === n))), 
            t && ((0, configModule.po)("themePreset", n), toast(`已切换为${THEMES[n][0]}`));
        }
        function applyAppearance(e) {
            const t = byId(ROOT_ID), n = e || {};
            t.dataset.density = n.density || "standard", t.dataset.shape = n.shape || "standard", 
            t.dataset.motion = n.motion || "standard", all("[data-appearance-axis]").forEach(e => {
                const t = e.dataset.appearanceValue === n[e.dataset.appearanceAxis];
                e.classList.toggle("is-active", t), setAttribute(e, "aria-pressed", String(t));
            });
        }
        function saveImageRange() {
            const e = Math.max(1, Math.trunc(Number(byId("ten-range-start").value) || 1)), t = Math.trunc(Number(byId("ten-range-end").value) || -1), n = -1 === t ? -1 : Math.max(e, t);
            state.settings.imageRange = [ e, n ], byId("ten-range-start").value = e, byId("ten-range-end").value = n, 
            (0, configModule.po)("imgDownRange", state.settings.imageRange);
        }
        function exportSettingsBackup() {
            const e = Object.fromEntries(BACKUP_KEYS.map(e => [ e, safeGet(e, null) ])), n = {
                format: "10Comic-settings-backup",
                version: 1,
                exportedAt: (new Date).toISOString(),
                settings: e,
                rules: Array.isArray(safeGet("userWebInfo", [])) ? safeGet("userWebInfo", []) : []
            }, r = (new Date).toISOString().slice(0, 10);
            !function(e, t) {
                const n = URL.createObjectURL(e);
                let r = !1, a = !1;
                const i = () => {
                    r || (r = !0, URL.revokeObjectURL(n));
                }, o = () => {
                    if (r || a) return;
                    a = !0;
                    const e = document.createElement("a");
                    e.href = n, e.download = t, e.hidden = !0, document.body.appendChild(e), e.click(), 
                    e.remove(), setTimeout(i, 1e3), toast("设置与规则备份已导出");
                };
                try {
                    GM_download({
                        url: n,
                        name: t,
                        saveAs: !0,
                        onload: () => {
                            i(), toast("设置与规则备份已导出");
                        },
                        onerror: o,
                        ontimeout: o
                    });
                } catch (e) {
                    o();
                }
            }(new Blob([ ruleModel.serialize(n) ], {
                type: "application/json"
            }), `10Comic-设置与规则备份-${r}.json`);
        }
        async function importSettingsBackup(event) {
            const file = event.target.files && event.target.files[0];
            event.target.value = "";
            if (!file) return;
            try {
                const data = ruleModel.deserialize(await file.text());
                if (!data || data.format !== "10Comic-settings-backup" || !data.settings || typeof data.settings !== "object" || Array.isArray(data.settings) || !Array.isArray(data.rules) || data.rules.length > 500) throw new Error("不是有效的10漫画备份文件");
                flushRuleDraft();
                previewRuleImport(data.rules, {
                    settings: data.settings
                });
            } catch (error) {
                toast(error.message || "备份文件读取失败");
            }
        }
        function applyPageSplicing() {
            let e = document.getElementById("ten-comic-page-style");
            e || (e = document.createElement("style"), e.id = "ten-comic-page-style", document.head.appendChild(e)), 
            e.textContent = state.settings.splicePage && siteRules.Po && siteRules.Po.readCssText ? siteRules.Po.readCssText : "";
        }
        async function chooseDirectory() {
            if ("function" == typeof window.showDirectoryPicker) try {
                const e = await (0, downloadUtils.IJ)();
                e && (state.dirHandle = e, byId("ten-dir-name").textContent = e.name, toast("保存目录已更新"));
            } catch (e) {
                e && "AbortError" !== e.name && toast("目录选择失败");
            } else toast("当前浏览器将使用默认下载目录");
        }
        function refreshQueueOnVisibility() {
            byId(ROOT_ID)?.classList.toggle("is-page-hidden", document.hidden);
            document.hidden || state.queue && state.queue.refresh();
            if (!document.hidden) refreshRecoveryTasks();
        }
        async function resetSettings() {
            await showConfirm("重置全部设置", "界面、下载和规则设置都将恢复默认值。", "确认重置") && (await (0, configModule.zU)(), 
            state.settings = readSettings(), state.ready && (applySettingsToUI(), toast("设置已重置")));
        }
        function createParticles(e = (state.settings ? state.settings.effectLevel : 1)) {
            const t = 0 === e ? 0 : 1 === e ? 11 : 22, n = byId("ten-particle-field");
            if (state.particleCount === t && n.childElementCount === t) return;
            state.particleCount = t;
            const r = [ "#5ff6ff", "#5b8cff", "#9c6cff", "#ff5fac" ];
            n.innerHTML = Array.from({
                length: t
            }, (e, t) => `<i style="--x:${(37 * t + 11) % 100}%;--y:${(61 * t + 7) % 100}%;--s:${1 + t % 3}px;--tx:${13 * t % 34 - 16}px;--ty:${17 * t % 46 - 22}px;--d:${4 + t % 5}s;--delay:-${t % 7}s;--c:${r[t % r.length]}"></i>`).join("");
        }
        function addRipple(e) {
            const t = e.target.closest(".ten-btn");
            if (!t || t.disabled || 0 === state.settings.effectLevel) return;
            const n = t.getBoundingClientRect(), r = document.createElement("span"), a = Math.max(n.width, n.height);
            r.className = "ten-ripple", r.style.width = r.style.height = `${a}px`, r.style.left = e.clientX - n.left - a / 2 + "px", 
            r.style.top = e.clientY - n.top - a / 2 + "px", t.appendChild(r), r.addEventListener("animationend", () => r.remove(), {
                once: !0
            });
        }
        function toast(e, t = null) {
            if (!state.ready) return;
            const n = byId("ten-toast"), r = byId("ten-toast-action");
            setText(byId("ten-toast-text"), e), state.toastUndo = "function" == typeof t ? t : null, 
            r.hidden = !state.toastUndo, n.classList.add("is-show"), clearTimeout(state.toastTimer), 
            state.toastTimer = setTimeout(() => {
                n.classList.remove("is-show"), state.toastUndo = null, r.hidden = !0;
            }, state.toastUndo ? 6500 : 2200);
        }
        function runToastUndo() {
            const e = state.toastUndo;
            e && (state.toastUndo = null, clearTimeout(state.toastTimer), byId("ten-toast-action").hidden = !0, 
            e(), toast("已撤销刚才的操作"));
        }
        function notifyDownloadTask(e) {
            const t = e.downChapterName || e.chapterName || "未命名章节", n = "failed" === e.status || "partial" === e.status || e.hasError, r = n ? `${t} 下载结束，存在失败图片` : `${t} 下载完成`;
            if (!state.visible || document.hidden) {
                if (state.settings.notifyComplete) try {
                    GM_notification({
                        title: n ? "10漫画：下载存在错误" : "10漫画：下载完成",
                        text: r,
                        timeout: 6e3,
                        silent: !1,
                        onclick: () => {
                            showUI(), activateTab("tasks");
                        }
                    });
                } catch (e) {
                    console.warn("10漫画：系统通知发送失败。", e);
                }
            } else toast(r);
        }
        function empty(e) {
            return `<div class="ten-empty">${escapeHtml(e)}</div>`;
        }
        function byId(e) {
            return document.getElementById(e);
        }
        function setText(e, t) {
            const n = String(t);
            e && e.textContent !== n && (e.textContent = n);
        }
        function setAttribute(e, t, n) {
            e && e.getAttribute(t) !== n && e.setAttribute(t, n);
        }
        function setStyle(e, t, n) {
            e && e.style.getPropertyValue(t) !== n && e.style.setProperty(t, n);
        }
        function one(e, t = document) {
            return t.querySelector(e);
        }
        function all(e, t = document) {
            return Array.from(t.querySelectorAll(e));
        }
        function escapeHtml(e) {
            return String(null == e ? "" : e).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        }
        function escapeAttr(e) {
            return escapeHtml(e).replace(/`/g, "&#96;");
        }
    })();
})();
