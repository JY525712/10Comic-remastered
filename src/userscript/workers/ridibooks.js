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

