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

