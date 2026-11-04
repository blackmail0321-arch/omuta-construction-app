"""Build the empty-data offline web app and portable runtime ZIP."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parent
parts = [('CSS', 'style.css'), ('INITIAL', 'initial-data.js'), ('VENDOR', 'vendor/fflate.js'), ('CORE', 'core.js'), ('APP', 'app.js'), ('OFFLINE', 'offline.js')]
assets = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']
inputs = ['index.template.html', 'sw.js', *[filename for _, filename in parts], *assets]
hash_input = hashlib.sha256()
for filename in inputs:
    hash_input.update(filename.encode())
    hash_input.update((ROOT / filename).read_bytes())
version = hash_input.hexdigest()[:20]
html = (ROOT / 'index.template.html').read_text()
for marker, filename in parts:
    contents = (ROOT / filename).read_text()
    if marker != 'CSS':
        contents = contents.replace('</script', '<\\/script')
    html = html.replace('/*' + marker + '*/', contents)
(ROOT / 'index.html').write_text(html)
(ROOT / 'service-worker.js').write_text((ROOT / 'sw.js').read_text().replace('__PLANNER_BUILD__', version))
runtime = ['index.html', 'service-worker.js', *assets]
with zipfile.ZipFile(ROOT / 'offline-site.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for filename in runtime:
        info = zipfile.ZipInfo(filename, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (ROOT / filename).read_bytes())
files = [*runtime, 'start_windows.bat', 'start_mac_linux.sh', 'README.md', 'vendor/LICENSE-fflate']
with zipfile.ZipFile(ROOT / 'planner.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for filename in files:
        data = (ROOT / filename).read_bytes()
        info = zipfile.ZipInfo('planner/' + filename, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, data)
with zipfile.ZipFile(ROOT / 'planner.zip') as archive:
    assert archive.testzip() is None
print('Built offline index.html, service-worker.js and planner.zip; version', version)
