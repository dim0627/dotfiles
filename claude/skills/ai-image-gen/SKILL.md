---
name: ai-image-gen
description: vercel-labs/ai-cli（Vercel AI Gateway 経由）でローカルから画像を生成する汎用ツール。Claude 本体が持たない「画像生成」機能を補う。秘匿キーは 1Password（op run でランタイム注入）、未導入時のインストール案内・Touch ID 連打回避・モデル選定・コスト管理の手順込み。用途は問わない（広告ビジュアル・素材・モック等）。「画像生成して」「画像作って」「ai image」で起動。
user-invocable: true
---

# ai-cli 画像生成（Vercel AI Gateway）

vercel-labs/ai-cli を使ってローカルから画像を生成する。`AI Gateway` 経由で gemini / imagen / gpt-image 等にアクセスする。**Claude 本体が持たない「画像生成」機能を補う汎用ツール**で、用途は問わない。

> 画像モデルは**日本語テキストが化ける**ため、画像内に文字を焼きたいときは「背景だけ生成して文字は別途ベクターで後乗せ」する分業が無難（汎用 Tips）。

## 起動条件 / 前提

- `op`（1Password CLI）がインストール済みでアプリ統合が有効（`/opt/homebrew/bin/op`）
- ai-cli が公式手順（`npm i -g ai-cli`）で導入済み。**未導入なら下記「未導入時のインストール」に従って入れてからリトライ**
- Vercel AI Gateway に**有料クレジット**がある（無料枠は画像モデルを弾く。2026-06-09 に $20 投入済み）

### 未導入時のインストール（node バージョン文脈ごとに必要）

ai-cli は **node のバージョンごとの global** に入る（npm/nodenv の仕様）。そのため、別バージョンの node に切り替わるディレクトリで叩くと `command not found` になることがある。**事前に `ai` の有無を確認し、無ければ公式手順で今の文脈にインストールしてから本処理に進む**：

```bash
# 確認 → 無ければ公式手順で導入（ai-cli は node >=20 で動作）
command -v ai >/dev/null 2>&1 || npm i -g ai-cli
```

`nodenv: ai: command not found` が出ても**バージョン番号を固定して回避しようとしない**。それは「今の node 文脈に未導入」のサインなので、上記コマンドで素直に入れる。

## 🔑 秘匿情報の在り処（最重要・毎回ここを忘れる）

- API キーは **1Password に保管**。参照は `op://Private/AI Gateway/credential`
  - vault=`Private` / item=`AI Gateway`（カテゴリ API_CREDENTIAL）/ field=`credential`（CONCEALED, 60文字）
- ai-cli は **環境変数 `AI_GATEWAY_API_KEY` だけ**を読む（ログインコマンド・設定ファイルは無い）
- `op run` が実行時だけキーを注入し、終われば消える。**平文ディスク保存ゼロ・コミット事故ゼロ**
- `op whoami` は "not signed in" を返すが**これは仕様で正常**（アプリ統合認証。vault/item 操作は通る）

## ⚙️ 正しい叩き方

`AI_GATEWAY_API_KEY` に 1Password 参照を渡し、`op run` でラップして `ai` を叩く（キーは実行時だけ注入される）。`ai` が見つからない場合は前述「未導入時のインストール」で導入してから再実行する：

```bash
AI_GATEWAY_API_KEY="op://Private/AI Gateway/credential" \
op run -- ai image "プロンプト" \
  -m google/gemini-2.5-flash-image \
  --no-preview -q -n 2 \
  -o out/
```

- `-o` はディレクトリ指定で `output-1.png` / `output-2.png` と自動命名される。出力先は任意（コミットしたくない実験用なら `.gitignore` に逃がす）。
- 生成画像の目視評価は Read ツールで PNG を開いて行う（捏造しない）。

### Touch ID 連打を避ける（複数生成は1コマンドに包む）

`op run` 1回につき Touch ID プロンプトが1回出る。**複数枚・複数プロンプトは `op run -- bash -c '...'` で1コマンドに束ねる**と認証1回で済む：

```bash
AI_GATEWAY_API_KEY="op://Private/AI Gateway/credential" op run -- bash -c '
M=google/gemini-2.5-flash-image
ai image "PROMPT A" -m "$M" --no-preview -q -n 2 -o out/a/
ai image "PROMPT B" -m "$M" --no-preview -q -n 2 -o out/b/
'
```

- プロンプト文字列にはアポストロフィ（`'`）を入れない（外側が単一引用符のため）。`cwd` は子に継承されるので相対パス（`out/...`）でOK。

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

- **参照画像フラグ（`-i`）はこのバージョンのヘルプに無い**。過去メモの `-i ref.png` は要再検証。当面は望む世界観をテキストプロンプトに言語化する。

## モデル選定とコスト

**`google/gemini-2.5-flash-image` をデフォルトにする。基本これで進める**（安い・速い。10枚で数十円レベル）。先回りで高いモデルを使わない。

議論・目視評価の中で**「これはモデル起因の品質問題だ」と判断したときに初めて**、上位モデルへ上げる/変える:

- `google/gemini-3-pro-image` — 高品質。
- 他の候補: `google/imagen-4.0-{fast,generate,ultra}-001`, `openai/gpt-image-{1,2,1.5}`, `xai/grok-imagine-image`。
- 全モデル一覧は `ai models` で確認（現在39個）。

### 課金まわりの未対応TODO（漏洩時の請求爆弾対策）

- AI Gateway ダッシュボードで ①このCLI専用キーを発行して `op` の値を差し替え ②スペンド上限設定。**未確認なら毎回ユーザーに確認**。

## 罠リスト（実証済み）

- **node 文脈ごとに未導入**: ai-cli は node のバージョンごとの global に入る。別バージョンに切り替わる repo 内で `ai` が `command not found` になったら、バージョンを固定して回避するのではなく `npm i -g ai-cli`（公式手順）で今の文脈に入れて再実行する。
- **無料枠ブロック**: `Free tier users do not have access to this model` はモデルID誤りではなく**クレジット不足**。top-up が必要。
- **Touch ID 連打**: 1 `op run` = 1 Touch ID。複数生成は `op run -- bash -c` で束ねる。
- **aspect-ratio が効かない（モデル依存）**: ai-cli の `--aspect-ratio` は gemini で無視される。実測（2026-06-09）: `gemini-2.5-flash-image` は **1:1（1024×1024）固定**、`gemini-3-pro-image` は **≒16:9（1408×768）固定**（指定に関わらず）。比率を厳守したいなら `--size` 直指定を試す or 別モデルで要検証。
- **`op whoami` の "not signed in"** は正常。署名状態を疑わない。
