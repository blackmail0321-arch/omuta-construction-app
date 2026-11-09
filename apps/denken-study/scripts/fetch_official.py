#!/usr/bin/env python3
"""Discover official published PDFs without inventing URLs. Never grades unverified downloads."""
import argparse,json,urllib.request,urllib.parse,urllib.error,hashlib,time
from html.parser import HTMLParser
from pathlib import Path
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.current=None
 def handle_starttag(self,tag,attrs):
  if tag=='a':
   href=dict(attrs).get('href');self.current=[href,''] if href else None
 def handle_data(self,data):
  if self.current:self.current[1]+=data
 def handle_endtag(self,tag):
  if tag=='a' and self.current:self.links.append(self.current);self.current=None
ALLOWED={'www.shiken.or.jp','shiken.or.jp'}
def valid(url):
 p=urllib.parse.urlparse(url);return p.scheme=='https' and p.hostname in ALLOWED and not p.username and not p.password
class SafeRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  if not valid(newurl):raise ValueError('公式ドメイン以外へのリダイレクトを停止しました')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--index',default='https://www.shiken.or.jp/answer/');p.add_argument('--download',action='store_true',help='公開リンクから見つかったPDFを保存（採点への自動登録はしない）');p.add_argument('--output',default=str(Path(__file__).resolve().parents[1]/'data/official-downloads'));p.add_argument('--max-downloads',type=int,default=40);p.add_argument('--max-pages',type=int,default=10);a=p.parse_args()
 if not valid(a.index):p.error('公式のHTTPSページURLを指定してください')
 dest=Path(a.output);dest.mkdir(parents=True,exist_ok=True);opener=urllib.request.build_opener(SafeRedirect());queue=[(a.index,0)];seen=set();pdfs={};errors=[]
 while queue and len(seen)<min(a.max_pages,30):
  url,depth=queue.pop(0)
  if url in seen:continue
  seen.add(url)
  try:
   with opener.open(urllib.request.Request(url,headers={'User-Agent':'DenkenStudy/1.0 (personal study)'}),timeout=30) as r:
    if not valid(r.url):raise ValueError('公式ドメイン外の応答')
    body=r.read(5_000_001)
    if len(body)>5_000_000:raise ValueError('ページが大きすぎます')
    enc=r.headers.get_content_charset() or 'utf-8';text=body.decode(enc,errors='replace')
   parser=Links();parser.feed(text)
   for href,label in parser.links:
    target=urllib.parse.urljoin(url,href).split('#')[0]
    if not valid(target):continue
    if urllib.parse.urlparse(target).path.lower().endswith('.pdf'):pdfs[target]={'url':target,'label':label.strip(),'found_on':url,'downloaded':False,'grading_verified':False}
    elif depth<2 and any(w in (label+target) for w in ['第一種','第1種','一種','denken1','answer','kaitou']):queue.append((target,depth+1))
   time.sleep(.25)
  except (urllib.error.URLError,ValueError) as e:errors.append({'url':url,'error':str(e)})
 for n,entry in enumerate(pdfs.values(),1):
  if not a.download or n>max(1,min(100,a.max_downloads)):continue
  try:
   with opener.open(entry['url'],timeout=45) as r:
    if not valid(r.url):raise ValueError('公式ドメイン外の応答')
    content=r.read(30_000_001)
   if len(content)>30_000_000 or not content.startswith(b'%PDF-'):raise ValueError('有効な30MB以下のPDFではありません')
   name=f'{n:03d}-'+hashlib.sha256(entry['url'].encode()).hexdigest()[:12]+'.pdf';(dest/name).write_bytes(content);entry.update(downloaded=True,file=name,sha256=hashlib.sha256(content).hexdigest())
  except (urllib.error.URLError,ValueError) as e:entry['error']=str(e)
 result={'checked_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'pages':list(seen),'pdfs':list(pdfs.values()),'errors':errors,'note':'一覧には他試験が含まれる場合があります。一種・年度・科目・問題と解答の対応を照合してから登録します。'};(dest/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(f'Checked {len(seen)} page(s); discovered {len(pdfs)} PDF link(s); errors: {len(errors)}')
 if errors and not pdfs:raise SystemExit(2)
if __name__=='__main__':main()
