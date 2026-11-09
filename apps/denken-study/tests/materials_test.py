import importlib.util,json,sys,tempfile,unittest,shutil
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));import materials
spec=importlib.util.spec_from_file_location('updater',ROOT/'scripts/update_materials.py');updater=importlib.util.module_from_spec(spec);spec.loader.exec_module(updater)
class TestMaterials(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.bank=json.loads((ROOT/'data/bank.json').read_text());cls.answers=materials.parse_answers(ROOT/'assets/2026-answers.pdf')
 def test_01_all_150_answers(self):
  for sid in materials.SUBJECTS:
   expected=[q['items'] for q in self.bank['questions'] if q['year']==2026 and q['subject']==sid]
   self.assertEqual(expected,self.answers[sid])
 def test_02_identity(self):
  self.assertEqual(materials.identity(ROOT/'assets/2026-answers.pdf'),(2026,'answers'))
  self.assertEqual(materials.identity(ROOT/'assets/2026-law.pdf'),(2026,'law'))
 def test_03_existing_data_kept(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d);(r/'data').mkdir();(r/'assets').mkdir();shutil.copy2(ROOT/'data/bank.json',r/'data/bank.json');before=(r/'data/bank.json').read_bytes()
   report=materials.import_pairs(r,[{'path':str(ROOT/'assets/2026-answers.pdf')},{'path':str(ROOT/'assets/2026-law.pdf')}]);self.assertFalse(report['added']);self.assertEqual(before,(r/'data/bank.json').read_bytes())
 def test_04_synthetic_new_year_and_rollback(self):
  # Metadata is deliberately mocked to test adding a new year without claiming possession of its actual exam.
  entries=[{'path':str(ROOT/'assets/2026-answers.pdf')},{'path':str(ROOT/'assets/2026-law.pdf')}]
  with tempfile.TemporaryDirectory() as d:
   r=Path(d);(r/'data').mkdir();(r/'assets').mkdir();shutil.copy2(ROOT/'data/bank.json',r/'data/bank.json')
   def synthetic(path):return (2025,'answers' if str(path).endswith('answers.pdf') else 'law')
   with patch.object(materials,'identity',synthetic):report=materials.import_pairs(r,entries)
   self.assertEqual(len(report['added']),1);b=json.loads((r/'data/bank.json').read_text());self.assertEqual(len([q for q in b['questions'] if q['year']==2025]),6);self.assertEqual(sum(i['points'] for q in b['questions'] if q['year']==2025 for i in q['items']),80);self.assertTrue((r/'data/bank.before-update.json').exists())
 def test_05_short_citation_extraction(self):
  p=updater.Article();p.feed('<html><title>変圧器の解説</title><nav>ナビゲーション</nav><p>変圧器は交流電圧を変換する機器です。巻数と電圧の比を整理し、並行運転では変圧比とインピーダンスなどの条件を照合します。<script>untrusted()</script></p></html>')
  self.assertEqual(p.title,'変圧器の解説');self.assertEqual(len(p.paragraphs),1);self.assertNotIn('untrusted',p.paragraphs[0]);self.assertNotIn('ナビ',p.paragraphs[0])
if __name__=='__main__':unittest.main()
