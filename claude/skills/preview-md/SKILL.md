---
name: preview-md
description: ユーザーが読むためのMarkdownファイルを新規作成した直後に、glowでプレビューするか確認して別ペインに開く。「glowで見せて」「MDプレビューして」でも起動。
user-invocable: true
allowed-tools: Bash(herdr pane split*), Bash(herdr pane run*), Bash(tmux split-window*)
---

ユーザーが読むために作ったMarkdown（ドキュメント・調査メモ・レポート等）を、glow で別ペインに開く。Bash ツールの出力はユーザーの画面に出ないので、glow は必ずユーザーの見えるペインで走らせる。

## 手順

### 1. 確認

応答の最後に一行で「glow で開く？」と聞く。同じターンで複数作ったならまとめて1回。ユーザーから直接プレビューを頼まれた場合は聞かずに 2 へ進む。

### 2. 開く

環境変数で分岐する。パスは絶対パスで渡す。

- **`HERDR_ENV=1`**: ペインを右に割り、返ってきた JSON の `.result.pane.pane_id` を次のコマンドに渡す。

  ```bash
  herdr pane split --current --direction right --focus
  herdr pane run <pane_id> "glow -p '<絶対パス>'; exit"
  ```

- **`TMUX` が空でない**:

  ```bash
  tmux split-window -h "glow -p '<絶対パス>'"
  ```

- **どちらでもない**: `glow -p <絶対パス>` を提示し、ユーザーに別ターミナルで打ってもらう。

`-p` はページャ表示で、`q` を押すと glow が終わりペインごと閉じる。開いたらそのことを一言添える。
