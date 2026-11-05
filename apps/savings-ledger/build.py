from pathlib import Path
import hashlib,json,zipfile,base64,re
R=Path(__file__).resolve().parent
for name,expected in json.loads((R/'vendor/SHA256SUMS.json').read_text()).items():
 if hashlib.sha256((R/'vendor'/name).read_bytes()).hexdigest()!=expected:raise ValueError('Vendor checksum mismatch: '+name)
parts=[('CSS','style.css'),('FFLATE','vendor/fflate.js'),('OCR','vendor/ocr/tesseract.min.js'),('CORE','core.js'),('EXCEL','excel.js'),('PAYROLL','payroll.js'),('VAULT','vault.js'),('APP','app.js'),('OFFLINE','offline.js')]
html=(R/'index.template.html').read_text()
for marker,name in parts:
 text=(R/name).read_text()
 if marker!='CSS':text=text.replace('</script','<\\/script')
 html=html.replace('/*'+marker+'*/',text)
scripts=re.findall(r'<script>(.*?)</script>',html,re.S)
styles=re.findall(r'<style>(.*?)</style>',html,re.S)
sha=lambda text: "'sha256-"+base64.b64encode(hashlib.sha256(text.encode()).digest()).decode()+"'"
policy="default-src 'self'; base-uri 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; script-src 'self' 'wasm-unsafe-eval' "+' '.join(map(sha,scripts))+"; style-src 'self' "+' '.join(map(sha,styles))+"; worker-src 'self' blob:; connect-src 'self' blob: data:; img-src 'self' blob: data:; font-src 'self' blob: data:; manifest-src 'self'"
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+policy+'">',1)
(R/'index.html').write_text(html)
assets=['index.html','manifest.webmanifest',*[str(f.relative_to(R)) for f in sorted((R/'icons').glob('*.png'))]]
for f in sorted((R/'vendor').rglob('*')):
 if not f.is_file():continue
 name=str(f.relative_to(R))
 if name.startswith(('vendor/pdfjs/','vendor/ocr/')) and f.suffix not in ['.json','.md'] and 'LICENSE' not in f.name and f.name!='tesseract.min.js':assets.append(name)
h=hashlib.sha256()
for name in assets+['sw.js']:h.update(name.encode());h.update((R/name).read_bytes())
version=h.hexdigest()[:20]
(R/'service-worker.js').write_text((R/'sw.js').read_text().replace('__VERSION__',version).replace('__FILES__',json.dumps(assets)).replace('__HASHES__',json.dumps({name:'sha256-'+base64.b64encode(hashlib.sha256((R/name).read_bytes()).digest()).decode() for name in assets})))
licenses=[str(f.relative_to(R)) for f in sorted((R/'vendor').rglob('*')) if f.is_file() and ('LICENSE' in f.name or f.name in ['SOURCE.json','VERSIONS.json','SHA256SUMS.json'])]
runtime=[*assets,'service-worker.js',*licenses]
for name,prefix in [('offline-site.zip',''),('savings.zip','savings/')]:
 with zipfile.ZipFile(R/name,'w',zipfile.ZIP_DEFLATED) as z:
  for f in runtime+(['README.md','SECURITY.md'] if name=='savings.zip' else []):
   if not (R/f).exists():continue
   info=zipfile.ZipInfo(prefix+f,date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,(R/f).read_bytes())
 with zipfile.ZipFile(R/name) as z:assert z.testzip() is None
print('Built empty-data savings app;',len(assets),'offline assets;',round(sum((R/f).stat().st_size for f in runtime)/1024/1024,1),'MiB;',version)
