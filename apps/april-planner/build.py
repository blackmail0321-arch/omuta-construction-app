"""Build a self-contained, empty-data planner and its downloadable runtime ZIP."""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
html = (ROOT / 'index.template.html').read_text()
for marker, filename in [('CSS', 'style.css'), ('INITIAL', 'initial-data.js'), ('VENDOR', 'vendor/fflate.js'), ('CORE', 'core.js'), ('APP', 'app.js')]:
    contents = (ROOT / filename).read_text()
    if marker != 'CSS':
        contents = contents.replace('</script', '<\\/script')
    html = html.replace('/*' + marker + '*/', contents)
(ROOT / 'index.html').write_text(html)
files = ['index.html', 'start_windows.bat', 'start_mac_linux.sh', 'README.md', 'vendor/LICENSE-fflate']
with zipfile.ZipFile(ROOT / 'planner.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for filename in files:
        data = (ROOT / filename).read_bytes()
        info = zipfile.ZipInfo('planner/' + filename, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, data)
with zipfile.ZipFile(ROOT / 'planner.zip') as archive:
    assert archive.testzip() is None
print('Built index.html and planner.zip (no personal schedule records).')
