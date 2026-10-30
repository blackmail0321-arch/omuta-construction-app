#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
printf '%s\n' '予定表アプリをポート8026で配信します。PCのブラウザで http://localhost:8026 を開いてください。' '同じWi-FiのiPadからは http://PCのLAN内IP:8026 を開けます。編集データは端末ごとに保存します。' '終了するには Ctrl+C を押してください。'
python3 -m http.server 8026 --bind 0.0.0.0 --directory .
