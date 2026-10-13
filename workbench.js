/* Stage5.59: real-workbook candidate workflow. No network calls. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), key='design_workbench_559';
 const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>Number(n||0).toLocaleString('ja-JP',{maximumFractionDigits:2})+'円';
 const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const uid=()=>globalThis.crypto?.randomUUID?.()||'id'+Date.now()+Math.random().toString(36).slice(2);
 const defaultSettings=()=>({year:'令和8年度',tax:10,budget:20,purpose:'設計用',rounding:1,common:0,management:0,general:0,commonSource:'',commonChecked:false});
 function candidates(source){
  const list=[];
  for(const sheet of source.sheets){
   if(!/(内訳書|^設計書\(電気\)$)/.test(sheet.name.trim()))continue;
   for(const row of sheet.rows){
    const c=row.cells,v=col=>c[col]?.value;
    if(typeof v('B')!=='string'||num(v('D'))===null||typeof v('E')!=='string'||!v('E').trim())continue;
    if(/^(直接工事費|共通仮設費|現場管理費|一般管理費|工事価格|消費税|工事費|合計|計|小計|純工事費|工事原価)/.test(v('B').trim()))continue;
    if(num(v('F'))===null && !c.F?.formula)continue;
    const id=source.id+'-'+sheet.name+'-'+row.row;
    const unit=num(v('F')),quantity=num(v('D')),amount=num(v('G'));
    list.push({id,name:v('B').trim(),spec:String(v('C')??''),quantity,unit:String(v('E')).trim(),unitPrice:unit,
     source:{file:source.filename,sheet:sheet.name,row:row.row,quantityCell:'D'+row.row,priceCell:'F'+row.row,amountCell:'G'+row.row,
      quantityFormula:c.D?.formula||'',priceFormula:c.F?.formula||'',amountFormula:c.G?.formula||'',sourceAmount:amount,sourceUnitPrice:unit},
     mode:'direct',material:0,quote:0,reduction:100,materialRate:0,electrician:0,ordinary:0,electricCoeff:0,ordinaryCoeff:0,laborRate:0,unitRounding:1,
     evidence:'添付Excelの保存済み単価。今回条件の照合が必要',priceChecked:false,quantityChecked:false,
     state:'candidate',reason:'',category:/スクラップ|有価|控除/.test(v('B'))?'控除':/撤去|処分|廃棄/.test(v('B')+' '+String(v('C')??''))?'撤去・処分':'新設',
     mismatch:unit!==null&&amount!==null&&Math.abs(Math.floor(quantity*unit)-amount)>1,
     formulaMissing:!!c.F?.formula&&unit===null});
   }
  }
  for(const item of list){
   const match=item.source.priceFormula.match(/^\+?\s*(?:'([^']+)'|([^'!]+))!\$?([A-Z]+)\$?(\d+)\s*$/);
   if(!match)continue;
   const sheet=source.sheets.find(s=>s.name===(match[1]||match[2]));
   if(!sheet||!/代価/.test(sheet.name))continue;
   const row=sheet.rows.find(r=>r.row===Number(match[4]));if(!row)continue;
   const value=col=>num(row.cells[col]?.value);
   item.source.breakdown={sheet:sheet.name,row:row.row,unitCell:match[3]+match[4],material:value('M'),labor:value('Q'),raw:value('R'),unit:value('S'),reduction:value('I'),materialFormula:row.cells.M?.formula||'',laborFormula:row.cells.Q?.formula||''};
  }
  return list;
 }
 function makeProject(source){
  let title='';
  for(const s of source.sheets){if(!/内訳書|^設計書\(電気\)$/.test(s.name.trim()))continue;
   const r=s.rows.find(r=>r.row===2);title=String(r?.cells.A?.value||r?.cells.B?.value||'');if(title)break;}
  return {id:'reference-'+source.id,title:title||source.filename.replace(/\.xlsx$/,''),role:'reference',sourceId:source.id,
   settings:defaultSettings(),items:candidates(source),documents:[{name:source.filename,type:'Excel',status:'候補抽出済み',sourceId:source.id}],history:[],approval:null};
 }
 let data;
 try{data=JSON.parse(localStorage.getItem(key)||'null');}catch{data=null;}
 if(!validData(data))data={version:559,projects:WB_SOURCES.map(makeProject),selected:'reference-'+WB_SOURCES[0].id,customSources:[]};
 let activeTab='candidates',search='',editing=null,savingError=false;
 function validItem(i){return i&&typeof i.id==='string'&&typeof i.name==='string'&&Number.isFinite(i.quantity)&&i.quantity>=0&&
  (i.unitPrice===null||Number.isFinite(i.unitPrice))&&typeof i.unit==='string'&&['candidate','hold','adopted','excluded'].includes(i.state)&&
  ['direct','compose'].includes(i.mode)&&['quantityChecked','priceChecked'].every(k=>typeof i[k]==='boolean')&&typeof i.reason==='string'&&i.source&&typeof i.source.file==='string'&&
  ['quote','reduction','materialRate','electrician','ordinary','electricCoeff','ordinaryCoeff','laborRate'].every(k=>Number.isFinite(i[k])&&i[k]>=0)&&i.reduction<=100&&[1,100,1000].includes(i.unitRounding);}
 function validData(d){return d&&d.version===559&&Array.isArray(d.projects)&&d.projects.length>0&&d.projects.length<200&&d.projects.every(p=>p&&typeof p.id==='string'&&typeof p.title==='string'&&['reference','current'].includes(p.role)&&Array.isArray(p.items)&&p.items.every(validItem)&&Array.isArray(p.documents)&&Array.isArray(p.history)&&p.settings&&Number.isFinite(p.settings.tax)&&p.settings.tax>=0&&p.settings.tax<=100&&[1,100,1000].includes(p.settings.rounding)&&['設計用','予算用'].includes(p.settings.purpose)&&['budget','common','management','general'].every(k=>Number.isFinite(p.settings[k])&&p.settings[k]>=0))&&Array.isArray(d.customSources);}
 const project=()=>data.projects.find(p=>p.id===data.selected)||data.projects[0];
 function save(){try{localStorage.setItem(key,JSON.stringify(data));savingError=false;}catch{savingError=true;}}
 function log(action,detail){const p=project();p.history.push({at:new Date().toISOString(),action,detail});p.approval=null;save();}
 function calc(i){
  if(i.mode==='direct')return {unit:i.unitPrice,material:null,labor:null,raw:i.unitPrice};
  const materialBase=i.quote*i.reduction/100;
  const material=materialBase*(1+i.materialRate/100);
  const laborBase=i.electrician*i.electricCoeff+i.ordinary*i.ordinaryCoeff;
  const labor=laborBase*(1+i.laborRate/100),raw=material+labor;
  return {unit:Math.floor(raw/i.unitRounding)*i.unitRounding,material,labor,raw,materialBase,laborBase};
 }
 function adopted(p=project()){return p.items.filter(i=>i.state==='adopted');}
 function totals(p=project()){
  const rows=adopted(p),direct=rows.reduce((n,i)=>n+Math.floor(i.quantity*calc(i).unit),0),s=p.settings;
  const price=Math.floor((direct+s.common+s.management+s.general)/s.rounding)*s.rounding;
  const tax=Math.floor(price*s.tax/100),total=price+tax,budget=Math.ceil(total*(1+s.budget/100));
  return {direct,price,tax,total,budget,count:rows.length};
 }
 function issues(p=project()){
  const result=[];
  if(p.role==='reference')result.push('参考工事です。「今回の工事として作成」してから正式確認してください。');
  if(!adopted(p).length)result.push('採用された項目がありません。');
  const pending=p.items.filter(i=>!['adopted','excluded'].includes(i.state));if(pending.length)result.push('候補・保留が'+pending.length+'件あります。採用または今回は対象外にしてください。');
  if(adopted(p).some(i=>!i.priceChecked||!i.quantityChecked||!i.reason.trim()||calc(i).unit===null))result.push('採用項目の確認が不足しています。');
  if(!p.settings.commonChecked||!p.settings.commonSource.trim())result.push('共通費・税・端数処理の適用根拠が未確認です。');
  if(totals(p).price<0)result.push('工事価格が負のため、控除と工事費を再確認してください。');
  return result;
 }
 function stamp(p=project()){return JSON.stringify({items:p.items,settings:p.settings,title:p.title,role:p.role});}
 function ready(){return issues().length===0&&project().approval?.snapshot===stamp();}
 function status(i){return ({candidate:'確認候補',hold:'保留',adopted:'採用済み',excluded:'今回対象外'})[i.state];}
 function render(){
  const p=project(),t=totals(),pending=p.items.filter(i=>i.state==='candidate').length;
  $('wb-project').innerHTML=data.projects.map(x=>`<option value="${h(x.id)}" ${p.id===x.id?'selected':''}>${x.role==='reference'?'参考｜':'今回｜'}${h(x.title)}</option>`).join('');
  $('wb-title').textContent=p.title;$('wb-role').textContent=p.role==='reference'?'参考資料からの候補':'今回工事';
  $('wb-copy').hidden=p.role!=='reference';
  $('wb-kpis').innerHTML=[['確認候補',pending],['保留',p.items.filter(i=>i.state==='hold').length],['採用',t.count],['採用明細計',money(t.direct)]].map(([label,value])=>`<div class="wb-kpi"><span>${h(label)}</span><strong>${h(value)}</strong></div>`).join('');
  $('wb-save-warning').hidden=!savingError;
  $('wb-next').textContent=ready()?'最終確認済みです。Excelを出力できます。':!t.count?'候補の数量・単価・根拠を確認し、採用してください。':issues()[0]||'明細の確認が揃いました。「最終確認する」で確定してください。';
  document.querySelectorAll('[data-wb-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.wbTab===activeTab);b.setAttribute('aria-selected',b.dataset.wbTab===activeTab?'true':'false');});
  $('wb-search-wrap').hidden=!['candidates','adopted'].includes(activeTab);
  let html='';
  if(activeTab==='candidates'||activeTab==='adopted'){
   const rows=p.items.filter(i=>(activeTab==='adopted'?i.state==='adopted':true)&&(!search||[i.name,i.spec,i.source.file,i.source.sheet,status(i)].join(' ').toLowerCase().includes(search.toLowerCase())));
   html=rows.length?`<div class="wb-items">${rows.map(i=>{const c=calc(i);return `<article class="wb-item"><div class="wb-item-top"><span class="wb-state ${i.state}">${status(i)}</span><span class="wb-muted">${h(i.category)}</span></div><h3>${h(i.name)}</h3><div class="wb-spec">${h(i.spec)||'規格の確認が必要'}</div><div class="wb-figures"><span>数量 <b>${h(i.quantity)} ${h(i.unit)}</b></span><span>単価 <b>${c.unit===null?'未取得':money(c.unit)}</b></span><span>金額 <b>${c.unit===null?'未計算':money(Math.floor(i.quantity*c.unit))}</b></span></div><div class="wb-muted wb-source">${h(i.source.file)}<br>${h(i.source.sheet)}・${h(i.source.priceCell)}${i.mismatch?' ｜ 原本の金額と数量×単価に差あり':''}</div><div class="wb-item-bottom"><span class="wb-muted">${h(i.reason||'今回条件の確認待ち')}</span><button data-wb-edit="${h(i.id)}">${i.state==='adopted'?'採用内容・根拠を見る':'確認する'}</button></div></article>`;}).join('')}</div>`:'<div class="wb-empty">'+(activeTab==='adopted'?'採用はまだ0件です。候補の「確認する」から採用できます。':'該当する項目がありません。')+'</div>';
  }else if(activeTab==='output'){
   const s=p.settings;
   html=`<div class="wb-output"><h3>採用した明細から作成</h3><p class="wb-muted">採用 ${t.count}件だけが、内訳書・代価表・採用一覧へ連動します。未採用項目は確認待ち一覧へ出力します。</p><div class="wb-total-rows">${[['採用明細計',t.direct],['共通仮設費',s.common],['現場管理費',s.management],['一般管理費等',s.general],['工事価格（端数処理後）',t.price],['消費税等',t.tax],['工事費合計',t.total],...(s.purpose==='予算用'?[[`予算額（${s.budget}%上乗せ）`,t.budget]]:[])].map(([n,v])=>`<div><span>${h(n)}</span><b>${money(v)}</b></div>`).join('')}</div><div class="wb-notice ${ready()?'':'warn'}">${ready()?'最終確認済み':issues().map(h).join('<br>')||'人による最終確認待ち'}</div><div class="wb-actions"><button id="wb-settings-open">共通費・出力設定</button><button id="wb-approve">最終確認する</button><button class="primary" id="wb-export">${ready()?'確認済み':'途中確認'}Excelを作成</button></div><p class="wb-muted">共通費の自動算定は未実装です。案件で算定・確認した金額と根拠を入力してください。今回のExcelは確認用の統一書式で、市の正式提出様式への転記は別途照合が必要です。</p></div>`;
  }else if(activeTab==='sources'){
   html=`<h3>この工事の資料</h3><div class="wb-actions"><button id="wb-upload">Excel・PDFなどを追加</button><button id="wb-manual">項目を手入力</button></div><div class="wb-docs">${p.documents.map((d,i)=>`<article><div><b>${h(d.name)}</b><p class="wb-muted">${h(d.type)} ｜ ${h(d.status)}</p></div><button data-wb-remove-doc="${i}">登録解除</button></article>`).join('')}</div><details><summary>公開基準資料（版・出典）</summary><div class="wb-docs">${WB_REFERENCES.map(r=>`<article><div><b>${h(r.title)}</b><p class="wb-muted">${h(r.version)} ｜ ${h(r.note)}</p><a href="${h(r.url)}" target="_blank" rel="noopener">公式資料を開く</a></div></article>`).join('')}</div><p class="wb-muted">公開原本を参照できる状態です。全表の単価マスタ化・PDF図面のAI読取は未実装。県単価表・画像見積は今回条件を確認して項目の根拠に登録してください。</p></details>`;
  }else{
   html=`<h3>変更と採用の記録</h3>${[...p.history].reverse().map(x=>`<article class="wb-history"><time>${h(new Date(x.at).toLocaleString('ja-JP'))}</time><b>${h(x.action)}</b><p>${h(x.detail)}</p></article>`).join('')||'<div class="wb-empty">操作履歴はまだありません。</div>'}`;
  }
  $('wb-content').innerHTML=html;
  $('wb-content').querySelectorAll('[data-wb-edit]').forEach(b=>b.onclick=()=>openItem(b.dataset.wbEdit));
  $('wb-content').querySelectorAll('[data-wb-remove-doc]').forEach(b=>b.onclick=()=>{
   const index=Number(b.dataset.wbRemoveDoc),d=p.documents[index];
   if(!confirm(d.name+' の資料登録を解除しますか？採用済み項目の根拠記録は保持します。'))return;
   p.documents.splice(index,1);log('資料登録解除',d.name);render();});
  if($('wb-settings-open'))$('wb-settings-open').onclick=openSettings;
  if($('wb-approve'))$('wb-approve').onclick=()=>{const problems=issues();if(problems.length){alert(problems.join('\n'));return;}if(!confirm('今回の数量・仕様・単価根拠と共通費を確認しましたか？'))return;
   p.history.push({at:new Date().toISOString(),action:'最終確認',detail:'採用'+t.count+'件・工事費'+money(t.total)});p.approval={at:new Date().toISOString(),snapshot:stamp()};save();render();};
  if($('wb-export'))$('wb-export').onclick=()=>{if(!t.count){alert('先に項目を採用してください。');return;}exportExcel();};
  if($('wb-upload'))$('wb-upload').onclick=()=>$('wb-files').click();
  if($('wb-manual'))$('wb-manual').onclick=()=>{const item={...candidatesBlank(),id:uid()};p.items.push(item);log('手入力候補を追加',item.id);render();openItem(item.id);};
 }
 function candidatesBlank(){return {name:'新しい項目',spec:'',quantity:1,unit:'個',unitPrice:null,source:{file:'手入力',sheet:'',row:0,quantityCell:'',priceCell:'',quantityFormula:'',priceFormula:'',sourceAmount:null},mode:'direct',material:0,quote:0,reduction:100,materialRate:0,electrician:0,ordinary:0,electricCoeff:0,ordinaryCoeff:0,laborRate:0,unitRounding:1,evidence:'',priceChecked:false,quantityChecked:false,state:'candidate',reason:'',category:'新設',mismatch:false};}
 function field(id,label,value,type='text',extra=''){return `<label>${h(label)}<input id="${id}" type="${type}" value="${h(value)}" ${extra}></label>`;}
 function openItem(id){
  editing=project().items.find(i=>i.id===id);if(!editing)return;const i=editing;
  $('wb-dialog-title').textContent='数量・単価・根拠の確認';
  $('wb-dialog-body').innerHTML=`<div class="wb-form">${field('wi-name','品名',i.name)}${field('wi-spec','規格・仕様',i.spec)}${field('wi-quantity','数量',i.quantity,'number','min="0" step="any"')}${field('wi-unit','単位',i.unit)}<label>工事区分<select id="wi-category">${['新設','撤去・処分','控除'].map(x=>`<option ${i.category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>単価の作り方<select id="wi-mode"><option value="direct" ${i.mode==='direct'?'selected':''}>確認した単価を使う</option><option value="compose" ${i.mode==='compose'?'selected':''}>材料費＋施工費を組み立てる</option></select></label></div><div id="wi-direct" class="wb-form">${field('wi-price','今回の採用単価（円）',i.unitPrice??'','number','step="any"')}</div><div id="wi-compose" class="wb-form">${field('wi-quote','材料の元価格（円）',i.quote,'number','min="0" step="any"')}${field('wi-reduction','採用率（％、55なら元価格×0.55）',i.reduction,'number','min="0" max="100" step="any"')}${field('wi-material-rate','材料への加算率（％）',i.materialRate,'number','min="0" step="any"')}${field('wi-electrician','電工単価（円/人）',i.electrician,'number','min="0" step="any"')}${field('wi-electric-coeff','電工歩掛り（人/単位）',i.electricCoeff,'number','min="0" step="any"')}${field('wi-ordinary','普通工単価（円/人）',i.ordinary,'number','min="0" step="any"')}${field('wi-ordinary-coeff','普通工歩掛り（人/単位）',i.ordinaryCoeff,'number','min="0" step="any"')}${field('wi-labor-rate','労務への加算率（％）',i.laborRate,'number','min="0" step="any"')}<label>単価端数処理<select id="wi-rounding">${[1,100,1000].map(n=>`<option value="${n}" ${i.unitRounding===n?'selected':''}>${n}円未満切捨て</option>`).join('')}</select></label></div><div class="wb-notice" id="wi-preview"></div><details open><summary>元資料の根拠</summary><p class="wb-muted">${h(i.source.file)} ｜ ${h(i.source.sheet)} ｜ 数量${h(i.source.quantityCell)}・単価${h(i.source.priceCell)}<br>数量式：${h(i.source.quantityFormula||'直接入力')}<br>単価式：${h(i.source.priceFormula||'直接入力')}<br>原本保存時の単価：${i.source.sourceUnitPrice===null?'未取得':money(i.source.sourceUnitPrice??i.unitPrice)} ／ 元金額：${i.source.sourceAmount===null?'未取得':money(i.source.sourceAmount)}${i.mismatch?'<br>注意：元金額と数量×単価に差があります。端数・数式を照合してください。':''}</p>${i.source.breakdown?`<div class="wb-notice"><b>元代価表の構成（保存済み計算結果）</b><p>${h(i.source.breakdown.sheet)}・${h(i.source.breakdown.unitCell)}<br>材料費 M${i.source.breakdown.row}：${i.source.breakdown.material===null?'未取得':money(i.source.breakdown.material)} ／ 施工費 Q${i.source.breakdown.row}：${i.source.breakdown.labor===null?'未取得':money(i.source.breakdown.labor)}<br>元低減率：${i.source.breakdown.reduction===null?'未取得':i.source.breakdown.reduction+'%'}<br><span class="wb-muted">材料式：${h(i.source.breakdown.materialFormula)}<br>施工式：${h(i.source.breakdown.laborFormula)}</span></p></div>`:''}</details><div class="wb-form">${field('wi-evidence','根拠資料・版・年月・ページ・適用条件',i.evidence)}${field('wi-reason','今回の採用／保留／対象外の理由',i.reason)}</div><label class="wb-check"><input id="wi-quantity-check" type="checkbox" ${i.quantityChecked?'checked':''}>今回の数量・仕様・更新対象を確認した</label><label class="wb-check"><input id="wi-price-check" type="checkbox" ${i.priceChecked?'checked':''}>単価の版・地域・単位・適用条件を確認した</label><p class="wb-muted">参考案件の価格は今回の正解とは限りません。組立単価の加算率・歩掛りは根拠に従って入力し、市場単価に含まれる費用を重ねて加算しないでください。</p><div class="wb-actions"><button id="wi-hold">保留して保存</button><button id="wi-exclude">今回は対象外</button><button class="primary" id="wi-adopt">採用する</button></div>`;
  const refresh=()=>{
   const compose=$('wi-mode').value==='compose';$('wi-compose').hidden=!compose;$('wi-direct').hidden=compose;
   try{const x=readItem(),c=calc(x);$('wi-preview').textContent=c.unit===null?'採用単価を入力してください。':`${compose?'材料費 '+money(c.material)+' ＋ 施工費 '+money(c.labor)+' → ':''}採用単価 ${money(c.unit)} ／ 金額 ${money(Math.floor(x.quantity*c.unit))}`;}catch{$('wi-preview').textContent='数量・単価・率を入力してください。';}
  };
  $('wb-dialog-body').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refresh));
  $('wi-adopt').onclick=()=>saveItem('adopted');$('wi-hold').onclick=()=>saveItem('hold');$('wi-exclude').onclick=()=>saveItem('excluded');refresh();$('wb-dialog').showModal();
 }
 function readNumber(id,{min=-Infinity,max=Infinity,nullable=false}={}){const v=$(id).value;if(nullable&&v==='')return null;const n=Number(v);if(!v.trim()||!Number.isFinite(n)||n<min||n>max)throw Error('数値の入力範囲を確認してください。');return n;}
 function readItem(){return {...editing,name:$('wi-name').value.trim(),spec:$('wi-spec').value.trim(),quantity:readNumber('wi-quantity',{min:0}),unit:$('wi-unit').value.trim(),category:$('wi-category').value,mode:$('wi-mode').value,unitPrice:readNumber('wi-price',{nullable:true}),quote:readNumber('wi-quote',{min:0}),reduction:readNumber('wi-reduction',{min:0,max:100}),materialRate:readNumber('wi-material-rate',{min:0}),electrician:readNumber('wi-electrician',{min:0}),electricCoeff:readNumber('wi-electric-coeff',{min:0}),ordinary:readNumber('wi-ordinary',{min:0}),ordinaryCoeff:readNumber('wi-ordinary-coeff',{min:0}),laborRate:readNumber('wi-labor-rate',{min:0}),unitRounding:Number($('wi-rounding').value),evidence:$('wi-evidence').value.trim(),reason:$('wi-reason').value.trim(),quantityChecked:$('wi-quantity-check').checked,priceChecked:$('wi-price-check').checked};}
 function saveItem(state){
  try{const i=readItem(),c=calc(i);
   if(!i.name||!i.unit)throw Error('品名と単位を入力してください。');
   if(!i.reason)throw Error('判断した理由を入力してください。');
   if(state==='adopted'&&(c.unit===null||!i.quantityChecked||!i.priceChecked||!i.evidence))throw Error('採用には単価・根拠資料と2つの確認チェックが必要です。');
   if(c.unit!==null&&c.unit<0&&i.category!=='控除')throw Error('負の単価は「控除」に分類してください。');
   i.state=state;i.confirmedAt=new Date().toISOString();const p=project();p.items[p.items.findIndex(x=>x.id===i.id)]=i;
   log(status(i),i.name+'｜数量 '+i.quantity+' '+i.unit+'｜単価 '+money(c.unit)+'｜'+i.reason);$('wb-dialog').close();render();
  }catch(e){alert(e.message);}
 }
 function openSettings(){const s=project().settings;
  $('wb-dialog-title').textContent='工事費・出力設定';
  $('wb-dialog-body').innerHTML=`<p class="wb-muted">共通費は今回の工事で算定済みの金額を入力します。0円の場合も、その理由を根拠欄に記録してください。</p><div class="wb-form">${field('ws-title','今回の工事件名',project().title)}${field('ws-year','適用年度',s.year)}<label>用途<select id="ws-purpose"><option ${s.purpose==='設計用'?'selected':''}>設計用</option><option ${s.purpose==='予算用'?'selected':''}>予算用</option></select></label>${field('ws-common','共通仮設費（円）',s.common,'number','min="0" step="1"')}${field('ws-management','現場管理費（円）',s.management,'number','min="0" step="1"')}${field('ws-general','一般管理費等（円）',s.general,'number','min="0" step="1"')}${field('ws-tax','消費税等率（％）',s.tax,'number','min="0" max="100" step="any"')}${field('ws-budget','予算上乗せ率（％）',s.budget,'number','min="0" step="any"')}<label>工事価格の端数処理<select id="ws-rounding">${[1,100,1000].map(n=>`<option value="${n}" ${s.rounding===n?'selected':''}>${n}円未満切捨て</option>`).join('')}</select></label>${field('ws-source','共通費・税・端数処理の根拠と適用条件',s.commonSource)}</div><label class="wb-check"><input id="ws-checked" type="checkbox" ${s.commonChecked?'checked':''}>今回条件での共通費・税・端数処理を確認した</label><div class="wb-actions"><button class="primary" id="ws-save">設定を保存</button></div>`;
  $('ws-save').onclick=()=>{try{const title=$('ws-title').value.trim(),year=$('ws-year').value.trim();if(!title||!year)throw Error('工事件名と適用年度を入力してください。');
   project().title=title;project().settings={year,purpose:$('ws-purpose').value,common:readNumber('ws-common',{min:0}),management:readNumber('ws-management',{min:0}),general:readNumber('ws-general',{min:0}),tax:readNumber('ws-tax',{min:0,max:100}),budget:readNumber('ws-budget',{min:0}),rounding:Number($('ws-rounding').value),commonSource:$('ws-source').value.trim(),commonChecked:$('ws-checked').checked};log('工事費設定を変更','共通費・税・端数処理を保存。最終確認を解除');$('wb-dialog').close();render();}catch(e){alert(e.message);}};
  $('wb-dialog').showModal();
 }
 function download(name,blob){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function backup(){download('設計書アプリ_作業バックアップ_'+new Date().toISOString().slice(0,10)+'.json',new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));}
 async function restore(file){try{if(file.size>30e6)throw Error('バックアップが大きすぎます。');const d=JSON.parse(await file.text());if(!validData(d))throw Error('この版の作業バックアップではないか、内容が不正です。');if(!confirm('現在の作業データをバックアップの内容へ置き換えますか？必要な作業は先にバックアップしてください。'))return;data=d;save();render();}catch(e){alert('復元できません：'+e.message);}}
 const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function column(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
 function exportExcel(){
  const p=project(),rows=adopted(),t=totals(),s=p.settings,checked=ready(),label=checked?'確認済み':'途中確認';
  const detail=[['内訳書',p.title,label],['名称','規格','区分','数量','単位','採用単価','金額','根拠資料','判断理由']];
  rows.forEach((i,k)=>{const r=k+3;detail.push([i.name,i.spec,i.category,i.quantity,i.unit,calc(i).unit,{f:`ROUNDDOWN(D${r}*F${r},0)`,v:Math.floor(i.quantity*calc(i).unit)},i.evidence,i.reason]);});
  const last=rows.length+2;detail.push(['採用明細計','','','','','',{f:`SUM(G3:G${last})`,v:t.direct}]);
  const summary=[['設計書',p.title,label],['適用年度',s.year],['用途',s.purpose],['項目','金額','根拠・計算'],['採用明細計',{f:`'内訳書'!G${last+1}`,v:t.direct},'採用 '+rows.length+'件'],['共通仮設費',s.common,s.commonSource],['現場管理費',s.management,s.commonSource],['一般管理費等',s.general,s.commonSource],['工事価格',{f:`ROUNDDOWN(SUM(B5:B8)/${s.rounding},0)*${s.rounding}`,v:t.price},s.rounding+'円未満切捨て'],['消費税等',{f:`ROUNDDOWN(B9*${s.tax}/100,0)`,v:t.tax},s.tax+'%'],['工事費合計',{f:'SUM(B9:B10)',v:t.total},'税を含む'],['予算上乗せ率',s.budget,'予算用途のみ加算'],['予算額',s.purpose==='予算用'?{f:`ROUNDUP(B11*(1+B12/100),0)`,v:t.budget}:null,s.purpose==='予算用'?'合計×予算係数、1円未満切上げ':'設計用のため加算なし'],['作成時点',new Date().toISOString()],['出力用途','確認用統一書式','市の正式提出様式への転記・適用は別途照合'],['状態',label,issues().join(' ／ ')||'人による最終確認済み']];
  const price=[['代価表',p.title],['名称','規格','方式','材料元価格','採用率%','材料加算率%','材料費','電工単価','電工歩掛り','普通工単価','普通工歩掛り','労務加算率%','施工費','端数処理単位','採用単価','根拠']];
  rows.forEach((i,k)=>{const r=k+3,c=calc(i);price.push([i.name,i.spec,i.mode==='compose'?'材料＋施工':'単価直接',i.mode==='compose'?i.quote:null,i.mode==='compose'?i.reduction:null,i.mode==='compose'?i.materialRate:null,i.mode==='compose'?{f:`D${r}*E${r}/100*(1+F${r}/100)`,v:c.material}:null,i.mode==='compose'?i.electrician:null,i.mode==='compose'?i.electricCoeff:null,i.mode==='compose'?i.ordinary:null,i.mode==='compose'?i.ordinaryCoeff:null,i.mode==='compose'?i.laborRate:null,i.mode==='compose'?{f:`(H${r}*I${r}+J${r}*K${r})*(1+L${r}/100)`,v:c.labor}:null,i.unitRounding,i.mode==='compose'?{f:`ROUNDDOWN((G${r}+M${r})/N${r},0)*N${r}`,v:c.unit}:c.unit,i.evidence]);});
  const trace=[['正式採用一覧',p.title,label],['品名','規格','数量','単位','採用単価','元ファイル','元シート','数量セル','単価セル','元数量式','元単価式','単価根拠','採用理由','採用時刻']];
  rows.forEach(i=>trace.push([i.name,i.spec,i.quantity,i.unit,calc(i).unit,i.source.file,i.source.sheet,i.source.quantityCell,i.source.priceCell,i.source.quantityFormula,i.source.priceFormula,i.evidence,i.reason,i.confirmedAt]));
  const pending=[['確認待ち一覧',p.title],['品名','規格','数量','単位','状態','理由','元ファイル','元シート','元セル']];p.items.filter(i=>i.state!=='adopted').forEach(i=>pending.push([i.name,i.spec,i.quantity,i.unit,status(i),i.reason,i.source.file,i.source.sheet,i.source.priceCell]));
  const sheets=[['設計書',summary],['内訳書',detail],['代価表',price],['正式採用一覧',trace],['確認待ち一覧',pending]];
  const files={},enc=new TextEncoder(),add=(path,text)=>files[path]=enc.encode(text);
  add('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name],i)=>`<sheet name="${name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
  add('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add('xl/styles.xml','<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Yu Gothic"/></font><font><b/><sz val="11"/><name val="Yu Gothic"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF12345A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFill="1" applyFont="1"><alignment wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  sheets.forEach(([name,values],index)=>{
   const header=name==='設計書'?4:2;
   add(`xl/worksheets/sheet${index+1}.xml`,`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${header}" topLeftCell="A${header+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({length:Math.max(...values.map(r=>r.length))},(_,k)=>`<col min="${k+1}" max="${k+1}" width="${k===0?32:k===1?40:k>=7?35:18}" customWidth="1"/>`).join('')}</cols><sheetData>${values.map((r,ri)=>`<row r="${ri+1}" ht="${ri===header-1?32:38}" customHeight="1">${r.map((v,ci)=>{const ref=column(ci+1)+(ri+1),style=ri===header-1?1:(typeof v==='number'||v&&typeof v==='object'?2:0);if(v===null||v===undefined)return '';if(v&&typeof v==='object')return `<c r="${ref}" s="${style}"><f>${xml(v.f)}</f><v>${v.v}</v></c>`;return typeof v==='number'?`<c r="${ref}" s="${style}"><v>${v}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="8" fitToWidth="1" fitToHeight="0"/></worksheet>`);
  });
  const bytes=zipStore(files);download(`【${label}】設計書_${p.title.replace(/[\\/:*?"<>|]/g,'_')}_Stage5.59.xlsx`,new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  p.history.push({at:new Date().toISOString(),action:'Excel出力',detail:label+'｜採用'+rows.length+'件｜工事費'+money(t.total)});save();render();
 }
 async function parseWorkbook(file){
  if(file.size>30e6)throw Error('Excelは30MB以内で追加してください。');
  const archive=await unzipSimple(new Uint8Array(await file.arrayBuffer())),decoder=new TextDecoder();
  const doc=path=>{if(!archive[path])throw Error('Excelの構成が読み取れません：'+path);const d=new DOMParser().parseFromString(decoder.decode(archive[path]),'application/xml');if(d.querySelector('parsererror'))throw Error('ExcelのXMLが不正です。');return d;};
  const textContent=e=>[...e.getElementsByTagName('t')].filter(t=>t.parentElement?.localName!=='rPh').map(x=>x.textContent).join('');
  const ss=archive['xl/sharedStrings.xml']?[...doc('xl/sharedStrings.xml').getElementsByTagName('si')].map(textContent):[];
  const rels=new Map([...doc('xl/_rels/workbook.xml.rels').getElementsByTagName('Relationship')].map(x=>[x.getAttribute('Id'),x.getAttribute('Target')]));
  const source={id:uid(),filename:file.name,sheets:[],issues:[]};
  for(const sh of doc('xl/workbook.xml').getElementsByTagName('sheet')){
   const target=rels.get(sh.getAttribute('r:id'));if(!target)continue;
   const parts=(target.startsWith('/')?target.slice(1):'xl/'+target).split('/'),normal=[];for(const part of parts){if(part==='..')normal.pop();else if(part!=='.')normal.push(part);}const path=normal.join('/');
   const sheet={name:sh.getAttribute('name'),rows:[]};
   for(const row of doc(path).getElementsByTagName('row')){
    const cells={};for(const cell of row.getElementsByTagName('c')){
     const ref=cell.getAttribute('r'),type=cell.getAttribute('t'),formula=cell.getElementsByTagName('f')[0]?.textContent||null;
     let value=cell.getElementsByTagName('v')[0]?.textContent??null;
     if(type==='s')value=ss[Number(value)]??null;else if(type==='inlineStr')value=textContent(cell);else if(value!==null&&type!=='e'){const n=Number(value);if(Number.isFinite(n))value=n;}
     cells[ref.replace(/\d+$/,'')]={value,formula,type};
    }sheet.rows.push({row:Number(row.getAttribute('r')),cells});
   }source.sheets.push(sheet);
  }return source;
 }
 async function addFiles(files){
  const targetProject=project();$('wb-import-status').textContent='資料を読み込んでいます…';
  for(const file of files){
   try{
    if(/\.xlsx$/i.test(file.name)){
     const source=await parseWorkbook(file),rows=candidates(source);data.customSources.push(source);
     targetProject.items.push(...rows);targetProject.documents.push({name:file.name,type:'Excel',status:rows.length?rows.length+'件の候補を抽出。今回条件は未確認':'シート構成を取得。対応する内訳明細は未検出',sourceId:source.id});
     targetProject.history.push({at:new Date().toISOString(),action:'Excel読込',detail:file.name+'｜候補'+rows.length+'件'});
    }else{
     targetProject.documents.push({name:file.name,type:/\.pdf$/i.test(file.name)?'PDF':'その他',status:'資料名を登録。内容の自動読取は未実装（原本は端末で保管）'});
     targetProject.history.push({at:new Date().toISOString(),action:'資料名を登録',detail:file.name});
    }
    targetProject.approval=null;save();
   }catch(e){alert(file.name+' の読込に失敗しました：'+e.message+'\n既存データは保持されています。');}
  }
  $('wb-import-status').textContent='読込が終わりました。候補の数量・仕様・単価を確認してください。';$('wb-files').value='';render();
 }
 $('wb-project').onchange=e=>{data.selected=e.target.value;save();search='';$('wb-search').value='';render();};
 $('wb-copy').onclick=()=>{const p=project(),title=prompt('今回の工事件名を入力してください。',p.title);if(!title?.trim())return;const copy=JSON.parse(JSON.stringify(p));copy.id=uid();copy.title=title.trim();copy.role='current';copy.approval=null;copy.history=[];copy.settings.commonChecked=false;
  copy.items.forEach(i=>{i.id=uid();i.state='candidate';i.quantityChecked=false;i.priceChecked=false;i.reason='';});data.projects.push(copy);data.selected=copy.id;log('今回工事を作成','参考工事 '+p.title+' から候補をコピー。今回の確認は未実施');render();};
 $('wb-new').onclick=()=>{const title=prompt('新しい工事件名を入力してください。');if(!title?.trim())return;const p={id:uid(),title:title.trim(),role:'current',sourceId:null,settings:defaultSettings(),items:[],documents:[],history:[],approval:null};data.projects.push(p);data.selected=p.id;log('新規工事',title.trim());render();};
 document.querySelectorAll('[data-wb-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.wbTab;render();});
 $('wb-search').oninput=e=>{search=e.target.value;render();};
 $('wb-backup').onclick=backup;$('wb-restore').onclick=()=>$('wb-backup-file').click();
 $('wb-backup-file').onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value='';};
 $('wb-files').onchange=e=>addFiles([...e.target.files]);$('wb-dialog-close').onclick=()=>$('wb-dialog').close();
 $('wb-dialog').addEventListener('click',e=>{if(e.target===$('wb-dialog'))$('wb-dialog').close();});
 window.WB={calc,totals,issues,project,adopted,ready,backup,parseWorkbook,exportExcel};
 save();render();
})();
