import unittest,json,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from daily_collect import read_third,plan_years
class DualTest(unittest.TestCase):
 def test_daily_limits(self):
  rows=lambda ys:[{'year':y,'url':str(y)} for y in ys]
  self.assertEqual(plan_years(rows([2024,2025]),rows(range(2009,2027)),2),[2023,2022])
  self.assertEqual(plan_years([],rows([2024,2025,2026]),1),[2026]);self.assertEqual(plan_years(rows([2026]),rows([2024,2025,2026]),1),[2025])
  self.assertEqual(plan_years(rows([2009]),rows([2009]),2),[])
 def test_third_originals_and_score(self):
  a=json.loads((ROOT/'data/third/archive.json').read_text());qs=a['questions'];self.assertTrue(qs)
  for r in a['records']:self.assertEqual(hashlib.sha256((ROOT/r['localFile']).read_bytes()).hexdigest(),r['sha256'])
  self.assertEqual(len({q['id'] for q in qs}),len(qs))
  for answer in [r for r in a['records'] if r['kind']=='answer']:
   if not any(q['year']==answer['year'] and q['term']==answer['term'] for q in qs):continue
   expected=read_third(ROOT/answer['localFile'])
   for sid in ['theory','power','machine','law']:
    part=[q for q in qs if q['year']==answer['year'] and q['term']==answer['term'] and q['subject']==sid]
    if not part:continue
    for q in part:self.assertEqual(q['items'],expected[sid][q['number']]);self.assertEqual(q['options'],['1','2','3','4','5'])
    for option in [17,18]:self.assertEqual(sum(i['points'] for q in part if not q['optional'] or q['number']==option for i in q['items']),100)
 def test_visual_lesson_physics(self):
  a=json.loads((ROOT/'data/third/archive.json').read_text());q={q['id']:q for q in a['questions']};lessons=json.loads((ROOT/'data/third/lessons.json').read_text())
  charge=8e-6*1000;capacity=4e-6;voltage=charge/capacity;energy=0.5*capacity*voltage**2
  self.assertAlmostEqual(voltage,2000);self.assertAlmostEqual(energy,8);self.assertEqual(q['third-2026-upper-theory-1']['items'][0]['answer'],'2')
  cases={'a':(2,3),'b':(1,3),'c':(.5,1.5),'d':(1,1.5)};values={k:1/a-1/b for k,(a,b) in cases.items()};self.assertEqual(min(values,key=values.get),'a');self.assertEqual(max(values,key=values.get),'c');self.assertEqual(q['third-2026-upper-theory-2']['items'][0]['answer'],'4')
  for id,lesson in lessons.items():self.assertIn(id,q);self.assertGreaterEqual(sum(bool(p.get('visual')) for p in lesson['panels']),5)
 def test_same_day_is_noop(self):
  import tempfile
  from unittest.mock import patch
  from datetime import datetime
  from zoneinfo import ZoneInfo
  import daily_collect
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'data').mkdir();file=root/'data/daily-status.json';text=json.dumps({'lastDate':datetime.now(ZoneInfo('Asia/Tokyo')).date().isoformat()});file.write_text(text)
   with patch.object(daily_collect,'ROOT',root),patch.object(daily_collect,'collect_grade',side_effect=AssertionError('must not fetch')):daily_collect.main()
   self.assertEqual(file.read_text(),text)
 def test_journal(self):
  s=json.loads((ROOT/'data/daily-status.json').read_text());self.assertLessEqual(len(s['lastRun']['firstYears']),2);self.assertLessEqual(len(s['lastRun']['thirdYears']),1)
if __name__=='__main__':unittest.main()
