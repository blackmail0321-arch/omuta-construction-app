"""Build a Windows download with ASCII-only filenames for legacy ZIP extractors."""
from pathlib import Path
import argparse,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1]
START='''@echo off
setlocal
cd /d "%~dp0denken-study"
if not exist "desktop_setup.py" (
  echo Please extract ALL files before running START.cmd.
  echo The denken-study folder must be next to START.cmd.
  pause
  exit /b 1
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 desktop_setup.py
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3.10 or later is required.
    echo Install Python from https://www.python.org/downloads/windows/
    echo Then open START.cmd again.
    echo See README_JA.txt for Japanese instructions.
  ) else (
    python desktop_setup.py
  )
)
echo.
echo The application process has ended. You may close this window.
pause
'''
GUIDE='''電験一種 学習アプリ — 起動方法

1. ZIPを右クリックし、「すべて展開」→「展開」を押します。
2. 展開したフォルダで START.cmd を開きます。
   マウスをファイル名に合わせ、左ボタンをすばやく2回押す操作です。
   または START.cmd を1回押して選び、キーボードのEnterキーを押しても開けます。
3. 黒いウィンドウが出たら待ちます。ブラウザが開いた後も、黒いウィンドウは開いたままにします。
4. 新しい画面で「設定・記録」→「AIへの接続設定」を開きます。
5. APIキーを入力し「認証を確認して接続する」を押します。キーはチャットへ貼らないでください。

START.cmdとdenken-studyフォルダが並んでいる状態で使います。
ZIPの中から直接開かず、全ファイルを展開してください。
日本語のファイル名が文字化けする解凍ソフトでも識別できるよう、ファイル名を英数字にしています。

「Python 3.10 or later is required」と表示された場合：
Pythonが見つかっていません。公式サイト https://www.python.org/downloads/windows/ からPython 3.10以上を導入する必要があります。
職場PCでインストールの権限がない場合は、管理担当者に確認してください。

起動用ウィンドウを閉じるとサーバーとAIの接続設定が終了します。再利用時はSTART.cmdを開いてください。
基本演習だけを使う場合はdenken-study/index.htmlをChromeまたはEdgeで開く方法もありますが、AI接続・資料更新にはSTART.cmdでの起動が必要です。

学習記録の引継ぎ：
以前のアプリで「設定・記録」→「学習記録を書き出す」。新しいアプリで「学習記録を読み込む」を使ってください。
直接HTMLを開く場合と、サーバーから開く場合では、ブラウザの保存領域が異なります。

他年度の過去問と参考引用は「教材と出典」からPCの通信で取得・照合します。
作業環境では外部通信が403となり、他年度の実取り込み、引用記事、実AIキーによる説明は未検証です。
独自の基礎・予想問題は公式問題と区別し、予想問題の難度は未校正です。
'''
def package(output):
 output=Path(output);output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  z.writestr('START.cmd',START.replace('\n','\r\n').encode('ascii'))
  z.writestr('README_JA.txt',GUIDE.encode('utf-8-sig'))
  z.writestr('denken-study/GUIDE_JA.md',GUIDE.encode('utf-8'))
  mapping={'検証結果.json':'VERIFICATION.json'}
  for f in ROOT.rglob('*'):
   if not f.is_file() or any(p in ['.runtime','__pycache__','.git'] for p in f.parts):continue
   rel=f.relative_to(ROOT)
   if rel.name in mapping:rel=rel.with_name(mapping[rel.name])
   if not str(rel).isascii():continue
   if f.suffix=='.png' or f.name=='bank.before-update.json':continue
   body=f.read_bytes()
   if f.name=='README.md':body=f.read_text().replace('はじめに.md','GUIDE_JA.md').encode('utf-8')
   z.writestr('denken-study/'+rel.as_posix(),body)
 with zipfile.ZipFile(output) as z:
  assert z.testzip() is None
  assert all(n.isascii() for n in z.namelist())
  b=z.read('START.cmd');assert b.isascii() and b.count(b'\r\n')>=20 and b'\\r\\n' not in b
  assert z.read('denken-study/index.html')==(ROOT/'index.html').read_bytes()
  assert 'denken-study/desktop_setup.py' in z.namelist()
 output.with_suffix('.sha256').write_text(hashlib.sha256(output.read_bytes()).hexdigest()+'  '+output.name+'\n')
 return output
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();f=package(a.output);print('Verified ASCII-name ZIP:',f.stat().st_size,'bytes')
