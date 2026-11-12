from pathlib import Path
import json,base64
R=Path(__file__).resolve().parents[1]
db=json.loads((R/'data/bank.json').read_text(encoding="utf-8"));db['lessons']=json.loads((R/'data/lessons.json').read_text(encoding='utf-8')) if (R/'data/lessons.json').exists() else {};db['notes']=json.loads((R/'data/notes.json').read_text(encoding="utf-8"));db['originals']=json.loads((R/'data/originals.json').read_text(encoding="utf-8"));db['forecasts']=json.loads((R/'data/forecasts.json').read_text(encoding="utf-8"));db['citations']=json.loads((R/'data/citations.json').read_text(encoding="utf-8")) if (R/'data/citations.json').exists() else [];db['pdfs']={p.stem:'data:application/pdf;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (R/'assets').glob('*.pdf')}
# The official archive is independently verified; preserve uploaded 2026 IDs and lessons.
archive_path=R/'data/official-archive/archive.json'
db['archive']=json.loads(archive_path.read_text(encoding='utf-8')) if archive_path.exists() else {}
known={q['id'] for q in db['questions']}
for q in db['archive'].get('questions',[]):
 if q['id'] not in known:db['questions'].append(q);known.add(q['id'])
for rec in db['archive'].get('records',[]):
 if not rec.get('verified') or rec['stage']!='primary' or rec['kind']!='question':continue
 qs=[q for q in db['questions'] if q['year']==rec['year'] and q['subject']==rec['subject']]
 if not qs:continue
 answer=next((a for a in db['archive']['records'] if a.get('verified') and a.get('year')==rec['year'] and a.get('stage')=='primary' and a.get('kind')=='answer'),None)
 existing=next((a for a in db['sources'] if a['year']==rec['year'] and (a.get('subject') or a['id'])==rec['subject']),None)
 if existing:
  if existing['sha256']==rec['sha256']:existing.update(url=rec['url'],answerUrl=answer['url'] if answer else '',officialCrosscheck=True,status='公式配信PDFのSHA256と添付原本が一致')
 else:db['sources'].append({'id':f"{rec['year']}-{rec['subject']}",'subject':rec['subject'],'year':rec['year'],'label':next(a['label'] for a in db['subjects'] if a['id']==rec['subject']),'url':rec['url'],'answerUrl':answer['url'] if answer else '', 'sha256':rec['sha256'],'origin':'official-download','officialCrosscheck':True,'status':'公式PDFの年度・科目・問題番号・正答・配点を機械照合'})
# Questions are kept in the bank, not repeated inside the source inventory.
db['archive'].pop('questions',None)
db['archive']['downloadableYears']=sorted({r['year'] for r in db['archive'].get('records',[])},reverse=True)[:2]
db.update(examLevel=1,examTitle='電験一種',paperTotal=80,optionalNumbers=[6,7],daily=json.loads((R/'data/daily-status.json').read_text()) if (R/'data/daily-status.json').exists() else {})
nav=[('home','▦','今日の学習'),('practice','▤','科目別演習'),('review','↻','苦手の復習'),('mock','◷','本番模試'),('plan','▥','学習計画'),('sources','▧','教材と出典'),('settings','⚙','設定・記録')]
page='''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="description" content="電験一種・一次試験。過去問の演習、採点、復習、学習計画をひとつに。"><title>DENKEN 1｜電験一種 学習ノート</title><style>__STYLE__</style></head><body><a class="skip" href="#main">本文へ移動</a><div class="shell"><aside class="sidebar"><a class="brand" href="#" aria-label="電験一種 学習ノート"><span class="brand-mark">ϟ</span><span><strong>DENKEN 1</strong><small>電験一種 学習ノート</small></span></a><nav aria-label="メインメニュー">__NAV__</nav><div class="side-bottom"><div class="eyebrow">YOUR GOAL</div><strong id="target-year">令和9年度 / 2027</strong><p id="side-minutes">今週 0 / 420 分</p><progress id="side-progress" max="100" value="0" aria-label="週間学習目標"></progress><button class="subtle small" data-view="settings">目標を変更する →</button></div></aside><div class="workspace"><header class="topbar"><span class="small">学習ノート <span class="muted"> / </span><span id="breadcrumb">今日の学習</span></span><div class="row"><span class="date" id="today-date"></span><span class="small muted"><span class="status-dot"></span><span id="storage-state">このブラウザに保存</span></span></div></header><div class="exam-switch"><label for="exam-level">学習する試験</label><select id="exam-level"><option value="1">電験一種</option><option value="3">電験三種</option></select><span>学習記録は試験ごとに保存</span></div><main class="content" id="main" tabindex="-1"><noscript>JavaScriptを有効にすると、演習・採点・復習管理が使えます。</noscript></main></div></div><input type="file" id="import-file" accept=".json,application/json" hidden><div id="toast" class="toast" role="status" aria-live="polite" hidden></div><dialog id="zoom" class="zoom"><div class="zoom-head"><strong>問題を拡大</strong><button data-action="close-zoom">閉じる</button></div><img id="zoom-image" alt="拡大した問題"></dialog><script>window.STUDY_BANK=__DATA__;</script><script>__CORE__</script><script>__COMIC__</script><script>__APP__</script></body></html>'''
template=page
def render(db):
 return template.replace('__STYLE__',(R/'style.css').read_text(encoding="utf-8")).replace('__NAV__',''.join(f'<button class="navbtn" data-view="{id}"><span class="nav-icon" aria-hidden="true">{icon}</span>{label}</button>' for id,icon,label in nav)).replace('__DATA__',json.dumps(db,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')).replace('__CORE__',(R/'core.js').read_text(encoding="utf-8")).replace('__COMIC__',(R/'comic.js').read_text(encoding='utf-8')).replace('__APP__',(R/'app.js').read_text(encoding="utf-8"))
page=render(db)
(R/'index.html').write_text(page, encoding="utf-8")
print('Standalone application:',len(page.encode()),'bytes')

third_path=R/'data/third/archive.json'
if third_path.exists():
 archive=json.loads(third_path.read_text(encoding='utf-8'))
 questions=archive.get('questions',[])
 if not questions:raise ValueError('Third-class questions must be verified before publication')
 papers=[{'id':p,'year':next(q['year'] for q in questions if q['paper']==p),'term':next(q['term'] for q in questions if q['paper']==p),'label':str(next(q['year'] for q in questions if q['paper']==p))+'年度 '+('上期' if p.endswith('upper') else '下期' if p.endswith('lower') else '通年')} for p in sorted({q['paper'] for q in questions},reverse=True)]
 for q in questions:
  q['topic']=str(q['year'])+'年度 '+('上期' if q['term']=='upper' else '下期' if q['term']=='lower' else '通年')+' '+q['topic'] if not q['topic'].startswith(str(q['year'])) else q['topic']
  if q['id']=='third-2026-upper-theory-1':q['topic']='コンデンサ・電荷保存と静電エネルギー'
  if q['id']=='third-2026-upper-theory-2':q['topic']='点電荷の電位差'
 archive.pop('questions',None)
 archive['downloadableYears']=sorted({r['year'] for r in archive.get('records',[])},reverse=True)[:2]
 third={'examLevel':3,'examTitle':'電験三種','paperTotal':100,'optionalNumbers':[17,18],'daily':db['daily'],'subjects':[dict(s,minutes=65 if s['id']=='law' else 90) for s in db['subjects']],'questions':questions,'sources':[],'archive':archive,'papers':papers,'lessons':json.loads((R/'data/third/lessons.json').read_text(encoding='utf-8')) if (R/'data/third/lessons.json').exists() else {},'notes':{},'originals':[],'forecasts':[],'citations':[],'pdfs':{}}
 text=render(third).replace('DENKEN 1','DENKEN 3').replace('電験一種','電験三種').replace('電験三種・一次試験','電験三種')
 text=text.replace('<option value="1">電験三種</option>','<option value="1">電験一種</option>')
 (R/'third.html').write_text(text,encoding='utf-8')
 print('Third-class application:',len(text.encode()),'bytes')
