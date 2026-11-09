"""Exercise actual application data operations with Windows-like cp932 defaults."""
from pathlib import Path
import importlib.util,runpy,unittest,sys,tempfile,shutil
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
real_open=Path.open

def cp932_default(path,mode='r',buffering=-1,encoding=None,errors=None,newline=None):
 if 'b' not in mode and encoding in [None,'locale']:encoding='cp932'
 return real_open(path,mode,buffering,encoding,errors,newline)

class TestEncoding(unittest.TestCase):
 def test_server_loads_japanese_bank_under_cp932_default(self):
  with patch.object(Path,'open',cp932_default):
   spec=importlib.util.spec_from_file_location('encoding_server',ROOT/'server.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
   self.assertEqual(len(s.BANK['questions']),26);self.assertEqual(sum(len(q['items']) for q in s.BANK['questions']),150)
 def test_build_roundtrip_is_utf8_under_cp932_default(self):
  original=(ROOT/'index.html').read_bytes()
  with patch.object(Path,'open',cp932_default):runpy.run_path(str(ROOT/'scripts/build_app.py'),run_name='encoding_build')
  self.assertEqual(original,(ROOT/'index.html').read_bytes());self.assertIn('電験一種',(ROOT/'index.html').read_text(encoding='utf-8'))
 def test_import_preserves_bank_with_cp932_default(self):
  sys.path.insert(0,str(ROOT));import materials
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);(root/'data').mkdir();shutil.copy2(ROOT/'data/bank.json',root/'data/bank.json');original=(root/'data/bank.json').read_bytes()
   with patch.object(Path,'open',cp932_default):report=materials.import_pairs(root,[])
   self.assertEqual(report['added'],[]);self.assertEqual(original,(root/'data/bank.json').read_bytes())
if __name__=='__main__':unittest.main()
