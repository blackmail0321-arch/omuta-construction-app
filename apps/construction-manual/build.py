"""Build a static, empty-record manual app. No network or user records in the package."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parent
for size in [192,512]:
 if not (root/f'icons/icon-{size}.png').is_file():raise FileNotFoundError('Missing install icon')
glossary=root/'data/glossary.json'
if glossary.exists():
 manual=root/'data/manual.json';data=json.loads(manual.read_text());data['terms']=json.loads(glossary.read_text());manual.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
inspection=root/'data/inspection-guide.json'
if inspection.exists():
 manual=root/'data/manual.json';data=json.loads(manual.read_text());guide=json.loads(inspection.read_text())
 for collection,key in [('sources','source'),('chapters','chapter'),('stages','stage')]:
  rows=data[collection];item=guide[key];position=next((i for i,x in enumerate(rows) if x['id']==item['id']),len(rows))
  if position<len(rows):rows[position]=item
  else:rows.append(item)
 for c in data['chapters']:
  if c['id'] not in guide['related']:continue
  pages=guide['related'][c['id']];c['references']=[r for r in c.get('references',[]) if r['sourceId']!='inspection-r7']
  c['references'].append(dict(sourceId='inspection-r7',pages=pages,where='PDF内ページ（紙面の印刷番号は20を加える）',why='この工程で起こりやすい過去の検査指摘と予防確認'))
  marker='<aside class="inspection-crosslink">'
  if marker not in c['body']:c['body']+=marker+'<p><a href="#chapter/c25">令和7年度の検査指摘例から、この工程の確認漏れを防ぐ →</a></p></aside>'
 data['version']='1.5';data['date']='2026-11-17';manual.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
assets=['index.html','style.css','app.js','sources.js','glossary.js','manifest.webmanifest','data/manual.json','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','downloads/manual.pdf','downloads/check-sheets.pdf','downloads/procurement-guide.pdf']
version=hashlib.sha256(Path(__file__).read_bytes()+b''.join((root/f).read_bytes() for f in assets)).hexdigest()[:12]
sw='''/* Offline app shell only. Local project records are not sent or cached here. */
const BASE=new URL('./',self.location.href),PREFIX='construction-manual-'+BASE.pathname+'-',CACHE=PREFIX+'VERSION',FILES=ASSETS.map(f=>new URL(f,BASE).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{try{const cache=await caches.open(CACHE);await cache.addAll(FILES);}catch(e){await caches.delete(CACHE);throw e;}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;if(event.request.mode==='navigate'&&[BASE.pathname,BASE.pathname+'index.html'].includes(url.pathname)){event.respondWith((async()=>{return (await caches.match(new URL('index.html',BASE).href,{cacheName:CACHE}))||fetch(event.request);})());return;}if(FILES.includes(url.href))event.respondWith((async()=>{const cached=await caches.match(event.request,{cacheName:CACHE});return cached||fetch(event.request);})());});
'''.replace('VERSION',version).replace('ASSETS',json.dumps(assets))
(root/'service-worker.js').write_text(sw)
with zipfile.ZipFile(root/'offline-site.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in assets+['service-worker.js']:z.write(root/name,name)
print('manual app',version,'bytes',(root/'offline-site.zip').stat().st_size)
