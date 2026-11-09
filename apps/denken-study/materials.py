"""Import verified first-class primary exam PDF pairs; uploaded text is reference data only."""
from pathlib import Path
import json,re,unicodedata,hashlib,base64,shutil
SUBJECTS={'theory':'理論','power':'電力','machine':'機械','law':'法規'}
def norm(s):return unicodedata.normalize('NFKC',s)
def identity(path):
 import fitz
 with fitz.open(path) as doc:text=norm(doc[0].get_text());compact=re.sub(r'\s+','',text)
 m=re.search(r'(令和|平成)(\d+)年度',compact)
 if not m or not re.search(r'(第1種|第一種)',compact) or '二次' in compact:return None
 year=int(m[2])+(2018 if m[1]=='令和' else 1988)
 if '解答' in compact and '一次' in compact:return year,'answers'
 for sid,label in SUBJECTS.items():
  if label in compact:return year,sid
 return None

def parse_answers(path):
 import fitz
 with fitz.open(path) as doc:
  if len(doc)!=1:raise ValueError('複数ページの解答表は未対応です。手動確認が必要です')
  page=doc[0];headers={}
  for block in page.get_text('dict')['blocks']:
   for line in block.get('lines',[]):
    text=re.sub(r'\s+','',norm(''.join(s['text'] for s in line['spans'])))
    for sid,label in SUBJECTS.items():
     if text in [f'<{label}>',f'〈{label}〉',f'《{label}》',label]:
      x0,y0,x1,y1=line['bbox'];headers[sid]=((x0+x1)/2,y1)
  if len(headers)!=4:raise ValueError('4科目の列見出しを特定できません。手動確認が必要です')
  ordered=sorted(headers,key=lambda s:headers[s][0]);result={}
  for i,sid in enumerate(ordered):
   left=(headers[ordered[i-1]][0]+headers[sid][0])/2 if i else 0
   right=(headers[ordered[i+1]][0]+headers[sid][0])/2 if i<3 else page.rect.width
   text=norm(page.get_text(clip=fitz.Rect(left,headers[sid][1]+1,right,page.rect.height),sort=True))
   rows=re.findall(r'\((\d+)\)\s+([イロハニホヘトチリヌルヲワカヨタレソツネナラ])\s+([1-9])(?:\s|$)',text)
   groups=[]
   for num,a,pts in rows:
    if int(num)==1:groups.append([])
    if not groups or int(num)!=len(groups[-1])+1:raise ValueError('解答表の小問番号が連続していません')
    groups[-1].append({'number':int(num),'answer':a,'points':int(pts)})
   expected=7 if sid in ['theory','machine'] else 6
   if len(groups)!=expected:raise ValueError(f'{sid}: 大問数が所定の数と一致しません')
   for n,g in enumerate(groups):
    if sum(i['points'] for i in g)!=(10 if n<4 else 20):raise ValueError(f'{sid}: 問{n+1}の配点を検証できません')
   result[sid]=groups
 return result

def parse_questions(path,answer_groups,year,sid,source_url=''):
 import fitz
 with fitz.open(path) as doc:
  starts=[]
  for i,page in enumerate(doc):
   hits=re.findall(r'(?m)^問([1-7])\s+',norm(page.get_text()))
   if len(hits)>1:raise ValueError('同一ページに複数の大問があります。切り分けの手動確認が必要です')
   if hits:starts.append((int(hits[0]),i))
  if [n for n,i in starts]!=list(range(1,len(answer_groups)+1)):raise ValueError('問題冊子と解答表の大問番号が一致しません')
  out=[]
  for j,(num,start) in enumerate(starts):
   end=starts[j+1][1] if j+1<len(starts) else len(doc);text='';pages=[]
   for n in range(start,end):
    text+=norm(doc[n].get_text())+'\n';jpg=doc[n].get_pixmap(matrix=fitz.Matrix(1.45,1.45),alpha=False).tobytes('jpeg',jpg_quality=83)
    pages.append({'number':n+1,'src':'data:image/jpeg;base64,'+base64.b64encode(jpg).decode()})
   choices=list(dict.fromkeys(re.findall(r'\(([イロハニホヘトチリヌルヲワカヨタレソツネナラ])\)',text)))
   for it in answer_groups[j]:
    if it['answer'] not in choices:raise ValueError('正答記号が問題の解答群に見つかりません')
   topic=re.search(r'次の文章は[、,]?\s*(.+?)(?:に関する|について|である)',text.replace('\n',' '))
   topic=re.sub(r'\s+','',topic[1])[:55] if topic else f'{SUBJECTS[sid]}・問{num}'
   out.append({'id':f'{year}-{sid}-{num}','year':year,'subject':sid,'number':num,'topic':topic,'kind':'past','optional':sid in ['theory','machine'] and num in [6,7],'pages':pages,'text':text,'options':choices,'items':answer_groups[j],'source':f'{year}-{sid}','sourceUrl':source_url,'explanationStatus':'正答・配点を照合。個別の解説は未整備'})
  return out

def import_pairs(root,entries):
 root=Path(root);bank=json.loads((root/'data/bank.json').read_text(encoding="utf-8"));grouped={};report={'added':[],'skipped':[],'errors':[]}
 for entry in entries:
  try:
   ident=identity(entry['path'])
   if ident:grouped.setdefault(ident[0],{})[ident[1]]=entry
  except Exception as e:report['errors'].append({'file':Path(entry['path']).name,'error':str(e)})
 for year,parts in sorted(grouped.items(),reverse=True):
  if 'answers' not in parts:report['skipped'].append({'year':year,'reason':'一次の正答表がありません'});continue
  try:answers=parse_answers(parts['answers']['path'])
  except Exception as e:report['errors'].append({'year':year,'error':str(e)});continue
  for sid,label in SUBJECTS.items():
   if sid not in parts:continue
   if any(q['year']==year and q['subject']==sid for q in bank['questions']):report['skipped'].append({'year':year,'subject':sid,'reason':'登録済みの教材を保持'});continue
   entry=parts[sid]
   try:
    questions=parse_questions(entry['path'],answers[sid],year,sid,entry.get('url',''))
    assets=root/'assets';assets.mkdir(exist_ok=True)
    for kind in [sid,'answers']:
     src=Path(parts[kind]['path']);dest=assets/f'{year}-{kind}.pdf'
     if src.resolve()!=dest.resolve():shutil.copy2(src,dest)
    bank['questions'].extend(questions);bank['sources'].append({'id':f'{year}-{sid}','subject':sid,'label':label,'year':year,'era':f'令和{year-2018}年度' if year>=2019 else f'平成{year-1988}年度','file':f'assets/{year}-{sid}.pdf','sha256':hashlib.sha256(Path(entry['path']).read_bytes()).hexdigest(),'minutes':next(s['minutes'] for s in bank['subjects'] if s['id']==sid),'origin':'official-download' if entry.get('url') else 'local-import','url':entry.get('url',''),'answerUrl':parts['answers'].get('url',''),'officialCrosscheck':bool(entry.get('url')),'status':'問題・正答の番号、記号、配点を機械照合'})
    report['added'].append({'year':year,'subject':sid,'questions':len(questions)})
   except Exception as e:report['errors'].append({'year':year,'subject':sid,'error':str(e)})
 if report['added']:
  # Preserve the last bank; replace only after all records can be serialized.
  content=json.dumps(bank,ensure_ascii=False,separators=(',',':'));shutil.copy2(root/'data/bank.json',root/'data/bank.before-update.json');tmp=root/'data/bank.next.json';tmp.write_text(content, encoding="utf-8");tmp.replace(root/'data/bank.json')
 return report
