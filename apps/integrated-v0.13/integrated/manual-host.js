/* Explicitly start the reader when its screen opens (including iPad standalone). */
(()=>{'use strict';
const screen=document.getElementById('manual'),frame=document.getElementById('construction-manual-frame'),body=document.getElementById('manual-reader-body'),status=document.getElementById('manual-load-status'),message=document.getElementById('manual-load-message');if(!screen||!frame||!body||!status||!message)return;
let started=false,timer=null,began=0,attempt=0,waitingForDocument=false,documentURL=null;
function stop(){clearTimeout(timer);timer=null;}
function fail(text){stop();body.dataset.manualState='error';body.setAttribute('aria-busy','false');frame.setAttribute('aria-busy','false');status.hidden=false;message.textContent=text||'マニュアルの本文を表示できませんでした。「もう一度読み込む」または「マニュアル単体を開く」をお試しください。';}
function probe(){if(body.dataset.manualState!=='loading')return;stop();
 try{const doc=waitingForDocument?null:frame.contentDocument,app=doc?.getElementById('app');
  if(doc?.getElementById('construction-manual-frame')){fail('この場所にはマニュアルの本文がまだ配信されていません。マニュアル単体のページから読むことができます。');return;}
  if(app?.querySelector('.notice.warning')&&app.textContent.includes('マニュアルを読み込めませんでした')){fail('マニュアル本文の読み込みに失敗しました。通信を確認して再読み込みするか、マニュアル単体を開いてください。');return;}
  if(doc?.querySelector('.app-header')&&app?.querySelector('.hero,.article,h1')){stop();body.dataset.manualState='ready';body.setAttribute('aria-busy','false');frame.setAttribute('aria-busy','false');status.hidden=true;return;}
 }catch{/* Some authentication or browser settings require opening the reader separately. */}
 if(Date.now()-began>=10000){fail();return;}timer=setTimeout(probe,250);
}
function start(retry=false){if(started&&!retry)return;started=true;stop();attempt++;began=Date.now();body.dataset.manualState='loading';body.setAttribute('aria-busy','true');frame.setAttribute('aria-busy','true');status.hidden=false;message.textContent='マニュアルを読み込んでいます。しばらくお待ちください。';
 try{const encoded=document.getElementById('construction-manual-bundle')?.textContent.trim();if(!encoded)throw Error('missing bundle');const html=new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));const previous=documentURL;documentURL=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));frame.removeAttribute('loading');waitingForDocument=true;frame.src=documentURL;if(previous)URL.revokeObjectURL(previous);probe();}catch{fail('同梱マニュアルを開けませんでした。「マニュアル単体を開く」から本文を確認できます。');}
}
frame.addEventListener('load',()=>{waitingForDocument=false;if(body.dataset.manualState==='loading')probe();});frame.addEventListener('error',()=>fail());
document.getElementById('manual-retry').addEventListener('click',()=>start(true));
new MutationObserver(()=>{if(screen.classList.contains('active'))start();}).observe(screen,{attributes:true,attributeFilter:['class']});
if(screen.classList.contains('active'))start();
})();
