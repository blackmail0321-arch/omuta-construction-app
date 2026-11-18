from pathlib import Path
import hashlib,shutil,json,zlib,struct,zipfile
R=Path(__file__).resolve().parent;site=R/'site';shutil.rmtree(site,ignore_errors=True);site.mkdir()
names=['index.html','style.css','core.js','app.js']
v=hashlib.sha256(b''.join((R/n).read_bytes() for n in names)).hexdigest()[:16]
for n in names:shutil.copy(R/n,site/n)
s=(site/'index.html').read_text().replace('<meta name="theme-color"','<meta name="app-version" content="'+v+'"><meta name="theme-color"')
for n in names[1:]:s=s.replace(n+'"',n+'?v='+v+'"')
(site/'index.html').write_text(s)
(site/'version.json').write_text(json.dumps({'version':v}))
# Self-contained icons; no runtime dependencies or external requests.
def png(size):
 points=[(.55,.1),(.24,.58),(.47,.58),(.39,.9),(.78,.4),(.54,.4)]
 def inside(x,y):
  hit=False;j=len(points)-1
  for i,(a,b) in enumerate(points):
   c,d=points[j]
   if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:hit=not hit
   j=i
  return hit
 data=b''.join(b'\0'+bytes(sum(([242,250,245,255] if inside((x+.5)/size,(y+.5)/size) else [33,94,89,255] for x in range(size)),[])) for y in range(size))
 def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b'')
for size in [192,512]:(site/f'icon-{size}.png').write_bytes(png(size))
manifest={'name':'電圧降下ノート','short_name':'電圧降下','lang':'ja','start_url':'./','scope':'./','display':'standalone','background_color':'#f4f7f5','theme_color':'#173e43','icons':[{'src':f'icon-{n}.png','sizes':f'{n}x{n}','type':'image/png','purpose':'any maskable'} for n in [192,512]]}
(site/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False))
urls=['./','./index.html',*[f'./{n}?v={v}' for n in names[1:]],'./manifest.webmanifest','./icon-192.png','./icon-512.png']
sw='''const CACHE='voltage-drop-v1-__VERSION__',FILES=__FILES__;
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(FILES);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('voltage-drop-v1-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url),scope=new URL(self.registration.scope);if(e.request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname)||u.pathname.endsWith('version.json'))return;if(e.request.mode==='navigate'){e.respondWith((async()=>{try{return await fetch(e.request)}catch(_){return (await caches.open(CACHE)).match('./index.html')}})());return}if(!FILES.some(f=>new URL(f,self.registration.scope).href===u.href))return;e.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(e.request)||fetch(e.request)})())});'''.replace('__VERSION__',v).replace('__FILES__',json.dumps(urls))
(site/'service-worker.js').write_text(sw)
shutil.copy(R/'README.md',site/'README.md')
with zipfile.ZipFile(R/'offline-site.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in site.iterdir():z.write(f,f.name)
print('Built local voltage-drop calculator:',v)
