---
name: create-pr
description: 現在のブランチからプルリクエストを作成する
user-invocable: true
allowed-tools: Bash(git status*), Bash(git push*), Bash(git checkout -b *), Bash(gh pr create*), Bash(git log *), Bash(git diff *), Bash(git add *), Bash(git commit *), Bash(git merge-base *)
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

- **テンプレートあり**: テンプレートの構造・見出し・チェックリストを完全踏襲してPR本文を作成する
- **テンプレートなし**: 以下のデフォルトフォーマットを使用する

タイトルは70文字以内で簡潔に。本文は HEREDOC 形式で渡す:

```bash
gh pr create --title "タイトル" --body "$(cat <<'EOF'
## Summary
- 変更点を箇条書きで

## Test plan
- [ ] テスト項目

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 7. 結果報告

作成したPRのURLを報告する。
