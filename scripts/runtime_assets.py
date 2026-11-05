"""Explicit runtime-only assets. Never deploy sources, private records or old source ZIPs."""
from pathlib import Path
import io,zipfile
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'apps/integrated-v0.13'
SHARED=['shared-config.js','shared-client.js','shared-editor.js','reference-library.js','status.html','status.css','status.js']
def assets(include_archive=True):
    result={name:(APP/name).read_bytes() for name in ['index.html','volume1.html']}
    result.update({'shared/'+name:(APP/'shared'/name).read_bytes() for name in SHARED})
    manual=ROOT/'manuals/Volume1_ダウンロードと初めての操作手順書.pdf'
    if manual.is_file():result['downloads/volume1-start-guide.pdf']=manual.read_bytes()
    public_docs=ROOT/'manuals/final-2026-11-05/published'
    for name in ['contractor-guide.html','contractor-guide.pdf','contractor-guide.docx','contractor-qr.png','contractor-qr.svg','app-manual.html','specification.html','construction-guide.html','app-manual.pdf','app-manual.docx','specification.pdf','specification.docx','construction-guide.pdf','construction-guide.docx','construction-checklist.html','manuals-complete.zip']:
        if (public_docs/name).is_file():result['downloads/final/'+name]=(public_docs/name).read_bytes()
    for name in ['tesseract.min.js','worker.min.js','tesseract-core-lstm.wasm.js','tesseract-core-lstm.wasm','LICENSE.md','LICENSE-core','lang/jpn.traineddata.gz','lang/eng.traineddata.gz','lang/LICENSE','lang/SOURCE.json']:
        result['vendor/ocr/'+name]=(APP/'vendor/ocr'/name).read_bytes()
    if include_archive:
        archive=io.BytesIO()
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
            for name,data in result.items():
                if name=='shared/shared-config.js':data=b"window.OMUTA_SHARED_CONFIG={url:'',publishableKey:''};\n"
                z.writestr('Volume1/'+name,data)
            z.writestr('Volume1/はじめに.txt','アプリ保管用です。入力データ・添付・接続設定・過去資料は含まれません。通常は元の公開URLを使ってください。参考資料庫には管理者によるDB設定が必要です。')
        result['downloads/volume1-with-guide.zip']=archive.getvalue()
    return result
