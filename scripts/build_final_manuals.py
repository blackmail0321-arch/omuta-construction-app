"""Build readable web, print PDF, Word and local checklist; no deployment."""
from pathlib import Path
import html, re, json, zipfile, hashlib, subprocess, base64
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderSVG
from docx import Document
from docx.shared import Inches, Pt
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'manuals/final-2026-11-05'
OUT=Path('/workspace/output/設備工事_最終確認とマニュアル_2026-11-05')
OUT.mkdir(parents=True,exist_ok=True)
URL='https://omuta-construction-editor.pages.dev/'
widget=qr.QrCodeWidget(URL,barLevel='M');x,y,x1,y1=widget.getBounds();d=Drawing(180,180,transform=[150/(x1-x),0,0,150/(y1-y),15,15]);d.add(widget)
renderSVG.drawToFile(d,str(OUT/'アプリ起動QR.svg'))
import fitz
svg=fitz.open(OUT/'アプリ起動QR.svg');svg[0].get_pixmap(matrix=fitz.Matrix(3,3)).save(OUT/'アプリ起動QR.png')
css='''*{box-sizing:border-box}html{font-size:20px;scroll-behavior:auto}body{font-family:"Noto Sans CJK JP","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;color:#20354b;background:#f2f5f9;margin:0;line-height:1.95}main{max-width:780px;margin:auto;padding:24px 20px 64px}h1{font-size:1.7rem;line-height:1.55;letter-spacing:.02em;margin:12px 0 24px}h2{font-size:1.35rem;line-height:1.6;color:#173e69;border-bottom:3px solid #c5daef;padding-bottom:14px;margin:0 0 24px}h3{font-size:1.1rem;line-height:1.65}p,li{overflow-wrap:anywhere}p{margin:0 0 1.15em}a{color:#1655a1;text-underline-offset:4px}a:focus-visible,button:focus-visible{outline:3px solid #1865bb;outline-offset:4px}.cover,.chapter,.contents{background:white;border:1px solid #d9e3ed;border-radius:14px;padding:30px;margin-bottom:28px}.chapter{scroll-margin-top:180px}.contents ul{list-style:none;padding:0}.contents li{margin:12px 0}.toolbar{display:flex;flex-wrap:wrap;gap:10px;max-width:780px;margin:auto;padding:12px 20px;position:sticky;top:0;background:#ffffff;align-items:center;z-index:2;border-bottom:1px solid #d9e3ed}button,input,select,textarea{font:inherit;padding:10px;border:1px solid #b4c7da;border-radius:8px;max-width:100%}button{cursor:pointer;background:white;color:#173e69;min-height:46px}.eyebrow{font-size:.8rem;color:#566d85}.notice{padding:18px;background:#edf5ff;border-left:4px solid #2566a9;border-radius:6px}img{max-width:100%;height:auto}.qr{width:180px;display:block;margin:16px 0}.back{font-size:.85rem}.contents a{display:block;padding:4px 0}.print-only{display:none}@media(max-width:600px){html{font-size:18px}main{padding:16px 12px 48px}.cover,.chapter,.contents{padding:22px 18px}h1{font-size:1.55rem}.toolbar{padding:10px 12px;gap:7px}.toolbar button{font-size:16px;padding:8px}}@media print{@page{size:A4;margin:20mm 19mm}html{font-size:14pt}body{background:white;color:#172b42;line-height:1.85}main{max-width:none;padding:0}.toolbar,.back,.screen-only{display:none!important}.cover,.chapter,.contents{border:0;border-radius:0;padding:0;margin:0}.cover,.contents{break-after:page}.chapter{break-before:page}.chapter h2{break-after:avoid}h1{font-size:26pt}h2{font-size:20pt}p{orphans:3;widows:3}a{color:inherit;text-decoration:none}.print-only{display:block}.qr{width:155px}.notice{border:1px solid #a9c8e3;padding:14px}li{margin-bottom:8px}}'''
for path in sorted(SRC.glob('*.md')):
 raw=path.read_text();(OUT/path.name).write_text(raw)
 doc=Document()
 normal=doc.styles['Normal'];normal.font.name='Yu Gothic';normal.font.size=Pt(13)
 normal.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'),'游ゴシック')
 normal.paragraph_format.line_spacing=1.65;normal.paragraph_format.space_after=Pt(12)
 for name,size in [('Title',25),('Heading 1',19)]:
  doc.styles[name].font.name='Yu Gothic';doc.styles[name].font.size=Pt(size)
 title=raw.splitlines()[0][2:];doc.add_heading(title,0)
 pdfname=path.stem+'.pdf';chapters=[];preface=[];current=None
 for line in raw.splitlines()[1:]:
  if not line.strip():continue
  if line.startswith('## '):
   current={'title':line[3:],'lines':[]};chapters.append(current)
  elif current is None:preface.append(line)
  else:current['lines'].append(line)
 if path.name.startswith('01_'):
  doc.add_picture(str(OUT/'アプリ起動QR.png'),width=Inches(1.7));doc.add_paragraph(URL)
 for line in preface:doc.add_paragraph(line)
 doc.add_page_break();doc.add_heading('目次',1)
 for c in chapters:doc.add_paragraph(c['title'])
 parts=['<header class="cover"><p class="eyebrow">設備工事 統合管理 · 読みやすさ改訂版 · 2026年11月5日</p><h1>'+html.escape(title).replace(' Volume 1 ','<br>Volume 1 ')+'</h1><p class="notice screen-only">iPadではこのWeb版をお使いください。文字は下のボタンで大きくでき、画面幅に合わせて折り返します。</p>']
 if path.name.startswith('01_'):parts.append('<img class="qr" src="アプリ起動QR.svg" width="180" alt="アプリ起動QR"><p><a href="'+URL+'">工事アプリを開く</a></p><p class="eyebrow">QRは起動用URLのみ。認証情報は含みません。</p>')
 parts.extend('<p class="eyebrow">'+html.escape(v)+'</p>' for v in preface)
 parts.append('</header><nav class="contents" id="contents" aria-label="目次"><h2>目次</h2><ul>')
 for i,c in enumerate(chapters):parts.append('<li><a href="#chapter-'+str(i)+'">'+html.escape(c['title'])+'</a></li>')
 parts.append('</ul></nav>')
 for i,c in enumerate(chapters):
  doc.add_page_break();doc.add_heading(c['title'],1)
  parts.append('<section class="chapter" id="chapter-'+str(i)+'"><h2>'+html.escape(c['title'])+'</h2>')
  for line in c['lines']:
   sentences=re.split(r'(?<=。)(?=.)',line) if len(line)>85 else [line]
   for sentence in sentences:
    parts.append('<p>'+html.escape(sentence)+'</p>');doc.add_paragraph(sentence)
  parts.append('<p class="back"><a href="#contents">目次へ戻る</a></p></section>')
 toolbar='<div class="toolbar" aria-label="文字サイズと保存"><button type="button" onclick="resizeText(-2)" aria-label="文字を小さく">文字 −</button><button type="button" onclick="resizeText(2)" aria-label="文字を大きく">文字 ＋</button><button type="button" onclick="print()">印刷・PDF保存</button><a href="'+html.escape(pdfname)+'">PDF版</a><a href="index.html">資料一覧</a></div>'
 script='<script>let fontSize=innerWidth<=600?18:20;function resizeText(step){fontSize=Math.max(16,Math.min(30,fontSize+step));document.documentElement.style.fontSize=fontSize+"px";}</script>'
 (OUT/(path.stem+'.html')).write_text('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(title)+'</title><style>'+css+'</style></head><body>'+toolbar+'<main>'+''.join(parts)+'</main>'+script+'</body></html>')
 doc.save(OUT/(path.stem+'.docx'))
# Chromium embeds the installed Japanese font into PDFs instead of relying on a viewer substitute.
subprocess.run(['node',str(ROOT/'scripts/render_manual_pdfs.cjs'),str(OUT)],check=True)

# Standalone checklist: no external libraries/network. No automatic integration into production app.
items=[];phase=''
for line in (SRC/'03_工事手順とチェックリスト.md').read_text().splitlines():
 if re.match(r'## [A-G]\.',line):phase=line[3:]
 m=re.match(r'^([A-G]\d\d) (.+)$',line)
 if m:items.append({'id':m[1],'text':m[2],'phase':phase})
checklist_css='body{font:18px/1.8 system-ui,sans-serif;color:#17324e;max-width:980px;margin:auto;padding:24px}h2{border-bottom:2px solid #2463a4;padding-top:20px}button,input,select,textarea{font:inherit;padding:10px;box-sizing:border-box;max-width:100%}button{cursor:pointer}p{overflow-wrap:anywhere}@media print{body{font-size:10pt;padding:0}}'
checkhtml='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>工事手順チェック表</title><style>CSS .row{border:1px solid #ccd9e6;border-radius:10px;padding:16px;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:block}input,select,textarea{width:100%}.toolbar{display:flex;flex-wrap:wrap;gap:10px;position:sticky;top:0;background:#fff;padding:12px 0}textarea{min-height:70px}.status{color:#164d80}@media(max-width:600px){.grid{grid-template-columns:1fr}}@media print{.row{break-inside:avoid}.toolbar{display:none}textarea{height:90px}}</style><h1>工事手順チェック表</h1><p>補助記録／工事アプリ・共有DBとは接続しません。判定基準は契約図書・提出要領で確認。手順の詳細は別冊をご参照ください。</p><div class="grid"><label>工事名<input id="project"></label><label>担当者<input id="person"></label></div><div class="toolbar"><button id="save">JSONを保存</button><label>JSONから読込<input id="restore" type="file" accept=".json"></label><button id="print">印刷・PDF保存</button><a href="index.html">目次</a></div><p id="notice" role="status"></p><p id="count"></p><main id="rows"></main><script>
const ITEMS=ITEMDATA;const KEY='omuta-procedure-checklist-v1';let data={kind:KEY,project:'',person:'',rows:{}};const el=id=>document.getElementById(id);let storage=true;
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.kind!==KEY||!parsed.rows)throw Error();data=parsed;}}catch{storage=false;el('notice').textContent='端末内保存を利用できないか、既存保存を読み込めません。自動上書きを停止しました。JSON保存を使ってください。';}
function text(tag,value,parent){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
function persist(){if(storage)try{localStorage.setItem(KEY,JSON.stringify(data));el('notice').textContent='このブラウザ内に保存しました。別端末へはJSON保存で移してください。';}catch{storage=false;el('notice').textContent='端末内保存に失敗。画面は閉じずJSON保存してください。';}counts();}
function counts(){let done=0,na=0;ITEMS.forEach(i=>{if(data.rows[i.id]?.state==='完了')done++;if(data.rows[i.id]?.state==='対象外')na++;});el('count').textContent=ITEMS.length+'項目／完了 '+done+'／対象外 '+na+'／その他 '+(ITEMS.length-done-na);}
function render(){el('project').value=data.project||'';el('person').value=data.person||'';el('rows').replaceChildren();let phase='';for(const item of ITEMS){if(item.phase!==phase){text('h2',item.phase,el('rows'));phase=item.phase;}const r=data.rows[item.id]||{},s=document.createElement('section');s.className='row';text('h3',item.id+' '+item.text,s);const grid=document.createElement('div');grid.className='grid';for(const [key,name,type] of [['state','状態','select'],['owner','担当者','text'],['due','予定日','date'],['checked','確認日','date'],['evidence','根拠資料・確認者','text'],['note','備考・対象外理由','textarea']]){const l=document.createElement('label');l.textContent=name;const e=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');if(e.tagName==='INPUT')e.type=type;if(type==='select')for(const v of ['未着手','作業中','要確認','完了','対象外']){const o=document.createElement('option');o.value=v;o.textContent=v;e.append(o);}e.value=r[key]||(key==='state'?'未着手':'');e.oninput=()=>{data.rows[item.id]||={};data.rows[item.id][key]=e.value;persist();};l.append(e);grid.append(l);}s.append(grid);el('rows').append(s);}counts();}
for(const key of ['project','person'])el(key).oninput=()=>{data[key]=el(key).value;persist();};el('print').onclick=()=>print();el('save').onclick=()=>{const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='工事手順チェック_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);};
el('restore').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5000000)throw Error('ファイルが大きすぎます');const d=JSON.parse(await f.text());if(d.kind!==KEY||typeof d.project!=='string'||typeof d.person!=='string'||!d.rows||typeof d.rows!=='object'||Array.isArray(d.rows))throw Error('このチェック表のJSONではありません');const clean={kind:KEY,project:d.project,person:d.person,rows:{}};for(const i of ITEMS){const r=d.rows[i.id];if(!r)continue;clean.rows[i.id]={};for(const k of ['state','owner','due','checked','evidence','note'])if(typeof r[k]==='string')clean.rows[i.id][k]=r[k];}if(!confirm('表示中のチェック内容を読み込んだJSONへ置き換えます。必要なら先にJSON保存してください。'))return;data=clean;render();persist();}catch(error){el('notice').textContent='読み込めません：'+error.message;}finally{e.target.value='';}};render();
</script></html>'''.replace('CSS',checklist_css).replace('ITEMDATA',json.dumps(items,ensure_ascii=False))
(OUT/'04_工事手順チェック表.html').write_text(checkhtml)
links=['<li><a href="'+html.escape(p.name)+'">'+html.escape(p.name)+'</a></li>' for p in sorted(OUT.iterdir()) if p.suffix in ['.pdf','.docx','.html'] and p.name!='index.html']
(OUT/'index.html').write_text('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>マニュアル一式</title><style>'+css+'</style><h1>設備工事 マニュアル一式</h1><p>2026年11月5日版。まず01の操作冊子、現状と未確認事項は02、工事手順は03、記録には04をご利用ください。</p><p>PDFは配布・印刷用、Wordは編集用、HTMLはブラウザ閲覧用です。チェック表は端末内保存で、共有DBとは接続しません。</p><img src="アプリ起動QR.svg" width="180" alt="アプリ起動QR"><p><a href="'+URL+'">アプリを開く</a></p><ul>'+''.join(links)+'</ul></html>')
print(OUT)
# Public documentation only. Explicit filenames prevent including runtime user data.
public=SRC/'published';public.mkdir(exist_ok=True)
names={
 'app-manual.html':'01_アプリ操作マニュアル完全版.html',
 'app-manual.pdf':'01_アプリ操作マニュアル完全版.pdf',
 'app-manual.docx':'01_アプリ操作マニュアル完全版.docx',
 'specification.html':'02_仕様書と最終確認結果.html',
 'specification.pdf':'02_仕様書と最終確認結果.pdf',
 'specification.docx':'02_仕様書と最終確認結果.docx',
 'construction-guide.html':'03_工事手順とチェックリスト.html',
 'construction-guide.pdf':'03_工事手順とチェックリスト.pdf',
 'construction-guide.docx':'03_工事手順とチェックリスト.docx',
 'construction-checklist.html':'04_工事手順チェック表.html',
}
for target,source in names.items():
 content=(OUT/source).read_bytes()
 if target.endswith('.html'):
  markup=content.decode().replace('href="index.html"','href="/volume1.html"')
  markup=markup.replace('src="アプリ起動QR.svg"','src="data:image/svg+xml;base64,'+base64.b64encode((OUT/'アプリ起動QR.svg').read_bytes()).decode()+'"')
  for public_name,original_name in names.items():
   if public_name.endswith('.pdf'):markup=markup.replace('href="'+original_name+'"','href="'+public_name+'?v=readable-20261105"')
  content=markup.encode()

 (public/target).write_bytes(content)
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='manifest.json'}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
archive=OUT.parent/(OUT.name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(OUT.iterdir()):
  if p.is_file():z.write(p,p.name)
assert zipfile.ZipFile(archive).testzip() is None
(public/'manuals-complete.zip').write_bytes(archive.read_bytes())
print('Manual bundle:',archive)
