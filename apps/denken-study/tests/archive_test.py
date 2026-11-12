import unittest,json,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));from archive_parser import parse
class TwoYearArchive(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.a=json.loads((ROOT/'data/official-archive/archive.json').read_text(encoding='utf-8'))
 def test_only_requested_two_years(self):
  r=self.a['records'];self.assertTrue({2024,2025}.issubset({x['year'] for x in r}));self.assertEqual(len({x['url'] for x in r}),len(r))
  for year in [2024,2025]:
   self.assertEqual(sum(x['year']==year and x['stage']=='primary' for x in r),5);self.assertEqual(sum(x['year']==year and x['stage']=='secondary' for x in r),3)
  for x in r:self.assertEqual(hashlib.sha256((ROOT/x['localFile']).read_bytes()).hexdigest(),x['sha256'])
 def test_answers_match_original_tables(self):
  q=self.a['questions'];self.assertEqual(sum(x['year'] in [2024,2025] for x in q),52);self.assertEqual(sum(len(x['items']) for x in q if x['year'] in [2024,2025]),299)
  for year in sorted({x['year'] for x in q}):
   answers=parse(ROOT/f'assets/official/{year}-primary-answers.pdf')
   for x in [q for q in q if q['year']==year]:self.assertEqual(x['items'],answers[x['subject']][x['number']-1])
   for sid in ['theory','power','machine','law']:
    for option in [6,7]:
     selected=[x for x in q if x['year']==year and x['subject']==sid and (not x['optional'] or x['number']==option)];self.assertEqual(len(selected),6);self.assertEqual(sum(i['points'] for x in selected for i in x['items']),80)
if __name__=='__main__':unittest.main()
