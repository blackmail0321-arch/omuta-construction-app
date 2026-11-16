from pathlib import Path
import json,unittest
ROOT=Path(__file__).resolve().parents[1]
class ManualContent(unittest.TestCase):
 def test_complete_manual(self):
  d=json.loads((ROOT/'data/manual.json').read_text());self.assertEqual(len(d['chapters']),24);self.assertEqual(len(d['worktypes']),10);self.assertGreaterEqual(len(d['terms']),30);self.assertEqual(len(d['documents']),43)
  ids=[t['id'] for s in d['stages'] for t in s['tasks']];self.assertEqual(len(ids),len(set(ids)));self.assertGreater(len(ids),60)
  chapters={c['id'] for c in d['chapters']};self.assertTrue(all(s['chapter'] in chapters for s in d['stages']))
  text=json.dumps(d,ensure_ascii=False);self.assertIn('受変電',text);self.assertIn('変更契約',text);self.assertIn('正式運用',text)
 def test_plain_language_glossary(self):
  d=json.loads((ROOT/'data/manual.json').read_text());terms=d['terms'];canonical=json.loads((ROOT/'data/glossary.json').read_text());self.assertEqual(terms,canonical);self.assertEqual(len(terms),68)
  ids={t['id'] for t in terms};self.assertEqual(len(ids),len(terms));self.assertEqual(len({t['term'] for t in terms}),len(terms))
  for t in terms:
   for field in ['meaning','reading','category','explanation','example','uses','pitfalls','nextSteps']:self.assertTrue(t[field],(t['term'],field))
   self.assertGreaterEqual(len(t['explanation']),2);self.assertIn(t['chapterId'],{c['id'] for c in d['chapters']});self.assertIn(t['sourceId'],{s['id'] for s in d['sources']});self.assertTrue(set(t['related'])<=ids)
  for name in ['代価表','歩掛り','人日','根拠','補正']:self.assertTrue(any(t['term']==name for t in terms))
  labor=next(t for t in terms if t['term']=='歩掛り');self.assertIn('0.1',str(labor));self.assertIn('仮',str(labor))
 def test_source_traceability(self):
  d=json.loads((ROOT/'data/manual.json').read_text());sources={s['id']:s for s in d['sources']};self.assertEqual(len(sources),15)
  for c in d['chapters']:
   for r in c.get('references',[]):
    self.assertIn(r['sourceId'],sources)
    for page in r['pages']:self.assertTrue(1<=page<=sources[r['sourceId']]['pageCount'])
  special=next(c for c in d['chapters'] if c['id']=='c22');self.assertIn('初回か再度入札後か',special['body']);self.assertIn('自動計算しません',special['body']);self.assertIn('p.4〜5',special['body'])
  optional=next(s for s in d['stages'] if s['id']=='procurement-zui');self.assertTrue(optional['optional']);self.assertEqual(len(optional['tasks']),12)
  self.assertEqual(sum(len(s['tasks']) for s in d['stages'] if not s.get('optional')),71)
  self.assertTrue((ROOT/'downloads/procurement-guide.pdf').read_bytes().startswith(b'%PDF'))
 def test_standard_editions_are_not_invented(self):
  d=json.loads((ROOT/'data/manual.json').read_text());s=[s for s in d['sources'] if s.get('versioned')];self.assertEqual(len(s),5)
  for source in s:self.assertIsNone(source['latestRelease']);self.assertFalse(source.get('expectedHash'));self.assertIn('未確認',source['edition'])
  self.assertTrue(any(c['id']=='c24' for c in d['chapters']))
 def test_public_empty_records(self):
  html=(ROOT/'index.html').read_text();self.assertNotIn('password',html);self.assertNotIn('supabase',html)
  for filename in ['manual.pdf','check-sheets.pdf']:self.assertTrue((ROOT/'downloads'/filename).read_bytes().startswith(b'%PDF'))
  js=(ROOT/'app.js').read_text();self.assertNotIn('https://',js);self.assertNotIn('XMLHttpRequest',js);self.assertNotIn('sendBeacon',js)
if __name__=='__main__':unittest.main()
