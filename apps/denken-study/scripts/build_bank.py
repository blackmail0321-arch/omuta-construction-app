from pathlib import Path
import fitz,re,json,unicodedata,base64,hashlib,shutil,sys
ROOT=Path(__file__).resolve().parents[1]
ATT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'assets'
def input_pdf(label,fallback):
 files=list(ATT.rglob('*'+label+'*.pdf'))
 return files[0] if files else ROOT/'assets'/fallback
def copy_pdf(source,target):
 if source.resolve()!=target.resolve():shutil.copy2(source,target)
def norm(t):return unicodedata.normalize('NFKC',t)
answer_path=input_pdf('解答','2026-answers.pdf')
ap=fitz.open(answer_path)[0]
subjects=[('theory','理論',60,164,90),('power','電力',185,289,80),('machine','機械',310,414,80),('law','法規',435,539,65)]
topics={
'theory':['直流回路・相反定理','半導体の拡散とドリフト','発振回路・積分回路','AD変換と実効値計測','不平衡三相回路','誘電体入りコンデンサ','単極誘導・電磁誘導'],
'power':['揚水発電・可変速運転','遮断器と過渡回復電圧','同期発電機の可能出力曲線','高圧配電線の地絡保護','火力発電の水処理','架空送電線・絶縁間隔'],
'machine':['同期機の短絡比','変圧器の並行運転','同期モータの運転特性','照明・半球面光源','パワー半導体','燃料電池','情報セキュリティ'],
'law':['電気事業法・保安の責務','特別高圧から低圧への変成','地域独立系統','系統連系の利点と課題','電力設備の過負荷','ガスタービン発電所の監視']}
questions=[];sources=[]
for sid,label,x0,x1,minutes in subjects:
 text=norm(ap.get_text(clip=fitz.Rect(x0,84,x1,700),sort=True))
 rows=re.findall(r'\((\d+)\)\s+([イロハニホヘトチリヌルヲワカヨタレソツネナラ])\s+([234])',text)
 groups=[]
 for n,a,p in rows:
  if int(n)==1:groups.append([])
  assert int(n)==len(groups[-1])+1,(sid,n)
  groups[-1].append({'number':int(n),'answer':a,'points':int(p)})
 path=input_pdf(label,f'2026-{sid}.pdf');doc=fitz.open(path)
 starts=[]
 for i,page in enumerate(doc):
  hits=re.findall(r'(?m)^問([1-7])\s+',norm(page.get_text()))
  if hits and i>=3:starts.append((int(hits[0]),i))
 assert len(starts)==len(groups)==len(topics[sid]),(sid,starts,len(groups))
 copy_pdf(path,ROOT/'assets'/f'2026-{sid}.pdf')
 sources.append({'id':sid,'label':label,'year':2026,'era':'令和8年度','file':f'assets/2026-{sid}.pdf','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'minutes':minutes,'status':'添付資料：問題冊子と正答表を照合','origin':'user-upload','officialCrosscheck':False})
 for index,(qnum,start) in enumerate(starts):
  end=starts[index+1][1] if index+1<len(starts) else len(doc)
  pages=[];qtext=''
  for p in range(start,end):
   pix=doc[p].get_pixmap(matrix=fitz.Matrix(1.45,1.45),alpha=False)
   img=pix.tobytes('jpeg',jpg_quality=83)
   pages.append({'number':p+1,'src':'data:image/jpeg;base64,'+base64.b64encode(img).decode()})
   qtext+=norm(doc[p].get_text())+'\n'
  opts=list(dict.fromkeys(re.findall(r'\(([イロハニホヘトチリヌルヲワカヨタレソツネナラ])\)',qtext)))
  for a in groups[index]:assert a['answer'] in opts,(sid,qnum,a,opts)
  questions.append({'id':f'2026-{sid}-{qnum}','year':2026,'subject':sid,'number':qnum,'topic':topics[sid][index],'kind':'past','optional':sid in ['theory','machine'] and qnum in [6,7], 'pages':pages,'text':qtext,'options':opts,'items':groups[index],'source':sid,'explanationStatus':'分野の基礎解説。小問ごとの完全解説・外部引用は未整備'})
 assert [sum(a['points'] for a in g) for g in groups[:4]]==[10]*4
 assert all(sum(a['points'] for a in g)==20 for g in groups[4:])
copy_pdf(answer_path,ROOT/'assets/2026-answers.pdf')
bank={'schema':1,'created':'2026-11-07','subjects':[{'id':s,'label':l,'minutes':m} for s,l,a,b,m in subjects],'sources':sources,'questions':questions}
(ROOT/'data/bank.json').write_text(json.dumps(bank,ensure_ascii=False,separators=(',',':')), encoding="utf-8")
print('Bank:',len(questions),'groups,',sum(len(q['items']) for q in questions),'subquestions; all answer symbols found; point totals verified')
