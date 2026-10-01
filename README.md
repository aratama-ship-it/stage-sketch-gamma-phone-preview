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
git add -A && git commit -m "rebuild from γ vX.Y.Z <commit>" && git push
```

`manifest.json` に元の版（γ の版番号とコミット）と各ファイルの SHA-256 が残る。入口 `index.html` と Viewer の情報パネルにも build 番号と元の版が出る。

## UI を直すときの回し方

1. ここで `stage-study-phone.css` / `stage-study-phone.js`（必要なら `stage-study.css`）を直して push → 1〜2 分で Pages に反映 → スマホで確認。
   `?b=` は build 番号なので、手で直したときは `viewer.html` 内の該当行の `?b=` を上げるか、再ビルドする。
2. 良ければ同じファイル名で γ の作業木へ移し、γ 側の `?v=` と CACHE_NAME を上げて通常の公開手順（`PUBLISH_RULES.md`）で出す。
3. γ 側を出したら、ここを再ビルドして同じ状態に戻す（手直しの差分が残らないようにする）。

## 手書きのファイル

`build.mjs`・`README.md`・`.gitignore`・`.nojekyll` だけ。それ以外は生成物（`manifest.json` の `files` が一覧）。

## 経緯

- 2026-09-11〜15: β時代の同種のプレビュー `stage-sketch-gamma/device-preview/performer-link-ui-20260911/`（iCloud のみ・未公開）。
  当時のスマホ用シェルは後に γ 本体 `stage-study-phone.js/.css` として取り込まれたので、本プレビューは本体ファイルをそのまま使う。
- 2026-10-01: γ v0.2.69（7af5a27）から本プレビューを作成・公開。
