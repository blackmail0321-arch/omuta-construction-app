"""Validate XML, relationship targets and markup-compatibility namespace bindings."""
import sys,zipfile,posixpath
from lxml import etree as E
MC='{http://schemas.openxmlformats.org/markup-compatibility/2006}'
ORDER='sheetPr dimension sheetViews sheetFormatPr cols sheetData sheetCalcPr sheetProtection protectedRanges scenarios autoFilter sortState dataConsolidate customSheetViews mergeCells phoneticPr conditionalFormatting dataValidations hyperlinks printOptions pageMargins pageSetup headerFooter rowBreaks colBreaks customProperties cellWatches ignoredErrors smartTags drawing legacyDrawing legacyDrawingHF picture oleObjects controls webPublishItems tableParts extLst'.split()
RANK={name:i for i,name in enumerate(ORDER)}
for path in sys.argv[1:]:
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  names=set(z.namelist())
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
    if name.endswith('.rels'):
     for rel in root:
      if rel.get('TargetMode')=='External':continue
      base='' if name=='_rels/.rels' else name.rsplit('/_rels/',1)[0]+'/'
      target=rel.get('Target');resolved=target.lstrip('/') if target.startswith('/') else posixpath.normpath(base+target)
      assert resolved in names,(name,'missing target',resolved)
 print('PASS ZIP, XML, relationship targets and compatibility namespaces:',path)
