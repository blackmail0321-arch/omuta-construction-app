"""Check that runtime packages contain no source projects, old archives or populated templates."""
from pathlib import Path
import sys,re,json,base64,zipfile,io,tempfile
from lxml import etree as ET
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from package_shared import package
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with tempfile.TemporaryDirectory() as d:
 out=Path(d)/'runtime';package(out)
 assert not(out/'editor/integrated').exists()
 assert not list((out/'editor').rglob('*sources.json'))
 assert not list((out/'editor').rglob('*.b64'))
 archives=[out/'editor/downloads/volume1-with-guide.zip'];assert archives[0].is_file()
 assert {p.name for p in (out/'editor').rglob('*.zip')} <= {'volume1-with-guide.zip','manuals-complete.zip'}
 with zipfile.ZipFile(archives[0]) as archive:
  assert not any('/integrated/' in n or n.endswith(('.b64','sources.json')) for n in archive.namelist())
  assert b"url:''" in archive.read('Volume1/shared/shared-config.js')
 html=(out/'editor/index.html').read_text()
 assert 'const WB_SOURCES=[]' in html and 'const WB_REFERENCES=[]' in html
 templates=json.loads(re.search(r'const WB_EXPORT_TEMPLATES=(.*?);\n',html)[1])
 for kind,encoded in templates.items():
  z=zipfile.ZipFile(io.BytesIO(base64.b64decode(encoded)))
  assert not any(n.startswith(('xl/media/','xl/comments','docProps/','xl/externalLinks/')) for n in z.namelist())
  root=ET.fromstring(z.read('xl/sharedStrings.xml'))
  texts=root.xpath('.//s:t/text()',namespaces=N)
  assert all(not any(x in t for x in ['勝立','みなと小学校','市営住宅','橋本','新勝立']) for t in texts)
  for name in z.namelist():
   if re.match(r'xl/worksheets/sheet\d+\.xml$',name):
    doc=ET.fromstring(z.read(name))
    assert not doc.xpath('//s:c[s:f]/s:v',namespaces=N)
    assert not doc.xpath('//s:c[not(@t="s") and not(@t="inlineStr")]/s:v',namespaces=N)
  price=ET.fromstring(z.read('xl/worksheets/sheet'+('6' if kind=='budget' else '4')+'.xml'))
  for col in ['L','M','N','O','P','Q','R','S']:
   assert price.xpath('//s:c[@r="'+col+'6"]/s:f',namespaces=N)
 print('PASS runtime allowlist, no reference seed/source/archive, sanitized templates without original literals/values/caches, unit formulas retained')
