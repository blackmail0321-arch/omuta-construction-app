#!/usr/bin/env python3
"""Fetch official materials and short cited references, validate, then rebuild the app."""
from pathlib import Path
import json,sys,subprocess,urllib.request,urllib.parse,urllib.error,time,hashlib,re
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from materials import import_pairs
class Article(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.tag=None;self.buffer=[];self.paragraphs=[];self.title='';self.links=[];self.link=None
 def handle_starttag(self,tag,attrs):
  if tag in ['script','style','nav','footer']:self.skip+=1
  if not self.skip and tag in ['p','title','h1']:self.tag=tag;self.buffer=[]
  if tag=='a':self.link=[dict(attrs).get('href',''),'']
 def handle_data(self,s):
  if self.tag and not self.skip:self.buffer.append(s)
  if self.link:self.link[1]+=s
 def handle_endtag(self,tag):
  if tag in ['script','style','nav','footer'] and self.skip:self.skip-=1
  if tag==self.tag:
   text=re.sub(r'\s+',' ',''.join(self.buffer)).strip()
   if tag in ['title','h1'] and text:self.title=text
   elif len(text)>=40:self.paragraphs.append(text)
   self.tag=None;self.buffer=[]
  if tag=='a' and self.link:self.links.append(self.link);self.link=None
REF_HOSTS={'www.jeea.or.jp','jeea.or.jp'}
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,url):
  if urllib.parse.urlparse(url).hostname not in REF_HOSTS:raise ValueError('参考サイトの外への転送を停止しました')
  return super().redirect_request(req,fp,code,msg,headers,url)
def get_article(url):
 p=urllib.parse.urlparse(url)
 if p.scheme!='https' or p.hostname not in REF_HOSTS:raise ValueError('許可されたHTTPS参考サイトではありません')
 with urllib.request.build_opener(Redirect()).open(url,timeout=20) as r:
  body=r.read(3_000_001)
  if len(body)>3_000_000:raise ValueError('記事が大きすぎます')
  charset=r.headers.get_content_charset()
  if not charset:
   m=re.search(br'charset\s*=\s*["\']?([A-Za-z0-9_-]+)',body[:2000]);charset=m[1].decode() if m else 'utf-8'
  text=body.decode(charset,errors='replace')
 a=Article();a.feed(text);return a,body

def fetch_references():
 dest=ROOT/'data/references';dest.mkdir(exist_ok=True);index='https://www.jeea.or.jp/course/contents.html';a,_=get_article(index)
 terms={'変圧器':['変圧器','並行運転'],'同期':['同期','短絡比'],'半導体':['半導体','パワー'],'計測':['計測','ディジタル','実効値'],'保護':['地絡','遮断','保護'],'発電':['揚水','水力','火力'],'法規':['電気事業法','保安','技術基準']}
 refs=json.loads((ROOT/'data/citations.json').read_text()) if (ROOT/'data/citations.json').exists() else [];seen={x['url'] for x in refs};added=0;errors=[]
 for href,label in a.links:
  topic_terms=[t for tags in terms.values() for t in tags if t in label]
  if not topic_terms:continue
  url=urllib.parse.urljoin(index,href).split('#')[0]
  if url in seen or url.endswith('.pdf'):continue
  try:
   page,body=get_article(url);relevant=[p for p in page.paragraphs if any(t in p for t in topic_terms)]
   if not relevant:continue
   paragraph=relevant[0];quote=paragraph[:160];key=hashlib.sha256(url.encode()).hexdigest()[:16];(dest/(key+'.html')).write_bytes(body)
   refs.append({'id':key,'title':page.title or label.strip(),'publisher':'日本電気技術者協会','url':url,'checkedAt':time.strftime('%Y-%m-%d'),'quote':quote,'keywords':topic_terms,'verifiedRetrieval':True,'reviewedForQuestion':False,'sha256':hashlib.sha256(body).hexdigest(),'note':'本文の短い引用を自動抽出。個別問題への適合性は要確認。'});seen.add(url);added+=1
   if added>=8:break
   time.sleep(.3)
  except Exception as e:errors.append({'url':url,'error':str(e)})
 (ROOT/'data/citations.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2));return {'added':added,'total':len(refs),'errors':errors}

def update():
 result={'official':{},'references':{},'rebuilt':False}
 proc=subprocess.run([sys.executable,str(ROOT/'scripts/fetch_official.py'),'--download'],capture_output=True,text=True,timeout=600)
 manifest_path=ROOT/'data/official-downloads/manifest.json';manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
 entries=[{'path':str(manifest_path.parent/e['file']),'url':e['url']} for e in manifest.get('pdfs',[]) if e.get('downloaded')]
 result['official']={'fetched':len(entries),'errors':manifest.get('errors',[]),'import':import_pairs(ROOT,entries) if entries else {'added':[],'errors':[]}}
 try:result['references']=fetch_references()
 except Exception as e:result['references']={'added':0,'errors':[str(e)]}
 subprocess.run([sys.executable,str(ROOT/'scripts/build_app.py')],check=True,capture_output=True,text=True);result['rebuilt']=True
 (ROOT/'data/update-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));return result
if __name__=='__main__':print(json.dumps(update(),ensure_ascii=False,indent=2))
