---
name: ai-image-gen
description: vercel-labs/ai-cli（Vercel AI Gateway 経由）でローカルから画像を生成する。秘匿キーは 1Password（op run でランタイム注入）、nodenv バージョン罠・Touch ID 連打回避・モデル選定・コスト管理の手順込み。taberu.pro / honn.me 等の X(Twitter)広告クリエイティブのビジュアル背景量産で使う。「画像生成して」「広告ビジュアル作って」「ai image」で起動。
user-invocable: true
---

# ai-cli 画像生成（Vercel AI Gateway）

vercel-labs/ai-cli を使ってローカルから画像を量産する。`AI Gateway` 経由で gemini / imagen / gpt-image 等にアクセスする。**設計思想は「ai-cli はビジュアル背景層だけ生成し、文字（コピー）は `compose-ad-creative` スキルで HTML/CSS 後乗せ」**（画像モデルは日本語が化けるため）。

## 起動条件 / 前提

- `op`（1Password CLI）がインストール済みでアプリ統合が有効（`/opt/homebrew/bin/op`）
- ai-cli が nodenv の **24.14.1** に global インストール済み（実体: `/Users/tsujidaisuke/.nodenv/shims/ai`）
- Vercel AI Gateway に**有料クレジット**がある（無料枠は画像モデルを弾く。2026-06-09 に $20 投入済み）

## 🔑 秘匿情報の在り処（最重要・毎回ここを忘れる）

- API キーは **1Password に保管**。参照は `op://Private/AI Gateway/credential`
  - vault=`Private` / item=`AI Gateway`（カテゴリ API_CREDENTIAL）/ field=`credential`（CONCEALED, 60文字）
- ai-cli は **環境変数 `AI_GATEWAY_API_KEY` だけ**を読む（ログインコマンド・設定ファイルは無い）
- `op run` が実行時だけキーを注入し、終われば消える。**平文ディスク保存ゼロ・コミット事故ゼロ**
- `op whoami` は "not signed in" を返すが**これは仕様で正常**（アプリ統合認証。vault/item 操作は通る）

## ⚙️ 正しい叩き方（このマシン特有の罠込み）

ユーザーの `~/.zshrc` には `ai()` ラッパー関数（`op run` 包み）があるが、**taberu.pro リポジトリ内では node バージョンで壊れる**（repo は node 22.21.1 固定、ai-cli は 24.14.1 在中 → `nodenv: ai: command not found`）。**必ず `NODENV_VERSION=24.14.1` を明示**してシム経由で叩く：

```bash
AI_GATEWAY_API_KEY="op://Private/AI Gateway/credential" \
NODENV_VERSION=24.14.1 \
op run -- /Users/tsujidaisuke/.nodenv/shims/ai image "プロンプト" \
  -m google/gemini-2.5-flash-image \
  --aspect-ratio 16:9 --no-preview -q -n 2 \
  -o assets/ad-experiments/round1/axis/
```

### Touch ID 連打を避ける（複数生成は1コマンドに包む）

`op run` 1回につき Touch ID プロンプトが1回出る。**複数枚・複数軸は `op run -- bash -c '...'` で1コマンドに束ねる**と認証1回で済む：

```bash
AI_GATEWAY_API_KEY="op://Private/AI Gateway/credential" NODENV_VERSION=24.14.1 op run -- bash -c '
AI=/Users/tsujidaisuke/.nodenv/shims/ai
M=google/gemini-2.5-flash-image
"$AI" image "PROMPT A" -m "$M" --no-preview -q -n 2 -o assets/ad-experiments/round1/1-axis/
"$AI" image "PROMPT B" -m "$M" --no-preview -q -n 2 -o assets/ad-experiments/round1/2-axis/
'
```

- bash -c 内の `ai` は PATH ではなくシム実体を変数で指す。`NODENV_VERSION` は外側 env から子に継承される
- プロンプト文字列にはアポストロフィ（`'`）を入れない（外側が単一引用符のため）。`cwd` は子に継承されるので相対パス（`assets/...`）でOK

## 主要フラグ（`ai image --help` で確認済み）

| フラグ | 意味 |
|---|---|
| `-m, --model` | `creator/model-name`。カンマ区切りでマルチモデル比較 |
| `-o, --output` | ファイルパス or **ディレクトリ**。dir 指定で `output-1.png` / `output-2.png` 自動命名 |
| `-n, --count` | モデルあたり生成枚数 |
| `--aspect-ratio` | 例 `16:9`（**flash は無視する→罠リスト参照**） |
| `--size` | 例 `1792x1024`（ピクセル直指定） |
| `--quality` | `standard` / `hd` |
| `-p, --concurrency` | 並列生成数（default 4） |
| `--no-preview` `-q` | ターミナル出力を抑制（Bash ツール経由では付ける） |
| `--json` | メタデータを JSON 出力 |

- **参照画像フラグ（`-i`）はこのバージョンのヘルプに無い**。過去メモの `-i ref.png` は要再検証。当面はブランド世界観をテキストプロンプトに言語化する
- 生成画像の目視評価は Read ツールで PNG を開いて行う（捏造しない）

## モデル選定とコスト

`ai models` で画像モデル一覧（現在39個）。代表:

- **`google/gemini-2.5-flash-image`** — 安い・速い。**幅出しラウンドはこれ**（10枚で数十円レベル）
- **`google/gemini-3-pro-image`** — 高品質。**勝った方向の決勝生成**に使う
- 他: `google/imagen-4.0-{fast,generate,ultra}-001`, `openai/gpt-image-{1,2,1.5}`, `xai/grok-imagine-image`
- 戦略: **flash で量産→選別→pro で本気生成**

### 課金まわりの未対応TODO（漏洩時の請求爆弾対策）

- AI Gateway ダッシュボードで ①このCLI専用キーを発行して `op` の値を差し替え ②スペンド上限設定。**未確認なら毎回ユーザーに確認**

## taberu.pro 広告クリエイティブ・ワークフロー（主ユースケース）

ゴール例: **サイト流入/お試し**。ブランド詳細・Round1 結果はメモリ `project_x_ad_creative_exploration.md` 参照。

1. **コピーとビジュアルを分離**。ai-cli は文字なし背景だけ生成（テキスト用の余白 or 空の吹き出しを必ず確保）。文字は後で `compose-ad-creative` スキルで乗せる（HTML/CSS のベクター品質、$0・Figma 不要）
2. **量で殴る**: ビジュアル軸 5方向 × 各2案＝10枚を1コマンドで生成（軸例: 写真シズル / ブランドイラスト / 応援団長マスコット / ミニマルグラデ / ポップコミック）
3. 全枚を Read で目視評価 → ユーザーが方向を選別
4. 勝った1〜2軸を `gemini-3-pro-image` で本気生成（Round2）
5. `compose-ad-creative` でコピー乗せ → 既存コピー型をチャンピオンに残しつつビジュアル型を挑戦者として X で A/B
6. 全軸に注入するブランドDNA: クリーム背景・角丸・アンバーオレンジ＋オリーブ・親しみやすい日本語アプリ調・`Absolutely no text, no letters, no words anywhere.`

### 作業ディレクトリ

- `assets/ad-experiments/round{N}/{軸名}/`（taberu.pro リポジトリ内。コミットしたくなければ `.gitignore` に追加）
- ブランド設計図の既存素材: `assets/taberu-pro.png`（og-cover）

## 罠リスト（このセッションで踏んだ実績）

- **nodenv バージョン罠**: repo 内で素の `ai` は node 22 に解決され `command not found`。`NODENV_VERSION=24.14.1` 必須
- **無料枠ブロック**: `Free tier users do not have access to this model` はモデルID誤りではなく**クレジット不足**。top-up が必要
- **Touch ID 連打**: 1 `op run` = 1 Touch ID。複数生成は `op run -- bash -c` で束ねる
- **aspect-ratio が効かない（モデル依存）**: ai-cli の `--aspect-ratio` は gemini で無視される。実測（2026-06-09）: `gemini-2.5-flash-image` は **1:1（1024×1024）固定**、`gemini-3-pro-image` は **≒16:9（1408×768）固定**（指定に関わらず）。比率を厳守したいなら `--size` 直指定を試す or 別モデルで要検証。X 広告は 1:1 も 16:9 もどちらも有効なので致命傷ではない
- **広告は背景だけでは不十分**: 生成した背景をそのまま渡すと「どこに何を配置するか」が空白で手直しが必要になる。コピー配置済みの原型（Figma 等のレイアウトモック）まで作って提示する。詳細は memory `project_x_ad_creative_exploration.md`
- **`op whoami` の "not signed in"** は正常。署名状態を疑わない

## 関連

- メモリ: `project_x_ad_creative_exploration.md`（探索の全文脈・Round1結果）、`project_ui_tone.md`（トーン方針）
- 後工程スキル: `compose-ad-creative`（背景＋コピー → カンプ PNG。文字乗せはこちら）
- 既存スキル: `create-ad-shelf`（honn.me Twitter 広告 Shelf 作成。広告運用フローの姉妹）
