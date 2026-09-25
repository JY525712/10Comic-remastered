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

