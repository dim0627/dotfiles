---
name: video-understand
description: 動画（mp4 等）をローカルで「理解」する汎用ツール。Claude 本体が直接読めない動画を、ffmpeg＋whisper.cpp で「音声→文字起こし」と「映像→静止画フレーム」の2チャンネルに分解し、タイムライン形式で統合理解する。文字起こしは whisper.cpp（ローカル・無料・Metal高速）。未導入時のインストール案内・モデル選定・トークンコスト管理込み。「動画読んで」「動画理解して」「mp4見て」「文字起こしして」「この動画なに」で起動。
user-invocable: true
---

# 動画理解（ffmpeg + whisper.cpp）

Claude Code の Read ツールは画像（PNG/JPG）・PDF・テキストは読めるが、**動画（mp4/mov 等）も音声も直接は読めない**。このスキルは動画を Claude が読める形に前処理して「理解」を成立させる。

動画の情報は2チャンネルに分かれており、**両方拾うと理解の解像度が上がる**：

1. **音声 → テキスト**: `ffmpeg` で音声を抜き、`whisper.cpp` でタイムスタンプ付き文字起こし。喋っている内容（ナレーション・会議・解説）を捕捉。**情報密度が最も高いのは多くの場合ここ**。
2. **映像 → 静止画フレーム**: `ffmpeg` でフレームを抽出し、Read ツールで PNG として読解。画面・スライド・UI・人物・シーンなど「映っているもの」を捕捉。

最後に文字起こし（時刻付き）とフレーム（時刻付き）を**タイムラインで突き合わせて統合理解**する。

## 起動条件 / 前提

すべて満たしてから本処理に進む。足りないものは下記手順で導入する。

- **`ffmpeg` / `ffprobe` が導入済み**（`command -v ffmpeg ffprobe`）。無ければ `brew install ffmpeg`。
- **`whisper-cli` が導入済み**（`command -v whisper-cli`）。無ければ `brew install whisper-cpp`。
  - Python の whisper（pip 版 `openai-whisper`）は使わない。torch 依存＋Python 3.8+ 要件で環境を汚すうえ、この環境の system python は 3.7.9 で要件を満たさない。**whisper.cpp は Python 非依存・Metal 高速・無料・ローカル完結**で本命。
- **GGML モデルファイルが存在する**（後述）。whisper.cpp はモデルを同梱しないため初回のみダウンロードが要る。

### whisper.cpp モデルの導入

モデルは `~/.local/share/whisper-models/` に置く規約とする。**多言語版（`.en` でない方）を使う**——`ggml-base.en.bin` 等の `.en` 付きは英語専用で日本語が出ない。

```bash
mkdir -p ~/.local/share/whisper-models
# デフォルト: base 多言語（約148MB・速い・そこそこ精度）
curl -L -o ~/.local/share/whisper-models/ggml-base.bin \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
```

モデル選定（精度⇄サイズ/速度のトレード。**日本語の精度が要るなら large-v3-turbo を推奨**）:

| モデルファイル | サイズ | 用途 |
|---|---|---|
| `ggml-base.bin` | 約148MB | デフォルト。速い。英語や聞き取りやすい音声なら十分 |
| `ggml-small.bin` | 約488MB | base で精度不足のとき。日本語のバランス型 |
| `ggml-large-v3-turbo.bin` | 約1.6GB | **日本語の精度重視ならこれ**。turbo なので large 系でも実用速度 |

ダウンロード URL は `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/<ファイル名>`。デフォルトからモデルを上げる前は、サイズと時間が変わるためユーザーに一言確認する。

## 正しい叩き方

作業ディレクトリ（例 `/tmp/video-understand/<名前>/`）を切り、そこに中間ファイルを吐く。コミット対象でない中間生成物はリポジトリ内に置かない。

### 1. メタデータを取得してサンプリング方針を決める

まず尺・解像度・fps・音声トラックの有無を見る。これでフレーム枚数と処理方針が決まる。

```bash
ffprobe -v error -show_entries format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 input.mp4
```

- `duration` でフレーム枚数の上限を決める（後述のコスト管理）。
- 音声ストリーム（`codec_type=audio`）が無ければ文字起こしは飛ばし、映像チャンネルだけで進める。

### 2. 音声を抽出して文字起こし

whisper.cpp は **16kHz mono の wav** を前提にするのが定石。`ffmpeg` で変換してから渡す。

```bash
MODEL=~/.local/share/whisper-models/ggml-base.bin
# 16kHz mono wav に変換
ffmpeg -y -i input.mp4 -vn -ar 16000 -ac 1 -c:a pcm_s16le audio.wav
# 文字起こし（SRT = 時刻付きで Claude が読みやすい）。-l auto で言語自動判定
whisper-cli -m "$MODEL" -f audio.wav -l auto -osrt -of transcript
# → transcript.srt が生成される。これを Read する
```

- `-l auto` で言語自動判定。日本語だと分かっているなら `-l ja`、英語なら `-l en` を明示すると安定する。
- 出力形式は `-osrt`(SRT) のほか `-oj`(JSON・構造化) `-otxt`(プレーン) `-ovtt` も可。**時刻とフレームを突き合わせたいので時刻付きの SRT/JSON を使う**。
- whisper-cli は進捗やバックエンド情報を大量に標準出力/エラーに吐くが、**結果は `-of` で指定したファイルに入る**。標準出力をパースせず、生成された `transcript.srt` を Read すればよい。

### 3. 映像フレームを抽出

**まずシーン変化検出を試し、足りなければ一定間隔にフォールバック**する。

```bash
mkdir -p frames
# 方式A: シーン変化検出（スライド切替・カット割りのある動画に強い。冗長フレームを激減できる）
ffmpeg -y -i input.mp4 -vf "select='gt(scene,0.3)',scale=768:-1" -vsync vfr frames/scene_%04d.png

# 方式B: 一定間隔（シーン検出が0枚 or 連続的な映像のとき）。例: 1枚/5秒
ffmpeg -y -i input.mp4 -vf "fps=1/5,scale=768:-1" frames/frame_%04d.png
```

- `scale=768:-1` で**横768pxに縮小**して抽出する。Claude の画像読解トークンは解像度に比例するため、文字が読める範囲で縮小してコストを抑える（スライドの細かい文字を読む必要があるときだけ大きめにする）。
- 抽出後は枚数を数え、多すぎ／少なすぎなら閾値（`scene,0.3`）や間隔（`fps=1/N`）を調整して撮り直す。
- 各 PNG を Read で開き、見えるものを記述する（捏造しない）。**ファイル名の連番＝抽出順＝おおよその時刻順**なので、SRT の時刻と対応づけられる。

### 4. 統合して理解を返す

文字起こし（SRT の時刻）とフレーム（時刻順）を1本のタイムラインに統合し、「いつ・何が映って・何が語られたか」をまとめる。ユーザーの問い（要約・特定箇所の抽出・UIの説明 等）に合わせて出力する。

## トークンコスト管理（最重要）

フレームを Read する＝画像読解＝トークンを食う。10分動画を1秒1枚で抜けば600枚で即破産する。**サンプリングは必ず尺に応じて間引く**。

目安（横768px・内容により増減。**多い側に振れそうなら必ずユーザーに枚数とコストを断ってから抽出する**）:

| 動画の尺 | フレーム枚数の目安 | 方針 |
|---|---|---|
| 〜1分 | 5〜12枚 | シーン検出 or 5〜10秒間隔 |
| 1〜10分 | 12〜30枚 | シーン検出優先。間隔なら20〜30秒/枚 |
| 10分〜 | 30枚を上限の目安に | 間隔を広げる。全網羅が要るなら**区間を区切って分割提案** |

- 既定の上限はおよそ **24〜30枚**。超えそうなら黙って大量抽出せず、枚数・狙い・コストを提示して相談する。
- 文字起こしは尺に比例してトークンを食うが画像より遥かに軽い。**長尺はまず文字起こしで全体像を掴み、映像は要点の時刻だけ狙い撃ちで抽出**すると効率がよい。

## 罠リスト（実証済み: 2026-06-21 / whisper-cpp 1.9.1・ffmpeg 8.1.2 で検証）

- **シーン変化検出が0枚になることがある**: グラデーションや連続的に動くだけでハードカットが無い映像（合成映像・一枚絵のズーム等）では `select='gt(scene,...)'` が1枚も拾わない。検出結果が0/極小なら**方式B（一定間隔）にフォールバック**する。スライドやカット割りのある実映像では有効。
- **`.en` モデルは英語専用**: 日本語動画に `ggml-base.en.bin` を使うと日本語が出ない。多言語モデル（`ggml-base.bin` 等、`.en` なし）を使う。
- **whisper は無音・BGM区間で幻聴（hallucination）する**: 喋っていない箇所で同じ字幕を繰り返したり、それっぽい文を捏造することがある。無音が多い動画では文字起こしを鵜呑みにせず、不自然な繰り返しは疑う。
- **whisper-cli の標準出力はノイズが多い**: `load_backend:` `read_audio_data:` 等が大量に出るが結果ではない。`-of` で出したファイル（`transcript.srt` 等）を正とする。
- **音声トラックの無い動画**: `ffprobe` に audio ストリームが出なければ文字起こしは飛ばす（`ffmpeg -vn` がエラーになる）。映像チャンネルだけで進める。
- **モデル未ダウンロードだと即エラー**: whisper.cpp はモデルを同梱しない。`whisper-cli` 導入直後は必ずモデル DL が要る。
- **大画像はトークンを浪費**: フレームは原寸で抜かず `scale=768:-1` で縮小する。スライドの細字を読む必要があるときだけ解像度を上げる。
