# パッケージ検証結果

2026年10月13日実施。

- 統合Ver0.9のPythonビルド成功（integrated/index.html生成）。
- 取得した元ZIPの展開成功。原本のSHA-256をoriginal-files.jsonに記録。
- 同梱ファイル一覧とSHA-256をmanifest.jsonへ記録。
- 最終ZIPのCRC検査成功。

今回の確認は移行パッケージの整合性とビルドまで。ブラウザ操作、Excel再計算、iPad実機、最新入力データ、DB移行は未検証。

## 2026-10-30 非公開資料庫の移行準備コード

- PASS `python3 tests/reference-db-test.py`：実PostgreSQLで所有者管理・別編集者/閲覧者/匿名の直接取得拒否・承認済みフィールドのみの提案・個別許可/解除・組立単価の未確定扱い・共有中保管の停止・冪等な本人利用履歴。Storageはテスト用テーブルで既存の広い許可ポリシーを設け、追加のrestrictive制限が機能することを確認。
- PASS `node tests/private-workspace.cjs`：新規0件、参考自動再追加なし、既存実工事保持、アカウント分離、保管、破損旧データ非上書き。
- PASS `node tests/reference-library.cjs`：許可資料だけの表示、明示選択、候補状態と出典/履歴、アカウント切替時の消去、元の保存領域を残した引継ぎ、原本の読戻し照合、共有中の保管拒否。
- PASS `python3 tests/private-release-test.py`、`python3 tests/shared-config-test.py`：ランタイム許可リスト、元の案件JSON・分割ソース・旧ZIP非収録、テンプレート原値/キャッシュ/私有文字の除去、公開設定キーの制限。
- PASS `OMUTA_PRIVATE_BACKUP=<提供済みのローカル作業JSON> node tests/private-export.cjs`：採用32件、合計7,209,400円、明細不変、設計/予算Excel。`check-print-settings.py` でA4の向き・倍率・改ページ・印刷範囲を維持。内訳の固定見出しと補助シートの原値除去もopenpyxlで確認。
- PASS `shared-comparison.cjs`、`shared-resolve.cjs`、`shared-stability.cjs`、`run-shared-integration.py`：既存の共有、権限、競合、保存/復元、通信断/再試行、セッション、スマホ振分け。

本番DB適用・本番Storage HTTP疎通・利用者最新端末の移行・iPad Safariの新機能実機確認は未実施。現在の公開アプリや利用者データを変更していない。
