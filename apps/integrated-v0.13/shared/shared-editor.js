/* Optional shared workflow. Offline projects are kept; importing always backs them up. */
(()=>{'use strict';
 if(!window.WB||!window.OmutaShared)return;
 const client=new OmutaShared.SharedClient(window.OMUTA_SHARED_CONFIG||{}),$=id=>document.getElementById(id);
 const app=document.querySelector('.app');let links={},projects=[],saving=false,preparing=false,suspended=false,identity=null;const timers=new Map();let listSequence=0;
 const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 const css=node('style');css.textContent=`.shared-login-required .app,.shared-login-required #wb-dialog{visibility:hidden}.shared-launch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.shared-launch button{min-height:44px}.shared-sync{font-size:13px;color:#234d7a}.shared-sync.error{color:#b91c1c}.shared-dialog{width:min(720px,95vw);max-height:90vh;border:1px solid #8fa8c6;border-radius:12px;padding:20px;color:#163254;overflow:auto}.shared-dialog::backdrop{background:#10284999}.shared-dialog label{display:block;margin:12px 0;font-weight:600}.shared-dialog input,.shared-dialog select,.shared-dialog button{font:inherit;min-height:46px;border-radius:7px;padding:10px;border:1px solid #91acca;max-width:100%}.shared-dialog input,.shared-dialog select{width:100%}.shared-dialog button{cursor:pointer;background:#1658b5;color:#fff;margin:5px}.shared-dialog button:disabled{opacity:.55;cursor:wait}.shared-message{background:#eaf2ff;padding:12px;line-height:1.7}.shared-message.error{background:#fef2f2;color:#991b1b;border:2px solid #b91c1c}.shared-project{border:1px solid #b5c9e3;padding:12px;margin:12px 0;overflow-wrap:anywhere}.shared-project strong{display:block}.shared-dialog input:user-invalid{border:2px solid #b91c1c;background:#fff1f2}.shared-comparison{width:min(1000px,94vw);box-sizing:border-box}.shared-diff-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;border:1px solid #b5c9e3;padding:12px;margin:12px 0}.shared-diff-row h4{grid-column:1/-1;margin:0;overflow-wrap:anywhere}.shared-diff-row pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:260px;overflow:auto;background:#f1f5f9;padding:10px}.shared-dialog .shared-diff-ack input{width:auto;min-height:0;margin-right:10px}.shared-diff-actions{display:flex;flex-wrap:wrap}@media(max-width:600px){.shared-diff-row{grid-template-columns:minmax(0,1fr)}}.shared-dialog [hidden]{display:none!important}`;document.head.append(css);
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
 function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
 const sameContent=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
 async function hash(project){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(project)))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
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
 async function list(){
  const sequence=++listSequence,actor=identity,before=Object.fromEntries(Object.entries(links).map(([id,l])=>[id,{...l}])),data=await client.list();
  if(!sameUser(actor)||sequence!==listSequence)return;projects=data;renderList();
  for(const [id,snapshot] of Object.entries(before)){
   const link=links[id];if(!link||link.id!==snapshot.id||link.revision!==snapshot.revision||saving||preparing)continue;
   const row=data.find(p=>p.id===link.id),selected=WB.project().id===id;
   if(!row||!row.can_edit){link.blocked=true;if(selected)sync('共有の編集権限を確認できません。端末内のデータは保持しています。',true);continue;}
   if(row.revision!==link.revision||link.blocked){
    const remote=await client.get(link.id);if(!sameUser(actor)||sequence!==listSequence)return;
    if(links[id]!==link||link.revision!==snapshot.revision||saving||preparing)continue;
    const local=current(id);if(!local)continue;
    if(WB.validProject(remote.project)&&sameContent(local,remote.project)){
     const checksum=await hash(local);if(!sameUser(actor)||sequence!==listSequence||links[id]!==link||link.revision!==snapshot.revision||saving||preparing||!sameContent(current(id),remote.project))continue;
     links[id]={id:link.id,revision:remote.revision,hash:checksum,blocked:false};
     if(selected){sync('端末内・共有先とも保存済み');message('端末内と共有側は同じ内容です。取り込みや更新は不要です。');}
    }else{link.blocked=true;if(selected){sync('共有側と内容が異なります。比較して確認してください。',true);message('端末内と共有側に異なる内容があります。「端末内の版と比較して共有」または「比較データを保存」で確認してください。端末内のデータは保持しています。',true);}}
   }else if(selected){const checksum=await hash(current(id));if(!sameUser(actor)||sequence!==listSequence||links[id]!==link||saving||preparing)continue;if(link.hash===checksum){sync('端末内・共有先とも保存済み');message('共有内容を確認しました。端末内・共有先とも保存済みです。');}else{sync('端末内に保存済み・共有待ち');message('端末内の変更は保存されています。共有先への反映を確認するには「端末内の版と比較して共有」を押してください。');}}
  }
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
 function comparisonRows(local,remote){
  const labels={title:'工事件名',role:'工事の区分',year:'適用年度',tax:'消費税率',workType:'工事区分',purpose:'用途・様式',location:'工事場所',contractPeriod:'工期の手入力表記',overview:'工事概要',person:'担当者',durationMonths:'計算用工期（月）',commonModel:'共通費の計算基準',commonSource:'算定根拠',commonChecked:'計算条件の確認',budget:'予算の物価上昇率',rounding:'工事価格の端数処理',directRounding:'直接工事費の端数処理',contractDate:'契約締結日',startDate:'実着工日',plannedEnd:'完成予定日',completionDate:'実完成日',inspectionDate:'完成検査日',contractAmount:'請負金額',supervision:'監理業者',subcontract:'下請業者',advance:'前金払',designated:'指定部分',asbestos:'石綿事前調査',equipmentOnly:'設備単独発注',checked:'条件の確認',route:'契約区分',kentai:'建退共の方式',status:'状態',note:'備考',folder:'保管先',dueDate:'指定提出期限',submittedAt:'提出記録日',confirmedAt:'内容確認日',partChecks:'構成書類の確認',partKinds:'構成書類の取扱い',partNotes:'構成書類の備考',materialSnapshots:'材料照合の記録',name:'名称',spec:'規格',quantity:'数量',unit:'単位',unitPrice:'単価',state:'採用状態',reason:'理由',evidence:'根拠',excludeCommon:'共通費対象外',archived:'履歴へ退避',mode:'単価の作り方',source:'出典',file:'資料名',sheet:'シート',priceCell:'単価の参照先',quantityCell:'数量の参照先',quote:'元価格',reduction:'低減率',electrician:'電工単価',ordinary:'普通工単価',laborSource:'労務単価の根拠',laborYear:'労務単価年度',referenceRevision:'計算資料の版',calculationBasis:'計算方式の版',size:'ファイル容量',at:'記録日時',docNo:'書類番号',recordKey:'関連する書類',parts:'構成書類',attachmentId:'添付の関連付け',sha256:'資料内容の識別情報',pageCount:'ページ数',method:'取込方法',id:'登録の識別情報',sourceId:'出典の関連付け'};
  const rows=[],sourceNames=new Map([...local.items||[],...remote.items||[]].map(i=>[i.id,[i.name,i.spec].filter(Boolean).join(' ')]));
  const format=(v,k)=>{if(['id','sourceId','attachmentId','sha256'].includes(k)&&v)return '（登録あり）';if(v===undefined)return '（登録なし）';if(v===null||v==='')return '（空欄）';if(typeof v==='boolean')return v?'あり／確認済み':'なし／未確認';if(typeof v==='number')return v.toLocaleString('ja-JP');if((k==='materialSnapshots'||sourceNames.has(k))&&typeof v==='string'){try{const x=JSON.parse(v);if(Array.isArray(x))return x.join(' ／ ');}catch{}}const words={yes:'あり',no:'なし',unknown:'未確認',needed:'今回提出',already:'施工時に提出済み（再送不要）',none:'今回は不要',adopted:'採用済み',candidate:'確認候補',hold:'保留',excluded:'今回対象外','budget-latest':'予算設計書（令和8年9月変更）','design-original':'勝立地区公民館の既存設計書',normal:'通常',electronic:'電子',current:'今回工事',reference:'参考工事',direct:'確認した単価を使用',compose:'材料と施工から計算'};return typeof v==='object'?JSON.stringify(v,null,2):(words[v]||String(v));};
  function walk(a,b,group,title,k=''){
   if(sameContent(a,b))return;
   if((a&&typeof a==='object'&&!Array.isArray(a))||(b&&typeof b==='object'&&!Array.isArray(b))){
    const aa=a&&typeof a==='object'?a:{},bb=b&&typeof b==='object'?b:{},keys=[...new Set([...Object.keys(aa),...Object.keys(bb)])];
    if(keys.length){for(const key of keys){let label=labels[key]||'登録内容';if(k==='partChecks'||k==='partKinds'||k==='partNotes')label=window.SUBMISSIONS?.master?.find(d=>String(d.no)===title.match(/^No\.(\d+)/)?.[1])?.parts?.[Number(key)]||'構成書類 '+(Number(key)+1);if(k==='materialSnapshots')label=sourceNames.get(key)||'材料照合';walk(aa[key],bb[key],group,title+' ／ '+label,key);}return;}
   }
   rows.push({group,title,local:format(a,k),remote:format(b,k)});
  }
  const groups={settings:'工事情報・計算条件',contract:'契約条件',submissionRecords:'提出書類',items:'設計明細',submissionFiles:'添付の登録情報',documents:'資料の登録情報',history:'操作履歴',approval:'最終確認'};
  for(const key of new Set([...Object.keys(local),...Object.keys(remote)])){
   const a=local[key],b=remote[key],group=groups[key]||'その他';if(sameContent(a,b))continue;
   if(key==='history'){rows.push({group,title:'操作履歴の記録',local:(a||[]).length+'件',remote:(b||[]).length+'件（記録内容または順序が異なります）'});continue;}
   if(key==='submissionRecords'){
    for(const record of new Set([...Object.keys(a||{}),...Object.keys(b||{})])){const [no,month]=record.split(':'),doc=window.SUBMISSIONS?.master?.find(d=>String(d.no)===no),title='No.'+no+' '+(doc?.name||'提出書類')+(month?'（'+month+'分）':'');walk(a?.[record],b?.[record],group,title);}
   }else if(['items','submissionFiles','documents'].includes(key)){
    const left=new Map((a||[]).map((r,n)=>[r.id||'position-'+n,r])),right=new Map((b||[]).map((r,n)=>[r.id||'position-'+n,r]));
    for(const id of new Set([...left.keys(),...right.keys()])){const x=left.get(id),y=right.get(id),r=x||y;walk(x,y,group,[r.name||'登録資料',r.spec].filter(Boolean).join(' '));}
    if(key==='items'&&!sameContent((a||[]).map(r=>r.id),(b||[]).map(r=>r.id)))rows.push({group,title:'明細の登録順',local:'端末内の順序',remote:'共有側では順序または項目が異なります'});
   }else walk(a,b,group,labels[key]||groups[key]||'その他の登録内容',key);
  }
  return rows;
 }
 async function reviewComparison(local,remote){
  const rows=comparisonRows(local,remote),panel=node('dialog','','shared-dialog shared-comparison');panel.id='shared-comparison';
  const header=node('h2','共有する前に差分を確認'),intro=node('p','左が端末内、右が共有側です。この画面を開いただけでは、どちらのデータも変更しません。');panel.append(header,node('h3',local.title),intro);
  const totals=p=>{try{const t=WB.totals(p);return WB.adopted(p).length+'件 ／ 明細計 '+t.rawDirect.toLocaleString('ja-JP')+'円';}catch{return '計算条件を確認してください';}};
  panel.append(node('p','端末内：'+totals(local)),node('p','共有側：'+totals(remote)));
  const label=node('label','表示する差分'),select=node('select');select.id='shared-diff-filter';
  for(const group of ['すべて',...new Set(rows.map(r=>r.group))]){const option=node('option',group);option.value=group;select.append(option);}label.append(select);panel.append(label);
  const count=node('p'),body=node('div');body.id='shared-diff-rows';panel.append(count,body);
  function show(){body.replaceChildren();const filtered=rows.filter(r=>select.value==='すべて'||r.group===select.value);count.textContent='表示 '+filtered.length+'項目 ／ 全 '+rows.length+'項目の差分';for(const r of filtered){const card=node('section','','shared-diff-row');card.append(node('h4',r.group+'：'+r.title));for(const [name,value] of [['端末内',r.local],['共有側',r.remote]]){const cell=node('div');cell.append(node('b',name),node('pre',value));card.append(cell);}body.append(card);}}select.onchange=show;show();
  panel.append(node('p','更新・取り込みは工事全体の置き換えです。項目ごとの自動結合は行いません。両版の復元用データを保存してから実行します。添付ファイル本体は別途「書類・分類ZIP」で保管してください。'));
  const ackLabel=node('label','','shared-diff-ack'),ack=node('input');ack.type='checkbox';ack.id='shared-diff-ack';ackLabel.append(ack,document.createTextNode('差分を確認し、使用する版を選びます'));panel.append(ackLabel);
  const actions=node('div','','shared-diff-actions'),localButton=node('button','端末内の版を共有する'),remoteButton=node('button','共有側の版を取り込む'),cancel=node('button','変更せず閉じる');localButton.id='shared-diff-use-local';remoteButton.id='shared-diff-use-remote';cancel.id='shared-diff-cancel';for(const button of [localButton,remoteButton,cancel])button.type='button';localButton.disabled=remoteButton.disabled=true;ack.onchange=()=>{localButton.disabled=remoteButton.disabled=!ack.checked;};actions.append(localButton,remoteButton,cancel);panel.append(actions);
  document.body.append(panel);panel.showModal();let choice='cancel';return await new Promise(resolve=>{localButton.onclick=()=>{choice='local';panel.close();};remoteButton.onclick=()=>{choice='remote';panel.close();};cancel.onclick=()=>panel.close();panel.addEventListener('close',()=>{panel.remove();resolve(choice);},{once:true});});
 }
 async function resolveLocal(){
  if(!identity){message('先にログインしてください。',true);return;}
  if(saving||preparing){message('別の共有処理が進行中です。完了後にもう一度比較してください。');return;}
  const actor=identity,id=WB.project().id,link=links[id];
  if(!link){message('この工事は共有先との関連付けがありません。「選択中の工事を共有・更新」から共有してください。',true);return;}
  message('端末内の版と共有版を比較しています…');preparing=true;$('shared-resolve').disabled=true;let stage='共有版の読み取り',saved=false;
  try{
   const remote=await client.get(link.id);if(!sameUser(actor))return;
   const local=JSON.parse(JSON.stringify(current(id)));if(!WB.validProject(remote.project))throw Error('共有版の形式を確認できません。変更していません。');
   const differences=comparisonRows(local,remote.project);
   if(sameContent(local,remote.project)){links[id]={id:link.id,revision:remote.revision,hash:await hash(local),blocked:false};remember();sync('端末内・共有先とも保存済み');message('比較が完了しました。端末内と共有側は同じ内容です。更新は不要です。');return;}
   const choice=await reviewComparison(local,remote.project);if(choice==='cancel'){message('比較を閉じました。端末内・共有側とも変更していません。');return;}
   if(!sameUser(actor)||JSON.stringify(current(id))!==JSON.stringify(local))throw Error('確認中に端末データが変わりました。もう一度比較してください。');
   if(choice==='remote'){
    stage='取り込み前の再確認';const latest=await client.get(link.id);if(!sameUser(actor))return;
    if(latest.revision!==remote.revision||!sameContent(latest.project,remote.project))throw Error('比較中に共有版が変わりました。もう一度比較してください。');
    await recovery('put',JSON.parse(JSON.stringify(remote.project)));await recovery('put',local);if(!sameUser(actor))return;
    if(!sameContent(current(id),local))throw Error('比較中に端末内の内容が変わりました。もう一度比較してください。');
    WB.backup();suspended=true;try{WB.restoreProject(remote.project);}finally{suspended=false;}
    links[id]={id:link.id,revision:remote.revision,hash:await hash(current(id)),blocked:false};remember();sync('共有版を端末内に保存済み');message('確認した共有版を取り込みました。取り込み前の版は復元用に退避済みです。添付ファイル本体は同期されません。');return;
   }
   stage='両版の退避';message('両版を端末内へ退避しています…');await recovery('put',JSON.parse(JSON.stringify(remote.project)));await recovery('put',local);if(!sameUser(actor))return;
   stage='比較バックアップの作成';const data={version:1,at:new Date().toISOString(),local,shared:remote.project,sharedRevision:remote.revision,differences};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='端末共有_比較バックアップ_'+new Date().toISOString().slice(0,10)+'.json';setTimeout(()=>URL.revokeObjectURL(url),60000);
   const checksum=await hash(local);if(!sameUser(actor))return;if(!sameContent(current(id),local))throw Error('比較中に端末内の内容が変わりました。もう一度比較してください。');saving=true;
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
