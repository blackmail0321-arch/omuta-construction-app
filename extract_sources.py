import pathlib, zipfile, json, xml.etree.ElementTree as E, hashlib, posixpath
N={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def extract(f):
 z=zipfile.ZipFile(f); ss=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  ss=[''.join((t.text or '') for t in list(si.findall('m:t',N))+list(si.findall('m:r/m:t',N))) for si in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',N)]
 rel={x.attrib['Id']:x.attrib['Target'] for x in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
 sheets=[]; issues=[]
 for sn in E.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',N):
  target=rel[sn.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
  path=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
  rows=[]
  for row in E.fromstring(z.read(path)).findall('m:sheetData/m:row',N):
   cells={}
   for c in row.findall('m:c',N):
    ref=c.attrib['r'];v=c.find('m:v',N);formula=c.find('m:f',N);t=c.attrib.get('t')
    val=v.text if v is not None else None
    if t=='s': val=ss[int(val)] if val else None
    elif t=='inlineStr': val=''.join((t.text or '') for t in list(c.findall('m:is/m:t',N))+list(c.findall('m:is/m:r/m:t',N)))
    elif t!='e' and val is not None:
     try: val=float(val);val=int(val) if val.is_integer() else val
     except ValueError: pass
    if val is not None or formula is not None: cells[ref.rstrip('0123456789')]={'value':val,'formula':formula.text if formula is not None else None,'type':t}
   rows.append({'row':int(row.attrib['r']),'cells':cells})
  sheets.append({'name':sn.attrib['name'],'rows':rows})
 for d in E.fromstring(z.read('xl/workbook.xml')).findall('m:definedNames/m:definedName',N):
  if '#N/A' in (d.text or ''): issues.append('印刷設定の定義に#N/Aあり（原本未変更）')
 return {'id':hashlib.sha256(f.name.encode()).hexdigest()[:12],'filename':f.name,'sheets':sheets,'issues':issues,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
sources=[extract(f) for f in sorted(pathlib.Path('upload').glob('*.xlsx'))]
pathlib.Path('app/sources.json').write_text(json.dumps(sources,ensure_ascii=False))
for x in sources:
 print(x['filename'],sum(len(s['rows']) for s in x['sheets']))
