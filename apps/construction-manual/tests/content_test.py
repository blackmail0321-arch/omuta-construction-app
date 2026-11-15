from pathlib import Path
import json,unittest
ROOT=Path(__file__).resolve().parents[1]
class ManualContent(unittest.TestCase):
 def test_complete_manual(self):
  d=json.loads((ROOT/'data/manual.json').read_text());self.assertEqual(len(d['chapters']),21);self.assertEqual(len(d['worktypes']),10);self.assertGreaterEqual(len(d['terms']),30);self.assertEqual(len(d['documents']),43)
  ids=[t['id'] for s in d['stages'] for t in s['tasks']];self.assertEqual(len(ids),len(set(ids)));self.assertGreater(len(ids),60)
  chapters={c['id'] for c in d['chapters']};self.assertTrue(all(s['chapter'] in chapters for s in d['stages']))
  text=json.dumps(d,ensure_ascii=False);self.assertIn('受変電',text);self.assertIn('変更契約',text);self.assertIn('正式運用',text)
 def test_public_empty_records(self):
  html=(ROOT/'index.html').read_text();self.assertNotIn('password',html);self.assertNotIn('supabase',html)
  for filename in ['manual.pdf','check-sheets.pdf']:self.assertTrue((ROOT/'downloads'/filename).read_bytes().startswith(b'%PDF'))
  js=(ROOT/'app.js').read_text();self.assertNotIn('https://',js);self.assertNotIn('XMLHttpRequest',js);self.assertNotIn('sendBeacon',js)
if __name__=='__main__':unittest.main()
