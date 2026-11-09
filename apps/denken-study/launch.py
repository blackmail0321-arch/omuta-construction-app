#!/usr/bin/env python3
"""Open the local app. Optional API key is held in process memory, not saved to disk."""
from pathlib import Path
import argparse,getpass,importlib.util,os,threading,webbrowser
ROOT=Path(__file__).resolve().parent

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--ask-key',action='store_true');args=parser.parse_args()
 if args.ask_key and not os.environ.get('DENKEN_AI_KEY'):
  print('AIのAPIキーを入力してください。入力文字は表示せず、ファイルにも保存しません。')
  print('空欄でEnterを押すと、AIなしで起動します。キーの取得・料金はAI提供元で確認してください。')
  key=getpass.getpass('API key: ').strip()
  if key:os.environ['DENKEN_AI_KEY']=key
 spec=importlib.util.spec_from_file_location('study_server',ROOT/'server.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 http=None
 for port in range(8031,8041):
  try:http=module.ThreadingHTTPServer(('127.0.0.1',port),module.Handler);break
  except OSError:continue
 if http is None:raise SystemExit('空いているポートがありません。起動済みの学習アプリを確認してください。')
 print('学習アプリを起動しました。このウィンドウを閉じるとサーバーは停止します。')
 print('AIの接続設定:',bool(os.environ.get('DENKEN_AI_KEY')))
 threading.Timer(.5,lambda:webbrowser.open(f'http://127.0.0.1:{http.server_port}/')).start()
 try:http.serve_forever()
 except KeyboardInterrupt:pass
 finally:http.server_close()
if __name__=='__main__':main()
