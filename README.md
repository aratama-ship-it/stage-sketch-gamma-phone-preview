# 舞台スケッチγ 共有画面（スマホ）UI確認用プレビュー

γの「演者用リンク」で開く共有 Viewer（`study.html`＋スマホ用シェル `stage-study-phone.js/.css`）を、
共有サーバー（γ専用 Cloudflare Worker）なしで GitHub Pages に置いたもの。スマホの共有画面の UI を
実機で見ながら改善するための足場で、製品ではない。

- 公開先: https://aratama-ship-it.github.io/stage-sketch-gamma-phone-preview/
- GitHub: https://github.com/aratama-ship-it/stage-sketch-gamma-phone-preview （public・noindex）
- 作業木: iCloud `claude code files/show-creative-ideas/stage-sketch-gamma-phone-preview/`
  管理領域: `~/git-repos/stage-sketch-gamma-phone-preview.git`（Mac mini。別 Mac では GitHub から clone）

## 仕組み

- `build.mjs` が γ の作業木から配信ファイルをそのまま複製し、絶対パス（`/study-assets/…`・`/stage-study-…`）を
  相対パスへ書き換える。`?v=` は build 番号 `?b=` に置き換わる（端末のキャッシュ対策）。
- `preview-adapter.js` が `fetch` を横取りし、共有 Worker の API（`/study/api/me`・`/study/api/view/<token>`・
  `/status`・`/notes`）の代わりに `samples/*.json` を返す。**「オーナーへ共有」は成功表示だけで、どこにも送らない。**
- 見本は γ 同梱データの複製（ロミオとジュリエット RJセカンド／全機能の試験場／四つの輪郭）。
  `viewer.html?sample=romeo-juliet|feature-test|four-outlines`。本人の実制作ショーは入れない。
- 自分用メモ・線・図上メモは Viewer 本来の localStorage キー（`stage-study-*`）にだけ残る。
  γ 本体の `gamma:` キーには触れない（同じ github.io オリジンに γ 本体があるため、ここは変えないこと）。

## 作り直す（γ を更新したとき）

```sh
# γ の origin/main を checkout した作業木を --source に渡す（iCloud の stage-sketch-gamma/ は古いので使わない）
# 元γ作業木は読み取り専用。この作業では fetch / checkout / 編集をしない。
cd "/Users/arata/Library/Mobile Documents/com~apple~CloudDocs/claude code files/show-creative-ideas/stage-sketch-gamma-phone-preview"
node build.mjs --source "$HOME/git-repos/gamma-publish-20261001"
git status --short   # 対象を確認し、明示パスで git add
# commit / push / 公開は別途明示指示がある場合だけ。
```

`manifest.json` に元の版（γ の版番号とコミット）と各ファイルの SHA-256 が残る。入口 `index.html` と Viewer の情報パネルにも build 番号と元の版が出る。

## UI を直すときの回し方

1. `overrides/stage-study-phone.js` / `overrides/stage-study-phone.css` を編集し、`node build.mjs --source "$HOME/git-repos/gamma-publish-20261001"` で再生成する。ルート直下の同名ファイルは直接編集しない。
2. build は γ のファイルを複製した後、`overrides/` の同名ファイルで上書きする。複製対象にない名前やサブディレクトリはエラーになる。`manifest.json` の `overrides` に適用一覧・元の γ ファイルの SHA-256・適用ファイルの SHA-256 が残る。HTML は適用後も `?b=<buildId>` で読み込む。
3. **γ へ戻すときは overrides/ のファイルを同名で移す。** γ 側の版・キャッシュ更新と公開は通常手順で別途行う。γ の更新を取り込む際は、overrides が元ファイル全体を置き換えることに注意して差分を統合する。
4. 確認後にコミット・push する（`git add -A` はフックで禁止のため `git status` の対象を明示パスで add）。

## 手書きのファイル

`build.mjs`・`README.md`・`IMPROVEMENTS.md`・`design/TOKEN_SHEET.md`・`overrides/`・`.gitignore`・`.nojekyll`。
`design/lighting-verification/` はローカル検証の画像・結果記録。
ルート直下の配信ファイルは生成物（`manifest.json` の `files` が一覧）。

## 今回の実装と検証範囲

改善点1〜7を実装。ショー情報／設定／場面一覧／場面情報は中央モーダル、書き込み／メモは従来の非モーダル位置。
縦は前後ボタンを下バー左、横は舞台図左下へ配置。詳細本文は単一DOMノードを常設領域とモーダルの間で移す。
寸法は `design/TOKEN_SHEET.md`。本人の見た目評価と実機Safariは未確認。

### 照明4の実装（2026-10-01）

API・トグルからCanvas描画まで実装済み。最上部の表示トグル左に、描画対象の照明を持つショーだけ照明アイコンを表示する。
「作業灯のみ」⇄「照明のみ（作業灯なし）」の2状態で、既定は作業灯のみ。
本体の `LIGHT_LOOK_STEPS` の `off` / `dark` を使い、後者は光だまり・光の筋を有効にして作業灯を落とす。
保存は親の localStorage `stage-study-phone-light` だけ。ページ／iframe再読み込み・向き変更・場面送りでも状態を維持する。
対象の照明がないショーではトグルを隠し、親の保存値を残したまま作業灯表示にする。

**判定の根拠:** `lightInfo()` は描画と同じ `lightCueOverlayForLayout(layout("plan"))` を使う。
`project.lightingDesign.rig.fixtures` の配置と `lightingDesign.scenes[].cue` を
`SHOSAI_STAGE_LIGHT_CUE_OVERLAY.build()` で読み、灯体数が0でないことと舞台の幅・奥行きが一致することを本体のガードで確認する。
キュー未設定・消灯でも仕込みがあれば対象になる。そのシーンで照明のみを選ぶと、本体同様に暗くなる。
試験場 v26 は21灯、ロミオは16灯。「四つの輪郭」は lightingDesign がなく、場面1・4の旧 `pieces.type === "light"` のみ。
本体 `drawStage()` は `lightsOn = false` で旧駒の灯体を描かないため、この見本のトグルは非表示にする。

**追加したモジュール（本体の相対順序で読み込み）:**

- `gamma-light-model.js`: 読み込み時の照明データ正規化。
- `stage-fixture-body.js`: 灯体の形とレンズ位置。
- `stage-lighting-plan-overlay.js`: 仕込み位置・舞台寸法の読み取りモデル。
- `light-design/rig-engine.js`: 光軸・投影楕円・ゴボ・カッターなどの計算。
- `light-design/laser-effects.js`: レーザーの計算・描画。
- `stage-light-render.js`: 光だまり・光の筋・作業灯の暗幕。
- `gamma-light-cue-overlay.js`: ショーの灯体とシーンのキューを描画モデルへ変換。

7ファイルはγからそのまま複製し、`manifest.json.files` に SHA-256 を記録。
追加ファイルにはストレージ・通信の実行呼び出しがない。照明プラン保存用 `stage-lighting-plans.js` や照明編集画面は不要なので読み込まない。
iframe の `sandbox="allow-scripts"`、編集イベント遮断、読み取り専用APIの公開範囲を維持する。

**replaceOnce パッチ一覧／γへ戻す際の本体側変更:**

| 対象 | パッチ |
|---|---|
| `stage-sketch.js` | 読み取り専用レンダラへ表示専用 `light(mode)` / `lightInfo()` を追加。prefsの3値を変更して `applyFeatureFlags()` / `render()` を呼び、`savePrefs()` は呼ばない |
| `stage-sketch.js` | 光だまり描画の条件だけ `showSelection || STUDY_READ_ONLY` にする |
| `stage-sketch.js` | 作業灯の暗幕・照らされた駒の再描画・光の筋・レーザー・灯体描画の条件だけ同様に通す |
| `stage-study-frame.js` | 検証済みmessage経路へ `light` を追加 |
| `stage-study-frame.js` | load後に `light-capability` を親へ通知 |
| `study-frame.html` | `gamma-light-model.js` を舞台モジュールより前へ追加 |
| `study-frame.html` | 残り6モジュールを本体の順序で `stage-machinery.js` の後へ追加 |

`drawStage(..., showSelection=false, ...)` は維持し、選択枠・ハンドル・照明配置用オーバーレイは有効にしない。
HTMLの追加参照も相対パス＋同じ `?b=<buildId>` を使う。全置換は1件一致必須で、0件・複数件ならビルド失敗。
`manifest.json.patches` に変更名とパッチ前後のSHA-256を記録する（HTMLのbeforeは相対パス化後）。
γへ戻すときは overrides の統合に加えて上記7パッチ相当とHTML生成元への反映が必要。今回γ作業木は変更していない。

### 照明4の画像差分・操作検証

Chromium、build `20261001-1134`、横844×390。各Canvas 640×360（230,400画素）。
シーン読み込みとフォントを待ち、停止状態で `light('work')` → `light('show')` → `light('work')` を比較した。

| 見本・場面番号 | 正面の差分画素 | 平面の差分画素 | 作業灯へ戻した画像 |
|---|---:|---:|---|
| 試験場 v26・場面26 | 230,390 | 230,400 | 両図とも元画像と完全一致 |
| 試験場 v26・場面1 | 230,400 | 230,400 | 両図とも元画像と完全一致 |
| ロミオ・場面1 | 230,069 | 229,088 | 両図とも元画像と完全一致 |

試験場の場面1・26は21灯すべてキュー未設定（点灯0灯）なので暗幕による変化。
ロミオの場面1は16灯中7灯が点灯し、光だまり・光の筋も出る。
[画像とハッシュの記録](design/lighting-verification/results.json)。比較PNGは同フォルダ内、左が作業灯、右が照明のみ。
例: [ロミオ場面1・正面](design/lighting-verification/romeo-juliet-scene-1-front.png)。

- 親トグルの往復、親localStorage、ページ／iframe再読込、縦横変更、場面の前後送りで照明状態を維持。画像の再適用も確認。
- 「四つの輪郭」でトグル非表示・作業灯表示、読み込みエラーなしを確認。
- lightingDesignも旧駒の灯体もない見本は samples/ に存在しないため、完全な灯体なしショーの実測は未確認。見本は加工していない。
- コンソールエラー0、非200応答0、配信36ファイルすべて200・ハッシュ一致。観測したリクエストはローカルGETのみ。
- sandbox内のストレージ拒否、読み取り専用API、overridesとのバイト一致、元γファイルの変更なしを確認。
- `node --check`（全配信JS・build・override）、build、パッチSHA-256照合、全replaceOnce対象の0件／2件拒否が合格。
- 既存UIの回帰確認も合格（360／390px、縦横、中央モーダル・Escape・フォーカス復帰、詳細DOMの単一性、書き込みの非モーダル表示）。
- 光の見た目の良し悪し・実機Safariは本人確認待ち。8977番の検証サーバーは停止済み。コミット・push・公開は行っていない。

## 経緯

- 2026-09-11〜15: β時代の同種のプレビュー `stage-sketch-gamma/device-preview/performer-link-ui-20260911/`（iCloud のみ・未公開）。
  当時のスマホ用シェルは後に γ 本体 `stage-study-phone.js/.css` として取り込まれたので、本プレビューは本体ファイルをそのまま使う。
- 2026-10-01: γ v0.2.69（7af5a27）から本プレビューを作成・公開。

## 前回のUI検証（2026-10-01・照明描画修正前）

- `node --check overrides/stage-study-phone.js` と build 成功。不明な override 名で失敗する負例も一時コピーで確認。
- overrides と配信ファイルのバイト一致、元 γ SHA-256、viewer の `?b=` 参照を確認。
- 8977番の専用一時サーバーで manifest が作業木と一致し、生成アセット29件が200。終了後にサーバー停止。
- Chromium の機械確認: 360×844／390×844のヘッダー横あふれなし・ボタン40px以上、縦正面／横両方、中央モーダル・Escape・フォーカス復帰、詳細DOMが1つ、書き込みは非モーダル、コンソールエラー0。
- 試験場IDは生成元 PROJECT_ID と見本 document.project.id が `gamma-feature-test-v26` で一致。場面1と26で操作確認。灯体データは場面26・27・36・37に存在（旧駒データ。現在の灯体判定の対象ではない）。
- 前回時点では目視評価、実機Safari、照明の切替は未確認。コミット・push・公開は行っていない。

確認する場合は本ディレクトリで `python3 -m http.server 8977 --bind 127.0.0.1` を起動し、
`http://127.0.0.1:8977/viewer.html?sample=feature-test` を開く（他サーバーが同ポートを使用していないことを確認）。


## UI2: 改善8〜10（2026-10-01、実装済み・実機未確認）

今回はローカルのみ。γ元作業木・βは変更せず、commit / push / add は実行していない。
[画像付き検証結果](design/ui2-verification/index.html)／[機械計測](design/ui2-verification/results.json)。

- **8 / A**: 横のヘッダーと場面行を右64pxレールの「メニュー」に移動。図の階・倍率・リセットは各図右上の開閉操作へ重ねる。すべて40px以上（図操作44px）。常設の上部3段をなくす。横「両方」は正面:平面=2:1にし、正面を優先。初期の両方表示、下左の前後、縦の配置は維持。
- **9 / B**: 読み取り専用API `stageBounds(view)` とnavigation側の等方拡大で、メインステージの幅か高さが表示枠の80%を占める状態を100%とした。操作倍率はこの基準から1〜4倍。正面は100%、平面は120%（占有率96%）を初期・場面送り・リセットに適用。ピンチで平面も100%へ戻せる。画像キャプチャのcropにも同じ変換を使用。
- **10 / C**: 「メモ用紙」は図上付箋と解釈。`#study-sticky` とパネルを非表示＋inertにし、生成JSから作成・選択・編集・移動・保存のハンドラーと付箋変更message処理を除去。iframeは既存付箋を表示専用に固定。互換参照用の非表示DOMとデータ読込は残す。キー・保存データの掃除なし。`#phone-memo` / `.study-memo` / `#study-note-form` は維持。

### 寸法の根拠と測定

`venueSize()` が `VENUES.sizeById(venue(), project.venueSize)` に `project.venueDims` を重ねた寸法を使う。
`layout('plan').stage` は舞台演技エリア（主輪郭の外接）、正面は同じlayoutの舞台開口（奥壁上端〜床前端）の外接を使用。客席・袖は含めない。正面の透視投影と16:9 Canvasは変更せず、同じ倍率で縦横を拡大する。

| 見本（場面1） | 幅×奥行×高さ m | 正面100%占有率（横/縦） | 平面100%占有率（横/縦） |
|---|---|---|---|
| ロミオ | 12×9×7.2 | 80.00% / 80.00% | 80.00% / 80.00% |
| 試験場 v26 | 12.4×9.6×7.2 | 80.00% / 80.00% | 80.00% / 80.00% |
| 四つの輪郭 | 7.15×4.55×7 | 80.00% / 80.00% | 80.00% / 80.00% |

占有率 = max(舞台の表示幅/viewport幅, 舞台の表示高/viewport高)。Canvas全景ではなく、切り抜いて見せる表示枠を分母にする。`stageBounds` の正規化座標と実際のCanvas DOM矩形から計測し、PNGも保存。±8%の許容内。平面既定120%は全6条件で96.00%。端数はCSSピクセル丸めあり。

横844×390、試験場の場面1での前後比較:

| 項目 | 前 | 後 |
|---|---:|---:|
| 正面viewport高さ | 258px | 390px（+132px） |
| 平面viewport高さ | 257px | 389px（+132px） |
| 両方表示の正面舞台幅 | 364.72px | 413.60px（+13.4%） |
| 正面単独の舞台幅 | 431.14px | 624.00px（+44.7%） |

3見本とも寸法取得でき、全景フォールバックは発生していない。未知寸法／無効な外接では基準倍率1・中央寄せの従来全景へフォールバックする。非矩形舞台・別の客席位置の80%見た目は実機未評価。

### γへ統合するとき

overrides 2ファイルの差分統合に加え、build.mjs の `UI2` / viewerパッチを以下へ移植する（全パッチはreplaceOnceで1件一致必須・manifest.patchesに記録）:

| 対象 | 統合内容 |
|---|---|
| stage-sketch.js | 読み取り専用 `stageBounds()`（照明追加APIは前回分） |
| stage-study-navigation.js | 基準fit・相対zoom・平面120%・場面reset・pinch/capture座標・図操作の開閉 |
| stage-study-navigation.css | タッチスマホ横だけの図操作overlay・正面2:平面1 |
| stage-study-frame.js | 場面ごとのnavigation reset・既存付箋の表示専用化 |
| stage-study-viewer.js | 付箋UI・イベント・変更message経路の廃止。自分用メモは保存 |
| study.html等Viewer生成元 | 付箋UIを常時非表示（互換DOM参照を残す場合はinertも維持） |

sandbox=`allow-scripts`、親/子の送信元チェック、編集イベント遮断は変更しない。旧照明パッチも引き続き必要。

### 再検証

```sh
python3 -m http.server 8981 --bind 127.0.0.1
# 別ターミナル。Python playwrightが必要。このMacの実行環境:
/Users/arata/.venvs/design-lint/bin/python design/ui2-verification/verify.py
/Users/arata/.venvs/design-lint/bin/python design/ui2-verification/persistence.py
```

hasTouch/isMobile相当をともに有効にしたChromium、844×390・390×844、3見本の場面1（場面2への送りと戻りも確認）。
照明の往復画像一致、表示切替、階選択、詳細の単一DOM/自動表示、回転マッピング、中央モーダル、付箋非表示、自分用メモ保存と再読込、ペン入力と1本戻す、保存済み付箋の保持を確認。既存付箋検証は隔離ブラウザ内の検証用データのみ。
通信はローカルGETのみ、コンソールエラー0。実機Safari/Androidのタッチ感・読める大きさは未確認。検証サーバーは作業終了時に停止。


UI2の変更ファイル一覧:
- 手編集: `overrides/stage-study-phone.js`、`overrides/stage-study-phone.css`、`build.mjs`、`README.md`、`IMPROVEMENTS.md`、`design/TOKEN_SHEET.md`。
- 追加証跡: `design/ui2-verification/`（画像、比較HTML、計測JSON、再実行用verify.py/persistence.py）。
- 再生成: `index.html`、`viewer.html`、`study-frame.html`、`preview-adapter.js`、`manifest.json`、`stage-sketch.js`、`stage-study-frame.js`、`stage-study-navigation.js/.css`、`stage-study-phone.js/.css`、`stage-study-viewer.js`、`stage-study-continuity.js`。
- 最終ビルド `20261001-1308`。全JS構文、manifest 36ファイルのSHA-256、override一致、replaceOnce 0件/複数件拒否、git diff --check が合格。


## 改善11: セリフ稽古モード（2026-10-01）

ローカル実装済み。場面行の「稽古」（横はメニュー内）で開始し、下の前後ボタンでセリフを送る。
終了は場面行のトグルまたはセリフ領域右上から。縦は常設詳細と同じ行、横は右レール左側の図の上に配置する。
ロミオ見本は84行、最初は場面3。台本がない「四つの輪郭」「全機能の試験場」では入口を隠す。

**追加replaceOnceパッチ（γへ戻す際にも必要）:**

| 対象 | パッチ |
|---|---|
| `stage-study-viewer.js` | `data = result; scenes = ...` の直後で `stage-study-loaded` CustomEventを発火。detailは `{ project: result.document.project, scenes }`。変更名は `read-only loaded project event for line rehearsal` |

既存 `patchAsset` の `patches` 配列・`manifest.json.patches` に追加パッチ名と前後ハッシュを記録。
overridesはこのイベントだけから台本・演者・キューを取得する。Viewer内部変数へ直接アクセスせず、場面移動は
`study-scenes.value` と `change` イベントの既存 `select()` 経路。イベント時点ではまだframeが準備中なので、復帰は操作可能になるまで保留する。

- 対象行はViewerのsceneに属する行のみ。シーン順→dialogueキューの秒（offsetSeconds、代替atSeconds、未設定は末尾）→元配列順。
- 本文・話者はtextContentで表示。話者の色は左4pxバーのみ。キューmemoの冒頭が本文の引用ならその行だけ省略し、合図ラベルの重複は表示時に除く。
- localStorage `stage-study-phone-lines:<token>` は仕様どおり `{ on, lineId }`。保存できない場合もメモリ内で操作可能。
- **仕様の補足:** 同じキー名のsessionStorageに開始前の表示（front/plan/both）を保持する。再読み込み後の終了でも開始前の表示へ戻すため。タブを閉じた後の新しいセッションではそのときの既定表示を戻り先とする。localStorageの指定形式は拡張していない。
- モード中は両方ボタンを無効化し、開始前が両方なら正面にする。回転規則は既存どおり。セリフのない場面では前後操作で隣のセリフのある場面へ移動する。
- 新規CSSトークンは指定の3つのみ。色・書体・アニメーションの追加なし。

### 検証と証拠

`design/lines-verification/` に縦390×844・360×740／横844×390のPNG、英語PNG、結果JSONと検証コードのテキストを保存。
Chromiumの `hasTouch:true, isMobile:true` で以下を確認（実機確認とは別）。

- 3サイズすべて: 入口の出し分け、1/84の話者・本文・合図、2/84、場面3→4、全84行の送り、先頭／末尾の無効化、再読み込み復帰、終了時の両方復元。
- 場面1のセリフなし案内と送り、場面一覧による最初のセリフへの整列、同じ場面選択では現在行を維持。
- 図側のcapture応答で場面3→4を確認。同じ場面内ではsceneメッセージを送らず、図側のsceneIdも維持。
- 正面／平面の回転保持、日英ラベル、aria-live/aria-atomic、既存ペンのON/OFF、自分用メモの保存・再読み込み。
- 360pxを含め横あふれなし。終了ボタン40px高、前後は44px幅（縦48px高／横44px高）。横の帯は132.59px以下、図は残り257.41px以上。
- ソートの境界（同秒、キューなし、null、atSeconds=0）、未知sceneの除外、話者名指定、引用省略、空の中間場面の前後移動はブラウザ内レスポンス置換で確認。見本JSONやγ元ファイルは変更していない。
- ページエラー・コンソールエラー0。追加検証の通信は127.0.0.1へのリクエストのみ。
- 本文・話者の合成色 #d0c8b9 / 背景 #191512 は10.93:1、補助文字 #aba495 は7.32:1（既存inkのalphaとopacity .8を合成しcontrast.mjsで計測）。

再実行（このMacのPlaywrightを使用）:

```sh
python3 -m http.server 8984 --bind 127.0.0.1
# 別ターミナル、同じリポジトリで実行
export NODE_PATH="/Users/arata/Library/Mobile Documents/com~apple~CloudDocs/claude code files/show-creative-ideas/stage-sketch-gamma/node_modules"
node < design/lines-verification/verify-main.txt
node < design/lines-verification/verify-extra.txt
node < design/lines-verification/verify-data.txt
```

未確認: 実機Safari/Androidのタッチ感・読みやすさ、VoiceOver等の実読み上げ。仕様から除外した機能はない。
commit / push / 公開は実行していない。確認URL: `http://127.0.0.1:8984/viewer.html?sample=romeo-juliet`（このMac内）。

変更一覧: 手編集は overridesのJS/CSS、build.mjs、README.md、IMPROVEMENTS.md、design/TOKEN_SHEET.md。
生成更新は stage-study-phone.js/.css、stage-study-viewer.js、stage-study-continuity.js、preview-adapter.js、
viewer.html、study-frame.html、index.html、manifest.json。追加証拠は design/lines-verification/。

改善11の最終ビルド: `20261001-1354`。node --check（build・override・全配信JS）、ビルド、生成36ファイルのSHA-256、overrideバイト一致、git diff --check が合格。

Safari折り返し補正（build `20261001-1638`）: `overrides/stage-study-phone.js` の `phraseParts`/`setPhrased`（`auto-phrase` 非対応時のみ有効）と `overrides/stage-study-phone.css` の `.phrase-wrap`。場面メモ `#study-scene-note` はMutationObserverで再描画（disconnect→描画→observeでループ回避）。WebKitは Playwright に `maxTouchPoints=5` の init script を足して検証（テスト専用・アプリ側は変更なし）。

セリフエリア高さ固定（build `20261001-2223`）: `overrides/stage-study-phone.css` の `.phone-lines-on` グリッドを「セリフ=1fr／図=min(--phone-figure-height, 画面高50%)」に変更し、`.phone-lines` の max-height を廃止。横は帯を `画面高×--phone-lines-ratio` の固定行高に。WebKit(375×667・430×932・667×375)とChromiumで確認。

稽古モードの図の全幅化・次のセリフ（build `20261001-2235`）: build.mjs に `stage-study-navigation.js` の `fill(full)`（stageFill 1.0／平面既定1.0）と `stage-study-frame.js` の `fit` メッセージを追加。親側は `overrides/stage-study-phone.js` の `applyFit`（稽古ON/OFFとiframe再読込の `loaded` で送信）。CSSは `.phone-line-next*`・`--phone-figure-height: 75vw`。確認: Chromium(375×667・393×852・360×740・844×390)・WebKit(375×667・844×390)。

セリフ送りの押し出し演出と話者の吹き出し（build ``）: `overrides/stage-study-phone.js` の `stepLine` が `slideDir` を立て、`syncLines` で旧セリフを複製（`.phone-line-ghost`）して上（戻りは下）へ流しつつ新セリフ・合図・次のセリフを入れる。吹き出しは `rehearsalLines` に `castId` を持たせ、`applySpeaker`（稽古ON/OFF・行変更・iframe再読込の `loaded` で送信）→ build.mjs の `speaker` メッセージ → stage-sketch.js パッチの `drawStudySpeakerMark`（正面・平面の主キャンバスのみ）。

モード切替トグルほか（build `20261002-0803`）: `#phone-lines` は `.phone-mode-scene`/`.phone-mode-lines` の2スパン。WebKitの `:hover` 固定でも `stage-study.css` の aria-pressed 塗りつぶしが出ないよう CSS で上書き。`linesExit` は削除。build.mjs の navigation パッチは `stageFill` を関数化（`fill(full)` は平面の全幅化だけを切り替える）。押し出し演出の長さは `syncLines` の `duration: 560`。

正面図の下詰め・縦書き（build `20261002-0812`）: build.mjs の navigation レイアウトパッチで、`viewer-phone` かつ正面のとき `v.cy` を「主舞台の下端＝viewport下端−4px」に（それ以外は従来の中央寄せ）。縦書きは `overrides/stage-study-phone.js` の設定ペイン `.phone-setting` チェックボックス→`verticalOn`、`syncLines` が `.phone-lines.is-vertical` を付け替え。セリフ3要素は `.phone-lines-flow`（横書き時は `display: contents`、縦書き時は `direction: rtl` の横スクロール flex）に入れ、各要素は `writing-mode: vertical-rl`。押し出し演出は縦書き時のみ X 軸（`syncLines` の `axis`/`sign`）。

## 2026-10-02 build 20261002-0849: ショー切り替え・操作ボタンを下バーへ・転換再生を削除
- ショー情報パネルの先頭に「ショーを切り替える」リスト（見本3種。選ぶと `?sample=` で読み込み直す）。★プレビュー専用: アダプタの `shows` 固定リスト。本番γでは最近のショー/割り当てショー一覧が要る（設計判断）。
- 図の中の「正面操作」トグルを下バーへ移動（正面/平面/両方で『正面操作』『平面操作』『図の操作』）。押すと図内の操作バー（席選択・拡大リセット）を重ねて表示。iframe へ `controls` メッセージ（build.mjs パッチ＝γへ戻す時は本体側にも要る）。図内のトグルは廃止。
- 「転換再生」ボタン削除。
