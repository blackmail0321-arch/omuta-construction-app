(function(){
'use strict';
const C=PlannerCore,INITIAL=window.PLANNER_INITIAL,KEY='april-note.records.v1',RECOVERY='april-note.before-import.v1';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const now=today();let year=Math.max(2000,Math.min(2098,C.fy(now))),month=Number(now.slice(5,7)),view='calendar',editing=null,pending=null,searchDates=[],searchPage=0,blocked=false,dirty=false;
let records={},allowances={},pendingAllowances=null,revision=null;
function show(msg,error=false){$('notice').textContent=msg;$('notice').hidden=false;$('notice').classList.toggle('warning',error);}
function warning(msg){$('storage-warning').textContent=msg;$('storage-warning').hidden=false;}
function snapshot(r=records,a=allowances){return {app:'april-note',schemaVersion:2,exportedAt:new Date().toISOString(),records:r,allowances:a};}
function decode(raw){const data=JSON.parse(raw);if(data.app!=='april-note'||![1,2].includes(data.schemaVersion))throw Error('このアプリの対応バックアップではありません。');return C.validateRecords(data.records);}
try{
 revision=localStorage.getItem(KEY);
 if(revision){records=decode(revision);allowances=C.validateAllowances(JSON.parse(revision).allowances);}else{records=C.validateRecords(INITIAL.records);const value=JSON.stringify(snapshot(records));localStorage.setItem(KEY,value);revision=value;}
}catch(e){
 if(revision){blocked=true;warning('保存データを読み込めません。上書き防止のため編集を停止しています。ブラウザの保存データを消さず、別ブラウザでバックアップから復元してください。');}
 else{records=C.validateRecords(INITIAL.records);warning('このブラウザでは保存を利用できません。変更は保存できないため、通常モードで開いてください。元データの閲覧とバックアップは利用できます。');}
}
function commit(next,nextAllowances=allowances){
 if(blocked)throw Error('保存データの保護のため編集を停止しています。');
 const existing=localStorage.getItem(KEY);if(existing!==revision)throw Error('別のタブでデータが変更されました。編集内容を控えてから、この画面を再読み込みしてください。');
 const value=JSON.stringify(snapshot(next,nextAllowances));localStorage.setItem(KEY,value);revision=value;records=next;allowances=nextAllowances;
}
function download(name,data,type='application/json'){const blob=new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);}
function backup(prefix='予定と休暇_バックアップ',data=records){download(`${prefix}_${today()}_${Date.now()}.json`,JSON.stringify(snapshot(data),null,2));}
function preserve(){
 // Failure to keep an on-device recovery copy aborts the merge.
 localStorage.setItem(RECOVERY,JSON.stringify(snapshot(records)));
 backup('取り込み前_予定と休暇');
}
const hcache=new Map();function holiday(s){const y=Number(s.slice(0,4));if(!hcache.has(y))hcache.set(y,C.holidays(y,INITIAL.holidays));return hcache.get(y)[s]||'';}
const weekday=s=>new Date(s+'T00:00:00Z').getUTCDay();
const human=s=>{const [y,m,d]=s.split('-').map(Number);return `${y}年${m}月${d}日（${'日月火水木金土'[weekday(s)]}）`;};
const caption=r=>[r.contentTop?'予定：'+r.contentTop:'',r.actualContent?'実施：'+r.actualContent:'',r.contentBottom?'旧下段：'+r.contentBottom:''].filter(Boolean).join(' / ');
function badges(r){return (r.upper?`<span class="chip upper">${esc(C.UPPER[r.upper])}</span>`:'')+(r.lower?`<span class="chip">${esc(C.LOWER[r.lower])}</span>`:'');}
function range(){return `${year}.04.01 — ${year+1}.03.31`;}
function setSelects(){
 $('fiscal-year').innerHTML=Array.from({length:99},(_,i)=>`<option value="${2000+i}">${2000+i}年度</option>`).join('');
 $('search-month').innerHTML+=[...Array(12)].map((_,i)=>`<option value="${i+1}">${i+1}月</option>`).join('');
 $('search-day').innerHTML+=[...Array(31)].map((_,i)=>`<option value="${i+1}">${i+1}日</option>`).join('');
 $('search-year').value=now.slice(0,4);
 for(const [id,options] of [['edit-upper',C.UPPER],['edit-lower',C.LOWER]])$(id).innerHTML=(id==='edit-lower'?['','有','夏','子','病','出','喪','1','2','3','4','5','6','7']:Object.keys(options)).map(v=>[v,options[v]]).map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join('');
 $('source-info').textContent=`「${INITIAL.source}」の入力済み${INITIAL.importedDays}日分を含みます。上段・下段の内容とメモを保持しています。このHTML自体にも元の記録が含まれるため、第三者への配布にはご注意ください。`;
}
function render(){
 $('fiscal-year').value=year;$('year-range').textContent=range();$('fiscal-label').textContent=`${year}年度 · APRIL — MARCH`;
 $('prev-year').disabled=year<=2000;$('next-year').disabled=year>=2098;
 const titles={calendar:'予定を、ひと目で。',annual:'一年の流れを、見渡す。',summary:'休暇の利用状況。',search:'あの日の予定を、探す。'};
 $('page-title').textContent=titles[view];$('view-label').textContent={calendar:'MY SCHEDULE',annual:'FISCAL YEAR',summary:'LEAVE SUMMARY',search:'FIND YOUR DAY'}[view];
 $('page-description').textContent=view==='search'?'年・月・日とキーワードで、必要な記録へ。':view==='summary'?'取得日数・残日数・時間休の利用可能時間を、年度ごとに確認。':'仕事の予定も、休暇の記録も。4月からの一年をまとめて。';
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
 for(const v of ['calendar','annual','summary','search'])$(v+'-view').hidden=v!==view;
 const t=C.totals(records,year);$('stat-paid').innerHTML=`${t.paid}<small>日</small>`;$('stat-hours').innerHTML=`${t.hours}<small>時間</small>`;$('stat-child').innerHTML=`${t.childHours}<small>時間</small>`;$('stat-days').innerHTML=`${t.registered}<small>日</small>`;$('stat-hour-count').textContent=`${t.hourCount}回の記録`;$('stat-child-count').textContent=`${t.childHourCount}回の記録`;renderLeaveStatus(t);
 if(view==='calendar')renderCalendar();if(view==='annual')renderAnnual();if(view==='summary')renderSummary();if(view==='search'&&searchDates.length)renderSearch();
}
function renderCalendar(){
 const cy=year+(month<4?1:0),n=C.days(cy,month),offset=C.date(cy,month,1).getUTCDay();
 $('month-title').textContent=`${cy}年 ${month}月`;
 const index=C.months(year).findIndex(a=>a.month===month);
 $('prev-month').disabled=year===2000&&index===0;$('next-month').disabled=year===2098&&index===11;
 $('month-tabs').innerHTML=C.months(year).map(a=>`<button data-month="${a.month}" class="${a.month===month?'selected':''}" aria-pressed="${a.month===month}">${a.month}月</button>`).join('');
 let html='';const count=Math.ceil((offset+n)/7)*7;
 for(let i=0;i<count;i++){
  const day=i-offset+1;
  if(day<1||day>n){const other=C.date(cy,month,day);html+=`<div class="day outside" aria-hidden="true"><span class="day-number">${other.getUTCDate()}</span></div>`;continue;}
  const s=C.iso(C.date(cy,month,day)),h=holiday(s),w=weekday(s),r=records[s]||C.empty();
  const classes=['day',w===6?'saturday':w===0?'sunday':'',h?'is-holiday':'',s===now?'is-today':''];
  html+=`<button class="${classes.join(' ')}" data-date="${s}" aria-label="${esc(human(s)+' '+h+' '+(C.UPPER[r.upper]||'')+' '+(C.LOWER[r.lower]||'')+' '+caption(r))}"><span class="day-header"><span class="day-number ${h||w===0?'sun':w===6?'sat':''}">${day}</span>${h?`<span class="holiday-name" title="${esc(h)}">${esc(h)}</span>`:''}</span>${badges(r)}${comparisonBlocks(r)}${r.memoTop||r.memoBottom||r.actualMemo?'<span class="memo-dot">・メモあり</span>':''}</button>`;
 }
 $('calendar').innerHTML=html;
}
function comparisonBlocks(r){
 const planned=r.contentTop||r.memoTop,actual=r.actualContent||r.actualMemo,legacy=r.contentBottom||r.memoBottom;
 if(!planned&&!actual&&!legacy)return '';
 return `<span class="plan-block"><b>予定</b><span>${esc(r.contentTop|| (r.memoTop?'メモあり':'未入力'))}</span></span><span class="actual-block"><b>実施</b><span>${esc(r.actualContent||(r.actualMemo?'メモあり':'未記録'))}</span></span>${legacy?'<span class="legacy-indicator">旧下段あり（未分類）</span>':''}`;
}
function recordTable(dates){
 return `<div class="table-scroll"><table><thead><tr><th>日付・休暇</th><th>予定</th><th>実施</th><th>比較・旧下段</th></tr></thead><tbody>${dates.map(s=>{const r=records[s]||C.empty(),w=weekday(s),h=holiday(s);return `<tr><td class="date-col"><button class="date-link ${h||w===0?'sun':w===6?'sat':''}" data-date="${s}">${esc(s.slice(5).replace('-','/'))}（${'日月火水木金土'[w]}）</button>${h?`<span class="holiday-name" title="${esc(h)}">${esc(h)}</span>`:''}<div>${badges(r)}</div></td><td class="text-col">${esc(r.contentTop)||'—'}${r.memoTop?`<div class="comparison-memo">メモ：${esc(r.memoTop)}</div>`:''}</td><td class="text-col">${esc(r.actualContent)||'未記録'}${r.actualMemo?`<div class="comparison-memo">メモ：${esc(r.actualMemo)}</div>`:''}</td><td class="text-col"><span class="comparison-status">${C.comparison(r)}</span>${r.contentBottom||r.memoBottom?`<details class="legacy-details"><summary>旧下段（未分類）</summary><div>${esc(r.contentBottom)}</div><div>${esc(r.memoBottom)}</div></details>`:''}</td></tr>`;}).join('')}</tbody></table></div>`;
}

function renderAnnual(){
 const only=$('record-only').checked;
 $('annual-content').innerHTML=C.months(year).map(a=>{const dates=Array.from({length:C.days(a.year,a.month)},(_,i)=>C.iso(C.date(a.year,a.month,i+1))).filter(s=>!only||records[s]);return `<section class="month-section"><h3>${a.year}年 ${a.month}月 <span>${dates.length}日表示</span></h3>${dates.length?recordTable(dates):'<div class="empty-state">この月の記録はまだありません。カレンダーの日付から入力できます。</div>'}</section>`;}).join('');
}
const leaveTypes=[['paid','有給休暇'],['sick','病気休暇'],['child','子の看護休暇'],['summer','夏季休暇'],['mourning','喪休']];
const amount=n=>Number(n.toFixed(4)).toLocaleString('ja-JP',{maximumFractionDigits:4});
function dayTime(hours,d){const n=Math.abs(hours),days=Math.floor((n+1e-8)/d),rest=Math.max(0,n-days*d);return `${hours<0?'−':''}${days}日 ${amount(rest)}時間`;}
function remainingDays(n,d,withHours=false){if(n===null)return '未設定';if(n<0)return `超過 ${withHours?dayTime(-n*d,d):amount(-n)+'日'}`;return withHours?dayTime(n*d,d):amount(n)+'日';}
function available(n){return n===null?'上限未設定':n<0?`超過 ${amount(-n)}時間`:`あと ${amount(n)}時間 利用可`;}
function renderLeaveStatus(t){
 const p=allowances[year]||C.defaultAllowance(),u=C.usage(t,p),d=p.hoursPerDay;
 $('paid-balance').textContent=`取得 ${t.paid}日 / 残り ${remainingDays(u.paidRemaining,d,p.hoursDeductPaid)}${p.paid===null?'（付与日数を設定）':''}`;
 $('stat-hours').innerHTML=`${Math.floor(t.hours/d)}<small>日</small> ${amount(t.hours%d)}<small>時間 使用</small>`;
 $('stat-child').innerHTML=`${Math.floor(t.childHours/d)}<small>日</small> ${amount(t.childHours%d)}<small>時間 使用</small>`;
 $('stat-hour-count').textContent=`計${t.hours}時間・${t.hourCount}回 / ${available(u.hoursRemaining)}`;
 $('stat-child-count').textContent=`計${t.childHours}時間・${t.childHourCount}回 / ${available(u.childHoursRemaining)}`;
 $('leave-status').innerHTML=leaveTypes.map(([k,label])=>{
  const remain=k==='paid'?u.paidRemaining:k==='child'?u.childRemaining:p[k]===null?null:p[k]-t[k];
  return `<article><h3>${label}</h3><p class="leave-used">取得 <b>${t[k]}</b> 日</p><p>付与・繰越 ${p[k]===null?'未設定':amount(p[k])+'日'}</p><p class="${remain!==null&&remain<0?'over-limit':''}">残り <b>${remainingDays(remain,d,k==='paid'?p.hoursDeductPaid:k==='child'?p.childHoursDeductChild:false)}</b></p></article>`;
 }).join('')+`<article><h3>出張・遅参・振替など</h3><p>出張 ${t.trip}日 / 遅参 ${t.late}回 / 早退 ${t.early}回</p><p>子遅 ${t.childLate}回 / 子早 ${t.childEarly}回</p><p>振替 ${t.substitute}回 / AM ${t.am}回 / PM ${t.pm}回</p></article>`;
 $('allowance-note').textContent=`${year}年度の登録済み記録（未来日の予定も含む）を集計。時間休は1日${d}時間換算。通常の時間休は${p.hoursDeductPaid?'有給からも差し引き':'有給とは別枠'}、子の時間休は${p.childHoursDeductChild?'子の看護休暇からも差し引き':'子の看護休暇とは別枠'}です。`;
}
function openAllowance(){
 const p=allowances[year]||C.defaultAllowance();$('allowance-year').textContent=`${year}年度（${year}年4月〜${year+1}年3月）`;
 const fields=[...leaveTypes.map(([k,n])=>[k,n+'の付与・繰越（日）']),['hours','通常の時間休の年間上限（時間）'],['childHours','子の時間休の年間上限（時間）'],['hoursPerDay','1日を何時間として換算するか']];
 $('allowance-fields').innerHTML=fields.map(([k,label])=>`<label>${label}<input id="allowance-${k}" type="number" min="${k==='hoursPerDay'?1:0}" max="${k==='hoursPerDay'?24:10000}" step="${k==='hoursPerDay'?1:'0.01'}" ${k==='hoursPerDay'?'required':''} value="${p[k]??''}" placeholder="未設定"></label>`).join('');
 $('allowance-hoursDeductPaid').checked=p.hoursDeductPaid;$('allowance-childHoursDeductChild').checked=p.childHoursDeductChild;$('allowance-error').textContent='';$('allowance-dialog').showModal();
}

const metrics=[['paid','有給','日'],['sick','病気','日'],['child','子の看護','日'],['summer','夏季','日'],['mourning','喪休','日'],['trip','出張','日'],['late','遅参','回'],['early','早退','回'],['childLate','子遅','回'],['childEarly','子早','回'],['substitute','振替','回'],['am','AM振替','回'],['pm','PM振替','回'],['hourCount','時間休','回'],['hours','時間休','時間'],['childHourCount','子の時間休','回'],['childHours','子の時間休','時間']];
function renderSummary(){
 const total=C.totals(records,year);
 const cells=t=>metrics.map(([k])=>`<td>${t[k]}</td>`).join('');
 $('summary-content').innerHTML=`<div class="table-scroll"><table class="summary-table"><thead><tr><th>月</th>${metrics.map(([,n,u])=>`<th>${n}<br>（${u}）</th>`).join('')}</tr></thead><tbody>${C.months(year).map(a=>`<tr><td>${a.year}/${String(a.month).padStart(2,'0')}</td>${cells(C.totals(records,year,a.month))}</tr>`).join('')}</tbody><tfoot><tr><td>年度合計</td>${cells(total)}</tr></tfoot></table></div><p class="footnote">時間休：${total.hours}時間＝${Math.floor(total.hours/(allowances[year]?.hoursPerDay||8))}日と${total.hours%(allowances[year]?.hoursPerDay||8)}時間 ／ 子の時間休：${total.childHours}時間＝${Math.floor(total.childHours/(allowances[year]?.hoursPerDay||8))}日と${total.childHours%(allowances[year]?.hoursPerDay||8)}時間（1日${allowances[year]?.hoursPerDay||8}時間換算）</p>`;
}
function setView(v){view=v;render();}
function monthStep(step){const m=C.months(year).findIndex(a=>a.month===month)+step;if(m<0){if(year<=2000)return;year--;month=3;}else if(m>11){if(year>=2098)return;year++;month=4;}else month=C.months(year)[m].month;render();}
function openDate(s){if(!C.valid(s))return;editing=s;dirty=false;const r=records[s]||C.empty();$('editor-title').textContent=human(s);$('editor-fy').textContent=`${C.fy(s)}年度 · ${records[s]?'記録を編集':'新しい記録'}`;$('editor-holiday').textContent=holiday(s);for(const k of C.FIELDS)$('edit-'+k).value=r[k]||'';$('legacy-section').hidden=!(r.contentBottom||r.memoBottom);$('legacy-section').open=false;$('editor-error').textContent='';$('delete-day').hidden=!records[s];hourHint();$('editor').showModal();}
function hourHint(){const current=C.empty();for(const k of C.FIELDS)current[k]=$('edit-'+k).value;$('comparison-hint').textContent=C.comparison(current)+'（文面の比較です。完了の自動判定はしません）';const u=$('edit-upper').value,l=$('edit-lower').value;$('hour-hint').textContent=/^[1-7]$/.test(l)?`${['子遅','子早'].includes(u)?'子の時間休':'時間休'}として、1回・${l}時間を集計します。`:'予定・実施とは別に、休暇の利用区分を記録します。';}
function closeEditor(){if(dirty&&!confirm('保存していない変更があります。変更を破棄して閉じますか？'))return;dirty=false;$('editor').close();}
function parseXml(bytes){if(!bytes)throw Error('必要なExcelシートがありません。');const s=new TextDecoder().decode(bytes);if(s.length>40000000)throw Error('Excelが大きすぎます。');const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('ExcelのXMLが壊れています。');return d;}
const nodes=(d,name)=>Array.from(d.getElementsByTagNameNS('*',name));
function richText(el){return nodes(el,'t').filter(t=>{for(let n=t.parentElement;n&&n!==el;n=n.parentElement)if(n.localName==='rPh')return false;return true;}).map(t=>t.textContent).join('');}
function xlsx(buffer){
 if(buffer.byteLength>20000000)throw Error('Excelは20MB以内で選択してください。');
 const files=fflate.unzipSync(new Uint8Array(buffer),{filter:f=>{if(f.originalSize>40000000)throw Error('展開後のExcelが大きすぎます。');return /^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(f.name);}});
 const book=parseXml(files['xl/workbook.xml']),s=nodes(book,'sheet').find(s=>s.getAttribute('name')==='予定表');if(!s)throw Error('「予定表」シートがありません。元Excel形式のファイルを選んでください。');
 if(nodes(book,'workbookPr').some(n=>['1','true'].includes(n.getAttribute('date1904'))))throw Error('1904年基準のExcelには対応していません。1900年基準の元Excelをご利用ください。');
 const id=s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
 const rel=nodes(parseXml(files['xl/_rels/workbook.xml.rels']),'Relationship').find(r=>r.getAttribute('Id')===id);if(!rel)throw Error('シート参照を読み取れません。');
 const target=rel.getAttribute('Target');if(!/^\/?(?:xl\/)?worksheets\/sheet\d+\.xml$/.test(target))throw Error('未対応のシート参照です。');const name=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:'xl/'+target;
 const shared=files['xl/sharedStrings.xml']?nodes(parseXml(files['xl/sharedStrings.xml']),'si').map(si=>richText(si)):[];
 const groups=new Map();
 for(const row of nodes(parseXml(files[name]),'row')){
  const cells={};for(const cell of nodes(row,'c')){const col=(cell.getAttribute('r')||'').replace(/[0-9]/g,''),type=cell.getAttribute('t');const v=nodes(cell,'v')[0]?.textContent??'';cells[col]=type==='s'?shared[Number(v)]??'':type==='inlineStr'?richText(cell):v;}
  if(!cells.B||!/^\d+(\.0+)?$/.test(cells.B))continue;const serial=Number(cells.B);if(serial<36526||serial>73050)continue;
  const date=C.iso(new Date(Date.UTC(1899,11,30)+serial*86400000));if(!C.valid(date))continue;if(!groups.has(date))groups.set(date,[]);groups.get(date).push(cells);
 }
 const out={};for(const [date,rows] of groups){if(rows.length!==2)throw Error(`${date}の上段・下段を読み取れません。元Excelの2行形式をご確認ください。`);const r=C.empty();rows.forEach((row,i)=>{r[i===0?'upper':'lower']=String(row.C||'');r['content'+(i===0?'Top':'Bottom')]=String(row.W||'');r['memo'+(i===0?'Top':'Bottom')]=String(row.X||'');});if(C.meaningful(r))out[date]=r;}
 if(!groups.size)throw Error('予定表の日付を読み取れませんでした。');return C.validateRecords(out);
}
function renderSearch(){const start=searchPage*40,dates=searchDates.slice(start,start+40);$('search-results').innerHTML=`<h3 class="results-heading">${searchDates.length}日が見つかりました <span class="footnote">${start+1}〜${Math.min(start+40,searchDates.length)}日目</span></h3>${recordTable(dates)}<div class="pagination"><button class="outline" id="search-prev" ${searchPage===0?'disabled':''}>前へ</button><span>${searchPage+1} / ${Math.ceil(searchDates.length/40)}</span><button class="outline" id="search-next" ${start+40>=searchDates.length?'disabled':''}>次へ</button></div>`;}
function doSearch(){
 $('search-error').textContent='';const y=Number($('search-year').value),m=Number($('search-month').value),d=Number($('search-day').value),q=$('search-text').value.trim().toLocaleLowerCase();
 if(!Number.isInteger(y)||y<2000||y>2099){$('search-error').textContent='年は2000〜2099年の西暦で指定してください。';return;}
 if(d&&!m){$('search-error').textContent='日を指定する場合は月も選んでください。';return;}
 if(m&&d&&d>C.days(y,m)){$('search-error').textContent=`${y}年${m}月${d}日は存在しません。日付を確認してください。`;return;}
 searchDates=[];for(let mm=m||1;mm<=(m||12);mm++)for(let dd=d||1;dd<=(d||C.days(y,mm));dd++){
  const s=C.iso(C.date(y,mm,dd)),r=records[s]||C.empty();const text=[...C.FIELDS.map(k=>r[k]),C.UPPER[r.upper],C.LOWER[r.lower],holiday(s)].join(' ').toLocaleLowerCase();if(!q||text.includes(q))searchDates.push(s);
 }searchPage=0;if(searchDates.length)renderSearch();else $('search-results').innerHTML='<div class="empty-state">該当する予定はありません。条件を変えて検索してください。</div>';
}
$('allowance-open').onclick=openAllowance;
$('allowance-form').onsubmit=e=>{e.preventDefault();try{const p=C.defaultAllowance();for(const k of ['paid','sick','child','summer','mourning','hours','childHours','hoursPerDay']){const v=$('allowance-'+k).value;p[k]=v===''?null:Number(v);}p.hoursDeductPaid=$('allowance-hoursDeductPaid').checked;p.childHoursDeductChild=$('allowance-childHoursDeductChild').checked;const next=C.validateAllowances({...allowances,[year]:p});commit(records,next);$('allowance-dialog').close();render();show(year+'年度の休暇設定を保存しました。');}catch(err){$('allowance-error').textContent='設定を保存できませんでした。'+err.message;}};
setSelects();render();
$('prev-year').onclick=()=>{if(year>2000){year--;render();}};$('next-year').onclick=()=>{if(year<2098){year++;render();}};
$('fiscal-year').onchange=e=>{year=Number(e.target.value);render();};$('prev-month').onclick=()=>monthStep(-1);$('next-month').onclick=()=>monthStep(1);
$('today').onclick=()=>{year=Math.max(2000,Math.min(2098,C.fy(today())));month=Number(today().slice(5,7));setView('calendar');openDate(today());};
$('record-only').onchange=renderAnnual;
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view)setView(b.dataset.view);if(b.dataset.month){month=Number(b.dataset.month);renderCalendar();}if(b.dataset.date)openDate(b.dataset.date);if(b.dataset.close){if(b.dataset.close==='editor')closeEditor();else $(b.dataset.close).close();}if(b.id==='search-prev'){searchPage--;renderSearch();}if(b.id==='search-next'){searchPage++;renderSearch();}});
$('editor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
$('editor-form').addEventListener('input',()=>{dirty=true;hourHint();});$('editor-form').addEventListener('change',()=>{dirty=true;hourHint();});
function copyLegacy(to){
 const fields=to==='plan'?['contentTop','memoTop']:['actualContent','actualMemo'];
 if(fields.some(k=>$('edit-'+k).value)&&!confirm('コピー先に入力があります。旧下段の内容で置き換えますか？'))return;
 $('edit-'+fields[0]).value=$('edit-contentBottom').value;$('edit-'+fields[1]).value=$('edit-memoBottom').value;dirty=true;hourHint();
}
$('plan-to-actual').onclick=()=>{
 if(($('edit-actualContent').value||$('edit-actualMemo').value)&&!confirm('実施欄に入力があります。予定の内容で置き換えますか？'))return;
 $('edit-actualContent').value=$('edit-contentTop').value;$('edit-actualMemo').value=$('edit-memoTop').value;dirty=true;hourHint();
};
$('legacy-to-plan').onclick=()=>copyLegacy('plan');$('legacy-to-actual').onclick=()=>copyLegacy('actual');
$('editor-form').onsubmit=e=>{e.preventDefault();const r=C.empty();for(const k of C.FIELDS)r[k]=$('edit-'+k).value;try{const v=C.validateRecord(r),next={...records};if(C.meaningful(v))next[editing]=v;else delete next[editing];commit(next);dirty=false;$('editor').close();render();show(human(editing)+'の記録を保存しました。');}catch(err){$('editor-error').textContent='保存できませんでした。'+err.message;}};
$('delete-day').onclick=()=>{if(!confirm(human(editing)+'の記録を削除しますか？'))return;try{const next={...records};delete next[editing];commit(next);dirty=false;$('editor').close();render();show('この日の記録を削除しました。');}catch(err){$('editor-error').textContent='削除できませんでした。'+err.message;}};
$('backup').onclick=()=>{backup();show('全記録のバックアップをダウンロードしました。ファイルを保管してください。');};
$('help-open').onclick=()=>$('help-dialog').showModal();
$('import-open').onclick=()=>{pending=null;pendingAllowances=null;$('import-file').value='';$('import-error').textContent='';$('import-preview').hidden=true;$('import-mode').value='keep';$('import-dialog').showModal();};
$('import-file').onchange=async e=>{pending=null;pendingAllowances=null;$('import-preview').hidden=true;$('import-error').textContent='';const f=e.target.files[0];if(!f)return;try{if(f.size>20000000)throw Error('ファイルは20MB以内で選択してください。');if(f.name.toLowerCase().endsWith('.xlsx')){pending=xlsx(await f.arrayBuffer());}else{const text=await f.text();pending=decode(text);pendingAllowances=C.validateAllowances(JSON.parse(text).allowances);}const dates=Object.keys(pending).sort(),conflicts=dates.filter(s=>records[s]).length;$('import-count').textContent=`${dates.length}日分の記録 / 重複 ${conflicts}日 / 休暇設定 ${Object.keys(pendingAllowances||{}).length}年度`;$('import-sample').innerHTML=`<div class="preview-list">${dates.slice(0,5).map(s=>`<div>${esc(human(s))}　${esc(caption(pending[s])||C.LOWER[pending[s].lower]||C.UPPER[pending[s].upper]||'メモ')}</div>`).join('')}</div>`;$('import-preview').hidden=false;$('import-confirm').disabled=!dates.length&&!Object.keys(pendingAllowances||{}).length;if(!dates.length&&!Object.keys(pendingAllowances||{}).length)$('import-error').textContent='取り込む記録がありません。';}catch(err){pending=null;$('import-error').textContent='読み込めませんでした。'+err.message;}};
$('import-confirm').onclick=()=>{if(!pending)return;try{const next={...records};let count=0;for(const [s,r] of Object.entries(pending))if(!next[s]||$('import-mode').value==='replace'){next[s]=r;count++;}const nextAllowances={...allowances};for(const [y,p] of Object.entries(pendingAllowances||{}))if(!nextAllowances[y]||$('import-mode').value==='replace')nextAllowances[y]=p;preserve();commit(next,nextAllowances);pending=null;pendingAllowances=null;$('import-dialog').close();render();show(`${count}日分の記録を取り込みました。取り込み前のバックアップも保存してください。`);}catch(err){$('import-error').textContent='取り込みを中止しました。'+err.message;}};
$('recover').onclick=()=>{try{const raw=localStorage.getItem(RECOVERY);if(!raw)throw Error('復元用コピーがありません。');const previous=decode(raw);if(!confirm('直前の取り込み前の全記録に戻します。取り込み後の変更は現在のバックアップに保存します。復元しますか？'))return;backup('復元前_予定と休暇');commit(previous,C.validateAllowances(JSON.parse(raw).allowances));$('help-dialog').close();render();show('取り込み前の状態へ復元しました。');}catch(err){show('復元できませんでした。'+err.message,true);}};
$('search-form').onsubmit=e=>{e.preventDefault();doSearch();};
$('csv-export').onclick=()=>{const csvCell=v=>'"'+String(v).replace(/"/g,'""')+'"';const rows=[['年度',year],['月',...metrics.map(([,n,u])=>`${n}(${u})`)],...C.months(year).map(a=>{const t=C.totals(records,year,a.month);return [`${a.year}/${a.month}`,...metrics.map(([k])=>t[k])];})];const t=C.totals(records,year);rows.push(['年度合計',...metrics.map(([k])=>t[k])]);download(`休暇集計_${year}年度.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');};
window.addEventListener('storage',e=>{if(e.key===KEY)warning('別のタブで記録が更新されました。このタブでの上書きを防止しています。編集内容を控えてから再読み込みしてください。');});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
// Exposed read-only helpers for offline validation; never used to bypass input checks.
window.Planner={xlsx,hasUnsavedChanges:()=>dirty||document.querySelector('dialog[open]')!==null,getRecords:()=>JSON.parse(JSON.stringify(records))};
})();
