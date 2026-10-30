"""Remove original project values while retaining form styles, geometry and formulas."""
import base64,io,re,zipfile
from lxml import etree as ET
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
S='{'+NS['s']+'}'
LABELS='数量|担当|規格|精算|工事名|工事場所|工事概要|工期|年度|起工|NO|ＮＯ|単価|金額|名称|品名|単位|摘要|備考|直接工事費|共通仮設費|現場管理費|一般管理費等|一般管理費|工事価格|消費税等|消費税|工事費|工事費計|工事費合計|合計|計|小計|純工事費|工事原価|設計書|予算書|内訳書|代価表|電気設備|新設|撤去|式|台|個|本|面|組|ｍ|m|円|人|人日|材料費|労務費|雑材料費|電工|普通作業員|普通工|雑材|率|加算率|歩掛|取付|取外し|端数処理|算定基準|改修|新築|Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅰ.計|Ⅱ.計|工種|種目|年月日|市長|大牟田市|電気設備工事|設計|積算|審査|課長|係長|担当者|予定価格|契約金額|税抜|税込|工事費内訳書|総括表|契約締結の日の翌日から|日間|工事区分|電気設備工事費|一般管理費等率|現場管理費率|共通仮設費率|直接工事費（千円）|工期（月）|現場環境改善費|処分費|共通費対象外|共通費対象外金額'
normalize=lambda s:re.sub(r'\s+','',s).replace('：','').replace(':','')
LABELS={normalize(x) for x in (LABELS+'|工事番号|起工・変更伺|決裁区分|次長|部長|助役|工事担当|建築住宅課|主査|課長補佐|－|予算執行|財政課|変更年月日|決裁年月日|令和|一般|会計|予算費目|款|項|目|補・単|費|添付書類|1．随契理由書2．依頼書3．公有財産取得処分同決裁済写|工事（委託）|監督員|業務吸収人員|地内|現場説明|有・無|１．入札室２．現地|一式|↓特殊工事費|日付|日|仕様|建設物価|ｺｽﾄ|低減率|補給率|雑材率|その他|採用単価|見積比較表|％').split('|')}
REMOVED=('xl/media/','xl/drawings/','xl/comments','xl/threadedComments/','xl/persons/','xl/printerSettings/','xl/externalLinks/','customXml/','docProps/')
def sanitize(encoded,budget=False):
 source=zipfile.ZipFile(io.BytesIO(base64.b64decode(encoded)));out=io.BytesIO();active={1,2,3,4,6} if budget else {1,2,3,4}
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
  for name in source.namelist():
   if name.startswith(REMOVED):continue
   data=source.read(name)
   if name.endswith(('.xml','.rels')):
    root=ET.fromstring(data)
    if name=='xl/sharedStrings.xml':
     for si in root:
      for ph in si.findall(S+'rPh'):si.remove(ph)
      text=''.join(si.xpath('.//s:t/text()',namespaces=NS))
      if normalize(text) not in LABELS:
       for child in list(si):si.remove(child)
       ET.SubElement(si,S+'t').text=''
      else:
       for ph in si.findall(S+'rPh'):si.remove(ph)
    if re.match(r'xl/worksheets/sheet\d+\.xml$',name):
     sheet=int(re.search(r'sheet(\d+)',name)[1])
     for cell in root.findall('.//s:c',NS):
      if sheet not in active:
       for child in list(cell):cell.remove(child)
       cell.attrib.pop('t',None)
      elif cell.find(S+'f') is not None:
       for child in cell.findall(S+'v'):cell.remove(child)
      elif cell.get('t')=='inlineStr':
       if normalize(''.join(cell.xpath('.//s:t/text()',namespaces=NS))) not in LABELS:
        for child in list(cell):cell.remove(child)
        cell.attrib.pop('t',None)
      elif cell.get('t')!='s':
       for child in cell.findall(S+'v'):cell.remove(child)
     for tag in ['drawing','legacyDrawing','legacyDrawingHF','picture','oleObjects','extLst','hyperlinks','headerFooter']:
      for child in root.findall('.//s:'+tag,NS):child.getparent().remove(child)
     for child in root.findall('.//s:pageSetup',NS):
      for key in list(child.attrib):
       if key.endswith('}id'):del child.attrib[key]
    if name=='xl/workbook.xml':
     for child in root.findall('.//s:definedName',NS):
      if child.get('name') not in ['_xlnm.Print_Area','_xlnm.Print_Titles']:child.getparent().remove(child)
     for child in root.findall('.//s:externalReferences',NS):child.getparent().remove(child)
    if name.endswith('.rels'):
     for child in list(root):
      typ=child.get('Type','').lower()
      if child.get('TargetMode')=='External' or any(t in typ for t in ['image','drawing','comment','vml','printersettings','externallink','metadata/core-properties','extended-properties','custom-properties','customxml','person']):root.remove(child)
    if name=='[Content_Types].xml':
     for child in list(root):
      if child.get('PartName','').lstrip('/').startswith(REMOVED):root.remove(child)
    data=ET.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True)
   target.writestr(name,data)
 return base64.b64encode(out.getvalue()).decode()
