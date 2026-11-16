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
assert 'manual/index.html#home' in release['index.html'].decode()
assert 'マニュアルは画面案です' not in release['index.html'].decode()
print('PASS canonical manual equals editor package and app archive; all 68 terms and PDF navigation included')
