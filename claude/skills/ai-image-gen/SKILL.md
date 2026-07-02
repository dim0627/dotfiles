---
name: ai-image-gen
description: Vercel AI Gateway を AI SDK で直叩きしてローカルから画像を生成する汎用ツール（スキル同梱の gen-image.mjs を実行）。Claude 本体が持たない「画像生成」機能を補う。API キーはカレントプロジェクトの `.env`（`AI_GATEWAY_API_KEY`）から読む。未導入時のセットアップ案内・モデル選定・コスト管理の手順込み。用途は問わない（広告ビジュアル・素材・モック等）。「画像生成して」「画像作って」「ai image」で起動。
user-invocable: true
---

# AI Gateway 直叩き画像生成（gen-image.mjs）

スキル同梱の `scripts/gen-image.mjs` で、AI SDK から Vercel AI Gateway を直接叩いて画像を生成する。gemini / imagen / gpt-image / flux 等にアクセスできる。**Claude 本体が持たない「画像生成」機能を補う汎用ツール**で、用途は問わない。

> 旧版は vercel-labs/ai-cli の wrapper だったが卒業した（オーナーの PR #62 がメンテナの同内容 PR #72 で上書きされた経緯＋aspect ratio 等を自分の手で制御するため）。品質・コストは同一（同じ Gateway）。

> 画像モデルは**日本語テキストが化ける**ため、画像内に文字を焼きたいときは「背景だけ生成して文字は別途ベクターで後乗せ」する分業が無難（汎用 Tips）。

## 起動条件 / 前提

すべて満たしてから本処理に進む。

- **`AI_GATEWAY_API_KEY` が解決できること**（スクリプトが環境変数を優先し、無ければ**カレントディレクトリの `.env`** から読む）。どちらにも無ければスクリプトがエラーで止まる。その場合は後述の「🔑 秘匿情報の在り処」を参照してユーザーに置き場所を伝え、停止する（勝手に探さない）。
- **スクリプトの依存が入っていること**（node >=20）。無ければ入れる:

  ```bash
  SKILL_SCRIPTS="$HOME/.claude/skills/ai-image-gen/scripts"
  [ -d "$SKILL_SCRIPTS/node_modules" ] || npm i --prefix "$SKILL_SCRIPTS"
  ```

- **Vercel AI Gateway に有料クレジットがあること**。無料枠は画像モデルを弾く。`Free tier users do not have access to this model` はモデルID誤りではなく**クレジット不足**のサインで、top-up が必要。漏洩時の請求対策として AI Gateway 側でスペンド上限を設定しておくと安全。
- Bash ツール経由で実行する場合、ネットワークアクセスのため **`dangerouslyDisableSandbox` が必要**。

## 🔑 秘匿情報の在り処（API キー）

- キーの解決は**スクリプト内蔵**: 環境変数 `AI_GATEWAY_API_KEY` を優先し、無ければ**カレントディレクトリの `.env`** から `AI_GATEWAY_API_KEY=` の行だけを読む（他の変数は巻き込まない）。旧 CLI 時代の「grep で抜いて export」の儀式は不要。
  - この順序により、CI（GitHub Actions 等）で env に直接渡る無人環境でも `.env` 無しで動く。
- **`.env` は必ず `.gitignore` に入れる**（平文の鍵がコミットされる事故を防ぐ）。未登録なら追加を提案する。
- どちらにも無い場合は、置き場所（`<プロジェクトルート>/.env`）をユーザーに伝えて**停止する**。他の場所から鍵を勝手に探さない。

## ⚙️ 正しい叩き方

**プロジェクトルート（`.env` のある場所）をカレントにして**実行する:

```bash
node ~/.claude/skills/ai-image-gen/scripts/gen-image.mjs \
  "プロンプト" \
  -m google/gemini-2.5-flash-image \
  -n 2 --aspect-ratio 16:9 \
  -o out/
```

- **出力は `<モデル名スラッグ>-<runId>-<連番>.<ext>` で自動命名**される（例: `gemini-2.5-flash-image-mr3cwst4-1.png`）。モデル名がファイル名に最初から入るので、撃ち比べても素性がロストしない（旧 CLI 時代の手動 `mv` プレフィックス付けは不要になった）。
- 同時に **`meta-<runId>.json`** が出力フォルダに書かれる（プロンプト・パラメータ・モデルごとの生成ファイル一覧・usage）。後から「どのプロンプトで出した画像か」を追える。
- 出力先は任意（コミットしたくない実験用なら `.gitignore` に逃がす）。
- 複数枚は `-n`、複数モデル比較は `-m a,b` で1コマンドに収まる（モデル間は並列実行、片方が失敗しても他は続行してエラーは個別報告）。
- 生成画像の目視評価は Read ツールで開いて行う（捏造しない）。ただし重い生成ループはサブエージェントに逃がし、本体 context に画像 Read を溜めない運用のプロジェクトではそれに従う。

### 生成後は出力フォルダを開く（必須）

生成が完了したら、ユーザーがすぐ目視確認できるよう **`open` で出力ディレクトリを Finder で開く**:

```bash
open out/
```

- 画像単体を `open` するとビューアが枚数分立ち上がるため、フォルダで開く。複数ディレクトリに出力した場合は、それらの**共通の親ディレクトリ**を1回だけ開く（`open` 連打でウィンドウを散らかさない）。
- Claude が先に評価コメントを書くとユーザーの印象を誘導するため、**`open` が先、目利きが後**。

## フラグ一覧（gen-image.mjs）

| フラグ | 意味 |
|---|---|
| `-m, --model` | `creator/model-name`。カンマ区切りでマルチモデル比較（default: `google/gemini-2.5-flash-image`） |
| `-n, --count` | モデルあたり生成枚数（default 1）。gemini 系は1枚ずつ直列で n 回呼ぶ |
| `--aspect-ratio` | 例 `16:9`。**gemini 系にも効く**（providerOptions の `imageConfig` で転送。実測 2026-07-02: gemini=1344×768 / imagen=1408×768） |
| `--size` | 例 `1024x1024`。**画像専用モデルのみ**（gemini 系は非対応 → aspect-ratio を使う） |
| `--seed` | 画像専用モデルのみ（モデル対応時） |
| `-o, --output` | 出力ディレクトリ（default: `out`） |
| `-i, --image` | 参照画像パス。繰り返し指定可（**gemini 系のみ**。画像専用モデルは非対応） |
| `--mode` | `llm` / `image`。モデル種別の自動判定（gemini 系→llm、他→image）を上書き |

## モデル選定とコスト

**`google/gemini-2.5-flash-image` をデフォルトにする。基本これで進める**（安い・速い。10枚で数十円レベル）。先回りで高いモデルを使わない。

- **デフォルトからモデルを変える前は、必ずユーザーに確認する**（コストと挙動が変わるため）。
- 議論・目視評価の中で「これはモデル起因の品質問題だ」と判断したときに、上位モデルへ上げる/変える候補: `google/gemini-3-pro-image`（高品質）/ `google/imagen-4.0-{fast,generate,ultra}-001` / `openai/gpt-image-{1,2,1.5}` / `xai/grok-imagine-image`。
- 対応モデル一覧は https://vercel.com/ai-gateway/models?type=image （Image Gen フィルタ）で確認。

## 実装メモ（スクリプトの中身を触るとき）

- 2経路: gemini 系（`google/gemini-*`）は `generateText` ＋ `providerOptions: { google: { responseModalities: ["IMAGE","TEXT"], imageConfig: { aspectRatio } } }` で `result.files` から回収。画像専用モデル（imagen / bfl / gpt-image / grok 等）は `generateImage`（AI SDK v6 で正式エクスポート）で `result.images` から回収。
- 判定は `google/gemini-` プレフィックスのヒューリスティック。新種のマルチモーダル LLM が来たら `--mode llm` で逃がすか判定を足す。

## 罠リスト（実証済み）

- **旧 CLI の「gemini が aspect-ratio を無視して 1:1 1024×1024 固定」問題は直叩きで解消済み**（2026-07-02 実測）。ただし比率がクリティカルな用途では、生成後に `sips -g pixelWidth -g pixelHeight` で都度確認するのが確実（モデル側の対応比率は世代で変わる）。
- gemini 系に `--size` は効かない（aspect-ratio を使う）。
- gemini 系が画像を返さずテキストだけ返すことが稀にある（プロンプトが安全フィルタ等に触れた場合など）。スクリプトは `warn: <model> は画像を返さなかった` を出すので、プロンプトを変えて再試行する。
