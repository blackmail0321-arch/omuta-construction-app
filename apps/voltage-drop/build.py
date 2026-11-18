from pathlib import Path
import hashlib,shutil,json,struct,zipfile
R=Path(__file__).resolve().parent;site=R/'site';shutil.rmtree(site,ignore_errors=True);site.mkdir()
names=['index.html','style.css','core.js','app.js']
icons={n:(R/f'icons/voltage-{n}.png').read_bytes() for n in [192,512]}
for n,data in icons.items():assert struct.unpack('>II',data[16:24])==(n,n)
v=hashlib.sha256(b''.join((R/n).read_bytes() for n in names)+b''.join(icons.values())+(R/'build.py').read_bytes()).hexdigest()[:16]
icon_names={n:f'voltage-icon-{n}-{v}.png' for n in icons}
for n,data in icons.items():(site/icon_names[n]).write_bytes(data)
icon_name=icon_names[192]
for n in names:shutil.copy(R/n,site/n)
s=(site/'index.html').read_text().replace('app-icon.png',icon_name).replace('<meta name="theme-color"','<meta name="app-version" content="'+v+'"><meta name="theme-color"')
for n in names[1:]:s=s.replace(n+'"',n+'?v='+v+'"')
(site/'index.html').write_text(s)
(site/'version.json').write_text(json.dumps({'version':v}))
manifest={'name':'電圧降下ノート','short_name':'電圧降下','lang':'ja','start_url':'./','scope':'./','display':'standalone','background_color':'#f4f7f5','theme_color':'#173e43','icons':[{'src':icon_names[n],'sizes':f'{n}x{n}','type':'image/png','purpose':'any'} for n in [192,512]]}
(site/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False))
urls=['./','./index.html',*[f'./{n}?v={v}' for n in names[1:]],'./manifest.webmanifest']+['./'+name for name in icon_names.values()]
sw='''const CACHE='voltage-drop-v1-__VERSION__',FILES=__FILES__;
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(FILES);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('voltage-drop-v1-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url),scope=new URL(self.registration.scope);if(e.request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname)||u.pathname.endsWith('version.json'))return;if(e.request.mode==='navigate'){e.respondWith((async()=>{try{return await fetch(e.request)}catch(_){return (await caches.open(CACHE)).match('./index.html')}})());return}if(!FILES.some(f=>new URL(f,self.registration.scope).href===u.href))return;e.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(e.request)||fetch(e.request)})())});'''.replace('__VERSION__',v).replace('__FILES__',json.dumps(urls))
(site/'service-worker.js').write_text(sw)
shutil.copy(R/'README.md',site/'README.md')
with zipfile.ZipFile(R/'offline-site.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in site.iterdir():z.write(f,f.name)
print('Built local voltage-drop calculator:',v)
