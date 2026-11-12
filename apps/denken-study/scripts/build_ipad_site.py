"""Build a static iPad study PWA. No server, credentials, learner records or AI gateway."""
from pathlib import Path
import hashlib,json,struct,zlib,zipfile,shutil
ROOT=Path(__file__).resolve().parents[1]
def png(size):
 bg=(21,45,60);fg=(167,210,185);poly=[(.53,.14),(.27,.55),(.47,.55),(.39,.86),(.74,.39),(.53,.39)]
 def inside(x,y):
  yes=False;j=len(poly)-1
  for i,(a,b) in enumerate(poly):
   c,d=poly[j]
   if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:yes=not yes
   j=i
  return yes
 raw=bytearray()
 for y in range(size):
  raw.append(0)
  for x in range(size):raw.extend(fg if inside((x+.5)/size,(y+.5)/size) else bg)
 def chunk(t,b):return struct.pack('!I',len(b))+t+b+struct.pack('!I',zlib.crc32(t+b)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')

def build(level=1):
 out=ROOT/'web' if level==1 else ROOT/'web/third'
 if out.exists():shutil.rmtree(out)
 out.mkdir()
 base=(ROOT/('index.html' if level==1 else 'third.html')).read_text(encoding='utf-8')
 head='''<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icon-180.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="電験一種"><meta name="theme-color" content="#152d3c"><script>window.DENKEN_WEB_ONLY=true;</script><style>.web-only #ai-help-box,.web-only #external-setup-card,.web-only #ai-configuration-card,.web-only #ai-state-card,.web-only #materials-update-card{display:none}.ipad-guide{margin:16px 24px 0;padding:12px 16px;border:1px solid #dae4de;border-radius:9px;background:#edf3ef;font-size:13px}.ipad-guide summary{cursor:pointer;font-weight:600}.ipad-guide p{margin:8px 0}.ipad-guide #offline-state{display:block;font-size:12px;margin-top:6px}@media(max-width:800px){.ipad-guide{margin:12px 16px 0}}@media print{.ipad-guide{display:none}}</style>'''
 guide='''<div class="ipad-guide"><button type="button" id="check-update">更新を確認</button><span id="update-state" role="status" aria-live="polite"></span></div><details class="ipad-guide"><summary>iPad Web版の使い方・保存状況</summary><p>Safariで開き、共有ボタン（四角から上向きの矢印）→「ホーム画面に追加」で、次回からアイコンで起動できます。</p><p>演習・採点・復習・学習計画・模試はこの端末内に保存します。PCとiPadの記録は自動同期しません。「設定・記録」から書き出し／読み込みで引き継いでください。</p><p>AI接続と外部資料の取得は、この静的Web版では利用できません。AIキーをこの公開サイトに埋め込んではいけません。ログイン付きのHTTPSサーバーを別途用意する必要があります。</p><p>追加した年度と二次試験のPDF原本は、オフライン用の自動保存の対象外です。「教材と出典」で年度別ZIPまたはPDFを「ファイル」に保存してください。</p><p>オフライン保存済みの表示を確認してから通信を切ってください。端末の保存容量やSafariの動作によりデータが消える場合があるため、定期的に学習記録を書き出してください。</p><span id="offline-state" role="status" aria-live="polite">オフライン保存を準備しています…</span></details>'''
 boot='''<script>(async()=>{const el=document.querySelector('#offline-state');if(!('serviceWorker' in navigator)){el.textContent='このブラウザではオフライン保存を利用できません。通信のある状態で利用してください。';return}try{const reg=await navigator.serviceWorker.register('./service-worker.js');const report=async()=>{const ready=await navigator.serviceWorker.ready;const names=await caches.keys();const prefix='denken-ipad:'+ready.scope+':';const saved=await Promise.all(names.filter(n=>n.startsWith(prefix)).map(async n=>(await caches.open(n)).match(new URL('./index.html',ready.scope))));el.textContent=saved.some(Boolean)?'オフライン保存済み。初回の準備が完了しました。':'オフライン保存を確認できません。通信を維持してください。'};const installing=reg.installing;if(installing)installing.addEventListener('statechange',()=>{if(installing.state==='redundant')el.textContent='オフライン保存に失敗しました。通信を維持し、保存容量を確認してください。'});await report()}catch(e){el.textContent='オフライン保存ができませんでした。HTTPSで開き、通信を維持して利用してください。'}})();</script>'''
 boot=boot+'<script>'+ (ROOT/'pwa-update.js').read_text(encoding='utf-8')+'</script>'
 if level==3:head=head.replace('電験一種','電験三種')
 page=base.replace('<html lang="ja">','<html lang="ja" class="web-only">',1).replace('</head>',head+'</head>',1).replace('<main class="content"',guide+'<main class="content"',1).replace('</body>',boot+'</body>',1)
 version=hashlib.sha256(page.encode()).hexdigest()[:16]
 page=page.replace('__DENKEN_RELEASE__',version)
 (out/'index.html').write_text(page,encoding='utf-8')
 archive_path=ROOT/('data/official-archive/archive.json' if level==1 else 'data/third/archive.json')
 if archive_path.exists():
  archive=json.loads(archive_path.read_text(encoding='utf-8'))
  records=[r for r in archive['records'] if r.get('verified')]
  for rec in records:
   dest=out/rec['localFile'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/rec['localFile'],dest)
  for year in sorted({r['year'] for r in records},reverse=True)[:2]:
   subset=[r for r in records if r['year']==year]
   with zipfile.ZipFile(out/f'past-papers-{year}.zip','w',zipfile.ZIP_DEFLATED) as package:
    for rec in subset:
     file=ROOT/rec['localFile'];package.write(file,rec['stage']+'/'+file.name)
    package.writestr('README_JA.txt',(f'{year}年度 第{level}種電気主任技術者試験 公式問題・解答\n出典：'+archive['officialIndex']+'\n対象年度の公開済み問題・正答。原本は改変していません。\n教育目的の利用条件・出典・SHA256はmanifest.jsonを参照してください。\n二次の自動採点と全小問の詳しい解説は未対応です。\n').encode('utf-8-sig'))
    package.writestr('manifest.json',json.dumps({'officialIndex':archive['officialIndex'],'checkedAt':archive['checkedAt'],'records':subset,'reusePolicy':archive['reusePolicy']},ensure_ascii=False,indent=2))
   print(year,'PDF package:',(out/f'past-papers-{year}.zip').stat().st_size,'bytes')
 (out/'version.json').write_text(json.dumps({'version':version}),encoding='utf-8')
 manifest={'id':'./','name':'電験一種 学習ノート','short_name':'電験一種','lang':'ja','start_url':'./index.html','scope':'./','display':'standalone','background_color':'#f5f5f0','theme_color':'#152d3c','icons':[{'src':f'./icon-{n}.png','sizes':f'{n}x{n}','type':'image/png','purpose':'any maskable'} for n in [192,512]]}
 if level==3:manifest['name']='電験三種 学習ノート';manifest['short_name']='電験三種'
 (out/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 for n in [180,192,512]:(out/f'icon-{n}.png').write_bytes(png(n))
 worker=''''use strict';
const PREFIX='denken-ipad:'+self.registration.scope+':';
const CACHE=PREFIX+'__VERSION__';
const CORE=['index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'].map(n=>new URL(n,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{try{const cache=await caches.open(CACHE);await cache.addAll(CORE);await self.skipWaiting()}catch(e){await caches.delete(CACHE);throw e}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url),scope=new URL(self.registration.scope);if(req.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;if(req.mode==='navigate'&&[scope.pathname,scope.pathname+'index.html'].includes(url.pathname)){event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(CORE[0])||fetch(req)})());return}if(!CORE.includes(url.href))return;event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(req)||fetch(req)})())});
'''.replace('__VERSION__',version)
 (out/'service-worker.js').write_text(worker,encoding='utf-8')
 (out/'robots.txt').write_text('User-agent: *\nDisallow: /\n',encoding='utf-8')
 return out

def package():
 out=ROOT/'web';output=ROOT/'ipad-site.zip'
 size=sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
 if size>900_000_000:raise ValueError('公開ファイルが容量上限に近づいたため、配信を停止して前の版を保持します')
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
  for p in sorted(out.rglob('*')):
   if p.is_file():z.write(p,p.relative_to(out).as_posix())
 with zipfile.ZipFile(output) as z:assert z.testzip() is None
 print('Dual-class iPad site:',output.stat().st_size,'bytes')
 return output
if __name__=='__main__':
 build(1)
 if (ROOT/'third.html').exists():build(3)
 package()
