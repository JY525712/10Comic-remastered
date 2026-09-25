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

