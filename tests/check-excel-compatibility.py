"""Validate XML, relationship targets and markup-compatibility namespace bindings."""
import sys,zipfile,posixpath,re,datetime,struct
from lxml import etree as E
MC='{http://schemas.openxmlformats.org/markup-compatibility/2006}'
ORDER='sheetPr dimension sheetViews sheetFormatPr cols sheetData sheetCalcPr sheetProtection protectedRanges scenarios autoFilter sortState dataConsolidate customSheetViews mergeCells phoneticPr conditionalFormatting dataValidations hyperlinks printOptions pageMargins pageSetup headerFooter rowBreaks colBreaks customProperties cellWatches ignoredErrors smartTags drawing legacyDrawing legacyDrawingHF picture oleObjects controls webPublishItems tableParts extLst'.split()
RANK={name:i for i,name in enumerate(ORDER)}
for path in sys.argv[1:]:
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  names=set(z.namelist())
  for info in z.infolist():
   datetime.datetime(*info.date_time)
   with open(path,'rb') as f:
    f.seek(info.header_offset+12);date=struct.unpack('<H',f.read(2))[0]
    assert date!=0,(info.filename,'invalid local ZIP date')
  for name in names:
   if name.endswith(('.xml','.rels')):
    root=E.fromstring(z.read(name))
    for element in root.iter():
     for prefix in element.get(MC+'Ignorable','').split():assert prefix in element.nsmap,(name,'undeclared Ignorable',prefix)
    if E.QName(root).localname=='worksheet':
     rank=-1
     for element in root:
      key=E.QName(element).localname
      if key not in RANK:continue
      assert RANK[key]>=rank,(name,'worksheet child order',key)
      rank=RANK[key]
    if name=='xl/workbook.xml' and root.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}externalReferences') is None:
     for defined in root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}definedName'):
      assert not re.search(r'\[\d+\]',defined.text or ''),(name,'orphan external name',defined.get('name'))
    if name.endswith('.rels'):
     for rel in root:
      if rel.get('TargetMode')=='External':continue
      base='' if name=='_rels/.rels' else name.rsplit('/_rels/',1)[0]+'/'
      target=rel.get('Target');resolved=target.lstrip('/') if target.startswith('/') else posixpath.normpath(base+target)
      assert resolved in names,(name,'missing target',resolved)
 print('PASS ZIP, XML, relationship targets and compatibility namespaces:',path)
