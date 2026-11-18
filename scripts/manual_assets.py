"""Only the public manual runtime; never copy source documents or local records."""
from pathlib import Path
import zipfile
ROOT=Path(__file__).resolve().parents[1]
FILES={'index.html','style.css','app.js','sources.js','glossary.js','reader.js','manifest.webmanifest','data/manual.json','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','downloads/manual.pdf','downloads/check-sheets.pdf','downloads/procurement-guide.pdf','service-worker.js'}
def manual_assets():
    with zipfile.ZipFile(ROOT/'apps/construction-manual/offline-site.zip') as archive:
        if set(archive.namelist())!=FILES:raise ValueError('Review manual runtime files before publishing')
        return {name:archive.read(name) for name in sorted(FILES)}
