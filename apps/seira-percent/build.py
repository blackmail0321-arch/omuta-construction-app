from pathlib import Path
import hashlib,shutil,json,zlib,struct,zipfile
R=Path(__file__).resolve().parent;site=R/'site';shutil.rmtree(site,ignore_errors=True);site.mkdir()
names=['index.html','style.css','core.js','app.js']
assets=sorted((R/'assets').glob('*'))
v=hashlib.sha256(b''.join((R/n).read_bytes() for n in names)+b''.join(p.read_bytes() for p in assets)).hexdigest()[:16]
for n in names:shutil.copy(R/n,site/n)
shutil.copytree(R/'assets',site/'assets')
s=(site/'index.html').read_text()
for portrait in ['seira.png','seira.webp','seira.jpg']:
 if (site/'assets'/portrait).exists():
  s=s.replace('assets/seira.svg','assets/'+portrait).replace('聖羅の案内アイコン','聖羅ちゃん');break
s=s.replace('<meta name="theme-color"','<meta name="app-version" content="'+v+'"><meta name="theme-color"')
for n in names[1:]:s=s.replace(n+'"',n+'?v='+v+'"')
(site/'index.html').write_text(s)
(site/'version.json').write_text(json.dumps({'version':v}))
# Self-contained icons; no runtime dependencies or external requests.
def png(size):
 import math
 points=[(.5+(.34 if i%2==0 else .15)*math.sin(i*math.pi/5),.5-(.34 if i%2==0 else .15)*math.cos(i*math.pi/5)) for i in range(10)]
 def inside(x,y):
  hit=False;j=len(points)-1
  for i,(a,b) in enumerate(points):
   c,d=points[j]
   if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:hit=not hit
   j=i
  return hit
 data=b''.join(b'\0'+bytes(sum(([255,250,244,255] if inside((x+.5)/size,(y+.5)/size) else [139,115,170,255] for x in range(size)),[])) for y in range(size))
 def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b'')
for size in [192,512]:(site/f'icon-{size}.png').write_bytes(png(size))
manifest={'name':'聖羅とぱっと計算','short_name':'聖羅と計算','lang':'ja','start_url':'./','scope':'./','display':'standalone','background_color':'#fcf8fc','theme_color':'#7862a6','icons':[{'src':f'icon-{n}.png','sizes':f'{n}x{n}','type':'image/png','purpose':'any maskable'} for n in [192,512]]}
(site/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False))
urls=['./','./index.html',*[f'./{n}?v={v}' for n in names[1:]],'./manifest.webmanifest','./icon-192.png','./icon-512.png']+[ './assets/'+p.name for p in assets]
sw='''const CACHE='seira-percent-v1-__VERSION__',FILES=__FILES__;
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(FILES);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('seira-percent-v1-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url),scope=new URL(self.registration.scope);if(e.request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname)||u.pathname.endsWith('version.json'))return;if(e.request.mode==='navigate'){e.respondWith((async()=>{try{return await fetch(e.request)}catch(_){return (await caches.open(CACHE)).match('./index.html')}})());return}if(!FILES.some(f=>new URL(f,self.registration.scope).href===u.href))return;e.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(e.request)||fetch(e.request)})())});'''.replace('__VERSION__',v).replace('__FILES__',json.dumps(urls))
(site/'service-worker.js').write_text(sw)
shutil.copy(R/'README.md',site/'README.md')
with zipfile.ZipFile(R/'offline-site.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in site.rglob('*'):
  if f.is_file():z.write(f,str(f.relative_to(site)))
print('Built local Seira percentage calculator:',v)
