/* Explicit PWA refresh; learner records are never removed. */
(async()=>{
  const current='__DENKEN_RELEASE__';
  const button=document.querySelector('#check-update');
  const status=document.querySelector('#update-state');
  button.addEventListener('click',async()=>{
    button.disabled=true;
    status.textContent=' 最新版を確認しています…';
    try{
      const response=await fetch(new URL('./version.json',location.href),{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error('network');
      const info=await response.json();
      if(!/^[a-f0-9]{16}$/.test(info.version))throw Error('version');
      if(info.version===current){status.textContent=' 最新版です。';return;}
      status.textContent=' 新しい版があります。';
      if(!confirm('新しい版に更新して画面を開き直します。学習記録は残ります。採点前の解答は失われるため、先に採点してください。今、更新しますか？'))return;
      const reg=await navigator.serviceWorker.getRegistration();
      if(!reg)throw Error('registration');
      await reg.update();
      const deadline=Date.now()+45000;
      // Wait for the worker to activate and its complete new page to be cached.
      while(Date.now()<deadline){
        const cacheName='denken-ipad:'+reg.scope+':'+info.version;
        if((await caches.keys()).includes(cacheName)&&reg.active?.state==='activated'&&!reg.installing&&!reg.waiting&&navigator.serviceWorker.controller===reg.active){
          const cache=await caches.open(cacheName);
          if(await cache.match(new URL('index.html',reg.scope).href)){
            // Network fetch is verified before reload; scope cache is already ready.
            location.reload();return;
          }
        }
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      throw Error('timeout');
    }catch(e){status.textContent=' 更新を確認・完了できませんでした。通信を確認して、もう一度お試しください。学習記録はそのままです。';}
    finally{button.disabled=false;}
  });
})();
