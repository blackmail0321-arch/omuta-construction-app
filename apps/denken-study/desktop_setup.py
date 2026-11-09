#!/usr/bin/env python3
"""Install PDF tooling in an app-local virtual environment, then start the local app."""
from pathlib import Path
import argparse,subprocess,sys,venv
ROOT=Path(__file__).resolve().parent

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--prepare-only',action='store_true');args=parser.parse_args()
 runtime=ROOT/'.runtime/venv';python=runtime/('Scripts/python.exe' if sys.platform=='win32' else 'bin/python')
 if args.check:
  print('Python version:',sys.version.split()[0]);print('Runtime exists:',python.exists());return
 if sys.version_info<(3,10):raise SystemExit('Python 3.10以上を使用してください。')
 print('初回はPDFを確認するための部品を取得します。アプリ専用フォルダに保存し、他のPython環境は変更しません。',flush=True)
 if not python.exists():venv.EnvBuilder(with_pip=True).create(runtime)
 expected=(ROOT/'requirements-build.txt').read_text().strip().split('==')[1]
 if subprocess.run([str(python),'-c',"import fitz,importlib.metadata,sys;assert importlib.metadata.version('PyMuPDF')==sys.argv[1]",expected],capture_output=True).returncode:
  subprocess.run([str(python),'-m','pip','install','--no-cache-dir','--disable-pip-version-check','-r',str(ROOT/'requirements-build.txt')],check=True)
 if args.prepare_only:
  print('PDF部品の準備を確認しました。',flush=True);return
 print('準備できました。ブラウザでアプリを開きます。',flush=True)
 subprocess.run([str(python),str(ROOT/'launch.py')],check=True)
if __name__=='__main__':
 try:main()
 except subprocess.CalledProcessError as e:raise SystemExit('準備・起動に失敗しました。通信状態と表示されたエラーを確認してください。TLS検証は無効化しないでください。') from None
