"""The estimating app must ship byte-identical public manual assets."""
from pathlib import Path
import sys,zipfile,io,json
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from manual_assets import manual_assets
from runtime_assets import assets
files=manual_assets();release=assets()
for name,content in files.items():
 assert content==(ROOT/'apps/construction-manual'/name).read_bytes(),name
 assert release['manual/'+name]==content,name
with zipfile.ZipFile(io.BytesIO(release['downloads/volume1-with-guide.zip'])) as z:
 for name,content in files.items():assert z.read('Volume1/manual/'+name)==content
assert len(json.loads(files['data/manual.json'])['terms'])==68
assert 'construction-manual-bundle' in release['index.html'].decode()
assert 'マニュアルは画面案です' not in release['index.html'].decode()
print('PASS canonical manual equals editor package and app archive; all 68 terms and PDF navigation included')

# The in-app reader includes the current canonical data and needs no asset requests.
import base64,re
html=release['index.html'].decode()
encoded=re.search(r'<script type="application/octet-stream" id="construction-manual-bundle">([^<]+)</script>',html)[1]
embedded=base64.b64decode(encoded).decode()
payload=re.search(r'<script type="application/json" id="manual-bundled-data">(.*?)</script>',embedded,re.S)[1]
assert json.loads(payload)==json.loads(files['data/manual.json'])
assert 'window.MANUAL_EMBEDDED=true' in embedded
assert not re.search(r'<script[^>]+src=',embedded)
assert '<link rel="stylesheet"' not in embedded
assert 'data:image/svg+xml;base64,' in embedded
assert 'https://blackmail0321-arch.github.io/omuta-construction-app/manual/downloads/' in embedded
print('PASS embedded document has current canonical data, scripts, CSS and icon; no manual path dependency')
