from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen
from urllib.parse import urljoin
import json,re,hashlib,unicodedata
import fitz
R=Path(__file__).resolve().parents[1];out=R/'data/third';out.mkdir(exist_ok=True);assets=R/'assets/third';assets.mkdir(exist_ok=True)
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.a=None
 def handle_starttag(self,t,a):
  if t=='a':self.a=[dict(a).get('href',''),'']
 def handle_data(self,d):
  if self.a:self.a[1]+=d
 def handle_endtag(self,t):
  if t=='a' and self.a:self.links.append(self.a);self.a=None
base='https://www.shiken.or.jp/chief/third/qa/';p=Links();p.feed(urlopen(base,timeout=35).read().decode());records=[]
for href,label in p.links:
 label=unicodedata.normalize('NFKC',label)
 if '令和8年度第三種電気主任技術者' not in label or not href.endswith('.pdf'):continue
 u=urljoin(base,href)
 if any(r['url']==u for r in records):continue
 name=u.rsplit('/',1)[-1];b=urlopen(u,timeout=35).read();assert b.startswith(b'%PDF-');(assets/name).write_bytes(b)
 with fitz.open(stream=b,filetype='pdf') as d:
  rec={'url':u,'label':label,'file':'assets/third/'+name,'sha256':hashlib.sha256(b).hexdigest(),'pages':len(d),'firstText':d[0].get_text(),'texts':[x.get_text(sort=True) for x in d] if '_a' in name else []}
 records.append(rec)
(out/'probe.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8');print('Fetched',len(records))
