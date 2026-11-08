(function(){'use strict';
const status=document.getElementById('offline-status'),button=document.getElementById('offline-update');let registration,reload=false;

function ownActive(reg){return new Promise((resolve,reject)=>{let watched=new Set();const timeout=setTimeout(()=>reject(Error('準備に時間がかかっています。通信を確認して開き直してください。')),90000);const check=()=>{if(reg.active?.state==='activated'){clearTimeout(timeout);resolve(reg.active);return;}for(const worker of [reg.installing,reg.waiting,reg.active])if(worker&&!watched.has(worker)){watched.add(worker);worker.addEventListener('statechange',()=>{if(worker.state==='redundant'&&!reg.active){clearTimeout(timeout);reject(Error('必要なファイルを保存できませんでした。通信を確認して再試行してください。'));}else check();});}};reg.addEventListener('updatefound',check);check();});}
async function setup(){if(location.protocol==='file:'){status.textContent='オフライン準備は公開URL、またはPCでのHTTP配信から利用してください。';return;}if(!isSecureContext||!('serviceWorker'in navigator)){status.textContent='iPad単独利用はHTTPSの公開URLから準備してください。';return;}
 status.textContent='オフライン準備中です。初回は通信できる状態でお待ちください。';
 try{const scope=new URL('./',location.href).href;registration=await navigator.serviceWorker.getRegistration(scope);if(!registration?.active||registration.scope!==scope)registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});const waiting=()=>{button.hidden=false;if(!button.disabled)button.textContent=registration.waiting?'アプリを更新':'更新を確認';};waiting();registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',waiting));if(navigator.onLine)registration.update().catch(()=>{});const active=await ownActive(registration);const result=await new Promise((resolve,reject)=>{const ch=new MessageChannel(),t=setTimeout(()=>reject(Error('保存状況を確認できません。')),10000);ch.port1.onmessage=e=>{clearTimeout(t);ch.port1.close();resolve(e.data);};active.postMessage({type:'CACHE_STATUS'},[ch.port2]);});status.textContent=result.ready?'オフライン利用の準備完了。iPadは共有→ホーム画面に追加してください。':'必要なファイルの保存が未完了です。通信できる状態で開き直してください。';if(result.ready&&navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
 }catch(e){status.textContent='オフライン準備は未完了です。'+e.message;}}
// Keep the check available even when no worker is waiting yet.
button.hidden=false;
button.onclick=async()=>{
 if(window.MomoUI?.hasUnsavedChanges()){alert('保護者の設定・予定を保存して、画面を閉じてから更新してください。');return;}
 if(!navigator.onLine){status.textContent='更新の確認にはインターネット接続が必要です。保存済みのアプリはそのまま使えます。';return;}
 button.disabled=true;button.textContent='確認中…';
 try{
  if(!registration)await setup();
  if(!registration)throw Error('公開URLをSafariで開いてから、もういちどお試しください。');
  await registration.update();
  const worker=registration.installing;
  if(worker&&worker.state!=='installed'&&worker.state!=='redundant')await new Promise((resolve,reject)=>{
   const finish=()=>{clearTimeout(timer);worker.removeEventListener('statechange',check);};
   const check=()=>{if(worker.state==='installed'){finish();resolve();}else if(worker.state==='redundant'){finish();reject(Error('新しいファイルを保存できませんでした。通信を確認して再試行してください。'));}};
   const timer=setTimeout(()=>{finish();reject(Error('確認に時間がかかっています。通信を確認して再試行してください。'));},30000);
   worker.addEventListener('statechange',check);check();
  });
  if(!registration.waiting){status.textContent='現在は最新です。オフライン利用の準備完了後は、そのまま使えます。';return;}
  if(window.MomoUI?.hasUnsavedChanges()){alert('保護者の設定・予定を保存してから更新してください。');return;}
  if(!confirm('保存済みの記録を保持したまま更新します。ゲームの途中経過は終了します。更新しますか？'))return;
  reload=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
 }catch(e){status.textContent='更新を確認できませんでした。'+e.message;}
 finally{button.disabled=false;button.textContent=registration?.waiting?'アプリを更新':'更新を確認';}
};navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(reload)location.reload();});setup();
})();
