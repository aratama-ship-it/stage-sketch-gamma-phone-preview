# スマホ共有画面の追加トークン（2026-10-01）

既存の舞台図・配色・書体を継承。演者が場面を送り、詳細を読みながら図を確認するための配置変更。

| CSS変数 | 値 | 用途 |
|---|---|---|
| --phone-hit | 40px | ヘッダーの操作領域 |
| --phone-icon | 18px | SVG |
| --phone-modal-width | 420px | 中央モーダル幅上限 |
| --phone-modal-vw | 92vw | 中央モーダル幅 |
| --phone-modal-ratio | .8 | 画面高さ上限の比率 |
| --phone-detail-ratio | .22 | 常設詳細の高さ上限比率 |
| --phone-dot | 5px | 詳細ありの印 |
| --phone-overlay-opacity | .8 | 背景の暗さ・浮遊ボタンの面 |

既存値: ヘッダー52px（横44px）、場面行44px、下バー48px、横レール64px。
余白は --study-s1/s2/s3、色は --study-bg/ink/identity-bg/accent/accent-strong のみ。
新しい色・書体・アニメーションは追加しない。目視・実機評価はClaudeと本人が担当。

既存ヘッダー色の実測: --study-accent-strong (#9dd4e6) / --study-identity-bg (#1c272c) = 9.44:1（contrast.mjs）。Chromiumで360px／390pxのヘッダー横あふれなし・操作領域40px以上を確認。
