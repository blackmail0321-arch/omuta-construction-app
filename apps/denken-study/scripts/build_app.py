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
nav=[('home','▦','今日の学習'),('practice','▤','科目別演習'),('review','↻','苦手の復習'),('mock','◷','本番模試'),('plan','▥','学習計画'),('sources','▧','教材と出典'),('settings','⚙','設定・記録')]
page='''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="description" content="電験一種・一次試験。過去問の演習、採点、復習、学習計画をひとつに。"><title>DENKEN 1｜電験一種 学習ノート</title><style>__STYLE__</style></head><body><a class="skip" href="#main">本文へ移動</a><div class="shell"><aside class="sidebar"><a class="brand" href="#" aria-label="電験一種 学習ノート"><span class="brand-mark">ϟ</span><span><strong>DENKEN 1</strong><small>電験一種 学習ノート</small></span></a><nav aria-label="メインメニュー">__NAV__</nav><div class="side-bottom"><div class="eyebrow">YOUR GOAL</div><strong id="target-year">令和9年度 / 2027</strong><p id="side-minutes">今週 0 / 420 分</p><progress id="side-progress" max="100" value="0" aria-label="週間学習目標"></progress><button class="subtle small" data-view="settings">目標を変更する →</button></div></aside><div class="workspace"><header class="topbar"><span class="small">学習ノート <span class="muted"> / </span><span id="breadcrumb">今日の学習</span></span><div class="row"><span class="date" id="today-date"></span><span class="small muted"><span class="status-dot"></span><span id="storage-state">このブラウザに保存</span></span></div></header><main class="content" id="main" tabindex="-1"><noscript>JavaScriptを有効にすると、演習・採点・復習管理が使えます。</noscript></main></div></div><input type="file" id="import-file" accept=".json,application/json" hidden><div id="toast" class="toast" role="status" aria-live="polite" hidden></div><dialog id="zoom" class="zoom"><div class="zoom-head"><strong>問題を拡大</strong><button data-action="close-zoom">閉じる</button></div><img id="zoom-image" alt="拡大した問題"></dialog><script>window.STUDY_BANK=__DATA__;</script><script>__CORE__</script><script>__COMIC__</script><script>__APP__</script></body></html>'''
page=page.replace('__STYLE__',(R/'style.css').read_text(encoding="utf-8")).replace('__NAV__',''.join(f'<button class="navbtn" data-view="{id}"><span class="nav-icon" aria-hidden="true">{icon}</span>{label}</button>' for id,icon,label in nav)).replace('__DATA__',json.dumps(db,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')).replace('__CORE__',(R/'core.js').read_text(encoding="utf-8")).replace('__COMIC__',(R/'comic.js').read_text(encoding='utf-8')).replace('__APP__',(R/'app.js').read_text(encoding="utf-8"))
(R/'index.html').write_text(page, encoding="utf-8")
print('Standalone application:',len(page.encode()),'bytes')
