/* Source-traceable suggestions. Rules produce unconfirmed candidates. */
(()=>{'use strict';
const $=s=>document.getElementById(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>Number(n).toLocaleString('ja-JP')+'円';
const normalize=s=>String(s||'').normalize('NFKC').replace(/\s/g,'').toUpperCase();
const code=s=>WB.publicCode(s);
const dimension=s=>String(s||'').normalize('NFKC').toUpperCase().match(/\d+(?:\.\d+)?\s*[×X*]\s*\d+(?:\.\d+)?(?:\s*[×X*]\s*\d+(?:\.\d+)?)?/)?.[0]?.replace(/\s/g,'').replace(/[X*]/g,'×')||'';
const kind=s=>/非常/.test(s)?'非常用照明':/誘導灯/.test(s)?'誘導灯':/ベースライト/.test(s)?'ベースライト':/照明|灯具|器具/.test(s)?'照明器具':/プルボックス/.test(s)?'プルボックス':/ケーブル|CVT|CV|IV\d/.test(s)?'ケーブル':/電線管|配管/.test(s)?'電線管':/分電盤/.test(s)?'分電盤':/開閉器/.test(s)?'開閉器':/スイッチ/.test(s)?'スイッチ':'';
let draft=[],loadedTarget=null,loadedDocument='',busy=false;
function parseLines(text,file,page=1){return text.split(/\n/).map((raw,index)=>{
 const line=raw.normalize('NFKC').trim(),type=code(line),name=kind(line);if(!line||(!name&&!type))return null;
 const q=line.match(/(?:数量\s*[:：]?\s*)?(\d+(?:\.\d+)?)\s*(台|個|本|箇所|面|組|m|ｍ)(?![A-Za-z0-9])/i);
 const dimensions=dimension(line),mount=line.match(/天井直付|天井埋込|壁付|吊下|直付|埋込|防水|屋外/)?.[0]||'',light=line.match(/\d+(?:\.\d+)?\s*(?:lm|lx|W)(?![A-Za-z])/i)?.[0]||'';
 return {name:name||'器具（品名確認）',spec:[type,dimensions,mount,light].filter(Boolean).join(' ／ '),quantity:q?Number(q[1]):0,unit:q?q[2]:'台',publicType:type,dimensions,mount,light,
  source:{file,sheet:'図面・姿図 p'+page,row:index+1,page,line:raw,quantityCell:'p'+page+' 行'+(index+1),priceCell:'未照合',quantityFormula:'',priceFormula:'',sourceAmount:null,sourceUnitPrice:null},
  unitPrice:null,evidence:file+' p'+page+' 行'+(index+1)+'｜原文：'+raw,
  category:/撤去|処分/.test(line)?'撤去・処分':'新設',missing:[!type&&'公共型番',!dimensions&&'寸法',!mount&&'取付方法',!light&&'明るさ・消費電力',!q&&'数量（図形の個数は未集計）'].filter(Boolean)};
}).filter(Boolean);}
function parseDocument(text,file,page=1){const parts=text.split(/【p(\d+)】/);if(parts.length===1)return parseLines(text,file,page);const result=parseLines(parts[0],file,page);for(let i=1;i<parts.length;i+=2)result.push(...parseLines(parts[i+1]||'',file,Number(parts[i])));return result;}
function suggestions(item){
 const pool=WB.projects().filter(p=>p.role==='reference').flatMap(p=>p.items.map(i=>({...i,referenceTitle:p.title,sourceType:'過去Excel',priceKind:'設計単価'})));
 pool.push(...WB_STANDARD_PRICES);const registered=WB.project().priceRecords; if(Array.isArray(registered))pool.push(...registered.filter(i=>i&&typeof i.name==='string'&&Number.isFinite(i.unitPrice)&&i.source));
 const ic=normalize(item.publicType||code(item.spec)),id=dimension(item.spec),n=normalize(item.name),category=item.category;
 return pool.map(i=>{
  const c=normalize(i.publicType||code(i.spec)),d=dimension(i.spec);if(ic&&c&&ic!==c||id&&d&&id!==d)return null;
  if(i.category&&i.category!==category)return null;
  const same=normalize(i.name)===n,publicSame=ic&&c===ic;
  if(!same&&!publicSame)return null;
  if(item.unit!==i.unit&&!(publicSame&&['台','個'].includes(item.unit)&&['台','個'].includes(i.unit)))return null;
  let score=publicSame?3:same?1:0;if(id&&d===id)score++;if(i.sourceType!=='過去Excel')score+=2;
  const missing=[item.unit!==i.unit&&'表の単位と今回単位の換算を確認',(!ic||!c)&&'公共型番の一致未確認',(!id||!d)&&'寸法の一致未確認','年度・地域・材質・取付条件を確認'];
  return {...i,score,match:publicSame?'公共型番一致':'品名一致（仕様未確定）',missing:missing.filter(Boolean)};
 }).filter(i=>i&&i.unitPrice!==null).sort((a,b)=>b.score-a.score).slice(0,8);
}
function applySuggestion(item,s){
 item.priceReference=s.priceReference||{type:s.sourceType||'過去Excel',name:s.source.file,edition:s.edition||'',location:s.location||s.source.sheet+'・'+s.source.priceCell,manufacturer:s.manufacturer||'',model:s.model||''};item.unitPrice=s.unitPrice;item.mode=s.priceKind==='材料価格'?'compose':'direct';
 if(item.mode==='compose'){item.quote=s.unitPrice;item.reduction=100;const ld=WB.laborDefault();item.electrician=item.electrician||ld.electrician;item.ordinary=item.ordinary||ld.ordinary;item.electricCoeff=0;item.ordinaryCoeff=0;}
 item.priceProposal={source:JSON.parse(JSON.stringify(s.source)),name:s.name,spec:s.spec,price:s.unitPrice,kind:s.priceKind||'設計単価',match:s.match,conditions:s.conditions||'',at:new Date().toISOString()};
 item.evidence+='\n単価候補（仮反映）：'+s.source.file+'｜'+s.source.sheet+'｜'+s.source.priceCell+'｜'+s.match+'｜'+(s.conditions||'今回条件は未確認');
 item.priceChecked=false;item.quantityChecked=false;
 item.state='candidate';
}
function renderDraft(){
 $('drawing-result').innerHTML=draft.length?draft.map((i,n)=>{const s=suggestions(i)[0];return `<article class="panel draft-row"><h3>${esc(i.name)}</h3><div class="wb-form"><label>品名<input data-draft="${n}" data-key="name" value="${esc(i.name)}"></label><label>規格・公共型番・寸法・取付・明るさ<input data-draft="${n}" data-key="spec" value="${esc(i.spec)}"></label><label>数量（未取得は0）<input type="number" min="0" step="any" data-draft="${n}" data-key="quantity" value="${i.quantity}"></label><label>単位<input data-draft="${n}" data-key="unit" value="${esc(i.unit)}"></label></div><p class="wb-muted">原文：${esc(i.source.line)}<br>${esc(i.source.file)}・${esc(i.source.sheet)}・行${i.source.row}</p><p>不足・確認：${esc(i.missing.join('、')||'今回の仕様と更新対象を確認')}</p><p>単価候補：${s?esc(yen(s.unitPrice)+'｜'+s.match+'｜'+s.source.file):'適合候補なし。県単価・見積等を登録して照合してください。'}</p><button class="primary" data-add-draft="${n}" ${i.added?'disabled':''}>${i.added?'追加済み':'確認候補へ追加'}</button></article>`;}).join(''):'<div class="notice">対象候補が見つかりません。原文の文字や行のまとまりを確認してください。画像だけのPDFは文字を読み取れません。</div>';
 $('drawing-result').querySelectorAll('[data-draft]').forEach(e=>e.onchange=()=>{const i=draft[Number(e.dataset.draft)],k=e.dataset.key;i[k]=k==='quantity'?Number(e.value):e.value;});
 $('drawing-result').querySelectorAll('[data-add-draft]').forEach(b=>b.onclick=()=>{try{
  if(WB.project().id!==loadedTarget)throw Error('工事を切り替えたため、資料を読み直してください。');
  if(WB.project().role!=='current')throw Error('先に「今回の工事として作成」または「新規工事」を押してください。');
  const i=draft[Number(b.dataset.addDraft)];if(!i.name.trim()||!i.unit.trim()||!Number.isFinite(i.quantity)||i.quantity<0)throw Error('品名・数量・単位を確認してください。');
  const fields=JSON.parse(JSON.stringify(i));delete fields.added;const suggestion=suggestions(fields)[0];if(suggestion)applySuggestion(fields,suggestion);
  const item=WB.addCandidate(fields);i.added=true;renderDraft();$('drawing-status').textContent='候補へ追加しました。「候補の確認」で不足情報と単価を確認して採用してください。';
 }catch(e){alert(e.message);}});
}
async function readPdf(file){
 if(file.size>30e6)throw Error('PDFは30MB以内で追加してください。');
 class EmbeddedCMapReader {async fetch({name}){const data=WB_CMAPS[name];if(!data)throw Error('対応していない文字マップ：'+name);return {cMapData:Uint8Array.from(atob(data),c=>c.charCodeAt(0)),compressionType:1};}}
 const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,CMapReaderFactory:EmbeddedCMapReader,useWorkerFetch:false}).promise;
 try{
  if(pdf.numPages>200)throw Error('200ページ以内の図面を選んでください。');
  const result=[],texts=[];
  for(let p=1;p<=pdf.numPages;p++){
   $('drawing-status').textContent='PDFの文字を読取中：'+p+' / '+pdf.numPages+'ページ';
   const page=await pdf.getPage(p),content=await page.getTextContent(),lines=[];
   for(const t of content.items){if(!t.str)continue;let l=lines.find(l=>Math.abs(l.y-t.transform[5])<2);if(!l){l={y:t.transform[5],parts:[]};lines.push(l);}l.parts.push({x:t.transform[4],str:t.str});}
   const text=lines.sort((a,b)=>b.y-a.y).map(l=>l.parts.sort((a,b)=>a.x-b.x).map(t=>t.str).join(' ')).join('\n');
   texts.push('【p'+p+'】\n'+text);result.push(...parseLines(text,file.name,p));page.cleanup();
  }
  return {result,text:texts.join('\n\n'),pages:pdf.numPages};
 }finally{await pdf.destroy();}
}
$('drawing-pdf').onchange=async e=>{if(busy)return;const f=e.target.files[0];if(!f)return;busy=true;loadedTarget=WB.project().id;loadedDocument=f.name;const target=WB.project();$('drawing-file-label').value=f.name;
 try{const r=await readPdf(f);if(WB.project().id!==loadedTarget)throw Error('工事が切り替わりました。資料を読み直してください。');draft=r.result;$('drawing-text').value=r.text;target.documents.push({name:f.name,type:'PDF文字読取',status:r.pages+'ページ／'+draft.length+'候補。図形数量・画像OCRは未実装'});WB.mutate('PDF文字読取',f.name+'｜'+r.pages+'ページ｜候補'+draft.length+'件');if(window.SUBMISSIONS&&target.role==='current')try{await SUBMISSIONS.storeDesignFile(f,target);}catch(err){alert('候補は保存しましたが、原本ファイルの保管に失敗しました：'+err.message);}renderDraft();$('drawing-status').textContent=draft.length+'件を抽出しました。図形の個数は数えていません。原文と数量を確認してください。';}
 catch(err){$('drawing-status').textContent='読取できませんでした：'+err.message+'。既存の積算データは保持しています。';}
 finally{busy=false;e.target.value='';}};
$('drawing-parse').onclick=()=>{loadedTarget=WB.project().id;loadedDocument=$('drawing-file-label').value.trim();if(!loadedDocument){alert('原資料名とページを入力してください。');return;}draft=parseDocument($('drawing-text').value,loadedDocument,Number($('drawing-page').value)||1);renderDraft();$('drawing-status').textContent=draft.length+'候補。コピーした原文との一致を確認してください。';};
$('price-register').onclick=()=>{try{
 if(WB.project().role!=='current')throw Error('今回工事を作成してから単価を登録してください。');
 const name=$('pr-name').value.trim(),spec=$('pr-spec').value.trim(),source=$('pr-source').value.trim(),conditions=$('pr-conditions').value.trim(),unit=$('pr-unit').value.trim(),price=$('pr-price').value.trim();
 if(!name||!source||!conditions||!unit||!price||!Number.isFinite(Number(price))||Number(price)<0)throw Error('品名・単位・価格・根拠資料・適用条件を入力してください。');
 const records=WB.project().priceRecords||(WB.project().priceRecords=[]);records.push({name,spec,unit,unitPrice:Number(price),category:$('pr-category').value,priceKind:$('pr-kind').value,sourceType:$('pr-type').value,conditions,edition:$('pr-edition').value.trim(),location:$('pr-location').value.trim()||conditions,manufacturer:$('pr-maker').value.trim(),model:$('pr-model').value.trim(),source:{file:source,sheet:$('pr-type').value,priceCell:$('pr-location').value.trim()||conditions},referenceTitle:'今回の登録資料'});
 WB.mutate('単価資料登録',name+'｜'+source+'｜'+conditions);$('price-status').textContent='登録しました。候補の「別候補・単価を照合」で選べます。';renderPrices();
 }catch(e){alert(e.message);}};
function renderPrices(){const records=WB.project().priceRecords;$('price-list').innerHTML=Array.isArray(records)?records.map(r=>`<p>${esc(r.name)}｜${esc(r.spec)}｜${esc(r.unit)}｜${esc(yen(r.unitPrice))}<br><small>${esc(r.source?.file)}｜${esc(r.conditions)}</small></p>`).join(''):'';}
window.addEventListener('wb-edit',e=>{
 const i=e.detail.item,box=document.createElement('details');box.open=false;box.className='wb-notice';
 const rows=suggestions(i);box.innerHTML='<summary>別候補・単価を照合</summary><p>品名・公共型番・寸法・単位・工事区分で照合します。過去案件は参考価格です。表示は推定確率ではありません。</p>'+(i.missing?'<p>不足情報：'+esc(i.missing.join('、'))+'</p>':'')+(rows.length?rows.map((s,n)=>`<div class="price-choice"><b>${esc(yen(s.unitPrice))}／${esc(s.unit)}｜${esc(s.priceKind)}</b><p>${esc(s.name)} ${esc(s.spec)}<br>資料種類：${esc(s.sourceType)}<br>${esc(s.match)}｜${esc(s.source.file)}・${esc(s.source.sheet)}・${esc(s.source.priceCell)}<br>版・年月：${esc(s.edition||'要確認')}／メーカー：${esc(s.manufacturer||'未登録')} ${esc(s.model||'')}<br>確認事項：${esc(s.missing.join('、'))}</p><button type="button" data-price-choice="${n}">この単価候補を仮反映</button></div>`).join(''):'<p>適合する価格候補がありません。資料読取・単価候補画面で根拠資料を登録してください。</p>');
 const sources=['営繕工事標準単価表','メーカー資料','建設物価','建築コスト情報'];box.insertAdjacentHTML('beforeend','<p class="wb-muted">'+sources.map(k=>esc(k)+'：'+(rows.some(x=>x.sourceType===k)?'照合候補あり':'該当資料は未登録・未照合')).join('<br>')+'</p>');$('wb-dialog-body').prepend(box);box.querySelectorAll('[data-price-choice]').forEach(b=>b.onclick=()=>{
  const s=rows[Number(b.dataset.priceChoice)];applySuggestion(i,s);$('wi-price').value=s.unitPrice;$('wi-mode').value=i.mode;$('wi-evidence').value=i.evidence;$('wi-price-check').checked=false;$('wi-quantity-check').checked=false;const r=i.priceReference;for(const [id,k] of [['wi-ref-type','type'],['wi-ref-name','name'],['wi-ref-edition','edition'],['wi-ref-location','location'],['wi-maker','manufacturer'],['wi-model','model']])$(id).value=r[k]||'';
  if(i.mode==='compose'){$('wi-electrician').value=i.electrician;$('wi-ordinary').value=i.ordinary;$('wi-quote').value=s.unitPrice;$('wi-reduction').value=100;$('wi-electric-coeff').value=0;$('wi-ordinary-coeff').value=0;}
  $('wi-mode').dispatchEvent(new Event('input',{bubbles:true}));box.open=false;WB.mutate('単価候補を仮反映',i.name+'｜'+s.source.file+'｜採用は未確認');
 });
});
function sync(){
 const p=WB.project(),t=WB.totals(),pending=p.items.filter(i=>i.state!=='adopted'&&i.state!=='excluded');
 $('shell-project').innerHTML=WB.projects().map(p=>`<option value="${esc(p.id)}" ${p.id===WB.project().id?'selected':''}>${p.role==='reference'?'参考｜':'今回｜'}${esc(p.title)}</option>`).join('');
 $('home-cards').innerHTML=[['数量・仕様の未確認',pending.filter(i=>!i.quantityChecked).length],['単価根拠の未確認',pending.filter(i=>!i.priceChecked).length],['保留',p.items.filter(i=>i.state==='hold').length],['採用',t.count]].map(([n,v])=>`<div class="card"><small>${n}</small><div class="n">${v}</div><small>選択中工事の実データ</small></div>`).join('');
 $('home-stage').textContent=p.role==='reference'?'参考工事です。今回の工事を作成して資料を読み込んでください。':WB.ready()?'設計書の最終確認済みです。Excel出力へ進めます。':'設計確認中：候補 '+pending.length+'件／採用 '+t.count+'件／採用明細計 '+yen(t.direct);
 $('home-next').innerHTML=pending.slice(0,4).map(i=>`<div class="task"><b>${esc(i.name)} ${esc(i.spec)}</b><small>${!i.quantityChecked?'数量・仕様を確認':'数量確認済み'}／${!i.priceChecked?'単価根拠を確認':'単価確認済み'}${i.state==='hold'?'／保留理由：'+esc(i.reason):''}</small><button class="ghost" data-home-item="${esc(i.id)}">確認する</button></div>`).join('')||'<p>明細の確認待ちはありません。共通費・最終確認へ進んでください。</p>';
 $('home-next').querySelectorAll('[data-home-item]').forEach(b=>b.onclick=()=>{show('estimate');WB.openItem(b.dataset.homeItem);});
 $('ledger-rows').innerHTML=WB.projects().map(p=>`<tr><td>${p.role==='reference'?'参考':'今回'}</td><td>${esc(p.title)}</td><td>電気</td><td>${p.items.length}候補／${WB.adopted(p).length}採用</td><td><button class="ghost" data-select-project="${esc(p.id)}">開く</button></td></tr>`).join('');
 $('ledger-rows').querySelectorAll('[data-select-project]').forEach(b=>b.onclick=()=>{WB.select(b.dataset.selectProject);show('estimate');});renderPrices();
}
$('shell-project').onchange=e=>WB.select(e.target.value);window.addEventListener('wb-render',sync);sync();
window.ASSIST={parseLines,parseDocument,suggestions,readPdf,applySuggestion};
})();
