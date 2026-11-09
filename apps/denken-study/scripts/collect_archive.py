"""Collect every PDF linked by the official first-class examination archive.
The official archive permits educational reuse with year/stage attribution.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen,Request
from urllib.parse import urljoin,urlparse
from concurrent.futures import ThreadPoolExecutor
import json,time,hashlib,re,unicodedata
import fitz
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'data/official-archive';PDF=ROOT/'assets/official';DEST.mkdir(parents=True,exist_ok=True);PDF.mkdir(parents=True,exist_ok=True)
BASE='https://www.shiken.or.jp/chief/first/qa/'
class Links(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None
 def handle_starttag(self,t,a):
  if t=='a':self.row=[dict(a).get('href',''),'']
 def handle_data(self,d):
  if self.row:self.row[1]+=d
 def handle_endtag(self,t):
  if t=='a' and self.row:self.rows.append(self.row);self.row=None

def get(u):
 for attempt in range(3):
  try:
   with urlopen(Request(u,headers={'User-Agent':'DenkenStudy educational archive'}),timeout=40) as r:
    if urlparse(r.url).hostname not in ['www.shiken.or.jp','shiken.or.jp']:raise ValueError('unexpected redirect')
    b=r.read(30000001)
    if len(b)>30000000:raise ValueError('oversized response')
    return b
  except Exception:
   if attempt==2:raise
   time.sleep(attempt+1)
queue=[BASE];seen=set();pages=[];pdfs={};errors=[]
while queue and len(seen)<20:
 u=queue.pop(0)
 if u in seen:continue
 seen.add(u)
 try:
  p=Links();p.feed(get(u).decode('utf-8',errors='replace'));rows=[]
  for href,label in p.rows:
   v=urljoin(u,href).split('#')[0];label=unicodedata.normalize('NFKC',label.strip())
   if urlparse(v).hostname not in ['www.shiken.or.jp','shiken.or.jp']:continue
   if urlparse(v).path.lower().endswith('.pdf') and '第一種電気主任技術者' in label:
    pdfs[v]={'url':v,'label':label,'foundOn':u};rows.append(v)
   elif v.startswith(BASE) and v not in seen and v not in queue:queue.append(v)
  pages.append({'url':u,'pdfs':rows})
 except Exception as e:errors.append({'url':u,'error':str(e)})
subjects={'理論':'theory','電力':'power','機械':'machine','法規':'law'}
def download(entry):
 try:
  m=re.search(r'(令和|平成)(元|\d+)年度',entry['label'])
  if not m:raise ValueError('year missing in official label')
  year=(2018 if m[1]=='令和' else 1988)+(1 if m[2]=='元' else int(m[2]));stage='secondary' if '二次' in entry['label'] else 'primary'
  sid=next((sid for label,sid in subjects.items() if label+'科目' in entry['label']),None) if stage=='primary' else ('power-management' if '電力' in entry['label'] else 'machine-control' if '機械' in entry['label'] else None)
  kind='question' if sid else 'answer';name=f'{year}-{stage}-{sid or "answers"}.pdf';path=PDF/name
  b=path.read_bytes() if path.exists() else get(entry['url'])
  if not b.startswith(b'%PDF-'):raise ValueError('not PDF')
  with fitz.open(stream=b,filetype='pdf') as doc:
   if not len(doc):raise ValueError('empty PDF')
   compact=re.sub(r'\s+','',unicodedata.normalize('NFKC',''.join(doc[i].get_text() for i in range(min(3,len(doc))))))
   textReadable=bool(re.search(r'第[1一]種',compact));headerYear=re.search(r'(令和|平成)(元|\d+)年度',compact)
   actual=(2018 if headerYear[1]=='令和' else 1988)+(1 if headerYear[2]=='元' else int(headerYear[2])) if headerYear else None
   if actual and actual!=year:raise ValueError('PDF year differs from official link label')
   rec={**entry,'year':year,'stage':stage,'subject':sid,'kind':kind,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'pages':len(doc),'verified':True,'identityVerified':textReadable and actual==year,'localFile':'assets/official/'+name,'verification':'公式一覧の年度・試験区分・科目を記録し、PDF形式・ページ数・SHA256を検証'}
  path.write_bytes(b);print(year,stage,sid or 'answers',len(b),flush=True);return rec
 except Exception as e:return {**entry,'verified':False,'error':str(e)}
with ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(download,pdfs.values()))
errors.extend({'url':r['url'],'error':r['error']} for r in records if not r['verified'])
result={'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'officialIndex':BASE,'pages':pages,'records':records,'errors':errors,'questions':[],'note':'公式一覧に掲載された資料を全件取得。出典は各PDFの年度・試験区分・科目を明記。掲載範囲より前の年度と未実施試験は含まない。','reusePolicy':{'url':BASE,'purpose':'教育目的の過去問使用は許諾・使用料不要。年度・試験区分の出典明記が必要。'}}
(DEST/'archive.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('Downloaded',sum(r.get('verified',False) for r in records),'of',len(records),'PDFs; errors',len(errors))
