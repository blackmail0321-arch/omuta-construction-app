from pathlib import Path
import json,re,zipfile
s=Path('app/index.html').read_text()
sources=json.loads(Path('app/sources.json').read_text())
refs=[
 {'title':'公共建築工事標準単価積算基準','version':'令和8年3月11日改定','url':'https://www.mlit.go.jp/gobuild/content/001733127.pdf','note':'工種・仕様・適用条件を確認'},
 {'title':'公共建築工事積算研究会参考歩掛り','version':'令和8年3月11日更新','url':'https://www.mlit.go.jp/gobuild/content/001733152.pdf','note':'標準歩掛りと区別し採用理由を保持'},
 {'title':'公共建築工事標準仕様書（電気）','version':'令和7年版','url':'https://www.mlit.go.jp/gobuild/content/001888825.pdf','note':'機材・施工条件の照合'},
 {'title':'公共建築工事標準仕様書（機械）','version':'令和7年版 修補版','url':'https://www.mlit.go.jp/gobuild/content/001967513.pdf','note':'2025年11月5日修補'},
 {'title':'公共建築設備工事標準図（電気）','version':'令和7年版','url':'https://www.mlit.go.jp/gobuild/content/001879276.pdf','note':'公共型番・形状・取付条件'},
 {'title':'公共建築設備工事標準図（機械）','version':'令和7年版','url':'https://www.mlit.go.jp/gobuild/content/001888832.pdf','note':'機器・施工要領'},
 {'title':'公共建築工事積算基準等資料','version':'令和8年改定','url':'https://www.mlit.go.jp/gobuild/content/001733150.pdf','note':'新営・改修・撤去・共通費の条件'},
 {'title':'事連協歩掛り','version':'令和8年6月15日更新','url':'https://www.mlit.go.jp/gobuild/content/001485562.pdf','note':'標準・参考歩掛りとは区別'},
 {'title':'建設物価・建築コスト情報','version':'契約・購入版の年月を確認','url':'https://www.kensetu-bukka.or.jp/service/publications/','note':'価格データ本体は未取得。公式提供案内のみ'},
]
markup='''<section id="workbench"><div class="wb-heading"><span class="wb-tag">Stage5.59 · 実資料から積算</span><h2>候補を確認して、設計書へつなげる。</h2><p>数量・単価・根拠を一度確認すると、採用一覧・代価表・内訳書・Excelへ連動します。</p></div><div class="wb-project-row"><label for="wb-project">工事を選ぶ<select id="wb-project"></select></label><button id="wb-copy" class="primary">今回の工事として作成</button><button id="wb-new">＋ 新規工事</button></div><div class="wb-topnote"><span class="wb-tag" id="wb-role"></span><h2 id="wb-title"></h2><p class="wb-muted">添付Excelの値は参考候補です。今回の図面数量と適用条件を確認して採用します。</p></div><div class="wb-kpis" id="wb-kpis"></div><div class="wb-notice" id="wb-next" role="status"></div><div class="wb-notice warn" id="wb-save-warning" hidden>端末への保存に失敗しました。画面上の作業は保持していますが、「作業をバックアップ」でファイルを保存してください。</div><nav class="wb-tabs" role="tablist" aria-label="積算作業"><button role="tab" data-wb-tab="candidates">候補の確認</button><button role="tab" data-wb-tab="adopted">採用一覧</button><button role="tab" data-wb-tab="output">設計書・出力</button><button role="tab" data-wb-tab="sources">資料・根拠</button><button role="tab" data-wb-tab="history">履歴</button></nav><div id="wb-search-wrap"><label class="wb-muted" for="wb-search">品名・規格・根拠で絞り込み</label><input class="wb-search" type="search" id="wb-search" placeholder="照明、ケーブル、保留 など"></div><div id="wb-content"></div><div class="wb-import-status" id="wb-import-status" role="status"></div><div class="wb-footer"><div class="wb-actions"><button id="wb-backup">作業をバックアップ</button><button id="wb-restore">バックアップから復元</button></div><p class="wb-muted">作業データはこのブラウザ内に保存します。PCとiPadの自動同期は未実装です。端末を替える際はバックアップを保存して復元してください。原本Excelの数式は実行せず、保存済みの計算結果から候補を作成しています。</p></div><input type="file" id="wb-files" accept=".xlsx,.pdf,.docx,.png,.jpg,.jpeg" multiple hidden><input type="file" id="wb-backup-file" accept=".json" hidden></section><details class="card" style="margin-top:24px"><summary>従来の試作画面（Stage5.58）を開く</summary><p class="wb-muted">従来の固定サンプルと出力テンプレートです。上の実資料積算とは別管理で、今回の採用データを出力する際は上の「設計書・出力」を使用してください。</p>'''
s=s.replace('設計書製作アプリ Stage5.53','設計書製作アプリ Stage5.59')
s=s.replace('Stage5.58 通常画面整理・根拠品質強化版','Stage5.59 実資料積算・採用連動版',1)
s=s.replace('</style>',Path('app/workbench.css').read_text()+'</style>',1)
s=s.replace('<main>','<main>'+markup,1).replace('</main>','</details></main>',1)
dialog='<dialog class="wb-dialog" id="wb-dialog"><div class="wb-dialog-heading"><h2 id="wb-dialog-title"></h2><button id="wb-dialog-close" type="button">閉じる</button></div><div id="wb-dialog-body"></div></dialog>'
js='const WB_SOURCES='+json.dumps(sources,ensure_ascii=False).replace('</','<\\/')+';\nconst WB_REFERENCES='+json.dumps(refs,ensure_ascii=False)+';\n'+Path('app/workbench.js').read_text()
s=s.replace('</body>',dialog+'<script>'+js+'</script></body>')
out=Path('release');out.mkdir(exist_ok=True);(out/'index.html').write_text(s)
print('built',len(s.encode()))
