# もちログ

体重変動.xlsxから記録を取り込める、端末内保存の体重管理PWA。公開時の初期データは空です。

- 身長・年齢は基本情報から手入力。体重は0.01kg単位、実測体脂肪率とメモも記録。
- BMI、成人向け肥満度、体重・BMI・体脂肪率グラフ、7日移動平均、月別集計。
- 増減に応じて相棒の雲・星・花の衣装が変化。増減に優劣を付けません。
- Excelの体重変動シートの日付と体重のみ取り込み。数式・マクロは実行しません。
- 身長未記録の過去データは現在の身長による参考値。計測時の身長・年齢は個別編集できます。
- 肥満度は（体重−BMI22の標準体重）÷標準体重×100。体脂肪率とは異なります。診断用ではありません。
- 記録とバックアップを暗号化。同期は暗号化JSONの書き出し・取り込みで行います。

初回はHTTPSの公開URLでパスフレーズを設定し、オフライン準備完了後にホーム画面へ追加してください。パスフレーズを忘れると復号できません。端末の保存領域が消える場合に備え、暗号化バックアップを別の場所にも保管してください。

ビルド: `python3 apps/weight-buddy/build.py`。出力offline-site.zipを/weight/へ配信します。既存の手動Pagesワークフローで予定表・貯蓄アプリと一緒に公開できます。

検証: `node apps/weight-buddy/tests/core.cjs`、`python3 apps/weight-buddy/tests/fixtures.py`、`node apps/weight-buddy/tests/import.cjs`、`node apps/weight-buddy/tests/browser.cjs`、`node apps/weight-buddy/tests/security-offline.cjs`。ブラウザ検証はPlaywrightとChromium、合成Excel生成はopenpyxlを使用。
