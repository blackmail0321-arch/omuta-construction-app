@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ブラウザで http://localhost:8026 を開いてください。終了は Ctrl+C です。
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 -m http.server 8026 --bind 0.0.0.0 --directory .
) else (
  python -m http.server 8026 --bind 0.0.0.0 --directory .
)
pause
