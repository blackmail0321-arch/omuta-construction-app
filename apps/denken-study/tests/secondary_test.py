import unittest,json,hashlib,html,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class References(unittest.TestCase):
 def test_verified_question_units(self):
  index=json.loads((ROOT/'secondary/index.json').read_text());self.assertGreaterEqual(len(index['questions']),40)
  for item in index['questions']:
   p=json.loads((ROOT/'secondary'/(item['id']+'.json')).read_text());self.assertEqual(p['id'],item['id']);self.assertEqual(p['maxScore'],30);self.assertTrue(p['questionImages']);self.assertTrue(p['answerImages']);self.assertLessEqual(len(p['questionImages'])+len(p['answerImages']),8)
   for image in p['questionImages']+p['answerImages']:self.assertTrue(image['src'].startswith('data:image/jpeg;base64,'))
  q=json.loads((ROOT/'secondary/secondary-2025-power-management-1.json').read_text());self.assertEqual([p['page'] for p in q['questionImages']],[3]);self.assertEqual([p['page'] for p in q['answerImages']],[1])
  q=json.loads((ROOT/'secondary/secondary-2025-machine-control-1.json').read_text());self.assertEqual([p['page'] for p in q['answerImages']],[7,8,9])
 def test_setup_code_matches_deployable_worker(self):
  text=(ROOT/'secondary-setup.html').read_text();m=re.search(r'<textarea id="worker" rows="12" readonly>(.*?)</textarea>',text,re.S);self.assertEqual(html.unescape(m[1]),(ROOT/'grading-worker/worker.mjs').read_text())
if __name__=='__main__':unittest.main()
