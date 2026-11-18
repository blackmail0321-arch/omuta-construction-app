"""Only the public manual runtime; never copy source documents or local records."""
from pathlib import Path
import zipfile
ROOT=Path(__file__).resolve().parents[1]
FILES={'index.html','style.css','app.js','sources.js','glossary.js','reader.js','manifest.webmanifest','data/manual.json','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','downloads/manual.pdf','downloads/check-sheets.pdf','downloads/procurement-guide.pdf','service-worker.js'}
def manual_assets():
    with zipfile.ZipFile(ROOT/'apps/construction-manual/offline-site.zip') as archive:
        if set(archive.namelist())!=FILES:raise ValueError('Review manual runtime files before publishing')
        return {name:archive.read(name) for name in sorted(FILES)}


def embedded_manual():
    """Same public manual, with scripts/styles/data inlined for a same-origin Blob frame."""
    import base64,re
    files=manual_assets()
    html=files['index.html'].decode()
    html=re.sub(r'<script src="(?:sources|glossary|reader|app)\.js" defer></script>','',html)
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+files['style.css'].decode()+'</style>')
    html=re.sub(r'<link rel="(?:manifest|apple-touch-icon)"[^>]*>','',html)
    icon='data:image/svg+xml;base64,'+base64.b64encode(files['icons/icon.svg']).decode()
    html=html.replace('icons/icon.svg',icon)
    public='https://blackmail0321-arch.github.io/omuta-construction-app/manual/'
    html=html.replace('href="downloads/','href="'+public+'downloads/')
    payload=files['data/manual.json'].decode().replace('<','\\u003c')
    scripts='<script type="application/json" id="manual-bundled-data">'+payload+'</script><script>window.MANUAL_EMBEDDED=true;</script>'
    for filename in ['sources.js','glossary.js','reader.js','app.js']:
        source=files[filename].decode()
        if filename=='app.js':source=source.replace('downloads/',public+'downloads/')
        scripts+='<script>'+source.replace('</script','<\\/script')+'</script>'
    return html.replace('</body>',scripts+'</body>')


def attach_manual_bundle(html):
    """Refresh the reader from the canonical ZIP at every deploy/archive build."""
    import base64,re
    payload=base64.b64encode(embedded_manual().encode()).decode()
    tag='<script type="application/octet-stream" id="construction-manual-bundle">'+payload+'</script>'
    pattern=r'<script type="application/octet-stream" id="construction-manual-bundle">[^<]*</script>'
    result,count=re.subn(pattern,lambda m:tag,html)
    if count!=1:raise ValueError('Expected one embedded manual placeholder in the editor')
    return result
