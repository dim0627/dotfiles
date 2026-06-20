---
name: ai-image-gen
description: vercel-labs/ai-cli（Vercel AI Gateway 経由）でローカルから画像を生成する汎用ツール。Claude 本体が持たない「画像生成」機能を補う。API キーはカレントプロジェクトの `.env`（`AI_GATEWAY_API_KEY`）から読む。未導入時のインストール案内・モデル選定・コスト管理の手順込み。用途は問わない（広告ビジュアル・素材・モック等）。「画像生成して」「画像作って」「ai image」で起動。
user-invocable: true
---

# ai-cli 画像生成（Vercel AI Gateway）

vercel-labs/ai-cli を使ってローカルから画像を生成する。`AI Gateway` 経由で gemini / imagen / gpt-image 等にアクセスする。**Claude 本体が持たない「画像生成」機能を補う汎用ツール**で、用途は問わない。

> 画像モデルは**日本語テキストが化ける**ため、画像内に文字を焼きたいときは「背景だけ生成して文字は別途ベクターで後乗せ」する分業が無難（汎用 Tips）。

## 起動条件 / 前提

すべて満たしてから本処理に進む。

- **`AI_GATEWAY_API_KEY` が解決できること**（環境変数を優先、無ければカレントプロジェクトの `.env` から読む）。どちらにも無ければ後述の「🔑 秘匿情報の在り処」を参照してユーザーに置き場所を伝え、停止する（勝手に探さない）。
- **ai-cli が最新で導入済みであること**（公式手順 `npm i -g ai-cli@latest`、node >=20）。**フラグや挙動はバージョンで変わる**ので最新に保つ（例: 参照画像フラグ `-i` は 0.2.x には無く 0.3.x で利用可）。ai-cli は **node のバージョンごとの global** に入るため、別バージョンの node に切り替わるディレクトリでは `command not found` になる。その場合は**バージョン番号を固定して回避せず、その node 文脈で素直に入れて**再実行する:

  ```bash
  # 確認 → 無ければ／古ければ最新を導入
  command -v ai >/dev/null 2>&1 || npm i -g ai-cli@latest
  ```

- **Vercel AI Gateway に有料クレジットがあること**。無料枠は画像モデルを弾く。`Free tier users do not have access to this model` はモデルID誤りではなく**クレジット不足**のサインで、top-up が必要。漏洩時の請求対策として AI Gateway 側でスペンド上限を設定しておくと安全。

## 🔑 秘匿情報の在り処（API キー）

- ai-cli は **環境変数 `AI_GATEWAY_API_KEY` だけ**を読む（ログインコマンド・設定ファイルは無い）。
- キーの解決は **環境変数を優先し、無ければカレントプロジェクトの `.env` から読む**。`.env` には `AI_GATEWAY_API_KEY=<キー>` で置く。
  - この順序により、CI（GitHub Actions 等）で env に直接渡る無人環境でも `.env` 無しで動く。
- **`.env` は必ず `.gitignore` に入れる**（平文の鍵がコミットされる事故を防ぐ）。未登録なら追加を提案する。
- 環境変数にも `.env` にも `AI_GATEWAY_API_KEY` が無い場合は、置き場所（`<プロジェクトルート>/.env`）をユーザーに伝えて**停止する**。他の場所から鍵を勝手に探さない。

> 旧版は 1Password（`op run` で `op://Private/AI Gateway/credential` を実行時注入）に依存していた。Touch ID ゲートと引き換えに無人実行ができず、依存も重かったため `.env` 集約へ移行した。

## ⚙️ 正しい叩き方

キーを解決して `export` してから `ai` を叩く。**Bash ツールはシェルの環境変数を呼び出し間で引き継がない**ため、解決と `ai` は必ず**同じコマンド内**にまとめる。`source .env` ではなく **`grep` で対象キー1行だけ抜く**（`.env` 内の他変数を巻き込む副作用・構文エラーを避ける）:

```bash
export AI_GATEWAY_API_KEY="${AI_GATEWAY_API_KEY:-$(grep -E '^AI_GATEWAY_API_KEY=' .env | head -1 | cut -d= -f2-)}"
ai image "プロンプト" \
  -m google/gemini-2.5-flash-image \
  --no-preview -q -n 2 \
  -o out/
```

- `-o` にディレクトリを渡すと **`<生成ID>[-<連番>].png`** で自動命名される（`output-N.png` ではない。0.3.1 のソースで確認済み）。`<生成ID>` は生成結果の id（`aitxt-<hex>` 形式）。
  - `-n 1`（単数・単一モデル）: 連番なしで `aitxt-<hash>.png`
  - `-n 2` 以上 / マルチモデル: ジョブごとに別 id ＋連番が付き `aitxt-<hashA>-1.png` / `aitxt-<hashB>-2.png`（hash はジョブごとに異なる）
  - **ファイル名を固定したいときは `-o` にファイルパスを直接渡す**（その場合は `-n 1` 前提）。複数枚を決め打ち名にしたいなら生成後に `mv` でリネームする。
  - 出力先は任意（コミットしたくない実験用なら `.gitignore` に逃がす）。
- 生成画像の目視評価は Read ツールで PNG を開いて行う（捏造しない）。

### 生成後は出力フォルダを開く（必須）

生成が完了したら、ユーザーがすぐ目視確認できるよう **`open` で出力ディレクトリを Finder で開く**:

```bash
open out/
```

- `-o` にファイルパスを直接渡した場合も、開くのは**そのファイルの親ディレクトリ**（`open "$(dirname <path>)"`）。画像単体を `open` するとビューアが枚数分立ち上がるため、フォルダで開く。
- 複数ディレクトリに出力した場合は、それらの**共通の親ディレクトリ**を1回だけ開く（`open` 連打でウィンドウを散らかさない）。

### 複数生成は1コマンドにまとめる

キー解決は1回で済むので、複数枚・複数プロンプトは**解決後に `ai` を続けて並べる**（毎回解決し直さない）:

```bash
export AI_GATEWAY_API_KEY="${AI_GATEWAY_API_KEY:-$(grep -E '^AI_GATEWAY_API_KEY=' .env | head -1 | cut -d= -f2-)}"
M=google/gemini-2.5-flash-image
ai image "PROMPT A" -m "$M" --no-preview -q -n 2 -o out/a/
ai image "PROMPT B" -m "$M" --no-preview -q -n 2 -o out/b/
```

- 別々の Bash 呼び出しに分けると環境変数が引き継がれないため、その都度先頭でキー解決し直す必要がある。1コマンドにまとめるのが楽。

## 主要フラグ（`ai image --help` / ai-cli 0.3.1 で確認）

フラグはバージョンで増減する。**実行前に `ai image --help` で都度確認する**のが確実（下表は 0.3.1 時点）。

| フラグ | 意味 |
|---|---|
| `-m, --model` | `creator/model-name`。カンマ区切りでマルチモデル比較 |
| `-o, --output` | ファイルパス or **ディレクトリ**。dir 指定で `<生成ID>[-<連番>].png`（`aitxt-<hash>.png` 等）に自動命名。固定名はファイルパス直指定 |
| `-i, --image` | 参照画像（パス or URL）。繰り返し指定可（0.3.x で利用可） |
| `-n, --count` | モデルあたり生成枚数（default 1） |
| `--size` | 例 `1024x1024`（ピクセル直指定） |
| `--aspect-ratio` | 例 `16:9`（**モデルが無視することがある→罠リスト参照**） |
| `--quality` | `standard` / `hd` |
| `--style` | 例 `vivid` / `natural` |
| `-q, --quiet` | 進捗出力を抑制（Bash ツール経由では付ける） |
| `--no-preview` | インラインプレビューを無効化（Bash ツール経由では付ける） |
| `-p, --concurrency` | 並列生成数（default 4） |
| `--json` | メタデータを JSON 出力 |

## モデル選定とコスト

**`google/gemini-2.5-flash-image` をデフォルトにする。基本これで進める**（安い・速い。10枚で数十円レベル）。先回りで高いモデルを使わない。

- **デフォルトからモデルを変える前は、必ずユーザーに確認する**（コストと挙動が変わるため）。
- 議論・目視評価の中で「これはモデル起因の品質問題だ」と判断したときに、上位モデルへ上げる/変える候補: `google/gemini-3-pro-image`（高品質）/ `google/imagen-4.0-{fast,generate,ultra}-001` / `openai/gpt-image-{1,2,1.5}` / `xai/grok-imagine-image`。
- 全モデル一覧は `ai models` で確認（現在39個）。

## 罠リスト（実証済み）

- **aspect-ratio が効かないことがある（モデル依存）**: `--aspect-ratio` フラグ自体は存在する（v0.2.1）が、実測（2026-06-09）では gemini 側が無視して固定サイズを返した（`gemini-2.5-flash-image`=1:1 1024×1024 / `gemini-3-pro-image`≒16:9 1408×768）。モデル・CLI バージョンで変わりうるので、**比率が重要なら使用時に `--size` 直指定で都度検証する**。
