from pathlib import Path
import shutil,zipfile
R=Path(__file__).resolve().parent
source=R.parent/'savings-ledger/vendor/pdfjs'
site=R/'site';shutil.rmtree(site,ignore_errors=True);site.mkdir()
for name in ['index.html','style.css','core.js','app.js','README.md']:shutil.copy(R/name,site/name)
shutil.copytree(source,site/'vendor/pdfjs')
with zipfile.ZipFile(R/'pdf-cad-draft.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in site.rglob('*'):
  if f.is_file():z.write(f,str(f.relative_to(site)))
print('Built empty-document PDF CAD draft app; no private drawings included')
