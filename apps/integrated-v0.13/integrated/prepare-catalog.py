import json,re
from pathlib import Path
pages=json.loads(Path('integrated/standard-pages.json').read_text());records=[]
for page in pages:
 if page['page'] not in [133,134,135,136,137,138,139,202]:continue
 title=code=unit='';cols=[]
 for lineno,line in enumerate(page['text'].splitlines(),1):
  m=re.search(r'^(.*?)\s+(施工|材料)\s+(E0-\d+)',line)
  if m:title,code=m[1],m[3];cols=[];unit='';continue
  if line in ['個','灯','台']:unit=line;continue
  if re.fullmatch(r'(?:-|L[A-Z]+)(?:\s+L[A-Z]+)*',line):cols=line.split();continue
  if not title or not cols or not unit:continue
  parts=line.split();n=len(cols)
  if len(parts)<=n:continue
  values=parts[-n:];spec=''.join(parts[:-n])
  if not re.match(r'^(L|K|SK)',spec) or not all(re.fullmatch(r'[\d,]+|－',v) for v in values):continue
  for column,v in zip(cols,values):
   if v=='－':continue
   amount=int(v.replace(',',''));loc=f"PDF p{page['page']}／印刷 p{page['page']-11}／{code}／行 {spec}／列 {column}"
   records.append(dict(name='非常用照明' if '非常' in title else '照明器具',spec=spec,publicType=re.sub(r'-+','-',spec.strip('-')),unit=unit,unitPrice=amount,category='新設',priceKind='設計単価',sourceType='営繕工事標準単価表',edition='令和7年度・令和8年3月 福岡県 新営',location=loc,conditions=title+'／表区分：施工／列条件と材料・施工の範囲を確認',source=dict(file='営繕工事標準単価表【新営】電気設備編',sheet=code,priceCell=loc),referenceTitle='共有済み営繕単価表'))
Path('integrated/standard-prices.json').write_text(json.dumps(records,ensure_ascii=False));print('lighting catalog candidates',len(records))
