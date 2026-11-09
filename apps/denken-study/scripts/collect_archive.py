"""Verify every PDF linked by the current official first-class archive.
Original papers stay at their official URLs. Only bibliographic and grading facts are published.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen,Request
from urllib.parse import urljoin,urlparse
import json,time,hashlib,re,sys,tempfile,unicodedata
import fitz
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'data/official-archive';DEST.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT));from materials import parse_answers
class Links(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None
 def handle_starttag(self,t,a):
  if t=='a':self.row=[dict(a).get('href',''),'']
 def handle_data(self,d):
  if self.row:self.row[1]+=d
 def handle_endtag(self,t):
  if t=='a' and self.row:self.rows.append(self.row);self.row=None
BASE='https://www.shiken.or.jp/chief/first/qa/'
def get(u):
 for attempt in range(3):
  try:
   with urlopen(Request(u,headers={'User-Agent':'DenkenStudy personal-learning archive'}),timeout=45) as r:
    if urlparse(r.url).hostname not in ['www.shiken.or.jp','shiken.or.jp']:raise ValueError('unexpected redirect')
    b=r.read(30000001)
    if len(b)>30000000:raise ValueError('oversized response')
    return b
  except Exception:
   if attempt==2:raise
   time.sleep(1+attempt)
queue=[BASE];seen=set();pages=[];pdfs={};errors=[]
while queue and len(seen)<20:
 u=queue.pop(0)
 if u in seen:continue
 seen.add(u)
 try:
  b=get(u);p=Links();p.feed(b.decode('utf-8',errors='replace'));rows=[]
  for href,label in p.rows:
   v=urljoin(u,href).split('#')[0]
   if urlparse(v).hostname not in ['www.shiken.or.jp','shiken.or.jp']:continue
   label=unicodedata.normalize('NFKC',label.strip())
   if urlparse(v).path.lower().endswith('.pdf') and '第一種電気主任技術者' in label:
    pdfs[v]={'url':v,'label':label,'foundOn':u};rows.append(v)
   elif v.startswith(BASE) and v not in seen and v not in queue:queue.append(v)
  pages.append({'url':u,'pdfs':rows})
  time.sleep(.2)
 except Exception as e:errors.append({'url':u,'error':str(e)})
subjects={'理論':'theory','電力':'power','機械':'machine','法規':'law'};records=[];banks={}
with tempfile.TemporaryDirectory() as tmp:
 for n,entry in enumerate(pdfs.values()):
  try:
   m=re.search(r'(令和|平成)(元|\d+)年度',entry['label'])
   if not m:raise ValueError('year not identified from official link label')
   year=(2018 if m[1]=='令和' else 1988)+(1 if m[2]=='元' else int(m[2]));stage='secondary' if '二次' in entry['label'] else 'primary'
   sid=next((sid for label,sid in subjects.items() if label+'科目' in entry['label']),None) if stage=='primary' else ('power-management' if '電力' in entry['label'] else 'machine-control' if '機械' in entry['label'] else None)
   kind='question' if sid else 'answer';b=get(entry['url'])
   if not b.startswith(b'%PDF-'):raise ValueError('not a PDF')
   path=Path(tmp)/f'{year}-{stage}-{sid or "answer"}.pdf';path.write_bytes(b)
   with fitz.open(path) as doc:
    text=unicodedata.normalize('NFKC',doc[0].get_text());compact=re.sub(r'\s+','',text)
    if not re.search(r'第[1一]種',compact):raise ValueError('PDF identity not first class')
    if (stage=='secondary')!=('二次' in compact):raise ValueError('PDF stage differs from official label')
    match=re.search(r'(令和|平成)(元|\d+)年度',compact)
    actual=((2018 if match[1]=='令和' else 1988)+(1 if match[2]=='元' else int(match[2]))) if match else None
    if actual!=year:raise ValueError('PDF year differs from official label')
    rec={**entry,'year':year,'stage':stage,'subject':sid,'kind':kind,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'pages':len(doc),'verified':True}
    if stage=='primary':
     part=banks.setdefault(year,{})
     if kind=='answer':
      try:part['answers']=parse_answers(path)
      except Exception as e:rec['gradingError']=str(e)
     else:
      starts=[]
      for i,page in enumerate(doc):
       ns=re.findall(r'(?m)^\s*問\s*([1-7])\s+',unicodedata.normalize('NFKC',page.get_text()))
       if len(ns)>1:raise ValueError('multiple question starts on one page')
       if ns:starts.append((int(ns[0]),i))
      groups=[]
      for j,(number,start) in enumerate(starts):
       end=starts[j+1][1] if j+1<len(starts) else len(doc)
       qtext='\n'.join(unicodedata.normalize('NFKC',doc[i].get_text()) for i in range(start,end))
       opts=list(dict.fromkeys(re.findall(r'\(([イロハニホヘトチリヌルヲワカヨタレソツネナラ])\)',qtext)))
       groups.append({'number':number,'pageStart':start+1,'pageEnd':end,'options':opts})
      part[sid]=groups
   records.append(rec);print(n+1,len(pdfs),year,stage,sid or 'answer',len(b),flush=True)
   time.sleep(.15)
  except Exception as e:
   records.append({**entry,'verified':False,'error':str(e)});errors.append({'url':entry['url'],'error':str(e)})
questions=[]
for year,parts in sorted(banks.items(),reverse=True):
 for sid in subjects.values():
  groups=parts.get(sid,[]);answers=parts.get('answers',{}).get(sid,[])
  try:
   if not answers or [g['number'] for g in groups]!=list(range(1,len(answers)+1)):raise ValueError('question/answer count not verified')
   src=next(r for r in records if r.get('year')==year and r.get('stage')=='primary' and r.get('subject')==sid and r.get('verified'))
   answer=next(r for r in records if r.get('year')==year and r.get('stage')=='primary' and r.get('kind')=='answer' and r.get('verified'))
   for g,items in zip(groups,answers):
    if not all(i['answer'] in g['options'] for i in items):raise ValueError('answer symbol missing from question choices')
   for g,items in zip(groups,answers):
    number=g['number'];questions.append({'id':f'{year}-{sid}-{number}','year':year,'subject':sid,'number':number,'topic':f'{next(k for k,v in subjects.items() if v==sid)}・問{number}','kind':'past','optional':sid in ['theory','machine'] and number in [6,7],'pages':[],'text':'公式の問題PDFを開き、指定された問題を解いてください。','options':g['options'],'items':items,'source':f'{year}-{sid}','sourceUrl':src['url'],'answerUrl':answer['url'],'officialPage':g['pageStart'],'officialPageEnd':g['pageEnd'],'explanationStatus':'公式の問題番号・正答・配点を機械照合。個別解説は未整備'})
  except Exception as e:
   errors.append({'year':year,'subject':sid,'gradingError':str(e)})
result={'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'officialIndex':BASE,'pages':pages,'records':records,'errors':errors,'questions':questions,'note':'公式一覧に掲載された資料を全件取得してPDFの年度・試験区分を検証。原本は公式URLから閲覧。採点は問題と正答の対応を照合できた一次問題のみ。'}
(DEST/'archive.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('Verified',sum(r.get('verified',False) for r in records),'of',len(records),'PDFs; gradeable groups',len(questions),'errors',len(errors))
