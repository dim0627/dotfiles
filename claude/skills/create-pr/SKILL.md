---
name: create-pr
description: 現在のブランチからプルリクエストを作成する。ユーザーが/create-prと打ったときだけでなく、PRを作成する場面では常にこのスキルを使うこと（gh pr create の直接実行は禁止 — --body 指定はリポジトリのPRテンプレートを黙って上書きするため。テンプレート踏襲・ブランチ確認等の手順を内包）
user-invocable: true
allowed-tools: Bash(git status*), Bash(git push*), Bash(git checkout -b *), Bash(gh pr create*), Bash(git log *), Bash(git diff *), Bash(git add *), Bash(git commit *), Bash(git merge-base *), Bash(gh pr edit *), Bash(gh label list*), Bash(gh label create *), Bash(gh repo view*), Bash(gh api user*)
---

現在のブランチの変更内容を分析し、PRを作成する。

## 現在の状態

- **未コミットの変更**:
!`git status`

- **現在のブランチ**:
!`git rev-parse --abbrev-ref HEAD`

- **デフォルトブランチ参照**:
!`git symbolic-ref refs/remotes/origin/HEAD`

## 手順

### 1. デフォルトブランチから分岐しているか確認

上記「デフォルトブランチ参照」からデフォルトブランチ名を特定する（例: `refs/remotes/origin/main` → `main`）。

現在のブランチがデフォルトブランチから直接分岐しているか確認する:
- `git merge-base --is-ancestor <デフォルトブランチ> HEAD` が成功すればOK
- ユーザーから明示的に別ブランチからの分岐を指示されている場合はスキップ
- デフォルトブランチ起点でない場合は警告し、続行するか確認して終了

### 2. デフォルトブランチ上にいる場合

デフォルトブランチ上にいる場合は、適切なブランチ名を提案して `git checkout -b <ブランチ名>` で新しいブランチを作成する。

### 3. 未コミットの変更がある場合

未コミットの変更がある場合は、差分を確認して適切なメッセージでコミットを作成する。コミットメッセージはリポジトリの既存スタイルに合わせ、HEREDOC 形式で `Co-Authored-By` を付与する。

### 4. 変更内容の分析

以下のコマンドでコミット一覧と差分を取得して変更の目的と影響範囲を把握する:
- `git log <デフォルトブランチ>..HEAD --oneline`
- `git diff <デフォルトブランチ>...HEAD`

### 5. リモートにプッシュ

1. `git push -u origin <ブランチ名>` でリモートにプッシュ

### 6. PR作成

まずリポジトリのPRテンプレートを確認する:

```bash
ls .github/PULL_REQUEST_TEMPLATE.md .github/pull_request_template.md docs/pull_request_template.md 2>/dev/null | head -1
```

テンプレートがあれば、その構造・見出し・チェックリストを完全踏襲してPR本文を作成する。本文の型を定める他のどの指示よりも、リポジトリのテンプレートが優先する。

タイトルは70文字以内で簡潔に。本文は HEREDOC 形式で渡す:

```bash
gh pr create --title "タイトル" --body "$(cat <<'EOF'
<本文>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 7. 動作確認が残る場合の目印

作業中に自分で実行・観測して確かめられなかったことがあれば、PR に目印を付けてユーザーに渡す。例: 画面の見た目や操作、本番・ステージングでしか起きない挙動、手元で流せず CI にも無いテスト、外部サービスとの実際の疎通。テストが通っただけで挙動を見ていないものも含める。全部確かめられたなら何もしない。

1. 本文に、確かめる手順を1項目1行のチェックリスト（`- [ ]`）で書く。テンプレートに動作確認の節があればそこへ、無ければ「手動での動作確認」の節を足す。各項目は、何をして何が見えれば OK かまで書く
2. ラベル `needs-manual-check` を付ける。目印はラベルだけにする（確認後にユーザーが外せば跡が残らない）

ラベルはリポジトリにあるときだけ付ける。自分がオーナーのリポジトリなら作ってから付ける。どちらでもなければチェックリストだけにして、ラベルを付けなかったことを報告で伝える:

```bash
gh label list --search needs-manual-check --json name --jq '.[].name'
gh repo view --json owner --jq '.owner.login'   # gh api user --jq .login と同じなら自分のリポジトリ
gh label create needs-manual-check --color FBCA04 --description "Needs a manual check before merge"
gh pr edit <番号> --add-label needs-manual-check
```

### 8. 自動レビューを待って読む

レビューボットがあるリポジトリでは、PR を作ってから1〜2分後にボットの指摘が付く。作ったら次の作業に移るので、ここで待たないと誰も読まない。draft でも同じ。

```bash
python3 -I ~/.claude/skills/create-pr/scripts/pr-open-reviews.py <番号> --wait
```

レビューのチェックが終わるまで待ち、作者がまだ対応していない指摘を出す（何を数えるかはスクリプト冒頭のコメント）。残りがあれば終了コード 1 になるので、1件ずつ直すか返信してから、もう一度流して 0 件を確かめる。ボットへの返信はそのまま投稿してよい。人への返信は下書きを見せて止める。

### 9. 結果報告

作成したPRのURLを報告する。手順8の結果（0件だった、または直した・返信した件数）を1行添える。動作確認の目印を付けたなら、確かめてほしい項目を1行ずつ添える。
