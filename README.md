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
cd "$HOME/git-repos/gamma-publish-20261001" && git fetch origin && git checkout --detach origin/main
cd "/Users/arata/Library/Mobile Documents/com~apple~CloudDocs/claude code files/show-creative-ideas/stage-sketch-gamma-phone-preview"
node build.mjs --source "$HOME/git-repos/gamma-publish-20261001"
git status --short   # 対象を確認し、明示パスで git add
git commit -m "rebuild from γ vX.Y.Z <commit>" && git push
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
