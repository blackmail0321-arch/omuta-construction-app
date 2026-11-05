"""Generate reviewable manuals and a standalone local checklist; no deployment."""
from pathlib import Path
import html, re, json, zipfile, hashlib
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.lib import colors
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderSVG, renderPM
from docx import Document
from docx.shared import Inches
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'manuals/final-2026-11-05'
OUT=Path('/workspace/output/設備工事_最終確認とマニュアル_2026-11-05')
OUT.mkdir(parents=True,exist_ok=True)
URL='https://omuta-construction-editor.pages.dev/'
widget=qr.QrCodeWidget(URL,barLevel='M');x,y,x1,y1=widget.getBounds();d=Drawing(180,180,transform=[150/(x1-x),0,0,150/(y1-y),15,15]);d.add(widget)
renderSVG.drawToFile(d,str(OUT/'アプリ起動QR.svg'))
try: renderPM.drawToFile(d,str(OUT/'アプリ起動QR.png'),fmt='PNG')
except Exception: pass
pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
styles=getSampleStyleSheet()
for name in ['Normal','Title','Heading1','Heading2']:styles[name].fontName='HeiseiKakuGo-W5'
styles['Normal'].fontSize=10;styles['Normal'].leading=17;styles['Normal'].wordWrap='CJK';styles['Normal'].spaceAfter=8
styles['Title'].fontSize=21;styles['Title'].leading=30
styles['Heading2'].fontSize=14;styles['Heading2'].leading=22;styles['Heading2'].spaceBefore=16
css='''body{font-family:system-ui,"Noto Sans JP",sans-serif;color:#17324e;margin:auto;max-width:980px;padding:24px;line-height:1.8}h1{line-height:1.4}h2{border-bottom:2px solid #2463a4;padding-top:20px}p{overflow-wrap:anywhere}a{color:#1252a1}button,input,select,textarea{font:inherit;padding:10px;box-sizing:border-box;max-width:100%}button{cursor:pointer}img{max-width:100%}@media print{.toolbar{display:none}body{padding:0;font-size:10pt}h2{break-after:avoid}p{orphans:3;widows:3}}'''
for path in sorted(SRC.glob('*.md')):
 raw=path.read_text();(OUT/path.name).write_text(raw)
 parts=[];story=[];doc=Document()
 for line in raw.splitlines():
  if not line.strip():continue
  if line.startswith('# '):
   title=line[2:];parts.append('<h1>'+html.escape(title)+'</h1>');story.append(Paragraph(html.escape(title),styles['Title']));doc.add_heading(title,0)
   if path.name.startswith('01_'):
    parts.append('<img src="アプリ起動QR.svg" width="180" alt="アプリ起動QR"><p><a href="'+URL+'">'+URL+'</a></p>');story.extend([d,Paragraph('アプリ起動用QR（認証情報なし）',styles['Normal'])]);
    if (OUT/'アプリ起動QR.png').exists():doc.add_picture(str(OUT/'アプリ起動QR.png'),width=Inches(1.6))
    doc.add_paragraph(URL)
  elif line.startswith('## '):
   title=line[3:];parts.append('<h2>'+html.escape(title)+'</h2>');story.append(Paragraph(html.escape(title),styles['Heading2']));doc.add_heading(title,1)
  else:
   safe=html.escape(line);parts.append('<p>'+safe+'</p>');story.append(Paragraph(safe,styles['Normal']));doc.add_paragraph(line)
 def footer(canvas,document):
  canvas.setFont('HeiseiKakuGo-W5',8);canvas.drawString(40,25,'設備工事 統合管理／2026-11-05／'+str(document.page))
 SimpleDocTemplate(str(OUT/(path.stem+'.pdf')),rightMargin=42,leftMargin=42,topMargin=40,bottomMargin=42).build(story,onFirstPage=footer,onLaterPages=footer)
 doc.save(OUT/(path.stem+'.docx'))
 (OUT/(path.stem+'.html')).write_text('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(path.stem)+'</title><style>'+css+'</style><div class="toolbar"><button onclick="print()">印刷・PDF保存</button> <a href="index.html">目次</a></div>'+''.join(parts)+'</html>')
# Standalone checklist: no external libraries/network. No automatic integration into production app.
items=[];phase=''
for line in (SRC/'03_工事手順とチェックリスト.md').read_text().splitlines():
 if re.match(r'## [A-G]\.',line):phase=line[3:]
 m=re.match(r'^([A-G]\d\d) (.+)$',line)
 if m:items.append({'id':m[1],'text':m[2],'phase':phase})
checkhtml='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>工事手順チェック表</title><style>CSS .row{border:1px solid #ccd9e6;border-radius:10px;padding:16px;margin:12px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:block}input,select,textarea{width:100%}.toolbar{display:flex;flex-wrap:wrap;gap:10px;position:sticky;top:0;background:#fff;padding:12px 0}textarea{min-height:70px}.status{color:#164d80}@media(max-width:600px){.grid{grid-template-columns:1fr}}@media print{.row{break-inside:avoid}.toolbar{display:none}textarea{height:90px}}</style><h1>工事手順チェック表</h1><p>補助記録／工事アプリ・共有DBとは接続しません。判定基準は契約図書・提出要領で確認。手順の詳細は別冊をご参照ください。</p><div class="grid"><label>工事名<input id="project"></label><label>担当者<input id="person"></label></div><div class="toolbar"><button id="save">JSONを保存</button><label>JSONから読込<input id="restore" type="file" accept=".json"></label><button id="print">印刷・PDF保存</button><a href="index.html">目次</a></div><p id="notice" role="status"></p><p id="count"></p><main id="rows"></main><script>
const ITEMS=ITEMDATA;const KEY='omuta-procedure-checklist-v1';let data={kind:KEY,project:'',person:'',rows:{}};const el=id=>document.getElementById(id);let storage=true;
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(parsed.kind!==KEY||!parsed.rows)throw Error();data=parsed;}}catch{storage=false;el('notice').textContent='端末内保存を利用できないか、既存保存を読み込めません。自動上書きを停止しました。JSON保存を使ってください。';}
function text(tag,value,parent){const e=document.createElement(tag);e.textContent=value;parent.append(e);return e;}
function persist(){if(storage)try{localStorage.setItem(KEY,JSON.stringify(data));el('notice').textContent='このブラウザ内に保存しました。別端末へはJSON保存で移してください。';}catch{storage=false;el('notice').textContent='端末内保存に失敗。画面は閉じずJSON保存してください。';}counts();}
function counts(){let done=0,na=0;ITEMS.forEach(i=>{if(data.rows[i.id]?.state==='完了')done++;if(data.rows[i.id]?.state==='対象外')na++;});el('count').textContent=ITEMS.length+'項目／完了 '+done+'／対象外 '+na+'／その他 '+(ITEMS.length-done-na);}
function render(){el('project').value=data.project||'';el('person').value=data.person||'';el('rows').replaceChildren();let phase='';for(const item of ITEMS){if(item.phase!==phase){text('h2',item.phase,el('rows'));phase=item.phase;}const r=data.rows[item.id]||{},s=document.createElement('section');s.className='row';text('h3',item.id+' '+item.text,s);const grid=document.createElement('div');grid.className='grid';for(const [key,name,type] of [['state','状態','select'],['owner','担当者','text'],['due','予定日','date'],['checked','確認日','date'],['evidence','根拠資料・確認者','text'],['note','備考・対象外理由','textarea']]){const l=document.createElement('label');l.textContent=name;const e=document.createElement(type==='select'?'select':type==='textarea'?'textarea':'input');if(e.tagName==='INPUT')e.type=type;if(type==='select')for(const v of ['未着手','作業中','要確認','完了','対象外']){const o=document.createElement('option');o.value=v;o.textContent=v;e.append(o);}e.value=r[key]||(key==='state'?'未着手':'');e.oninput=()=>{data.rows[item.id]||={};data.rows[item.id][key]=e.value;persist();};l.append(e);grid.append(l);}s.append(grid);el('rows').append(s);}counts();}
for(const key of ['project','person'])el(key).oninput=()=>{data[key]=el(key).value;persist();};el('print').onclick=()=>print();el('save').onclick=()=>{const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='工事手順チェック_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);};
el('restore').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>5000000)throw Error('ファイルが大きすぎます');const d=JSON.parse(await f.text());if(d.kind!==KEY||typeof d.project!=='string'||typeof d.person!=='string'||!d.rows||typeof d.rows!=='object'||Array.isArray(d.rows))throw Error('このチェック表のJSONではありません');const clean={kind:KEY,project:d.project,person:d.person,rows:{}};for(const i of ITEMS){const r=d.rows[i.id];if(!r)continue;clean.rows[i.id]={};for(const k of ['state','owner','due','checked','evidence','note'])if(typeof r[k]==='string')clean.rows[i.id][k]=r[k];}if(!confirm('表示中のチェック内容を読み込んだJSONへ置き換えます。必要なら先にJSON保存してください。'))return;data=clean;render();persist();}catch(error){el('notice').textContent='読み込めません：'+error.message;}finally{e.target.value='';}};render();
</script></html>'''.replace('CSS',css).replace('ITEMDATA',json.dumps(items,ensure_ascii=False))
(OUT/'04_工事手順チェック表.html').write_text(checkhtml)
links=['<li><a href="'+html.escape(p.name)+'">'+html.escape(p.name)+'</a></li>' for p in sorted(OUT.iterdir()) if p.suffix in ['.pdf','.docx','.html'] and p.name!='index.html']
(OUT/'index.html').write_text('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>マニュアル一式</title><style>'+css+'</style><h1>設備工事 マニュアル一式</h1><p>2026年11月5日版。まず01の操作冊子、現状と未確認事項は02、工事手順は03、記録には04をご利用ください。</p><p>PDFは配布・印刷用、Wordは編集用、HTMLはブラウザ閲覧用です。チェック表は端末内保存で、共有DBとは接続しません。</p><img src="アプリ起動QR.svg" width="180" alt="アプリ起動QR"><p><a href="'+URL+'">アプリを開く</a></p><ul>'+''.join(links)+'</ul></html>')
print(OUT)
# Public documentation only. Explicit filenames prevent including runtime user data.
public=SRC/'published';public.mkdir(exist_ok=True)
names={
 'app-manual.pdf':'01_アプリ操作マニュアル完全版.pdf',
 'app-manual.docx':'01_アプリ操作マニュアル完全版.docx',
 'specification.pdf':'02_仕様書と最終確認結果.pdf',
 'specification.docx':'02_仕様書と最終確認結果.docx',
 'construction-guide.pdf':'03_工事手順とチェックリスト.pdf',
 'construction-guide.docx':'03_工事手順とチェックリスト.docx',
 'construction-checklist.html':'04_工事手順チェック表.html',
}
for target,source in names.items():
 content=(OUT/source).read_bytes()
 if target.endswith('.html'):content=content.replace(b'href="index.html"',b'href="/volume1.html"')
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
