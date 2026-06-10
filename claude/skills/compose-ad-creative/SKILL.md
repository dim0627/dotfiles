---
name: compose-ad-creative
description: 背景画像＋コピーから広告クリエイティブのカンプ（静止画 PNG）を量産する。HTML/CSS でベクター品質の文字組みを作り agent-browser で PNG 書き出し（$0・Figma 不要）。ブランド（色/書体/ロゴ）は対象プロダクトの docs/product.md から読む。X(Twitter) 等の広告カンプ作成で使う。「広告カンプ作って」「コピー乗せて」「クリエイティブ量産」で起動。
user-invocable: true
---

# compose-ad-creative（広告カンプ量産）

背景 PNG ＋ コピーから、広告クリエイティブのカンプ（静止画）を生成する。文字は **HTML/CSS のベクター品質**で組み、`agent-browser`（ヘッドレスブラウザ）で PNG に書き出す。**$0・Touch ID 不要・Figma 不要・Claude だけで完結**する。

`ai-image-gen`（背景生成）の後工程にあたる。画像モデルは日本語が化けるので、**背景は画像生成・文字はこのスキルで後乗せ**という分業（旧来の「文字は Figma で」を置き換える）。

> ⚠️ **これは汎用エンジンではなく、minimal/left レイアウト（左に余白のある背景 ＋ 左上コピー ＋ 下部中央ロゴ）に特化した参考実装（叩き台）です。** 背景の構図が違えば `scripts/compose.mjs` を出発点に、ベール方向・配置・サイズを案件ごとに改変して使ってください。ブランド（色/書体/ロゴ/CTA）だけは config.brand に外部化済みでプロダクト非依存です。

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
下記「config スキーマ」を参考に config.json を書く。`brand` は product.md 由来、`comps` は訴求軸・コピー。**1 つの comp = 1 訴求軸**。背景が minimal/left 構図でなければ、`scripts/compose.mjs` のレイアウトを叩き台に改変する。

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
生成 PNG を `Read` で開いて確認。**全体をパッと見て「良い」で済ませない**（一見OKでも各テキストの端が背景の主役に重なる事故が起きる）。以下を1要素ずつ照合する:

- [ ] **各テキスト要素（eyebrow / headline 各行 / sub 各行 / CTA）の右端**を背景の主役（被写体）と照合。重なっていないか拡大して確認する
- [ ] headline に中途半端な折り返しがないか（長い行は `size` を下げる）
- [ ] sub が左カラム（クリアゾーン）に収まっているか（はみ出すなら `\n` で割る。後述 mandatories）
- [ ] 左下に X キャプション UI と被る要素を置いていないか

崩れがあれば config を直して 4 から再実行。被写体が主役側にいて寄せたい場合は `bgSize`（>100%）＋`bgPos` で隅へ追い出す。

## mandatories（必ず守る・compose.mjs は既にこれらに準拠）

- **X セーフゾーン**: 画像の**左下**に X 側のキャプション UI が重なる。左下隅に要素を置かない。ロゴは下部中央、CTA は sub 直下に配置済み
- **コピーは左カラム前提**: headline / sub はこのレイアウトの左クリアゾーン（左 96px 起点・幅 840px）に収める。**長い1行は `\n` で2行以上に割る**（1行のままだと右端が背景の主役に重なる）。ベール強化に走る前に、まず改行で収まらないか試す
- **1 クリエイティブ = 1 訴求軸**（混ぜない）。A/B テストは 1 変数限定
- **文字は HTML/CSS のベクター**で組む。画像生成で日本語を焼かない（化けるため）
- **背景の向き不向き**: 余白がデザインされた背景（片側グラデ等）はコピーが主役になれて◎。主役オブジェクトが画面を占める背景（キャラ・食べ物びっしり等）は文字と喧嘩する（半透明パネルでの救済は将来対応。当面は余白系を選ぶ）
- **AI 生成写真は避ける**: AI 生成感が拭えず日本市場は拒否反応が強い。イラスト/グラフィック系を選ぶ（最終判断は product.md のトーンに従う）

## config スキーマ

> ⚠️ 以下の値は**すべてダミー**。実際には対象プロダクトの `docs/product.md` のブランド資産で置換すること（フォント名・色・ロゴ・コピーを実在値に差し替える）。

```jsonc
{
  "brand": {                  // ← docs/product.md のブランド資産から（すべてダミー値）
    "ink": "#3d3d2f",         // 文字色（必須）。任意の CSS color 可（oklch/hex/rgb）
    "accent": "#ff8a3d",      // アクセント色（必須）。同上
    "paper": "#f2f2ee",       // ベール/紙の地色（必須）。同上。Tailwind v4 の oklch トークンをそのまま渡してよい
    "fontFamily": "<product のフォント名>",  // 必須。例: "Zen Maru Gothic"（ダミー。product.md で置換）
    "fontCssUrl": "https://fonts.googleapis.com/css2?family=...&display=swap", // 必須
    "logo": { "pre": "taberu", "accent": ".", "post": "pro" },  // accent部のみアクセント色（ダミー）
    "cta": "無料・登録なしではじめる"   // 省略可。あれば sub 直下にボタン化（ダミー）
  },
  "viewport": { "width": 1200, "height": 1200 },  // 1:1 推奨。配置数値は 1200 基準に最適化
  "comps": [
    {
      "id": "comp-01",
      "bg": "/abs/path/to/background.png",   // 背景PNG（絶対パス推奨。file:// に正規化される）
      "bgSize": "cover",                     // 省略可（既定 cover）。背景とキャンバスが同比率だと cover はクロップ無し＝bgPos が効かない。被写体を寄せたいときは "140%" 等のズームを指定
      "bgPos": "72% 64%",                    // background-position（クロップが起きている時のみ被写体を寄せられる。bgSize 参照）
      "eyebrow": "いちばん雑な、食事記録。",   // 上部の小ラベル（省略可）
      "headline": [                          // 行ごとに nowrap。長い行は size を下げる
        { "text": "ラーメン食べた、", "size": 108 },
        { "text": "で終わり。", "accent": true, "size": 116 }
      ],
      "sub": "チャットで送るだけ。\nAIが記録して、全力で応援する。",  // \n で改行。左カラム前提なので長い行は \n で割る（後述）
      "axis": "入力のゆるさ"                  // 訴求軸メモ（出力には出ない）
    }
  ]
}
```

ブランド色は `docs/product.md` の役割（地色/文字/アクセント）に対応する値をそのまま渡す。色は任意の CSS color を受けるので、Tailwind v4 の oklch トークン（例 `oklch(98.8% 0.003 106.5)`）でも hex でも rgb でもよい（内部で `color-mix` によりベール/影のアルファ合成に使う）。他プロダクト（例: honn.me）で使うときは、その `docs/product.md` のブランドで `brand` を差し替えるだけ。

## 罠リスト（実証済み）

- **`agent-browser` は homebrew 版**（`/opt/homebrew/bin`）。`playwright-cli` は node 版違い（nodenv の 22.22.1 在中）で `NODENV_VERSION` 明示が要るので避ける
- **`wait 1800` は必須**。Web フォント読込前に screenshot すると字体が出ない（デフォルト書体で豆腐る）
- **retina は viewport 末尾の `2`**。1200×1200 指定でも 2400px で出力され高精細。X 広告 1:1 推奨は 1200 だが大きめ出力は縮小されるだけで問題ない
- **headline は行ごと nowrap**。長い行は `size` を下げないと枠を溢れる（「カレー食べた、」が中途半端に折れる事故の対策）
- **`bgPos` はクロップが起きている時だけ効く**。`background-size: cover` で背景とキャンバスが**同比率**（例: 1:1 背景を 1:1 に敷く）だとクロップが起きず、`bgPos` で被写体を寄せられない。寄せたいときは `bgSize` に `"140%"` 等のズームを指定してから `bgPos`（例 `72% 64%`）で隅へ追い出す
- 賑やか背景（主役オブジェクト多）は left レイアウトだと文字が喧嘩する。その場合はこの参考実装を叩き台に、半透明パネルやレイアウト変更を案件ごとに足す（当面は余白系背景が最も手堅い）

## このスキルの位置づけ

- **汎用エンジンではなく、minimal/left レイアウトの参考実装（叩き台）**。背景の構図が変われば `scripts/compose.mjs` を出発点にレイアウト（ベール方向・配置・サイズ）を改変して使う。2 つ目のレイアウトが実際に必要になった時点で共通化を検討する（先回りして汎用化しない）
- 広告制作スキルスイートの中での前後関係:
  - 前工程: **`ai-image-gen`**（背景素材を生成）
  - 上流: `plan-ad-strategy`（訴求軸・コピーの戦略を出す）※将来追加予定
  - 統括: `produce-ad-creative`（各スキルを束ねるオーケストレーター）※将来追加予定
