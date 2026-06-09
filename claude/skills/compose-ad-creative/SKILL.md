---
name: compose-ad-creative
description: 背景画像＋コピーから広告クリエイティブのカンプ（静止画 PNG）を量産する。HTML/CSS でベクター品質の文字組みを作り agent-browser で PNG 書き出し（$0・Figma 不要）。ブランド（色/書体/ロゴ）は対象プロダクトの docs/product.md から読む。X(Twitter) 等の広告カンプ作成で使う。「広告カンプ作って」「コピー乗せて」「クリエイティブ量産」で起動。
user-invocable: true
---

# compose-ad-creative（広告カンプ量産エンジン）

背景 PNG ＋ コピーから、広告クリエイティブのカンプ（静止画）を量産する。文字は **HTML/CSS のベクター品質**で組み、`agent-browser`（ヘッドレスブラウザ）で PNG に書き出す。**$0・Touch ID 不要・Figma 不要・Claude だけで完結**する。

`ai-image-gen`（背景生成）の後工程にあたる。画像モデルは日本語が化けるので、**背景は画像生成・文字はこのスキルで後乗せ**という分業（旧来の「文字は Figma で」を置き換える）。

## 前提（満たさなければ止まる）

- **対象プロダクトの `docs/product.md` が存在すること**。ブランド資産（色トークン・書体・トーン・ロゴ）をここから読んで config に落とす。**無ければ「先に docs/product.md を整備してください」と伝えて停止する**（憶測で色や書体を捏造しない）
- `agent-browser`（`/opt/homebrew/bin/agent-browser`。homebrew 版なので nodenv とは無関係）
- ネット接続（Web フォントを Google Fonts から読み込むため）
- 背景素材（`ai-image-gen` で生成 or 既存。`Read` で目視厳選しておく）

## 使い方（検証済みフロー）

### 1. product.md からブランドを確定
対象プロダクトの `docs/product.md` を読み、色・書体・ロゴ・トーンを把握する。無ければ停止。

### 2. 背景を用意して厳選
`ai-image-gen` で背景を生成する（or 既存素材）。**余白がデザインされた背景を選ぶ**（後述 mandatories）。`Read` で PNG を開いて目視評価する（捏造しない）。

### 3. config.json を組む
`examples/taberu-pro.example.json` を雛形に、`brand`（product.md 由来）と `comps`（訴求軸・コピー）を埋める。**1 つの comp = 1 訴求軸**。

### 4. HTML を生成
```bash
node <このスキル>/scripts/compose.mjs <config.json> <outDir>
# 例: node scripts/compose.mjs /tmp/ad/config.json /tmp/ad/out
```
config の `brand` に必須キー（ink/accent/paper/fontFamily/fontCssUrl）が欠けていると停止する。

### 5. agent-browser で PNG 書き出し（この手順で検証済み）
```bash
agent-browser open about:blank
agent-browser set viewport 1200 1200 2          # 末尾 2 = retina（2400px 出力で高精細）
for f in <outDir>/*.html; do
  agent-browser open "file://$f"                # f は絶対パス
  agent-browser wait 1800                        # Web フォント読込待ち（必須・無いと文字が出ない）
  agent-browser screenshot "${f%.html}.png"
done
agent-browser close
```

### 6. 目視評価 → 微調整
生成 PNG を `Read` で開いて確認。崩れ（中途半端な折り返し／被写体と文字の被り／可読性）があれば config を直して 4 から再実行。

## mandatories（必ず守る・compose.mjs は既にこれらに準拠）

- **X セーフゾーン**: 画像の**左下**に X 側のキャプション UI が重なる。左下隅に要素を置かない。ロゴは下部中央、CTA は sub 直下に配置済み
- **1 クリエイティブ = 1 訴求軸**（混ぜない）。A/B テストは 1 変数限定
- **文字は HTML/CSS のベクター**で組む。画像生成で日本語を焼かない（化けるため）
- **背景の向き不向き**: 余白がデザインされた背景（片側グラデ等）はコピーが主役になれて◎。主役オブジェクトが画面を占める背景（キャラ・食べ物びっしり等）は文字と喧嘩する（半透明パネルでの救済は将来対応。当面は余白系を選ぶ）
- **AI 生成写真は避ける**: AI 生成感が拭えず日本市場は拒否反応が強い。イラスト/グラフィック系を選ぶ（最終判断は product.md のトーンに従う）

## config スキーマ

```jsonc
{
  "brand": {                  // ← docs/product.md のブランド資産から
    "ink": "#3d3d2f",         // 文字色（必須）
    "accent": "#ff8a3d",      // アクセント色（必須）
    "paper": "#f2f2ee",       // ベール/紙の地色（必須）
    "fontFamily": "Zen Kaku Gothic New",  // 必須
    "fontCssUrl": "https://fonts.googleapis.com/css2?family=...&display=swap", // 必須
    "logo": { "pre": "taberu", "accent": ".", "post": "pro" },  // accent部のみアクセント色
    "cta": "無料・登録なしではじめる"   // 省略可。あれば sub 直下にボタン化
  },
  "viewport": { "width": 1200, "height": 1200 },  // 1:1 推奨。配置数値は 1200 基準に最適化
  "comps": [
    {
      "id": "comp-01",
      "bg": "/abs/path/to/background.png",   // 背景PNG（絶対パス推奨。file:// に正規化される）
      "bgPos": "72% 64%",                    // background-position（被写体を画面内に収める微調整）
      "eyebrow": "いちばん雑な、食事記録。",   // 上部の小ラベル（省略可）
      "headline": [                          // 行ごとに nowrap。長い行は size を下げる
        { "text": "ラーメン食べた、", "size": 108 },
        { "text": "で終わり。", "accent": true, "size": 116 }
      ],
      "sub": "チャットで送るだけ。\nAIが記録して、全力で応援する。",  // \n で改行
      "axis": "入力のゆるさ"                  // 訴求軸メモ（出力には出ない）
    }
  ]
}
```

他プロダクト（例: honn.me）で使うときは、その `docs/product.md` のブランドで `brand` を差し替えるだけ。

## 罠リスト（実証済み）

- **`agent-browser` は homebrew 版**（`/opt/homebrew/bin`）。`playwright-cli` は node 版違い（nodenv の 22.22.1 在中）で `NODENV_VERSION` 明示が要るので避ける
- **`wait 1800` は必須**。Web フォント読込前に screenshot すると字体が出ない（デフォルト書体で豆腐る）
- **retina は viewport 末尾の `2`**。1200×1200 指定でも 2400px で出力され高精細。X 広告 1:1 推奨は 1200 だが大きめ出力は縮小されるだけで問題ない
- **headline は行ごと nowrap**。長い行は `size` を下げないと枠を溢れる（「カレー食べた、」が中途半端に折れる事故の対策）
- **背景の被写体は `bgPos` で収める**（例 `72% 64%` で丼を右下に収めた）
- 賑やか背景（主役オブジェクト多）は現状の left レイアウトだと文字が喧嘩する。**半透明パネル救済は未実装**（将来対応。当面は余白系背景を選ぶ）

## このスキルの位置づけ（広告制作スキルスイート）

- 前工程: **`ai-image-gen`**（背景素材を生成）
- 上流: **`plan-ad-strategy`**（訴求軸・コピーの戦略を出す）※未実装
- 統括: **`produce-ad-creative`**（オーケストレーター。各スキルを束ねる司会）※未実装
- 設計の全体像はメモ `project_ad_skill_suite_design.md`、探索ログ・mandatories 詳細は `project_x_ad_creative_exploration.md`
