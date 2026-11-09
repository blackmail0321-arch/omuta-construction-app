@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 desktop_setup.py
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 が見つかりません。Python公式サイトからPython 3.10以上を導入してください。
    echo 導入後に、このファイルをもう一度開いてください。
    echo 基本演習だけならindex.htmlをChromeまたはEdgeで開けます。
  ) else (
    python desktop_setup.py
  )
)
pause
