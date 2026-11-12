"""Bounded daily official backfill. Published files are source data, never instructions."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.parse import urljoin,urlparse
from datetime import datetime
from zoneinfo import ZoneInfo
import json,sys,re,hashlib,time,unicodedata,copy
import fitz
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from archive_parser import parse as parse_first,KANA
SUBJECTS={'theory':'理論','power':'電力','machine':'機械','law':'法規'}
HOSTS={'www.shiken.or.jp','shiken.or.jp'}
def allowed(u):return urlparse(u).scheme=='https' and urlparse(u).hostname in HOSTS
class Redirect(HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  if not allowed(newurl):raise ValueError('Unexpected redirect outside official site')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def fetch(u):
 if not allowed(u):raise ValueError('Not an official HTTPS URL')
 for n in range(3):
  try:
   with build_opener(Redirect()).open(Request(u,headers={'User-Agent':'DenkenStudy educational backfill'}),timeout=35) as r:
    b=r.read(30000001)
    if len(b)>30000000:raise ValueError('Response larger than 30 MB')
    return b
  except Exception:
   if n==2:raise
   time.sleep(n+1)
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.a=None
 def handle_starttag(self,t,a):
  if t=='a':self.a=[dict(a).get('href',''),'']
 def handle_data(self,d):
  if self.a:self.a[1]+=d
 def handle_endtag(self,t):
  if t=='a' and self.a:self.links.append(self.a);self.a=None

def discover(level):
 base=f'https://www.shiken.or.jp/chief/{"first" if level==1 else "third"}/qa/'
 queue=[base];seen=set();records={}
 while queue:
  u=queue.pop(0)
  if u in seen:continue
  if len(seen)>=20:raise ValueError('Archive pagination exceeded safety limit')
  seen.add(u);p=Links();p.feed(fetch(u).decode('utf-8'))
  for href,label in p.links:
   v=urljoin(u,href).split('#')[0];label=unicodedata.normalize('NFKC',label.strip())
   if not allowed(v):continue
   if v.endswith('.pdf') and ('第一種電気主任技術者' if level==1 else '第三種電気主任技術者') in label:
    m=re.search(r'(令和|平成)(元|\d+)年度',label)
    if not m:raise ValueError('Year missing from official label')
    year=(2018 if m[1]=='令和' else 1988)+(1 if m[2]=='元' else int(m[2]))
    stage='secondary' if '二次' in label else 'primary';term='upper' if '上期' in label else 'lower' if '下期' in label else 'annual'
    sid=next((s for s,l in SUBJECTS.items() if l+'科目' in label),None) if stage=='primary' else ('power-management' if '電力' in label else 'machine-control' if '機械' in label else None)
    records[v]={'url':v,'label':label,'year':year,'stage':stage,'term':term,'subject':sid,'kind':'question' if sid else 'answer','foundOn':u}
   elif v.startswith(base) and v not in seen and v not in queue:queue.append(v)
 return base,list(records.values())

def plan_years(existing,available,quota):
 have={r['year'] for r in existing};years=sorted({r['year'] for r in available},reverse=True)
 if not have:return years[:quota]
 urls={r['url'] for r in existing}
 changed=[y for y in years if y in have and any(r['year']==y and r['url'] not in urls for r in available)]
 older=[y for y in years if y<min(have)]
 return (changed+older)[:quota]

def read_third(path):
 from materials import norm
 with fitz.open(path) as doc:
  if len(doc)!=1:raise ValueError('Unsupported third-class answer-table page count')
  page=doc[0];headers={}
  for block in page.get_text('dict')['blocks']:
   for line in block.get('lines',[]):
    text=re.sub(r'\s+','',norm(''.join(s['text'] for s in line['spans'])))
    for sid,label in SUBJECTS.items():
     if text in [f'<{label}>',f'〈{label}〉',f'《{label}》']:
      x0,y0,x1,y1=line['bbox'];headers[sid]=((x0+x1)/2,y1)
  if len(headers)!=4:raise ValueError('Four third-class subject headers not found')
  order=sorted(headers,key=lambda s:headers[s][0]);result={}
  for i,sid in enumerate(order):
   left=(headers[order[i-1]][0]+headers[sid][0])/2 if i else 0;right=(headers[order[i+1]][0]+headers[sid][0])/2 if i<3 else page.rect.width
   text=norm(page.get_text(clip=fitz.Rect(left,headers[sid][1]+1,right,page.rect.height),sort=True))
   groups={}
   for num,letter,answer,points in re.findall(r'問\s*(\d+)(?:\s*\(([ab])\))?\s+([1-5])\s+(\d+)(?:\s|$)',text):
    number=int(num);group=groups.setdefault(number,[]);item=1 if letter in ['','a'] else 2
    if item!=len(group)+1:raise ValueError('Third-class subquestion order mismatch')
    group.append({'number':item,'label':'('+letter+')' if letter else '解答','answer':answer,'points':int(points)})
   expected=18 if sid in ['theory','machine'] else 17 if sid=='power' else 13
   if list(groups)!=list(range(1,expected+1)):raise ValueError(f'{sid}: third-class question numbers incomplete')
   for optional in ([17,18] if sid in ['theory','machine'] else [None]):
    total=sum(x['points'] for n,g in groups.items() if n not in [17,18] or sid not in ['theory','machine'] or n==optional for x in g)
    if total!=100:raise ValueError(f'{sid}: third-class paper is not 100 points')
   result[sid]=groups
 return result

def questions_for(archive,level,year):
 out=[];records=[r for r in archive['records'] if r['year']==year and r['stage']=='primary']
 for answer in [r for r in records if r['kind']=='answer']:
  term=answer.get('term','annual');answers=parse_first(ROOT/answer['localFile']) if level==1 else read_third(ROOT/answer['localFile'])
  for sid,label in SUBJECTS.items():
   src=next(r for r in records if r['subject']==sid and (level==1 or r.get('term')==term))
   groups=answers[sid];groups=groups.items() if level==3 else enumerate(groups,1)
   for n,items in groups:
    paper=f'{year}-{term}';name=f'{year}-{sid}-{n}' if level==1 else f'third-{paper}-{sid}-{n}'
    out.append({'id':name,'year':year,'subject':sid,'number':n,'topic':label+'・問'+str(n),'kind':'past','optional':sid in ['theory','machine'] and n in ([6,7] if level==1 else [17,18]),'pages':[],'text':'原本PDFで問題を読み、解答を選んでください。','options':list(KANA) if level==1 else ['1','2','3','4','5'],'items':items,'source':f'{paper}-{sid}','sourceUrl':src['url'],'localFile':src['localFile'],'answerUrl':answer['url'],'answerLocalFile':answer['localFile'],'paper':paper,'term':term,'officialPage':None,'officialPageEnd':None,'explanationStatus':'公式正答と配点を機械照合。詳しい解説は未整備'})
 return out

def collect_grade(archive,level,quota):
 base,available=discover(level);wanted=plan_years(archive.get('records',[]),available,quota);result=copy.deepcopy(archive)
 result.setdefault('records',[]);result.setdefault('questions',[]);result.setdefault('gradingReport',[])
 for year in wanted:
  candidates=[r for r in available if r['year']==year];downloaded=[]
  for r in candidates:
   role=r['subject'] or 'answers';name=f'{year}-{r["stage"]}-{role}.pdf' if level==1 else f'{year}-{r["term"]}-{role}.pdf';relative=('assets/official/' if level==1 else 'assets/third/')+name;dest=ROOT/relative;dest.parent.mkdir(parents=True,exist_ok=True)
   b=fetch(r['url'])
   if not b.startswith(b'%PDF-'):raise ValueError('Invalid official PDF')
   with fitz.open(stream=b,filetype='pdf') as doc:
    if not len(doc):raise ValueError('Empty official PDF')
    rec={**r,'localFile':relative,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'pages':len(doc),'verified':True}
   dest.write_bytes(b);downloaded.append(rec)
  primary=[r for r in downloaded if r['stage']=='primary']
  for term in {r['term'] for r in primary}:
   part=[r for r in primary if r['term']==term]
   if len(part)!=5 or {r['subject'] for r in part}!={None,*SUBJECTS}:raise ValueError('Four papers and answer table are required')
  result['records']=[r for r in result['records'] if r['year']!=year]+downloaded
  try:
   qs=questions_for(result,level,year);result['questions']=[q for q in result['questions'] if q['year']!=year]+qs
   report={'year':year,'status':'演習・採点対応','groups':len(qs),'items':sum(len(q['items']) for q in qs)}
  except ValueError as e:
   report={'year':year,'status':'原本閲覧のみ・採点の形式は要確認','reason':str(e)}
  result['gradingReport']=[r for r in result['gradingReport'] if r['year']!=year]+[report]
 result.update(officialIndex=base,checkedAt=datetime.now(ZoneInfo('Asia/Tokyo')).isoformat(),reusePolicy={'url':base,'purpose':'教育目的の利用・出典明記。原本を改変せず保管。'},releaseYears=sorted({r['year'] for r in result['records']}),note='原本PDFは必要なときだけ開きます。詳しい個別解説は未整備です。')
 return result,wanted

def main():
 status_path=ROOT/'data/daily-status.json';date=datetime.now(ZoneInfo('Asia/Tokyo')).date().isoformat();status=json.loads(status_path.read_text()) if status_path.exists() else {}
 if status.get('lastDate')==date:print('Already collected for JST date',date);return
 first_path=ROOT/'data/official-archive/archive.json';third_path=ROOT/'data/third/archive.json'
 first=json.loads(first_path.read_text());third=json.loads(third_path.read_text()) if third_path.exists() else {}
 first,years1=collect_grade(first,1,2);third,years3=collect_grade(third,3,1)
 if not third.get('questions'):raise ValueError('No verified third-class grading records; keep existing publication')
 for path,data in [(first_path,first),(third_path,third)]:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 entry={'date':date,'firstYears':years1,'thirdYears':years3};status.update(lastDate=date,lastRun=entry,schedule='毎日 日本時間6時ごろ。一種2年度・三種1年度ずつ。GitHub実行状況により遅れる場合があります。',history=(status.get('history',[])+[entry])[-90:]);status_path.write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(entry,ensure_ascii=False))
if __name__=='__main__':main()
