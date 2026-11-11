"""Read vertical and horizontal official answer tables with bounded geometric checks."""
import re,unicodedata
import fitz
SUBJECTS={'theory':'理論','power':'電力','machine':'機械','law':'法規'}
KANA='イロハニホヘトチリヌルヲワカヨタレソツネナラ'
def norm(s):return unicodedata.normalize('NFKC',s).replace('二','ニ').replace('へ','ヘ')
def rows(page):
 chars=[]
 for block in page.get_text('rawdict')['blocks']:
  for line in block.get('lines',[]):
   for span in line['spans']:
    for c in span['chars']:
     for v in norm(c['c']):
      if not v.isspace():chars.append((v,c['bbox'][0],c['bbox'][1],c['bbox'][2],c['bbox'][3]))
 result=[]
 for c in sorted(chars,key=lambda c:(round((c[2]+c[4])/2,1),c[1])):
  cy=(c[2]+c[4])/2
  r=next((r for r in reversed(result[-3:]) if abs(r['y']-cy)<2),None)
  if r is None:r={'y':cy,'chars':[]};result.append(r)
  r['chars'].append(c)
 for r in result:r['chars'].sort(key=lambda c:c[1]);r['text']=''.join(c[0] for c in r['chars'])
 return sorted(result,key=lambda r:r['y'])
def note_for(number,rs,page_width):
 candidates=[]
 for row in rs:
  text=row['text']
  if '配点' not in text:continue
  for segment in re.finditer(r'\(問.*?(?=\(問|$)',text):
   part=segment[0];names=[int(x) for x in re.findall(r'(?<!小)問([5-7])',part.split('配点')[0])]
   if number not in names:continue
   left=row['chars'][segment.start()][1]-2
   right=row['chars'][segment.end()][1]-2 if segment.end()<len(row['chars']) else page_width
   textrows=[]
   for rr in rs:
    if rr['y']<row['y']-1 or rr['y']>row['y']+65:continue
    t=''.join(c[0] for c in rr['chars'] if left<=c[1]<right)
    if rr['y']>row['y']+1 and t.startswith('(問'):break
    textrows.append(t)
    combined=''.join(textrows)
    if re.search(r'計20点',combined):break
   combined=''.join(textrows)
   if '計20点' in combined:candidates.append(combined.split('計20点')[0])
 if len(candidates)!=1:raise ValueError(f'問{number}: 配点注記を一意に読めません ({len(candidates)})')
 return candidates[0]
def horizontal(path):
 result={}
 with fitz.open(path) as doc:
  for page in doc:
   rr=rows(page);headers=[]
   for i,r in enumerate(rr):
    for sid,label in SUBJECTS.items():
     if r['text'] in ['<'+label+'>','〈'+label+'〉','《'+label+'》']:headers.append((i,sid))
   for h,(index,sid) in enumerate(headers):
    section=rr[index+1:headers[h+1][0] if h+1<len(headers) else len(rr)];groups=[]
    correction_text=''.join(r['text'] for r in section)
    corrections={(int(q),int(i)):(old,new) for q,i,old,new in re.findall(r'問(\d+)\((\d+)\)は「(['+KANA+'])」→「(['+KANA+'])」に訂正',correction_text)}
    for ri,row in enumerate(section):
     matches=list(re.finditer(r'\((\d{1,2})\)',row['text']))
     if not matches or ''.join(m[0] for m in matches)!=row['text']:continue
     if ri+1>=len(section):raise ValueError('解答の行がありません')
     answerrow=section[ri+1]
     if not all(c[0] in KANA for c in answerrow['chars']):raise ValueError('解答の行に選択記号以外があります')
     centers=[(row['chars'][m.start()][1]+row['chars'][m.end()-1][3])/2 for m in matches]
     buckets=[[] for m in matches]
     for c in answerrow['chars']:
      ci=min(range(len(centers)),key=lambda j:abs(centers[j]-(c[1]+c[3])/2))
      if abs(centers[ci]-(c[1]+c[3])/2)>10:raise ValueError('小問番号と正答の位置が一致しません')
      buckets[ci].append(c[0])
     for m,letters in zip(matches,buckets):
      n=int(m[1])
      if n==1:groups.append([])
      if not groups or n!=len(groups[-1])+1:raise ValueError('小問番号が連続していません')
      correction=corrections.get((len(groups),n))
      if len(letters)==1:answer=letters[0]
      elif correction and sorted(letters)==sorted(correction):answer=correction[1]
      else:raise ValueError('一つの小問に複数の正答記号があります')
      item={'number':n,'answer':answer}
      if correction:item['correction']='公式訂正 '+correction[0]+'→'+correction[1];item['answer']=correction[1]
      groups[-1].append(item)
    expected=7 if sid in ['theory','machine'] else 6
    if len(groups)!=expected:raise ValueError(f'{sid}: 大問数 {len(groups)} / {expected}')
    for number,items in enumerate(groups,1):
     if number<=4:
      if len(items)!=5:raise ValueError('必須前半の小問数が5ではありません')
      for item in items:item['points']=2
     else:
      note=note_for(number,section,page.rect.width)
      explicit=re.findall(r'(?:小問)?((?:\(\d+\))+)(?:は)?各?(\d+)点',note)
      if explicit:
       mapping={}
       for numbers,points in explicit:
        for n in re.findall(r'\d+',numbers):
         if int(n) in mapping:raise ValueError('重複した配点注記')
         mapping[int(n)]=int(points)
       if set(mapping)!=set(range(1,len(items)+1)):raise ValueError(f'{sid} 問{number}: 全小問の配点が明示されていません: '+note)
       for item in items:item['points']=mapping[item['number']]
      else:
       match=re.search(r'各(\d+)点',note)
       if not match:raise ValueError('均等配点を明示する注記がありません: '+note)
       for item in items:item['points']=int(match[1])
     if sum(i['points'] for i in items)!=(10 if number<=4 else 20):raise ValueError('大問の配点が10/20点と一致しません')
    if sid in result:raise ValueError('科目の解答表が重複しています')
    result[sid]=groups
 if set(result)!=set(SUBJECTS):raise ValueError('全4科目の正答を読み取れません')
 return result

def parse(path):
 from materials import parse_answers
 # These two years use four vertical subject columns; earlier years use horizontal grids.
 with fitz.open(path) as doc:
  text=norm(doc[0].get_text())
  if re.search(r'令和\s*[78]\s*年度',text):
   if '二' not in doc[0].get_text():return parse_answers(path)
   # The 2025 PDF encodes one katakana ニ as the ideograph 二. Normalize only the extracted table.
   return vertical_normalized(doc[0])
 return horizontal(path)

def vertical_normalized(page):
 headers={}
 for row in rows(page):
  for sid,label in SUBJECTS.items():
   if '<'+label+'>' in row['text']:
    m=re.search('<'+label+'>',row['text']);headers[sid]=(row['chars'][m.start()][1]+row['chars'][m.end()-1][3])/2
 if len(headers)!=4:raise ValueError('4列の見出しがありません')
 order=sorted(headers,key=headers.get);result={}
 for i,sid in enumerate(order):
  left=(headers[order[i-1]]+headers[sid])/2 if i else 0;right=(headers[order[i+1]]+headers[sid])/2 if i<3 else page.rect.width
  text=norm(page.get_text(clip=fitz.Rect(left,60,right,page.rect.height),sort=True));groups=[]
  for n,a,pts in re.findall(r'\((\d+)\)\s+(['+KANA+r'])\s+([1-9])(?:\s|$)',text):
   n=int(n)
   if n==1:groups.append([])
   if not groups or n!=len(groups[-1])+1:raise ValueError('小問が連続していません')
   groups[-1].append({'number':n,'answer':a,'points':int(pts)})
  if len(groups)!=(7 if sid in ['theory','machine'] else 6):raise ValueError('大問数不一致')
  for j,g in enumerate(groups):
   if sum(i['points'] for i in g)!=(10 if j<4 else 20):raise ValueError('配点不一致')
  result[sid]=groups
 return result
