import importlib.util,tempfile,sys,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('bootstrap',ROOT/'desktop_setup.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class TestBootstrap(unittest.TestCase):
 def test_failed_pdf_download_does_not_block_launch(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d);p=r/'.runtime/venv'/('Scripts/python.exe' if sys.platform=='win32' else 'bin/python');p.parent.mkdir(parents=True);p.touch();(r/'requirements-build.txt').write_text('PyMuPDF==1.26.6\n');calls=[]
   def run(args,**kw):
    calls.append(args)
    return SimpleNamespace(returncode=0 if str(args[-1]).endswith('launch.py') else 1)
   with patch.object(m,'ROOT',r),patch.object(m.subprocess,'run',run),patch.object(sys,'argv',['desktop_setup.py']):m.main()
   self.assertTrue(str(calls[-1][-1]).endswith('launch.py'));self.assertIn('--timeout',calls[1]);self.assertNotIn('--trusted-host',calls[1])
 def test_failed_prepare_only_does_not_claim_success(self):
  with tempfile.TemporaryDirectory() as d:
   r=Path(d);p=r/'.runtime/venv'/('Scripts/python.exe' if sys.platform=='win32' else 'bin/python');p.parent.mkdir(parents=True);p.touch();(r/'requirements-build.txt').write_text('PyMuPDF==1.26.6\n')
   with patch.object(m,'ROOT',r),patch.object(m.subprocess,'run',return_value=SimpleNamespace(returncode=1)),patch.object(sys,'argv',['desktop_setup.py','--prepare-only']):
    with self.assertRaises(SystemExit):m.main()
if __name__=='__main__':unittest.main()
