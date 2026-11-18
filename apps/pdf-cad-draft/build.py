from pathlib import Path
import shutil,zipfile,hashlib,json
R=Path(__file__).resolve().parent
source=R.parent/'savings-ledger/vendor/pdfjs'
site=R/'site';shutil.rmtree(site,ignore_errors=True);site.mkdir()
for name in ['index.html','style.css','core.js','pdf-vectors.js','local-store.js','app.js','image-source.js','tiff-worker.js','README.md']:shutil.copy(R/name,site/name)
version=hashlib.sha256(b''.join((R/n).read_bytes() for n in ['index.html','style.css','core.js','pdf-vectors.js','local-store.js','app.js','image-source.js','tiff-worker.js','vendor/tiff/UTIF.js','vendor/tiff/pako_inflate.min.js'])).hexdigest()[:12]
html=(site/'index.html').read_text().replace('<meta name="theme-color"','<meta name="cad-version" content="'+version+'"><meta name="theme-color"')
(site/'version.json').write_text(json.dumps({'version':version}))
for name in ['style.css','core.js','pdf-vectors.js','local-store.js','app.js','image-source.js','tiff-worker.js']:html=html.replace(name+'\"',name+'?v='+version+'\"')
(site/'index.html').write_text(html)
shutil.copytree(source,site/'vendor/pdfjs')
shutil.copytree(R/'vendor/tiff',site/'vendor/tiff')
with zipfile.ZipFile(R/'pdf-cad-draft.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in site.rglob('*'):
  if f.is_file():z.write(f,str(f.relative_to(site)))
print('Built empty-document PDF CAD draft app; no private drawings included')
