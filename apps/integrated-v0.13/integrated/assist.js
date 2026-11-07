/* Source-traceable suggestions. Rules produce unconfirmed candidates. */
(()=>{'use strict';
const $=s=>document.getElementById(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>Number(n).toLocaleString('ja-JP')+'円';
const normalize=s=>String(s||'').normalize('NFKC').replace(/\s/g,'').toUpperCase();
const code=s=>WB.publicCode(s);
const dimension=s=>String(s||'').normalize('NFKC').toUpperCase().match(/\d+(?:\.\d+)?\s*[×X*]\s*\d+(?:\.\d+)?(?:\s*[×X*]\s*\d+(?:\.\d+)?)?/)?.[0]?.replace(/\s/g,'').replace(/[X*]/g,'×')||'';
const kind=s=>/非常/.test(s)?'非常用照明':/誘導灯/.test(s)?'誘導灯':/ベースライト/.test(s)?'ベースライト':/照明|灯具|器具/.test(s)?'照明器具':/プルボックス/.test(s)?'プルボックス':/ケーブル|CVT|CV|IV\d/.test(s)?'ケーブル':/電線管|配管/.test(s)?'電線管':/分電盤/.test(s)?'分電盤':/開閉器/.test(s)?'開閉器':/スイッチ/.test(s)?'スイッチ':'';
let draft=[],loadedTarget=null,loadedDocument='',loadedAnalysisDoc=null,busy=false;
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
 const pool=[];
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
 if(item.mode==='compose'){item.quote=s.unitPrice;if(item.reductionOrigin!=='manual'&&item.reduction===100){item.reduction=WB.suggestedReduction(item)??100;item.reductionOrigin='operation-default';}const ld=WB.laborDefault();item.electrician=item.electrician||ld.electrician;item.ordinary=item.ordinary||ld.ordinary;item.electricCoeff=0;item.ordinaryCoeff=0;}
 item.priceProposal={source:JSON.parse(JSON.stringify(s.source)),name:s.name,spec:s.spec,price:s.unitPrice,kind:s.priceKind||'設計単価',match:s.match,conditions:s.conditions||'',at:new Date().toISOString()};
 item.evidence+='\n単価候補（仮反映）：'+s.source.file+'｜'+s.source.sheet+'｜'+s.source.priceCell+'｜'+s.match+'｜'+(s.conditions||'今回条件は未確認');
 item.priceChecked=false;item.quantityChecked=false;
 item.state='candidate';
}
function renderDraft(){
 const wasOpen=$('drawing-draft-details')?.open||false,scrollTop=$('drawing-draft-list')?.scrollTop||0;
 $('drawing-result').innerHTML=draft.length?'<section class="panel drawing-draft-overview"><h3>文字の読取結果：'+draft.length+'件</h3><p>機器の選択・整理は下の一覧で行えます。読取直後の候補は、必要なときだけ開いて確認できます。</p><button type="button" id="drawing-equipment-jump" class="primary">追加する機器を選ぶへ</button><details id="drawing-draft-details"><summary>読取直後の候補を開く（'+draft.length+'件）</summary><div id="drawing-draft-list" role="region" aria-label="読取直後の候補" tabindex="0">'+draft.map((i,n)=>{const s=suggestions(i)[0];return `<article class="panel draft-row"><h3>${esc(i.name)}</h3><div class="wb-form"><label>品名<input data-draft="${n}" data-key="name" value="${esc(i.name)}"></label><label>規格・公共型番・寸法・取付・明るさ<input data-draft="${n}" data-key="spec" value="${esc(i.spec)}"></label><label>数量（未取得は0）<input type="number" min="0" step="any" data-draft="${n}" data-key="quantity" value="${i.quantity}"></label><label>単位<input data-draft="${n}" data-key="unit" value="${esc(i.unit)}"></label></div><p class="wb-muted">原文：${esc(i.source.line)}<br>${esc(i.source.file)}・${esc(i.source.sheet)}・行${i.source.row}</p><p>不足・確認：${esc(i.missing.join('、')||'今回の仕様と更新対象を確認')}</p><p>単価候補：${s?esc(yen(s.unitPrice)+'｜'+s.match+'｜'+s.source.file):'適合候補なし。県単価・見積等を登録して照合してください。'}</p><button class="primary" data-add-draft="${n}" ${i.added?'disabled':''}>${i.added?'追加済み':'確認候補へ追加'}</button></article>`;}).join('')+'</div></details></section>':'<div class="notice">対象候補が見つかりません。原文の文字や行のまとまりを確認してください。写真・画像PDFは原文を確認・修正し、必要に応じて品名を含む行を入力してください。</div>';
 if(draft.length){$('drawing-draft-details').open=wasOpen;$('drawing-draft-list').scrollTop=scrollTop;$('drawing-equipment-jump').onclick=()=>{const p=WB.project();if(p.id!==loadedTarget){alert('工事を切り替えたため、資料を読み直してください。');return;}const doc=p.documents.find(d=>d.id===loadedAnalysisDoc);if(doc)DOC_ANALYSIS.showDocument(doc);else{DOC_ANALYSIS.run();$('analysis-equipment-panel').scrollIntoView({block:'start'});}};}
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
 const header=new TextDecoder('ascii').decode(await file.slice(0,1024).arrayBuffer());if(!header.includes('%PDF-'))throw Error('選択した資料はPDFとして確認できません。ファイルの情報で種類を確認してください。写真は「写真を選ぶ・撮影する」、Excelは「Excelを選ぶ」から取り込めます。');
 class EmbeddedCMapReader {async fetch({name}){const data=WB_CMAPS[name];if(!data)throw Error('対応していない文字マップ：'+name);return {cMapData:Uint8Array.from(atob(data),c=>c.charCodeAt(0)),compressionType:1};}}
 const pdf=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,CMapReaderFactory:EmbeddedCMapReader,useWorkerFetch:false}).promise;
 try{
  if(pdf.numPages>200)throw Error('200ページ以内の図面を選んでください。');
  const result=[],texts=[],drawingQuantities=[];
  for(let p=1;p<=pdf.numPages;p++){
   $('drawing-status').textContent='PDFの文字を読取中：'+p+' / '+pdf.numPages+'ページ';
   const page=await pdf.getPage(p),content=await page.getTextContent(),lines=[];
   for(const t of content.items){if(!t.str)continue;let l=lines.find(l=>Math.abs(l.y-t.transform[5])<2);if(!l){l={y:t.transform[5],parts:[]};lines.push(l);}l.parts.push({x:t.transform[4],str:t.str});}
   let text=lines.sort((a,b)=>b.y-a.y).map(l=>l.parts.sort((a,b)=>a.x-b.x).map(t=>t.str).join(' ')).join('\n');
   if(!text.trim()){if(pdf.numPages>10)throw Error('画像PDFの文字読取は10ページ以内で選んでください。');const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(page.view[2]-page.view[0],page.view[3]-page.view[1]))}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;text=await SOURCE_IMPORTS.recognize(canvas,m=>$('drawing-status').textContent='PDF '+p+'ページ：'+m);canvas.width=canvas.height=1;}
   drawingQuantities.push(...MaterialAnalysis.extractDrawingQuantities(content.items,p,page.view[3]));
   texts.push('【p'+p+'】\n'+text);result.push(...parseLines(text,file.name,p));page.cleanup();
  }
  return {result,text:texts.join('\n\n'),pages:pdf.numPages,drawingQuantities};
 }finally{await pdf.destroy();}
}
$('drawing-pdf').onchange=async e=>{if(busy||window.DOC_ANALYSIS?.isReading()){alert('他の読取の完了をお待ちください。');e.target.value='';return;}const f=e.target.files[0];if(!f)return;if(SOURCE_IMPORTS.isImage(f)){try{await importPhotoFile(f);}finally{e.target.value='';}return;}busy=true;loadedTarget=WB.project().id;loadedDocument=f.name;const target=WB.project();loadedAnalysisDoc=null;draft=[];$('drawing-result').replaceChildren();$('drawing-text').value='';clearPhoto();$('drawing-file-label').value=f.name;
 try{if(target.role!=='current')throw Error('今回の工事を選んでください。');const r=await readPdf(f);if(WB.project()!==target)throw Error('工事が切り替わりました。資料を読み直してください。');draft=r.result;$('drawing-text').value=r.text;const doc=await SOURCE_IMPORTS.save(f,target,'PDF文字読取',r.pages+'ページ／'+draft.length+'候補（未確認）');DOC_ANALYSIS.capture(doc,target,{text:r.text,page:1,drawingQuantities:r.drawingQuantities});loadedAnalysisDoc=doc.id;renderDraft();$('drawing-status').textContent=draft.length+'件を抽出しました。図形の個数は数えていません。原文と数量を確認してください。';}
 catch(err){draft=[];$('drawing-result').replaceChildren();$('drawing-status').textContent='読取できませんでした：'+err.message+'。既存の積算データは保持しています。';}
 finally{busy=false;e.target.value='';}};
let photoUrl=null;
function clearPhoto(){if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;$('drawing-photo-preview').replaceChildren();}
async function importPhotoFile(f){if(busy||window.DOC_ANALYSIS?.isReading()){alert('他の読取の完了をお待ちください。');return;}busy=true;const p=WB.project();loadedTarget=p.id;loadedDocument=f.name;loadedAnalysisDoc=null;draft=[];clearPhoto();$('drawing-text').value='';$('drawing-file-label').value='';renderDraft();let doc;
 try{if(p.role!=='current')throw Error('今回の工事を選んでください。');const page=Number($('drawing-page').value)||1,canvas=await SOURCE_IMPORTS.imageCanvas(f,page);if(WB.project()!==p)throw Error('工事が切り替わりました。読み直してください。');doc=await SOURCE_IMPORTS.save(f,p,'写真','文字読取前／原本保管済み');doc.page=canvas.importPage||1;doc.pages=canvas.importPages||1;WB.persist();clearPhoto();const img=document.createElement('img');img.src=canvas.toDataURL('image/png');img.alt=f.name;img.style.cssText='max-width:100%;max-height:420px;object-fit:contain';$('drawing-photo-preview').append(img);$('drawing-file-label').value=f.name;$('drawing-text').value='';const text=await SOURCE_IMPORTS.recognize(canvas,m=>$('drawing-status').textContent=m);canvas.width=canvas.height=1;if(WB.project()!==p)throw Error('工事が切り替わりました。読み直してください。');$('drawing-text').value=text;DOC_ANALYSIS.capture(doc,p,{text,page:doc.page});loadedAnalysisDoc=doc.id;draft=parseDocument(text,f.name,doc.page);doc.status='原本保管済み／'+doc.page+' / '+doc.pages+'ページ／'+draft.length+'候補（未確認）';WB.mutate('写真文字読取',f.name);renderDraft();$('drawing-status').textContent='原本を保存し、'+doc.page+' / '+doc.pages+'ページの文字を読み取りました。'+(draft.length?'候補は'+draft.length+'件です。':'候補が0件でも添付は完了しています。')+'原文を修正して「原文から候補を作る」を押してください。数量・単価は原本と照合してください。';}
 catch(err){if(doc&&WB.project()===p){doc.status='原本保管済み／文字読取未完了';WB.mutate('写真読取未完了',f.name);}$('drawing-status').textContent=err.message+(doc?' 原本は保存済みです。文字を直接入力することもできます。':'');}
 finally{busy=false;SOURCE_IMPORTS.render();}}
$('drawing-photo').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await importPhotoFile(f);}finally{e.target.value='';}};
window.addEventListener('source-deleted',e=>{if(e.detail.project===loadedTarget&&e.detail.docs.some(d=>d.name===loadedDocument)){draft=[];loadedDocument='';$('drawing-text').value='';$('drawing-file-label').value='';$('drawing-result').replaceChildren();clearPhoto();}});
window.addEventListener('wb-workspace-changed',clearPhoto);
$('drawing-parse').onclick=()=>{try{if(busy){alert('読取の完了をお待ちください。');return;}loadedTarget=WB.project().id;loadedDocument=$('drawing-file-label').value.trim();if(!loadedDocument){alert('原資料名とページを入力してください。');return;}const p=WB.project();if(p.role!=='current'){alert('今回の工事を選んでください。');return;}let doc=p.documents.find(d=>d.id===loadedAnalysisDoc&&d.name===loadedDocument);if(!doc){doc={id:crypto.randomUUID(),name:loadedDocument,type:'入力原文',status:'原本未保管／手入力の読取原文'};p.documents.push(doc);}DOC_ANALYSIS.capture(doc,p,{text:$('drawing-text').value,rows:undefined,page:Number($('drawing-page').value)||1,corrected:true});loadedAnalysisDoc=doc.id;draft=parseDocument($('drawing-text').value,loadedDocument,Number($('drawing-page').value)||1);renderDraft();$('drawing-status').textContent=draft.length+'候補。原文は分析用に保存しました。コピーした原文との一致を確認してください。';}catch(e){alert(e.message);}};
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
 const rows=suggestions(i);box.classList.add('price-match-panel');box.innerHTML='<summary>別候補・単価を照合<span class="price-match-hint">押して候補を開く／閉じる</span></summary><p>品名・公共型番・寸法・単位・工事区分で照合します。過去案件は参考価格です。表示は推定確率ではありません。</p>'+(i.missing?'<p>不足情報：'+esc(i.missing.join('、'))+'</p>':'')+(rows.length?rows.map((s,n)=>`<div class="price-choice"><b>${esc(yen(s.unitPrice))}／${esc(s.unit)}｜${esc(s.priceKind)}</b><p>${esc(s.name)} ${esc(s.spec)}<br>資料種類：${esc(s.sourceType)}<br>${esc(s.match)}｜${esc(s.source.file)}・${esc(s.source.sheet)}・${esc(s.source.priceCell)}<br>版・年月：${esc(s.edition||'要確認')}／メーカー：${esc(s.manufacturer||'未登録')} ${esc(s.model||'')}<br>確認事項：${esc(s.missing.join('、'))}</p><button type="button" class="pub-apply" data-price-choice="${n}">この単価候補を仮反映</button></div>`).join(''):'<p>適合する価格候補がありません。資料読取・単価候補画面で根拠資料を登録してください。</p>');
 const sources=['営繕工事標準単価表','メーカー資料','建設物価','建築コスト情報'];box.insertAdjacentHTML('beforeend','<p class="wb-muted">'+sources.map(k=>esc(k)+'：'+(rows.some(x=>x.sourceType===k)?'照合候補あり':'該当資料は未登録・未照合')).join('<br>')+'</p>');$('wb-dialog-body').prepend(box);box.querySelectorAll('[data-price-choice]').forEach(b=>b.onclick=()=>{
  const s=rows[Number(b.dataset.priceChoice)];applySuggestion(i,s);$('wi-price').value=s.unitPrice;$('wi-mode').value=i.mode;$('wi-evidence').value=i.evidence;$('wi-price-check').checked=false;$('wi-quantity-check').checked=false;$('wi-maker-price').value=i.priceReference.manufacturer?s.unitPrice:'';const r=i.priceReference;for(const [id,k] of [['wi-ref-type','type'],['wi-ref-name','name'],['wi-ref-edition','edition'],['wi-ref-location','location'],['wi-maker','manufacturer'],['wi-model','model']])$(id).value=r[k]||'';
  if(i.mode==='compose'){$('wi-electrician').value=i.electrician;$('wi-ordinary').value=i.ordinary;$('wi-quote').value=s.unitPrice;$('wi-reduction').value=100;$('wi-electric-coeff').value=0;$('wi-ordinary-coeff').value=0;}
  $('wi-mode').dispatchEvent(new Event('input',{bubbles:true}));box.open=false;WB.mutate('単価候補を仮反映',i.name+'｜'+s.source.file+'｜採用は未確認');
 });
});
function sync(){
 const p=WB.project(),t=WB.totals(),pending=p.items.filter(i=>!i.archived&&i.state!=='adopted'&&i.state!=='excluded');
 $('shell-project').innerHTML=WB.projects().map(p=>`<option value="${esc(p.id)}" ${p.id===WB.project().id?'selected':''}>${p.role==='reference'?'参考｜':'今回｜'}${esc(p.title)}</option>`).join('');
 $('home-cards').innerHTML=[['数量・仕様の未確認',pending.filter(i=>!i.quantityChecked).length],['単価根拠の未確認',pending.filter(i=>!i.priceChecked).length],['保留',p.items.filter(i=>!i.archived&&i.state==='hold').length],['採用',t.count]].map(([n,v])=>`<div class="card"><small>${n}</small><div class="n">${v}</div><small>選択中工事の実データ</small></div>`).join('');
 $('home-stage').textContent=p.role==='reference'?'参考工事です。今回の工事を作成して資料を読み込んでください。':WB.ready()?'設計書の最終確認済みです。Excel出力へ進めます。':'設計確認中：候補 '+pending.length+'件／採用 '+t.count+'件／採用明細計 '+yen(t.rawDirect);
 $('home-next').innerHTML=pending.slice(0,4).map(i=>`<div class="task"><b>${esc(i.name)} ${esc(i.spec)}</b><small>${!i.quantityChecked?'数量・仕様を確認':'数量確認済み'}／${!i.priceChecked?'単価根拠を確認':'単価確認済み'}${i.state==='hold'?'／保留理由：'+esc(i.reason):''}</small><button class="ghost" data-home-item="${esc(i.id)}">確認する</button></div>`).join('')||'<p>明細の確認待ちはありません。共通費・最終確認へ進んでください。</p>';
 if(!p.id){$('home-stage').textContent='新規工事を作成すると、確認する項目が表示されます。';$('home-next').textContent='工事はまだありません。新規工事を作成するか、利用を許可された共有工事を取り込んでください。';}
 $('home-next').querySelectorAll('[data-home-item]').forEach(b=>b.onclick=()=>{show('estimate');WB.openItem(b.dataset.homeItem);});
 $('ledger-rows').innerHTML=WB.projects().length?WB.projects().map(p=>`<tr><td>${p.role==='reference'?'参考':'今回'}</td><td>${esc(p.title)}</td><td>電気</td><td>${p.items.length}候補／${WB.adopted(p).length}採用</td><td><button class="ghost" data-select-project="${esc(p.id)}">開く</button></td></tr>`).join(''):'<tr><td colspan="5">工事はまだありません。「新規工事を作成」から始めてください。</td></tr>';
 $('ledger-rows').querySelectorAll('[data-select-project]').forEach(b=>b.onclick=()=>{WB.select(b.dataset.selectProject);show('estimate');});renderPrices();
}
$('shell-project').onchange=e=>WB.select(e.target.value);window.addEventListener('wb-render',sync);sync();
window.addEventListener('wb-workspace-changed',()=>{draft=[];loadedTarget=null;loadedDocument='';loadedAnalysisDoc=null;for(const n of document.querySelectorAll('#assist input,#assist textarea'))if(n.type!=='button')n.value='';for(const id of ['drawing-result','drawing-status','price-list','price-status','batch-preview','batch-status'])document.getElementById(id)?.replaceChildren();});
let lastDrawingProject=WB.project().id;window.addEventListener('wb-render',()=>{if(lastDrawingProject!==WB.project().id){lastDrawingProject=WB.project().id;draft=[];loadedTarget=null;loadedDocument='';loadedAnalysisDoc=null;clearPhoto();for(const id of ['drawing-file-label','drawing-text'])$(id).value='';$('drawing-result').replaceChildren();$('drawing-status').textContent='';}});
window.ASSIST={isReading:()=>busy,parseLines,parseDocument,suggestions,readPdf,applySuggestion};
})();

/* Excel batch preview: preserve existing records, never adopt automatically. */
(()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFKC').replace(/\s/g,'').toUpperCase();
let batch=null,reading=false;
function same(a,b){
 if(norm(a.name)!==norm(b.name)||norm(a.unit)!==norm(b.unit))return false;
 const x=norm(a.spec),y=norm(b.spec);if(x===y)return true;
 // Explicitly edited item codes can identify an enriched specification. Added
 // accessories remain distinct rows even when their base fixture code matches.
 if(/[+＋]/.test(x+y))return false;
 const enriched=(item,other)=>{const code=norm(item.publicType);return code&&code===norm(other.spec)&&norm(item.spec).startsWith(code+'/');};
 return Boolean(enriched(a,b)||enriched(b,a));
}
function duplicate(row,items){return items.some(i=>same(row,i));}
function render(){const p=WB.project();$('batch-preview').innerHTML='<table><thead><tr><th>追加</th><th>品名・規格</th><th>数量</th><th>単価候補</th><th>出典・確認事項</th></tr></thead><tbody>'+batch.rows.map((r,k)=>{const dup=duplicate(r,p.items)||batch.rows.slice(0,k).some(i=>same(i,r));r.duplicate=dup;return `<tr><td><input type="checkbox" data-batch-row="${k}" aria-label="${esc(r.name+' '+r.spec)}を追加" ${dup?'disabled':'checked'}></td><td>${esc(r.name)}<br>${esc(r.spec)}</td><td>${esc(r.quantity)} ${esc(r.unit)}</td><td>${r.unitPrice===null?'未登録':esc(r.unitPrice.toLocaleString('ja-JP')+'円')}</td><td>${esc(r.source.sheet+'／'+r.source.quantityCell)}<br>${dup?'重複候補：追加せず既存項目を保持':'数量・仕様・単価の適用条件は未確認'}</td></tr>`;}).join('')+'</tbody></table>';$('batch-add').hidden=!batch.rows.some(r=>!r.duplicate);}
$('batch-excel').onchange=async e=>{if(reading||window.DOC_ANALYSIS?.isReading()){alert('他の読取の完了をお待ちください。');e.target.value='';return;}const file=e.target.files[0];if(!file)return;reading=true;window.OMUTA_BATCH_READING=true;batch=null;$('batch-add').hidden=true;$('batch-preview').textContent='';const target=WB.project().id;
try{if(WB.project().role!=='current')throw Error('今回の工事を選んでください。');$('batch-status').textContent='Excelを読み取り中です。';const source=await WB.parseWorkbook(file);if(WB.project().id!==target)throw Error('工事が切り替わりました。読み直してください。');const rows=WB.workbookCandidates(source);
for(const r of rows){r.publicType=WB.publicCode(r.spec);r.priceReference=r.unitPrice===null?{}:{type:'過去Excel',name:source.filename,location:r.source.sheet+'／'+r.source.priceCell};r.evidence='数量出典：'+source.filename+'／'+r.source.sheet+'／'+r.source.quantityCell+'。'+(r.unitPrice===null?'単価未登録。':'単価出典：'+r.source.priceCell+'（保存済みの値）。')+'数量・仕様・単価の適用条件は未確認。';r.reason='Excelから一括読取。数量・仕様と単価の適用条件は確認待ち。';}
const doc=await SOURCE_IMPORTS.save(file,WB.project(),'Excel',rows.length+'件の読取候補（未確認）');DOC_ANALYSIS.capture(doc,WB.project(),DOC_ANALYSIS.workbookPayload(source));batch={target,rows,filename:file.name,documentId:doc.id};render();$('batch-status').textContent=rows.length+'件を読み取りました。工事と明細を確認し、追加する行を選んでください。単価空欄は0円にしません。';
}catch(err){$('batch-status').textContent='読取できませんでした：'+err.message;}finally{reading=false;window.OMUTA_BATCH_READING=false;e.target.value='';}};
window.addEventListener('source-deleted',e=>{if(batch&&e.detail.project===batch.target&&e.detail.docs.some(d=>d.id===batch.documentId)){batch=null;$('batch-preview').replaceChildren();$('batch-add').hidden=true;$('batch-status').textContent='資料を削除しました。';}});
$('batch-add').onclick=()=>{try{if(!batch||WB.project().id!==batch.target)throw Error('工事が変わりました。Excelを読み直してください。');const p=JSON.parse(JSON.stringify(WB.project())),selected=[...$('batch-preview').querySelectorAll('[data-batch-row]:checked')].map(x=>batch.rows[Number(x.dataset.batchRow)]);let count=0;
for(const r of selected){if(duplicate(r,p.items))continue;p.items.push({...JSON.parse(JSON.stringify(r)),id:crypto.randomUUID(),state:'candidate',quantityChecked:false,priceChecked:false});count++;}
if(!count)throw Error('追加する明細がありません。');p.approval=null;p.history.push({at:new Date().toISOString(),action:'Excel明細を一括追加',detail:batch.filename+'／'+count+'件'});WB.restoreProject(p);render();$('batch-status').textContent=count+'件を確認候補へ追加しました。既存項目は保持しました。「候補の確認へ」で確認してください。';if(!WB.localSaved())throw Error('端末保存に失敗しました。再追加せず、作業バックアップを保存してください。');
}catch(err){$('batch-status').textContent=err.message;}};
})();
