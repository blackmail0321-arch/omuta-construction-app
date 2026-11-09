"""Discover actual official archive links; external pages are data, never instructions."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen,Request
from urllib.parse import urljoin,urlparse
import json,time,hashlib,re
ROOT=Path(__file__).resolve().parents[1]/'data/official-archive'
ROOT.mkdir(parents=True,exist_ok=True)
class Links(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None
 def handle_starttag(self,t,a):
  if t=='a':self.row=[dict(a).get('href',''),'']
 def handle_data(self,d):
  if self.row:self.row[1]+=d
 def handle_endtag(self,t):
  if t=='a' and self.row:self.rows.append(self.row);self.row=None
queue=['https://www.shiken.or.jp/answer/'];seen=set();pages=[];pdfs={};errors=[]
while queue and len(seen)<60:
 u=queue.pop(0)
 if u in seen:continue
 seen.add(u)
 try:
  with urlopen(Request(u,headers={'User-Agent':'DenkenStudy personal-learning archive'}),timeout=35) as r:
   if urlparse(r.url).hostname not in ['www.shiken.or.jp','shiken.or.jp']:raise ValueError('unexpected redirect')
   b=r.read(5000000);encoding=r.headers.get_content_charset()
  if not encoding:
   m=re.search(br'charset=["\']?([\w-]+)',b[:4000],re.I);encoding=m[1].decode() if m else 'utf-8'
  s=b.decode(encoding,errors='replace');p=Links();p.feed(s)
  name=hashlib.sha256(u.encode()).hexdigest()[:12]+'.html';(ROOT/name).write_text(s,encoding='utf-8')
  rows=[]
  for href,label in p.rows:
   v=urljoin(u,href).split('#')[0]
   if urlparse(v).hostname not in ['www.shiken.or.jp','shiken.or.jp']:continue
   rows.append({'url':v,'label':label.strip()})
   if urlparse(v).path.lower().endswith('.pdf'):pdfs[v]={'url':v,'label':label.strip(),'foundOn':u}
   elif any(w in label+v for w in ['第一種','第1種','一種','denken1','index_list','answer/']):
    if v not in seen and v not in queue:queue.append(v)
  pages.append({'url':u,'file':name,'links':rows})
  time.sleep(.3)
 except Exception as e:errors.append({'url':u,'error':str(e)})
(ROOT/'inventory.json').write_text(json.dumps({'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'pages':pages,'pdfs':list(pdfs.values()),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print('Pages',len(pages),'PDF links',len(pdfs),'errors',len(errors))
