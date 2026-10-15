(()=>{'use strict';
 const $=id=>document.getElementById(id),client=new OmutaShared.SharedClient(window.OMUTA_SHARED_CONFIG);
 let snapshot=null,busy=false,sequence=0,queued=false;
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 $('month').value=today().slice(0,7);
 function message(text,error=false){$('status-message').textContent=text;$('status-message').className=error?'error':'';}
 function signedOut(){sequence++;snapshot=null;$('dashboard').hidden=true;$('login').hidden=false;$('rows').replaceChildren();$('counts').replaceChildren();$('project').replaceChildren();$('updated').textContent='';}
 function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
 function render(){
  $('rows').replaceChildren();$('counts').replaceChildren();$('condition-label').textContent='表示条件：'+$('month').value+'／'+($('filter').value==='all'?'すべて':$('filter').value)+'（押して変更）';if(!snapshot){$('updated').textContent='';return;}
  $('updated').textContent='共有データの更新：'+new Date(snapshot.updated_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+'（日本時間）';
  const counts={};for(const row of snapshot.rows)counts[row.priority]=(counts[row.priority]||0)+1;
  for(const name of ['期限超過','差戻し','7日以内','未提出','未確認','要再確認','確認済み']){const button=node('button',name+' '+(counts[name]||0)+'件','counter');button.type='button';button.setAttribute('aria-pressed',String($('filter').value===name));button.onclick=()=>{$('filter').value=$('filter').value===name?'all':name;render();};$('counts').append(button);}
  const rank={'期限超過':0,'差戻し':1,'要再確認':2,'7日以内':3,'未確認':4};
  const rows=snapshot.rows.filter(row=>$('filter').value==='all'||row.priority===$('filter').value).sort((a,b)=>(rank[a.priority]??5)-(rank[b.priority]??5)||a.no-b.no);
  for(const row of rows){const card=node('article','','document');card.append(node('span',row.priority,'state '+(['期限超過','差戻し','要再確認'].includes(row.priority)?'urgent':row.priority==='確認済み'?'done':'')),node('h2','No.'+row.no+' '+row.name),node('p',row.phase+'／'+row.applicability),node('p','期限：'+(row.due_date||row.due_text)),node('p','提出日：'+(row.submitted_at||'未記録')+' ／ 確認日：'+(row.confirmed_at||'未記録')));if(row.note)card.append(node('p','備考：'+row.note));$('rows').append(card);}
  if(!rows.length)$('rows').append(node('p','該当する書類はありません。'));
 }
 async function load(){
  if(busy){queued=true;return;}const id=$('project').value;if(!id){snapshot=null;render();return;}
  const month=$('month').value;if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){message('対象月を選択してください。',true);return;}
  busy=true;const request=++sequence;message('最新の提出状況を確認しています…');$('refresh').disabled=true;
  try{const data=await client.status(id,month);if(request!==sequence)return;snapshot=data;render();message('共有先で確認できた最新の状態です。確認時刻 '+new Date().toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo'}));}
  catch(error){if(request!==sequence)return;message('最新状態を取得できていません。'+error.message,true);if(error.kind==='auth'){signedOut();client.store(null);}else if(error.kind==='permission'){snapshot=null;render();}}
  finally{busy=false;$('refresh').disabled=false;if(client.session&&(queued||$('project').value!==id||$('month').value!==month)){queued=false;load();}}
 }
 async function open(){
  const actor=client.session?.user?.id,selected=$('project').value;message('共有工事を確認しています…');const projects=await client.list();if(client.session?.user?.id!==actor)return;sequence++;if(!projects.some(p=>p.id===snapshot?.id)||snapshot?.month!==$('month').value)snapshot=null;render();$('project').replaceChildren(node('option','工事を選択してください'));
  $('project').firstChild.value='';for(const p of projects){const opt=node('option',p.title);opt.value=p.id;$('project').append(opt);}
  $('login').hidden=true;$('dashboard').hidden=false;
  if(projects.length){$('project').value=projects.some(p=>p.id===selected)?selected:projects[0].id;await load();}else message('共有されている工事はありません。管理者に共有設定を依頼してください。');
 }
 $('login').onsubmit=async event=>{event.preventDefault();const button=$('login').querySelector('button');button.disabled=true;
  try{await client.signIn($('email').value.trim(),$('password').value);$('password').value='';await open();}catch(error){message(error.message,true);}finally{$('password').value='';button.disabled=false;}};
 $('logout').onclick=async()=>{signedOut();await client.signOut();message('ログアウトしました。');};
 $('project').onchange=()=>{sequence++;snapshot=null;$('updated').textContent='';render();load();};$('month').onchange=()=>{sequence++;snapshot=null;$('updated').textContent='';render();load();};$('filter').onchange=render;$('refresh').onclick=()=>open().catch(error=>{if(error.kind==='auth'){signedOut();client.store(null);}message('最新状態を取得できていません。'+error.message,true);});
 setInterval(()=>{if(!document.hidden&&client.session)load();},30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&client.session)load();});
 if(!client.configured()){message('共有先が未設定です。管理者による接続設定が必要です。',true);$('login').querySelector('button').disabled=true;}
 else if(client.session)open().catch(error=>{signedOut();message(error.message,true);});
})();
