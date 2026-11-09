@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 launch.py --ask-key
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python 3 が見つかりません。Python を導入後にもう一度開いてください。
  ) else (
    python launch.py --ask-key
  )
)
pause
