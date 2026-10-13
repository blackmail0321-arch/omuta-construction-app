/* Stage5.59: real-workbook candidate workflow. No network calls. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), key='design_workbench_559';
 const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const trunc=v=>Math.trunc(Number(v.toPrecision(15))),floor=v=>Math.floor(Number(v.toPrecision(15)));
 const money=n=>Number(n||0).toLocaleString('ja-JP',{maximumFractionDigits:2})+'円';
 const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const uid=()=>globalThis.crypto?.randomUUID?.()||'id'+Date.now()+Math.random().toString(36).slice(2);
 const defaultSettings=()=>({year:'令和8年度',tax:10,calculationBasis:4,referenceRevision:7,workType:'改修',budget:20,purpose:'設計用',rounding:1,directRounding:1000,commonStack:0,location:'',contractPeriod:'',overview:'',person:'',durationMonths:0,common:0,management:0,general:0,commonSource:SourceCalculation.basis,commonChecked:false});
 function candidates(source){
  const list=[];
  for(const sheet of source.sheets){
   if(!/(内訳書|^設計書\(電気\)$)/.test(sheet.name.trim()))continue;
   const directStart=Math.max(0,...sheet.rows.filter(r=>r.row>25&&r.cells.B?.value==='直接工事費'&&/Ⅰ|I|１|1/.test(String(r.cells.A?.value||''))).map(r=>r.row));
   for(const row of sheet.rows){
    if(row.row<=directStart)continue;
    const c=row.cells,v=col=>c[col]?.value;
    if(typeof v('B')!=='string'||num(v('D'))===null||typeof v('E')!=='string'||!v('E').trim())continue;
    if(/^(直接工事費|共通仮設費|現場管理費|一般管理費|工事価格|消費税|工事費|合計|計|小計|純工事費|工事原価)/.test(v('B').trim()))continue;
    const amountOnly=num(v('F'))===null&&!c.F?.formula&&num(v('G'))!==null&&v('D')>0;
    if(num(v('F'))===null && !c.F?.formula&&!amountOnly)continue;
    if(amountOnly&&/^\+?\s*\$?G\$?\d+\s*$/.test(c.G?.formula||''))continue;
    const id=source.id+'-'+sheet.name+'-'+row.row;
    const quantity=num(v('D')),amount=num(v('G')),unit=amountOnly?amount/quantity:num(v('F'));
    list.push({id,name:v('B').trim(),spec:String(v('C')??''),quantity,unit:String(v('E')).trim(),unitPrice:unit,
     source:{file:source.filename,sheet:sheet.name,row:row.row,quantityCell:'D'+row.row,priceCell:(amountOnly?'G':'F')+row.row,fromAmount:amountOnly,amountCell:'G'+row.row,
      quantityFormula:c.D?.formula||'',priceFormula:c.F?.formula||'',amountFormula:c.G?.formula||'',sourceAmount:amount,sourceUnitPrice:unit},
     mode:'direct',material:0,quote:0,reduction:100,materialRate:0,electrician:0,ordinary:0,electricCoeff:0,ordinaryCoeff:0,laborRate:0,unitRounding:1,
     excludeCommon:/みなと小学校|勝立地区公民館/.test(source.filename)&&num(v('I'))!==null&&v('I')!==0,evidence:amountOnly?'添付Excelの保存済み金額÷数量。原本は金額指定のため、今回条件を照合':'添付Excelの保存済み単価。今回条件の照合が必要',priceChecked:false,quantityChecked:false,
     state:'candidate',reason:'',category:unit<0||/スクラップ|有価|控除/.test(v('B'))?'控除':/撤去|処分|廃棄/.test(v('B')+' '+String(v('C')??''))?'撤去・処分':'新設',
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
 function isAsbestosSurvey(i){return /(石綿|アスベスト)/.test(i.name)&&/調査/.test(i.name);}
 function migrate(){data.projects.forEach(p=>{const s=p.settings;if(s.calculationBasis!==4){s.previousCalculation={common:s.common,management:s.management,general:s.general,budget:s.budget};s.calculationBasis=4;s.workType='改修';s.budget=Number.isFinite(s.budget)?s.budget:20;s.directRounding=1000;s.rounding=1;s.commonChecked=false;p.approval=null;}if(s.commonStack===undefined)s.commonStack=0;if(s.referenceRevision!==7){s.referenceRevision=7;s.commonChecked=false;p.approval=null;}if(!s.commonSource)s.commonSource=SourceCalculation.basis;});WB_SOURCES.forEach(source=>{if(!data.projects.some(p=>p.sourceId===source.id))data.projects.push(makeProject(source));});}migrate();
 let newDraft=null;
 let activeTab='candidates',search='',editing=null,savingError=false;
 function validItem(i){return i&&(i.directRoundingApplied===undefined||typeof i.directRoundingApplied==='boolean')&&(i.excludeCommon===undefined||typeof i.excludeCommon==='boolean')&&typeof i.id==='string'&&typeof i.name==='string'&&Number.isFinite(i.quantity)&&i.quantity>=0&&
  (i.unitPrice===null||Number.isFinite(i.unitPrice))&&typeof i.unit==='string'&&['candidate','hold','adopted','excluded'].includes(i.state)&&
  ['direct','compose'].includes(i.mode)&&['quantityChecked','priceChecked'].every(k=>typeof i[k]==='boolean')&&typeof i.reason==='string'&&i.source&&typeof i.source.file==='string'&&
  ['quote','reduction','materialRate','electrician','ordinary','electricCoeff','ordinaryCoeff','laborRate'].every(k=>Number.isFinite(i[k])&&i[k]>=0)&&i.reduction<=100&&[1,10,100,1000,'source'].includes(i.unitRounding);}
 function validWorkflow(p){
  const c=p.contract;if(c!==undefined){if(!c||typeof c!=='object'||Array.isArray(c))return false;if(c.checked!==undefined&&typeof c.checked!=='boolean')return false;if(c.contractAmount!==undefined&&c.contractAmount!==null&&(!Number.isFinite(c.contractAmount)||c.contractAmount<0))return false;for(const k of ['contractDate','startDate','plannedEnd','completionDate','inspectionDate','subcontractDate','changeDate'])if(c[k]!==undefined&&(!validDate(c[k])))return false;for(const k of ['supervision','subcontract','advance','designated','asbestos','equipmentOnly'])if(c[k]!==undefined&&!['unknown','yes','no'].includes(c[k]))return false;}
  if(p.submissionRecords!==undefined){if(!p.submissionRecords||typeof p.submissionRecords!=='object'||Array.isArray(p.submissionRecords))return false;for(const r of Object.values(p.submissionRecords)){if(!r||!['未提出','提出済','差戻し','確認済み','対象外'].includes(r.status)||['dueDate','submittedAt','confirmedAt'].some(k=>r[k]!==undefined&&!validDate(r[k])))return false;}}
  return p.submissionFiles===undefined||Array.isArray(p.submissionFiles)&&p.submissionFiles.every(f=>f&&typeof f.id==='string'&&typeof f.name==='string'&&Number.isFinite(f.size)&&f.size>=0&&typeof f.folder==='string');
 }
 function validDate(v){return typeof v==='string'&&(v===''||/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);}
 function validData(d){return d&&d.version===559&&Array.isArray(d.projects)&&d.projects.length>0&&d.projects.length<200&&d.projects.every(p=>p&&typeof p.id==='string'&&typeof p.title==='string'&&['reference','current'].includes(p.role)&&Array.isArray(p.items)&&p.items.every(validItem)&&Array.isArray(p.documents)&&Array.isArray(p.history)&&p.settings&&Number.isFinite(p.settings.tax)&&p.settings.tax>=0&&p.settings.tax<=100&&[1,100,1000].includes(p.settings.rounding)&&['設計用','予算用'].includes(p.settings.purpose)&&['budget','common','management','general'].every(k=>Number.isFinite(p.settings[k])&&p.settings[k]>=0)&&validPriceRecords(p)&&validWorkflow(p))&&Array.isArray(d.customSources);}
 function validPriceRecords(p){if(p.settings.laborRates&&(typeof p.settings.laborRates!=='object'||Object.values(p.settings.laborRates).some(x=>!x||!Number.isFinite(x.electrician)||x.electrician<0||!Number.isFinite(x.ordinary)||x.ordinary<0||typeof x.source!=='string')))return false;if(p.settings.workType!==undefined&&!['新築','改修'].includes(p.settings.workType))return false;if(p.settings.durationMonths!==undefined&&(!Number.isFinite(p.settings.durationMonths)||p.settings.durationMonths<0))return false;if(![undefined,1,100,1000].includes(p.settings.directRounding)||(p.settings.commonStack!==undefined&&(!Number.isFinite(p.settings.commonStack)||p.settings.commonStack<0)))return false;return p.priceRecords===undefined||(Array.isArray(p.priceRecords)&&p.priceRecords.every(r=>r&&typeof r.name==='string'&&typeof r.spec==='string'&&typeof r.unit==='string'&&Number.isFinite(r.unitPrice)&&r.unitPrice>=0&&['設計単価','材料価格'].includes(r.priceKind)&&typeof r.conditions==='string'&&r.source&&typeof r.source.file==='string'));}
 const project=()=>data.projects.find(p=>p.id===data.selected)||data.projects[0];
 function save(){try{localStorage.setItem(key,JSON.stringify(data));savingError=false;}catch{savingError=true;}}
 function log(action,detail){const p=project();p.history.push({at:new Date().toISOString(),action,detail});p.approval=null;save();}
 function calc(i){
  if(i.mode==='direct')return {unit:i.unitPrice!==null&&i.directRoundingApplied&&i.unitRounding!=='source'?trunc(i.unitPrice/i.unitRounding)*i.unitRounding:i.unitPrice,material:null,labor:null,raw:i.unitPrice};
  const materialBase=floor(i.quote*i.reduction/100),material=materialBase+floor(materialBase*i.materialRate/100);
  const electricAmount=trunc(i.electrician*i.electricCoeff),ordinaryAmount=trunc(i.ordinary*i.ordinaryCoeff),laborBase=electricAmount+ordinaryAmount;
  const labor=laborBase+floor(laborBase*i.laborRate/100),raw=Math.trunc(material+labor);
  const r=i.unitRounding==='source'?(raw>=1000?10**(Math.floor(Math.log10(raw))-2):1):i.unitRounding;
  return {unit:trunc(raw/r)*r,material,labor,raw,materialBase,laborBase,electricAmount,ordinaryAmount};
 }
 function adopted(p=project()){return p.items.filter(i=>i.state==='adopted');}
 function totals(p=project()){
  const rows=adopted(p),s=p.settings,rawDirect=rows.reduce((n,i)=>n+trunc(i.quantity*calc(i).unit),0),dr=s.directRounding||1000;
  const direct=trunc(rawDirect*(s.purpose==='予算用'?1+s.budget/100:1)/dr)*dr;
  const special=Math.trunc(rows.filter(i=>i.excludeCommon).reduce((n,i)=>n+trunc(i.quantity*calc(i).unit),0)/1000)*1000;
  const stack=rows.filter(isAsbestosSurvey).reduce((n,i)=>n+Math.max(0,trunc(i.quantity*calc(i).unit)),0);
  let common=0,management=0,general=0,method='',rates=[],formulaError='';
  if(rows.length){try{if(!(s.durationMonths>0))throw Error('共通費算定の工期（月）を入力してください。');if(!(direct>special))throw Error('直接工事費から共通費対象外を除いた額が0円以下です。');const c=SourceCalculation.calculate({G7:s.workType||'改修',G9:direct/1000,G11:special/1000,G15:s.durationMonths,G20:stack/1000});({common,management,general,method,rates}=c);}catch(e){formulaError=e.message;}}
  const price=trunc((direct+common+management+general)/s.rounding)*s.rounding;
  const tax=price*s.tax/100,total=price+tax,budget=Math.ceil(total/10000)*10000;
  return {rawDirect,direct,special,stack,common,management,general,method,rates,formulaError,price,tax,total,budget,count:rows.length};
 }
 function issues(p=project()){
  const result=[];
  if(p.role==='reference')result.push('参考工事です。「今回の工事として作成」してから正式確認してください。');
  if(!adopted(p).length)result.push('採用された項目がありません。');
  const pending=p.items.filter(i=>!['adopted','excluded'].includes(i.state));if(pending.length)result.push('候補・保留が'+pending.length+'件あります。採用または今回は対象外にしてください。');
  if(adopted(p).some(i=>!i.priceChecked||!i.quantityChecked||!i.reason.trim()||calc(i).unit===null))result.push('採用項目の確認が不足しています。');
  if(!p.settings.commonChecked||!p.settings.commonSource.trim())result.push('共通費・税・端数処理の適用根拠が未確認です。');
  if(totals(p).formulaError)result.push(totals(p).formulaError);
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
   html=rows.length?`<div class="wb-items">${rows.map(i=>{const c=calc(i);return `<article class="wb-item"><div class="wb-item-top"><span class="wb-state ${i.state}">${status(i)}</span><span class="wb-muted">${h(i.category)}</span></div><h3>${h(i.name)}</h3><div class="wb-spec">${h(i.spec)||'規格の確認が必要'}</div><div class="wb-figures"><span>数量 <b>${h(i.quantity)} ${h(i.unit)}</b></span><span>単価 <b>${c.unit===null?'未取得':money(c.unit)}</b></span><span>金額 <b>${c.unit===null?'未計算':money(Math.trunc(i.quantity*c.unit))}</b></span></div><div class="wb-muted wb-source">${h(i.source.file)}<br>${h(i.source.sheet)}・${h(i.source.priceCell)}${i.mismatch?' ｜ 原本の金額と数量×単価に差あり':''}</div><div class="wb-item-bottom"><span class="wb-muted">${h(i.reason||'今回条件の確認待ち')}</span><button data-wb-edit="${h(i.id)}">${i.state==='adopted'?'採用内容・根拠を見る':'確認する'}</button></div></article>`;}).join('')}</div>`:'<div class="wb-empty">'+(activeTab==='adopted'?'採用はまだ0件です。候補の「確認する」から採用できます。':'該当する項目がありません。')+'</div>';
  }else if(activeTab==='output'){
   const s=p.settings;
   html=`<div class="wb-output"><h3>採用した明細から作成</h3><p class="wb-muted">採用 ${t.count}件だけが、内訳書・代価表・採用一覧へ連動します。未採用項目は確認待ち一覧へ出力します。</p><div class="wb-total-rows">${[['採用明細計（加算前）',t.rawDirect],['直接工事費',t.direct],['共通費対象外',t.special],['積上げ分（石綿事前調査費のみ）',t.stack],['共通仮設費',t.common],['現場管理費',t.management],['一般管理費等',t.general],['工事価格（端数処理後）',t.price],['消費税等',t.tax],['工事費合計',t.total],...(s.purpose==='予算用'?[['予算見積額（1万円単位切上げ）',t.budget]]:[])].map(([n,v])=>`<div><span>${h(n)}</span><b>${t.formulaError&&!['採用明細計（加算前）','直接工事費','共通費対象外'].includes(n)?'未算定':money(v)}</b></div>`).join('')}</div><div class="wb-notice ${ready()?'':'warn'}">${ready()?'最終確認済み':issues().map(h).join('<br>')||'人による最終確認待ち'}</div><div class="wb-actions"><button id="wb-settings-open">共通費・出力設定</button><button id="wb-approve">最終確認する</button><button class="primary" id="wb-export">${ready()?'確認済み':'途中確認'}Excelを作成</button></div><p class="wb-muted">予算用：みなと小学校様式／設計用：勝立地区公民館様式。共通費は予算Excelの電気設備数式で算定します。採用区分：${h(t.method||'条件入力待ち')}。予算用は直接工事費に物価上昇率を加えてから共通費を計算します。</p></div>`;
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
  if($('wb-manual'))$('wb-manual').onclick=openNewItem;
  $('wb-add-material').onclick=openNewItem;$('wb-setup-top').onclick=openSettings;
  $('wb-workflow-next').innerHTML=p.role==='reference'?'①「今回の工事として作成」から始めてください。':'① 材料を追加・候補を確認 → ② 数量・単価の2つのチェック → ③ 工期（月）を入力 → ④ Excel出力 → ⑤ 契約後の提出書類へ';
  window.dispatchEvent(new Event('wb-render'));
 }
 function publicCode(s){const x=String(s||'').normalize('NFKC').toUpperCase();return (x.match(/(?:^|[^A-Z0-9])((?:L|K|SK)[A-Z0-9/]+(?:\s*-[A-Z0-9/]+){1,5})/)?.[1]||x.match(/(?:^|[^A-Z0-9])([A-Z]{1,3}\d{2,4}[A-Z]?)(?=$|[^A-Z0-9])/)?.[1]||'').replace(/\s/g,'');}
 const laborOfficial={year:'令和8年度',electrician:28900,ordinary:24100,source:'福岡県 公共工事設計労務単価 令和8年3月12日適用',url:'https://www.pref.fukuoka.lg.jp/uploaded/life/806690_62804471_misc.pdf'};
 function laborDefault(p=project(),year=p.settings.year){return p.settings.laborRates?.[year]||(year.replace(/\s/g,'')==='令和8年度'?laborOfficial:{year,electrician:0,ordinary:0,source:'この年度の労務単価は未登録',url:''});}
 function openNewItem(){if(project().role==='reference'){alert('上部の「今回の工事として作成」または「新規工事」から今回の工事を作成してください。');return;}newDraft={...candidatesBlank(),id:uid(),name:'',quantity:0,source:{...candidatesBlank().source,file:'手入力・追加材料'}};openItem(newDraft.id);}
 function candidatesBlank(){const ld=laborDefault();return {excludeCommon:false,name:'新しい項目',spec:'',quantity:1,unit:'個',unitPrice:null,source:{file:'手入力',sheet:'',row:0,quantityCell:'',priceCell:'',quantityFormula:'',priceFormula:'',sourceAmount:null},mode:'direct',material:0,quote:0,reduction:100,materialRate:0,electrician:ld.electrician,ordinary:ld.ordinary,electricCoeff:0,ordinaryCoeff:0,laborRate:0,unitRounding:'source',evidence:'',priceChecked:false,quantityChecked:false,state:'candidate',reason:'',category:'新設',mismatch:false};}
 function field(id,label,value,type='text',extra=''){const required=['wi-name','wi-quantity','wi-unit','wi-price','wi-evidence','ws-months'].includes(id);return `<label class="${required?'input-required':''}">${h(label)}${required?' <small>入力</small>':''}<input id="${id}" type="${type}" value="${h(value)}" ${extra}></label>`;}
 function reasonField(value){const options=['図面数量・仕様と単価根拠を確認した','県単価の適用条件を確認して採用した','見積比較結果に基づき採用した','公共型番・寸法・取付条件が一致した','代用歩掛りの妥当性を確認した','追加・訂正項目として採用した','根拠資料不足のため保留した','今回工事の対象外と判断した'];return `<label>採用・保留等の理由（選択または入力）<select id="wi-reason-preset" aria-label="採用理由の候補"><option value="">候補から選ぶ／自由入力</option>${options.map(x=>`<option value="${h(x)}" ${value===x?'selected':''}>${h(x)}</option>`).join('')}</select><input id="wi-reason" type="text" value="${h(value)}" placeholder="選んだ理由を編集・追記できます" aria-label="採用理由の自由入力"></label>`;}
 function openItem(id){
  editing=project().items.find(i=>i.id===id)||newDraft;if(!editing)return;const i=editing,ld=laborDefault(),autoLabor=i.state!=='adopted';
  $('wb-dialog-title').textContent=newDraft?.id===i.id?'材料を追加（図面がなくても入力できます）':'数量・単価・根拠の確認';
  $('wb-dialog-body').innerHTML=`<div class="input-guide">① 品名・規格・数量を入力　② 単価または材料＋施工を入力　③ 根拠と採用理由を入力　④ 下の2つをチェックして採用</div><div class="wb-form">${field('wi-name','品名',i.name)}${field('wi-spec','規格・仕様',i.spec)}${field('wi-public-type','公共型番（読み取った候補を訂正可）',i.publicType||publicCode(i.spec))}${field('wi-quantity','数量',i.quantity,'number','min="0" step="any"')}${field('wi-unit','単位',i.unit)}<label>工事区分<select id="wi-category">${['新設','撤去・処分','控除'].map(x=>`<option ${i.category===x?'selected':''}>${x}</option>`).join('')}</select></label><label>単価の作り方<select id="wi-mode"><option value="direct" ${i.mode==='direct'?'selected':''}>確認した単価を使う</option><option value="compose" ${i.mode==='compose'?'selected':''}>材料費＋施工費を組み立てる</option></select></label></div><div id="wi-direct" class="wb-form">${field('wi-price','今回の採用単価（円）',i.unitPrice??'','number','step="any"')}</div><p class="wb-muted">年度別労務単価：${h(ld.year)}／${h(ld.source)}。変更は工期・計算条件から。明細内でも変更できます。</p><div id="wi-compose" class="wb-form">${field('wi-quote','材料の元価格（円）',i.quote,'number','min="0" step="any"')}${field('wi-reduction','低減率（％、55なら元価格×0.55）',i.reduction,'number','min="0" max="100" step="any"')}${field('wi-material-rate','雑材料率（％）',i.materialRate,'number','min="0" step="any"')}${field('wi-electrician','電工単価（円/人日）',autoLabor&&i.electrician===0?ld.electrician:i.electrician,'number','min="0" step="any"')}${field('wi-electric-coeff','電工歩掛り（人/単位）',i.electricCoeff,'number','min="0" step="any"')}${field('wi-ordinary','普通工単価（円/人日）',autoLabor&&i.ordinary===0?ld.ordinary:i.ordinary,'number','min="0" step="any"')}${field('wi-ordinary-coeff','普通工歩掛り（人/単位）',i.ordinaryCoeff,'number','min="0" step="any"')}${field('wi-labor-rate','その他率（％、電工＋普通工の労務費に乗じる）',i.laborRate,'number','min="0" step="any"')}<label>単価端数処理<select id="wi-rounding"><option value="source" ${i.unitRounding==='source'?'selected':''}>添付式：1,000円以上は有効3桁</option>${[1,10,100,1000].map(n=>`<option value="${n}" ${i.unitRounding===n?'selected':''}>${n}円未満切捨て</option>`).join('')}</select></label></div><div class="wb-notice" id="wi-preview"></div><details open><summary>参照情報（入力不要）</summary><p class="wb-muted">${h(i.source.file)} ｜ ${h(i.source.sheet)} ｜ 数量${h(i.source.quantityCell)}・単価${h(i.source.priceCell)}<br>数量式：${h(i.source.quantityFormula||'直接入力')}<br>単価式：${h(i.source.priceFormula||'直接入力')}<br>原本保存時の単価：${i.source.sourceUnitPrice===null?'未取得':money(i.source.sourceUnitPrice??i.unitPrice)} ／ 元金額：${i.source.sourceAmount===null?'未取得':money(i.source.sourceAmount)}${i.mismatch?'<br>注意：元金額と数量×単価に差があります。端数・数式を照合してください。':''}</p>${i.source.breakdown?`<div class="wb-notice"><b>元代価表の構成（保存済み計算結果）</b><p>${h(i.source.breakdown.sheet)}・${h(i.source.breakdown.unitCell)}<br>材料費 M${i.source.breakdown.row}：${i.source.breakdown.material===null?'未取得':money(i.source.breakdown.material)} ／ 施工費 Q${i.source.breakdown.row}：${i.source.breakdown.labor===null?'未取得':money(i.source.breakdown.labor)}<br>元低減率：${i.source.breakdown.reduction===null?'未取得':i.source.breakdown.reduction+'%'}<br><span class="wb-muted">材料式：${h(i.source.breakdown.materialFormula)}<br>施工式：${h(i.source.breakdown.laborFormula)}</span></p></div>`:''}</details><div class="wb-form"></div><details open><summary>単価の参照元（営繕・メーカー・刊行物）</summary><div class="wb-form"><label>価格資料<select id="wi-ref-type">${['未選択','営繕工事標準単価表','県単価','メーカー資料','建設物価','建築コスト情報','見積','過去Excel'].map(v=>`<option ${i.priceReference?.type===v?'selected':''}>${v}</option>`).join('')}</select></label>${field('wi-ref-name','資料名',i.priceReference?.name||'')}${field('wi-ref-edition','年度・版・年月・地域',i.priceReference?.edition||'')}${field('wi-ref-location','ページ・表番号・行／Excelセル',i.priceReference?.location||'')}${field('wi-maker','メーカー名',i.priceReference?.manufacturer||'')}${field('wi-model','メーカー型番',i.priceReference?.model||'')}${field('wi-maker-price','メーカー単価（円/単位、変更可）',i.priceReference?.manufacturerPrice??(i.priceReference?.manufacturer?(i.mode==='compose'?i.quote:i.unitPrice):''),'number','min="0" step="any"')}</div><p class="wb-muted">公共型番が不明でも、品名・仕様と単価表の掲載箇所から照合できます。材料価格と施工込み単価を区別してください。</p></details><div class="wb-form">${field('wi-evidence','根拠資料・版・年月・ページ・適用条件',i.evidence)}${reasonField(i.reason)}</div><p class="wb-muted">品名に「石綿」または「アスベスト」と「調査」を含む採用明細は、積上げ分に自動反映します。処分・除去費は含めません。</p><label class="wb-check"><input id="wi-special" type="checkbox" ${i.excludeCommon?'checked':''}>共通費対象外（内訳書I列へ。処分費等の適用を確認）</label><label class="wb-check"><input id="wi-quantity-check" type="checkbox" ${i.quantityChecked?'checked':''}>今回の数量・仕様・更新対象を確認した</label><label class="wb-check"><input id="wi-price-check" type="checkbox" ${i.priceChecked?'checked':''}>単価の版・地域・単位・適用条件を確認した</label><p class="wb-muted">参考案件の価格は今回の正解とは限りません。組立単価の加算率・歩掛りは根拠に従って入力し、市場単価に含まれる費用を重ねて加算しないでください。</p><div class="wb-actions"><button id="wi-hold">保留して保存</button><button id="wi-exclude">今回は対象外</button><button class="primary" id="wi-adopt">採用する</button></div>`;
  const refresh=()=>{
   const compose=$('wi-mode').value==='compose';$('wi-compose').hidden=!compose;$('wi-direct').hidden=compose;
   try{const x=readItem(),c=calc(x);$('wi-preview').textContent=c.unit===null?'採用単価を入力してください。':`${compose?'材料費 '+money(c.material)+' ＋ 施工費 '+money(c.labor)+' → ':''}採用単価 ${money(c.unit)} ／ 金額 ${money(Math.trunc(x.quantity*c.unit))}`;}catch{$('wi-preview').textContent='数量・単価・率を入力してください。';}
  };
  $('wi-rounding').addEventListener('input',()=>{$('wi-rounding').dataset.changed='1';});
  for(const id of ['wi-name','wi-spec','wi-quantity','wi-unit','wi-category','wi-public-type'])$(id).addEventListener('input',()=>{$('wi-quantity-check').checked=false;});
  for(const id of ['wi-mode','wi-price','wi-quote','wi-reduction','wi-material-rate','wi-electrician','wi-electric-coeff','wi-ordinary','wi-ordinary-coeff','wi-labor-rate','wi-rounding','wi-ref-type','wi-ref-name','wi-ref-edition','wi-ref-location','wi-maker','wi-model','wi-maker-price'])$(id).addEventListener('input',()=>{$('wi-price-check').checked=false;});
  $('wb-dialog-body').querySelectorAll('input,select').forEach(el=>el.addEventListener('input',refresh));
  $('wi-reason-preset').onchange=e=>{if(e.target.value){$('wi-reason').value=e.target.value;$('wi-reason').dispatchEvent(new Event('input'));}};$('wi-adopt').onclick=()=>saveItem('adopted');$('wi-hold').onclick=()=>saveItem('hold');$('wi-exclude').onclick=()=>saveItem('excluded');window.dispatchEvent(new CustomEvent('wb-edit',{detail:{item:i}}));refresh();$('wb-dialog').showModal();
 }
 function readNumber(id,{min=-Infinity,max=Infinity,nullable=false}={}){const v=$(id).value===''&&$(id).dataset.zeroCleared==='1'?'0':$(id).value;if(nullable&&v==='')return null;const n=Number(v);if(!v.trim()||!Number.isFinite(n)||n<min||n>max)throw Error('数値の入力範囲を確認してください。');return n;}
 function readItem(){return {...editing,name:$('wi-name').value.trim(),spec:$('wi-spec').value.trim(),publicType:$('wi-public-type').value.trim().normalize('NFKC').toUpperCase(),publicationPrices:window.EDIT09?EDIT09.readPublications():editing.publicationPrices,priceReference:{type:$('wi-ref-type').value,name:$('wi-ref-name').value.trim(),edition:$('wi-ref-edition').value.trim(),location:$('wi-ref-location').value.trim(),manufacturer:$('wi-maker').value.trim(),model:$('wi-model').value.trim(),manufacturerPrice:readNumber('wi-maker-price',{nullable:true,min:0})},laborYear:project().settings.year,laborSource:(Number($('wi-electrician').value)===laborDefault().electrician&&Number($('wi-ordinary').value)===laborDefault().ordinary?laborDefault().source:'明細で手動設定／基準：'+laborDefault().source),quantity:readNumber('wi-quantity',{min:0}),unit:$('wi-unit').value.trim(),category:$('wi-category').value,mode:$('wi-mode').value,unitPrice:readNumber('wi-price',{nullable:true}),quote:readNumber('wi-quote',{min:0}),reduction:readNumber('wi-reduction',{min:0,max:100}),materialRate:readNumber('wi-material-rate',{min:0}),electrician:readNumber('wi-electrician',{min:0}),electricCoeff:readNumber('wi-electric-coeff',{min:0}),ordinary:readNumber('wi-ordinary',{min:0}),ordinaryCoeff:readNumber('wi-ordinary-coeff',{min:0}),laborRate:readNumber('wi-labor-rate',{min:0}),directRoundingApplied:editing.directRoundingApplied===true||$('wi-rounding').dataset.changed==='1',unitRounding:$('wi-rounding').value==='source'?'source':Number($('wi-rounding').value),excludeCommon:$('wi-special').checked,evidence:$('wi-evidence').value.trim(),reason:$('wi-reason').value.trim(),quantityChecked:$('wi-quantity-check').checked,priceChecked:$('wi-price-check').checked};}
 function saveItem(state){
  try{const i=readItem(),c=calc(i);
   if(!i.name||!i.unit)throw Error('品名と単位を入力してください。');
   if(!i.reason)throw Error('判断した理由を入力してください。');
   if(state==='adopted'&&(c.unit===null||i.quantity<=0||!i.quantityChecked||!i.priceChecked||!i.evidence))throw Error('採用には正の数量・単価・根拠資料と2つの確認チェックが必要です。');
   if(state==='adopted'&&i.mode==='compose'&&(i.electricCoeff>0&&i.electrician<=0||i.ordinaryCoeff>0&&i.ordinary<=0))throw Error('使用する職種の年度別労務単価を入力してください。');
   if(c.unit!==null&&c.unit<0&&i.category!=='控除')throw Error('負の単価は「控除」に分類してください。');
   i.state=state;i.confirmedAt=new Date().toISOString();const p=project();const index=p.items.findIndex(x=>x.id===i.id);if(index<0)p.items.push(i);else p.items[index]=i;newDraft=null;
   log(status(i),i.name+'｜数量 '+i.quantity+' '+i.unit+'｜単価 '+money(c.unit)+'｜'+i.reason);$('wb-dialog').close();render();
  }catch(e){alert(e.message);}
 }
 function openSettings(){const s=project().settings,t=totals(),ld=laborDefault();
  $('wb-dialog-title').textContent='工事費・出力設定';
  $('wb-dialog-body').innerHTML=`<p class="wb-muted">共通費は予算Excelの数式で算定します。工期・工事区分・積上げ額を確認してください。予算用の物価上昇率は初期値20%です。今回の条件に応じて変更できます。</p><div class="wb-form">${field('ws-title','今回の工事件名',project().title)}${field('ws-year','適用年度',s.year)}${field('ws-electrician','年度の電工単価（円/人日、変更可）',ld.electrician,'number','min="0"')}${field('ws-ordinary','年度の普通工単価（円/人日、変更可）',ld.ordinary,'number','min="0"')}${field('ws-labor-source','年度別労務単価の根拠・適用日',ld.source)}<label class="wb-check"><input type="checkbox" id="ws-apply-labor">既存の組立明細にも反映（単価の再確認が必要）</label>${field('ws-location','工事場所',s.location||'')}${field('ws-period','工期の表記（例：契約翌日から90日間）',s.contractPeriod||'')}${field('ws-overview','工事概要',s.overview||'')}${field('ws-person','担当者',s.person||'')}${field('ws-months','必須：共通費を計算する工期（月、3カ月なら3）',s.durationMonths||'','number','min="0" step="any" placeholder="例：3"')}<label>工事区分<select id="ws-type">${['改修','新築'].map(n=>`<option ${s.workType===n?'selected':''}>${n}</option>`).join('')}</select></label><label>用途・様式<select id="ws-purpose"><option ${s.purpose==='設計用'?'selected':''}>設計用</option><option ${s.purpose==='予算用'?'selected':''}>予算用</option></select></label>${field('ws-stack','予算用の積上げ額（円）',s.commonStack||0,'number','min="0" step="1"')+'<p class="wb-muted" id="ws-stack-help"></p>'}${field('ws-tax','消費税等率（％）',s.tax,'number','min="0" max="100" step="any"')}${field('ws-budget','予算の物価上昇率（％、直接工事費へ加算）',s.budget,'number','min="0" step="any"')}<label>直接工事費の端数処理<select id="ws-direct-rounding">${[1,100,1000].map(n=>`<option value="${n}" ${(s.directRounding||1000)===n?'selected':''}>${n}円未満切捨て</option>`).join('')}</select></label><label>工事価格の端数処理<select id="ws-rounding">${[1,100,1000].map(n=>`<option value="${n}" ${s.rounding===n?'selected':''}>${n}円未満切捨て</option>`).join('')}</select></label>${field('ws-source','今回の算定条件・適用根拠',s.commonSource)}</div><p>現在の算定：${t.formulaError?'未算定（下の不足事項を確認）':'共通仮設費 '+money(t.common)+'／現場管理費 '+money(t.management)+'／一般管理費等 '+money(t.general)}<br>${h(t.formulaError||t.method)}</p><label class="wb-check"><input id="ws-checked" type="checkbox" ${s.commonChecked?'checked':''}>今回の工期・工事区分・税・端数処理を確認した</label><div class="wb-actions"><button class="primary" id="ws-save">設定を保存</button></div>`;
  let budgetStack=String(s.purpose==='設計用'?(s.savedBudgetStack??s.commonStack??0):(s.commonStack||0)),budgetRate=String(s.purpose==='設計用'?(s.savedBudgetRate??s.budget??20):s.budget),purposeInitialized=false;const updatePurpose=()=>{if(purposeInitialized&&!$('ws-budget').disabled){budgetStack=$('ws-stack').value;budgetRate=$('ws-budget').value;}purposeInitialized=true;const design=$('ws-purpose').value==='設計用';$('ws-stack').disabled=true;$('ws-budget').disabled=design;$('ws-stack').value=design?'0':String(t.stack);$('ws-budget').value=design?'0':budgetRate;$('ws-stack-help').textContent=design?'電気設備の積上分は、採用した石綿事前調査費のみ自動反映します。現在 '+money(t.stack)+'。':'予算用も石綿事前調査費のみ自動反映します。現在 '+money(t.stack)+'。';};$('ws-purpose').onchange=updatePurpose;updatePurpose();
  $('ws-year').onchange=()=>{const x=laborDefault(project(),$('ws-year').value.trim());$('ws-electrician').value=x.electrician;$('ws-ordinary').value=x.ordinary;$('ws-labor-source').value=x.source;};
  $('ws-save').onclick=()=>{try{const title=$('ws-title').value.trim(),year=$('ws-year').value.trim();if(!title||!year)throw Error('工事件名と適用年度を入力してください。');const labor={year,electrician:readNumber('ws-electrician',{min:0}),ordinary:readNumber('ws-ordinary',{min:0}),source:$('ws-labor-source').value.trim()};if(!labor.source)throw Error('労務単価の根拠を入力してください。');if($('ws-apply-labor').checked)project().items.filter(i=>i.mode==='compose').forEach(i=>{i.electrician=labor.electrician;i.ordinary=labor.ordinary;i.laborYear=year;i.laborSource=labor.source;i.priceChecked=false;if(i.state==='adopted')i.state='candidate';});project().title=title;project().settings={...s,laborRates:{...(s.laborRates||{}),[year]:labor},calculationBasis:4,referenceRevision:7,savedBudgetStack:Number($('ws-purpose').value==='設計用'?budgetStack:$('ws-stack').value),savedBudgetRate:Number($('ws-purpose').value==='設計用'?budgetRate:$('ws-budget').value),workType:$('ws-type').value,year,location:$('ws-location').value.trim(),contractPeriod:$('ws-period').value.trim(),overview:$('ws-overview').value.trim(),person:$('ws-person').value.trim(),durationMonths:readNumber('ws-months',{min:0}),commonStack:0,directRounding:Number($('ws-direct-rounding').value),purpose:$('ws-purpose').value,tax:readNumber('ws-tax',{min:0,max:100}),budget:$('ws-purpose').value==='設計用'?0:readNumber('ws-budget',{min:0}),rounding:Number($('ws-rounding').value),commonSource:$('ws-source').value.trim(),commonChecked:$('ws-checked').checked};log('工事費設定を変更','原本数式の算定条件を保存。最終確認を解除');$('wb-dialog').close();render();}catch(e){alert(e.message);}};
  $('wb-dialog').showModal();
 }
 function download(name,blob){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function backup(){download('設計書アプリ_作業バックアップ_'+new Date().toISOString().slice(0,10)+'.json',new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));}
 async function restore(file){try{if(file.size>30e6)throw Error('バックアップが大きすぎます。');const d=JSON.parse(await file.text());if(!validData(d))throw Error('この版の作業バックアップではないか、内容が不正です。');if(!confirm('現在の作業データをバックアップの内容へ置き換えますか？必要な作業は先にバックアップしてください。'))return;data=d;migrate();save();render();}catch(e){alert('復元できません：'+e.message);}}
 const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 function column(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
 function exportExcel(){
  if(!window.TemplateExport){alert('Excel出力機能を読み込めません。アプリを開き直してください。');return;}
  window.TemplateExport.export().catch(e=>alert('Excel出力に失敗しました：'+e.message+' 作業データは保持されています。'));
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
     targetProject.documents.push({name:file.name,type:/\.pdf$/i.test(file.name)?'PDF':'その他',status:'資料名を登録。内容は資料読取画面または直接入力で確認'});
     targetProject.history.push({at:new Date().toISOString(),action:'資料名を登録',detail:file.name});
    }
    if(window.SUBMISSIONS&&targetProject.role==='current')try{await SUBMISSIONS.storeDesignFile(file,targetProject);}catch(e){alert('読込内容は保存しましたが、原本ファイルの保管に失敗しました：'+e.message);}
    targetProject.approval=null;save();
   }catch(e){alert(file.name+' の読込に失敗しました：'+e.message+'\n既存データは保持されています。');}
  }
  $('wb-import-status').textContent='読込が終わりました。候補の数量・仕様・単価を確認してください。';$('wb-files').value='';render();
 }
 $('wb-project').onchange=e=>{data.selected=e.target.value;save();search='';$('wb-search').value='';render();};
 $('wb-copy').onclick=()=>{const p=project(),title=prompt('今回の工事件名を入力してください。',p.title);if(!title?.trim())return;const copy=JSON.parse(JSON.stringify(p));copy.id=uid();copy.title=title.trim();copy.role='current';copy.approval=null;copy.history=[];copy.settings.commonChecked=false;delete copy.contract;delete copy.submissionRecords;delete copy.submissionFiles;
  copy.items.forEach(i=>{i.id=uid();i.state='candidate';i.quantityChecked=false;i.priceChecked=false;i.reason='';});data.projects.push(copy);data.selected=copy.id;log('今回工事を作成','参考工事 '+p.title+' から候補をコピー。今回の確認は未実施');render();};
 $('wb-new').onclick=()=>{const title=prompt('新しい工事件名を入力してください。');if(!title?.trim())return;const p={id:uid(),title:title.trim(),role:'current',sourceId:null,settings:defaultSettings(),items:[],documents:[],history:[],approval:null};data.projects.push(p);data.selected=p.id;log('新規工事',title.trim());render();};
 document.querySelectorAll('[data-wb-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.wbTab;render();});
 $('wb-search').oninput=e=>{search=e.target.value;render();};
 $('wb-backup').onclick=backup;$('wb-restore').onclick=()=>$('wb-backup-file').click();
 $('wb-backup-file').onchange=e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value='';};
 $('wb-files').onchange=e=>addFiles([...e.target.files]);$('wb-dialog-close').onclick=()=>$('wb-dialog').close();
 $('wb-dialog').addEventListener('click',e=>{if(e.target===$('wb-dialog'))$('wb-dialog').close();});
 window.WB={publicCode,laborDefault,isAsbestosSurvey,validProject:p=>validData({version:559,projects:[p],selected:p.id,customSources:[]}),restoreProject:p=>{if(!validData({version:559,projects:[p],selected:p.id,customSources:[]}))throw Error('工事データが不正です');const k=data.projects.findIndex(x=>x.id===p.id);if(k<0)data.projects.push(p);else data.projects[k]=p;data.selected=p.id;migrate();save();render();},openNewItem,openSettings,record:(action,detail)=>{project().history.push({at:new Date().toISOString(),action,detail});save();render();},amount:i=>trunc(i.quantity*calc(i).unit),calc,totals,issues,project,adopted,ready,backup,parseWorkbook,exportExcel,
  projects:()=>data.projects,render,openItem,persist:()=>{save();render();},
  select:id=>{if(data.projects.some(p=>p.id===id)){data.selected=id;save();render();}},
  addCandidate:(fields,target=project())=>{const item={...candidatesBlank(),...fields,id:uid(),state:'candidate',quantityChecked:false,priceChecked:false,reason:''};if(!validItem(item))throw Error('候補の数量・単価・形式を確認してください。');target.items.push(item);target.approval=null;target.history.push({at:new Date().toISOString(),action:'資料から候補を追加',detail:item.name+'｜'+item.source.file});save();render();return item;},
  mutate:(action,detail)=>{log(action,detail);render();}};
 save();render();
})();
