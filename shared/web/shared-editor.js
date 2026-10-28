/* Optional shared workflow. Offline projects are kept; importing always backs them up. */
(()=>{'use strict';
 if(!window.WB||!window.OmutaShared)return;
 const client=new OmutaShared.SharedClient(window.OMUTA_SHARED_CONFIG||{}),$=id=>document.getElementById(id);
 const app=document.querySelector('.app');let links={},projects=[],saving=false,preparing=false,suspended=false,identity=null;const timers=new Map();
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 const css=node('style');css.textContent=`.shared-login-required .app,.shared-login-required #wb-dialog{visibility:hidden}.shared-launch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.shared-launch button{min-height:44px}.shared-sync{font-size:13px;color:#234d7a}.shared-sync.error{color:#b91c1c}.shared-dialog{width:min(720px,95vw);max-height:90vh;border:1px solid #8fa8c6;border-radius:12px;padding:20px;color:#163254;overflow:auto}.shared-dialog::backdrop{background:#10284999}.shared-dialog label{display:block;margin:12px 0;font-weight:600}.shared-dialog input,.shared-dialog select,.shared-dialog button{font:inherit;min-height:46px;border-radius:7px;padding:10px;border:1px solid #91acca;max-width:100%}.shared-dialog input,.shared-dialog select{width:100%}.shared-dialog button{cursor:pointer;background:#1658b5;color:#fff;margin:5px}.shared-dialog button:disabled{opacity:.55;cursor:wait}.shared-message{background:#eaf2ff;padding:12px;line-height:1.7}.shared-message.error{background:#fef2f2;color:#991b1b;border:2px solid #b91c1c}.shared-project{border:1px solid #b5c9e3;padding:12px;margin:12px 0;overflow-wrap:anywhere}.shared-project strong{display:block}.shared-dialog input:user-invalid{border:2px solid #b91c1c;background:#fff1f2}.shared-dialog [hidden]{display:none!important}`;document.head.append(css);
 const launcher=node('div','','shared-launch'),launch=node('button','端末間共有'),pill=node('span','共有：未接続','shared-sync');launch.type='button';launcher.append(launch,pill);(document.querySelector('.top')||document.body).append(launcher);
 const dialog=node('dialog','','shared-dialog');dialog.id='shared-dialog';
 dialog.innerHTML='<h2>PC・iPadとスマホの共有</h2><p id="shared-message" class="shared-message" role="status" aria-live="polite"></p><form id="shared-login"><label>メールアドレス<input id="shared-email" type="email" autocomplete="username" required></label><label>パスワード<input id="shared-password" type="password" autocomplete="current-password" required></label><button type="submit">ログイン</button></form><section id="shared-controls" hidden><p id="shared-account"></p><p>共有するのは工事データと提出状況です。添付ファイル本体は今回の同期対象に含まれません。</p><button type="button" id="shared-publish">選択中の工事を共有・更新</button><button type="button" id="shared-resolve">端末内の版と比較して共有</button><button type="button" id="shared-compare-download">比較データを保存（更新しない）</button><button type="button" id="shared-list-refresh">共有工事の一覧を更新</button><button type="button" id="shared-recovery">選択中工事を取り込み前に戻す</button><button type="button" id="shared-signout">ログアウト</button><div id="shared-projects"></div><form id="shared-members"><h3>共有相手の設定（工事の所有者）</h3><label>対象の工事<select id="shared-member-project"></select></label><label>登録済み利用者のメールアドレス<input id="shared-member-email" type="email" required></label><label>権限<select id="shared-member-access"><option value="viewer">提出状況の閲覧のみ</option><option value="editor">工事データの編集</option></select></label><button type="submit" id="shared-grant">共有相手を追加・変更</button><button type="button" id="shared-revoke">この相手の共有を解除</button><p>先に管理者が利用者を登録してください。招待メールはこの操作では送信しません。</p></form><p><a href="shared/status.html" target="_blank" rel="noopener">スマホ用の提出状況画面を開く</a></p></section><button type="button" id="shared-close">閉じる</button>';
 document.body.append(dialog);
 function message(text,error=false){$('shared-message').textContent=text;$('shared-message').classList.toggle('error',error);}
 function sync(text,error=false){pill.textContent=text;pill.classList.toggle('error',error);}
 function failed(error){
  message(error.message,true);sync(error.message,true);
  if(error.kind==='auth'){
   identity=null;links={};for(const timer of timers.values())clearTimeout(timer);timers.clear();
   $('shared-controls').hidden=true;$('shared-login').hidden=false;$('shared-close').disabled=true;
   document.documentElement.classList.add('shared-login-required');if(!dialog.open)dialog.showModal();
  }
 }

 const namespace=()=>`omuta-shared-links:${client.url}:${identity}`;
 function remember(){try{localStorage.setItem(namespace(),JSON.stringify(links));}catch{sync('同期設定を端末に保存できません。バックアップを保存してください。',true);}}
 async function hash(project){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(project))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function current(id=WB.project().id){return WB.projects().find(p=>p.id===id);}
 function sameUser(actor){return actor===identity&&client.session?.user?.id===actor;}
 function renderList(){
  $('shared-projects').replaceChildren();$('shared-member-project').replaceChildren();
  for(const row of projects){const card=node('article','','shared-project');card.append(node('strong',row.title),node('p','共有側の更新：'+new Date(row.updated_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})));
   if(row.can_edit){const details=node('details'),summary=node('summary','別端末の共有版を取り込む（現在の工事を置き換え）'),button=node('button','共有版を取り込んで編集');button.type='button';button.onclick=event=>{event.preventDefault();event.stopPropagation();pull(row);};details.append(summary,button);card.append(details);}
   $('shared-projects').append(card);
   if(row.can_manage){const option=node('option',row.title);option.value=row.id;$('shared-member-project').append(option);}
  }
  if(!projects.length)$('shared-projects').append(node('p','共有工事はまだありません。選択中の工事から共有を開始してください。'));
  $('shared-members').hidden=!projects.some(p=>p.can_manage);
 }
 async function list(){const actor=identity,data=await client.list();if(!sameUser(actor))return;projects=data;renderList();
  for(const link of Object.values(links)){const row=data.find(p=>p.id===link.id);if(!row||!row.can_edit){link.blocked=true;if(links[WB.project().id]===link)sync('共有の編集権限を確認できません。自動送信を停止しています。',true);continue;}if(row.revision!==link.revision){link.blocked=true;if(links[WB.project().id]===link)sync('共有側に更新があります。一覧から確認して取り込んでください。',true);}}
  remember();
 }
 async function signedIn(){
  const actor=client.session?.user?.id,access=await client.access();if(client.session?.user?.id!==actor)return;
  if(access==='viewer'){location.replace(new URL('shared/status.html',location.href));return;}
  if(access!=='editor')throw new OmutaShared.SharedError('利用者の権限が未登録です。管理者に登録を依頼してください。','permission');
  identity=actor;try{links=JSON.parse(localStorage.getItem(namespace())||'{}')||{};}catch{links={};}
  $('shared-login').hidden=true;$('shared-controls').hidden=false;$('shared-account').textContent='ログイン中：'+(client.session.user.email||'編集用アカウント');
  document.documentElement.classList.remove('shared-login-required');$('shared-close').disabled=false;
  message('接続しました。最初は選択中の工事を共有するか、共有工事を取り込んでください。');sync('共有先に接続中');await list();
 }
 async function push(localId=WB.project().id){
  if(suspended||!identity||!client.session)return;
  if(saving||preparing){schedule(localId);return;}
  const local=current(localId);if(!local||local.role!=='current'){message('今回の工事を作成してから共有してください。',true);return;}
  const actor=identity,id=local.id,link=links[id];
  if(link?.blocked){sync('共有側の更新を取り込むまで自動送信を停止しています。',true);message('他端末の更新または権限変更があります。一覧を更新し、共有版を確認してください。',true);return;}
  if(WB.localSaved&&!WB.localSaved()){message('端末内の保存に失敗しています。バックアップを保存してから再試行してください。',true);sync('端末内の保存に失敗・共有停止',true);return;}
  const project=JSON.parse(JSON.stringify(local));let checksum;preparing=true;try{checksum=await hash(project);}finally{preparing=false;}if(!sameUser(actor))return;
  if(link?.hash===checksum){sync('端末内・共有先とも保存済み');message('送信待ちの変更はありません。共有側の最新内容も確認する場合は「端末内の版と比較して共有」を押してください。');return;}
  saving=true;sync('共有先へ保存中…');$('shared-publish').disabled=true;
  try{
   const row=await client.save(link?.id,id,project,link?.revision);if(!sameUser(actor))return;
   links[id]={id:row.id,revision:row.revision,hash:checksum,blocked:false};remember();sync('端末内・共有先とも保存済み');message('工事データと提出状況を共有しました。添付本体は端末内に残ります。');
   await list();
  }catch(error){if(error.kind==='auth'&&identity===actor){failed(error);return;}if(!sameUser(actor))return;if(error.kind==='conflict'||error.kind==='permission'){if(links[id])links[id].blocked=true;remember();}sync(error.message,true);message(error.message,true);}
  finally{saving=false;$('shared-publish').disabled=false;if(sameUser(actor)&&links[id]?.hash===checksum&&!links[id]?.blocked&&current(id)&&await hash(current(id))!==checksum)schedule(id);}
 }
 function schedule(id=WB.project().id){if(suspended||!identity||!links[id]||links[id].blocked)return;clearTimeout(timers.get(id));sync('端末内に保存済み・共有待ち');timers.set(id,setTimeout(()=>{timers.delete(id);push(id).catch(error=>sync(error.message,true));},900));}
 async function recovery(mode,project){
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('omuta-sharing-recovery',1);request.onupgradeneeded=()=>request.result.createObjectStore('backups',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('復元用データを端末に保存できません。取り込みは中止しました。'));});
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction('backups',mode==='put'?'readwrite':'readonly'),store=tx.objectStore('backups');let value;
   const request=mode==='put'?store.put({key:crypto.randomUUID(),user:identity,localId:project.id,at:new Date().toISOString(),project}):store.getAll();
   request.onsuccess=()=>value=request.result;tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(new Error('復元用データを端末に保存できません。取り込みは中止しました。'));
  });}finally{db.close();}
 }
 async function pull(row){
  if(saving){message('保存が終わってから取り込んでください。',true);return;}
  const actor=identity;message('共有工事を確認しています…');
  try{const remote=await client.get(row.id);if(!sameUser(actor))return;
   if(!WB.validProject(remote.project))throw new OmutaShared.SharedError('この版では取り込めない工事データです。元データは変更していません。','validation');
   const existing=current(remote.project.id),remoteCount=remote.project.items.filter(i=>i.state==='adopted').length;
   const amounts='／共有側の明細計 '+WB.totals(remote.project).rawDirect.toLocaleString('ja-JP')+'円'+(existing?'／端末内 '+WB.totals(existing).rawDirect.toLocaleString('ja-JP')+'円':'');
   const summary='「'+remote.project.title+'」を取り込みます。共有側の採用 '+remoteCount+'件'+(existing?'／端末内の採用 '+WB.adopted(existing).length+'件。端末内の同じ工事を置き換えます。':'。')+amounts+'\n先に現在の全工事のバックアップを保存します。添付本体は同期されません。続けますか？';
   if(!confirm(summary))return;
   if(existing)await recovery('put',JSON.parse(JSON.stringify(existing)));if(!sameUser(actor))return;
   WB.backup();suspended=true;try{WB.restoreProject(remote.project);}finally{suspended=false;}
   links[remote.project.id]={id:row.id,revision:remote.revision,hash:await hash(current(remote.project.id)),blocked:false};remember();
   sync('共有版を端末内に保存済み');message('取り込みました。以後、この工事の変更は自動送信します。添付本体は元端末から書類・分類ZIPで別途復元してください。');dialog.close();
  }catch(error){failed(error);}
 }
 launch.onclick=()=>{if(!dialog.open)dialog.showModal();};
 $('shared-close').onclick=()=>dialog.close();dialog.addEventListener('cancel',event=>{if(document.documentElement.classList.contains('shared-login-required'))event.preventDefault();});
 $('shared-login').onsubmit=async event=>{event.preventDefault();const button=$('shared-login').querySelector('button');button.disabled=true;try{await client.signIn($('shared-email').value.trim(),$('shared-password').value);await signedIn();}catch(error){failed(error);}finally{$('shared-password').value='';button.disabled=false;}};
 async function downloadComparison(){
  if(saving||preparing||!identity)return;const actor=identity,id=WB.project().id,link=links[id];
  const remoteId=link?.id||projects.find(row=>row.local_id===id)?.id;
  if(!remoteId){message('この工事の共有先を特定できません。共有データは変更していません。',true);return;}
  preparing=true;$('shared-compare-download').disabled=true;
  try{message('共有版を読み取っています。共有先への更新は行いません。');const remote=await client.get(remoteId);if(!sameUser(actor))return;
   if(!WB.validProject(remote.project))throw Error('共有版を確認できません。データは変更していません。');
   const local=JSON.parse(JSON.stringify(current(id))),data={kind:'omuta-shared-comparison',version:1,at:new Date().toISOString(),local,shared:remote.project,sharedRevision:remote.revision};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='端末共有_読取比較_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);message('比較データを作成しました。端末内・共有側とも変更していません。');
  }catch(error){failed(error);}finally{preparing=false;$('shared-compare-download').disabled=false;}
 }
 $('shared-compare-download').onclick=()=>downloadComparison().catch(failed);
 async function resolveLocal(){
  if(!identity){message('先にログインしてください。',true);return;}
  if(saving||preparing){message('別の共有処理が進行中です。完了後にもう一度比較してください。');return;}
  const actor=identity,id=WB.project().id,link=links[id];
  if(!link){message('この工事は共有先との関連付けがありません。「選択中の工事を共有・更新」から共有してください。',true);return;}
  message('端末内の版と共有版を比較しています…');preparing=true;$('shared-resolve').disabled=true;let stage='共有版の読み取り',saved=false;
  try{
   const remote=await client.get(link.id);if(!sameUser(actor))return;
   const local=JSON.parse(JSON.stringify(current(id)));if(!WB.validProject(remote.project))throw Error('共有版の形式を確認できません。変更していません。');
   const value=p=>({採用件数:WB.adopted(p).length,明細計:WB.totals(p).rawDirect,工事場所:p.settings.location||'（空欄）',工事概要:p.settings.overview||'（空欄）',担当者:p.settings.person||'（空欄）',計算用工期:p.settings.durationMonths});
   const left=value(local),right=value(remote.project),lines=Object.keys(left).map(k=>k+'：端末内 '+left[k]+' ／ 共有側 '+right[k]);
   const differences=[];function diff(a,b,path=''){if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],path?path+'.'+k:k);}else differences.push(path);}
   diff(local,remote.project);
   if(!differences.length){links[id]={id:link.id,revision:remote.revision,hash:await hash(local),blocked:false};remember();sync('端末内・共有先とも保存済み');message('比較が完了しました。端末内と共有側は同じ内容です。更新は不要です。');return;}
   if(!confirm('端末内の版で共有側を更新します。共有版は端末へ取り込みません。\n'+lines.join('\n')+'\n全データの差分箇所：'+differences.length+'件。両版を復元用に保存し、比較バックアップをダウンロードします。端末内の版を共有してよいですか？'))return;
   if(!sameUser(actor)||JSON.stringify(current(id))!==JSON.stringify(local))throw Error('確認中に端末データが変わりました。もう一度比較してください。');
   stage='両版の退避';message('両版を端末内へ退避しています…');await recovery('put',JSON.parse(JSON.stringify(remote.project)));await recovery('put',local);if(!sameUser(actor))return;
   stage='比較バックアップの作成';const data={version:1,at:new Date().toISOString(),local,shared:remote.project,sharedRevision:remote.revision,differences};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='端末共有_比較バックアップ_'+new Date().toISOString().slice(0,10)+'.json';setTimeout(()=>URL.revokeObjectURL(url),60000);
   const checksum=await hash(local);if(!sameUser(actor))return;saving=true;
   stage='共有先への保存';message('端末内の版を共有先へ保存しています…');const row=await client.save(link.id,id,local,remote.revision);saved=true;if(!sameUser(actor))return;
   links[id]={id:row.id,revision:row.revision,hash:checksum,blocked:false};remember();sync('端末内・共有先とも保存済み');message('端末内の版を共有しました。両版は端末内の復元用データへ退避済みです。比較バックアップを保存してください。');stage='保存後の一覧更新';try{await list();}finally{a.click();}
  }catch(error){if(error.kind==='auth'){failed(error);}else{const text=(saved?'共有先への保存は完了しました。':'')+stage+'で停止しました。'+error.message;message(text,true);sync(text,true);}}finally{saving=false;preparing=false;$('shared-resolve').disabled=false;}
 }
 $('shared-resolve').onclick=()=>resolveLocal().catch(failed);
 $('shared-publish').onclick=()=>push().catch(failed);$('shared-list-refresh').onclick=()=>list().catch(failed);
 $('shared-signout').onclick=async()=>{identity=null;links={};projects=[];for(const timer of timers.values())clearTimeout(timer);timers.clear();$('shared-projects').replaceChildren();$('shared-member-project').replaceChildren();$('shared-controls').hidden=true;$('shared-login').hidden=false;document.documentElement.classList.add('shared-login-required');$('shared-close').disabled=true;await client.signOut();sync('共有：ログアウト');message('ログアウトしました。端末内の工事データは保持しています。');};
 $('shared-recovery').onclick=async()=>{
  if(saving){message('保存が終わってから操作してください。',true);return;}
  try{const actor=identity,id=WB.project().id,backups=(await recovery('get')).filter(row=>row.user===actor&&row.localId===id).sort((a,b)=>b.at.localeCompare(a.at));
   if(!sameUser(actor))return;if(!backups.length){message('この工事の取り込み前データはありません。');return;}
   const previous=backups[0];if(!confirm(new Date(previous.at).toLocaleString('ja-JP')+' の端末内データへ戻します。現在のデータは先にバックアップします。共有先には自動送信しません。続けますか？'))return;
   if(!WB.validProject(previous.project))throw new Error('復元用データを確認できません。現在の入力は保持しています。');
   await recovery('put',JSON.parse(JSON.stringify(WB.project())));if(!sameUser(actor))return;WB.backup();suspended=true;try{WB.restoreProject(previous.project);}finally{suspended=false;}
   if(links[id])links[id].blocked=true;remember();message('取り込み前のデータを端末内に復元しました。共有版とは異なるため、自動送信を停止しています。バックアップを保存して内容を比較してください。');sync('端末内に復元・共有への自動送信は停止中',true);
  }catch(error){failed(error);}
 };
 $('shared-members').onsubmit=async event=>{event.preventDefault();event.stopPropagation();const button=$('shared-grant');button.disabled=true;try{await client.grant($('shared-member-project').value,$('shared-member-email').value,$('shared-member-access').value);message('共有相手の権限を設定しました。');}catch(error){failed(error);}finally{button.disabled=false;}};
 $('shared-revoke').onclick=async()=>{if(!$('shared-member-email').reportValidity())return;if(!confirm('この相手の工事へのアクセスを解除しますか？'))return;try{await client.revoke($('shared-member-project').value,$('shared-member-email').value);message('この工事への共有を解除しました。');}catch(error){failed(error);}};
 window.addEventListener('wb-render',()=>schedule());
 setInterval(()=>{if(identity&&!document.hidden)list().catch(failed);},30000);
 if(!client.configured()){document.documentElement.classList.remove('shared-login-required');message('共有機能の初期設定が必要です。管理者に接続設定を依頼してください。現在の端末内データはそのまま使えます。',true);$('shared-login').querySelector('button').disabled=true;}
 else{
  document.documentElement.classList.add('shared-login-required');$('shared-close').disabled=true;
  if(matchMedia('(max-width:600px)').matches){location.replace(new URL('shared/status.html',location.href));return;}
  dialog.showModal();if(client.session)signedIn().catch(failed);
 }
})();
