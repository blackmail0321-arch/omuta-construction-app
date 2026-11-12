"""Build per-question, source-verified secondary reference images, loaded only on demand."""
from pathlib import Path
import json,re,base64,hashlib,shutil,unicodedata
import fitz
SUBJECTS={'power-management':'電力・管理','machine-control':'機械・制御'}
def compact(t):return re.sub(r'\s+','',unicodedata.normalize('NFKC',t))
def lines(page):
 result=[]
 for b in page.get_text('dict')['blocks']:
  for l in b.get('lines',[]):result.append((l['bbox'][1],compact(''.join(s['text'] for s in l['spans']))))
 return sorted(result)
def problem_starts(doc,subject):
 starts=[]
 for p,page in enumerate(doc):
  for y,text in lines(page):
   m=re.match(r'問([1-6])(?![~〜～\d])',text)
   if m and (not starts or int(m[1])!=starts[-1]['number']):starts.append({'subject':subject,'number':int(m[1]),'page':p,'y':y})
 expected=6 if subject=='power-management' else 4
 if [x['number'] for x in starts]!=list(range(1,expected+1)):raise ValueError('問題番号の切り分けを確認できません')
 return starts

def answer_starts(doc):
 starts=[];subject='power-management'
 for p,page in enumerate(doc):
  for y,text in lines(page):
   if re.match(r'[<〈《〔]機械・?制御科目',text):subject='machine-control'
   if re.match(r'[<〈《〔]電力・?管理科目',text):subject='power-management'
   m=re.search(r'〔?問([1-6])の標準解答',text)
   if m:starts.append({'subject':subject,'number':int(m[1]),'page':p,'y':y})
 if [(x['subject'],x['number']) for x in starts]!=[(s,n) for s in SUBJECTS for n in range(1,7 if s=='power-management' else 5)]:raise ValueError('標準解答の科目・問題番号を確認できません')
 return starts

def images(doc,start,end):
 out=[]
 for p in range(start['page'],(end['page'] if end else len(doc)-1)+1):
  if end and p==end['page'] and end['y']<100 and p>start['page']:break
  page=doc[p];top=max(0,start['y']-4) if p==start['page'] else 0;bottom=max(0,end['y']-4) if end and p==end['page'] else page.rect.height
  if bottom-top<12:continue
  clip=fitz.Rect(0,top,page.rect.width,bottom);jpg=page.get_pixmap(matrix=fitz.Matrix(1.35,1.35),clip=clip,alpha=False).tobytes('jpeg',jpg_quality=78)
  out.append({'page':p+1,'src':'data:image/jpeg;base64,'+base64.b64encode(jpg).decode()})
 return out

def build(root):
 root=Path(root);out=root/'secondary';out.mkdir(exist_ok=True)
 for f in out.glob('*.json'):f.unlink()
 archive=json.loads((root/'data/official-archive/archive.json').read_text(encoding='utf-8'));records=[r for r in archive['records'] if r.get('verified') and r['stage']=='secondary'];entries=[];issues=[]
 for year in sorted({r['year'] for r in records},reverse=True):
  try:
   answer=next(r for r in records if r['year']==year and r['kind']=='answer');path=root/answer['localFile']
   if hashlib.sha256(path.read_bytes()).hexdigest()!=answer['sha256']:raise ValueError('標準解答のハッシュ不一致')
   with fitz.open(path) as adoc:
    if not re.search(r'一題当たり30点',compact(adoc[0].get_text())):raise ValueError('公式の大問30点の確認が必要です')
    ast=answer_starts(adoc)
    for subject,label in SUBJECTS.items():
     source=next(r for r in records if r['year']==year and r['subject']==subject)
     with fitz.open(root/source['localFile']) as qdoc:
      qst=problem_starts(qdoc,subject)
      for i,start in enumerate(qst):
       n=start['number'];aidx=next(i for i,a in enumerate(ast) if a['subject']==subject and a['number']==n);qid=f'secondary-{year}-{subject}-{n}'
       problem=images(qdoc,start,qst[i+1] if i+1<len(qst) else None);answerimages=images(adoc,ast[aidx],ast[aidx+1] if aidx+1<len(ast) else None)
       if len(problem)+len(answerimages)>8:raise ValueError('参照ページ数が上限を超えています')
       pack={'id':qid,'year':year,'subject':subject,'subjectLabel':label,'number':n,'maxScore':30,'questionUrl':source['url'],'answerUrl':answer['url'],'questionSha256':source['sha256'],'answerSha256':answer['sha256'],'questionImages':problem,'answerImages':answerimages,'rubricStatus':'公式の小問別・部分点の採点基準は未公表のため、AIの独自基準で参考採点'}
       (out/(qid+'.json')).write_text(json.dumps(pack,ensure_ascii=False,separators=(',',':')),encoding='utf-8');entries.append({k:v for k,v in pack.items() if k not in ['questionImages','answerImages']})
  except (ValueError,StopIteration) as e:issues.append({'year':year,'reason':str(e)})
 (out/'index.json').write_text(json.dumps({'questions':entries,'issues':issues},ensure_ascii=False,indent=2),encoding='utf-8')
 print('Secondary reference packs:',len(entries),'questions; issues',issues)
 return entries
if __name__=='__main__':build(Path(__file__).resolve().parents[1])
