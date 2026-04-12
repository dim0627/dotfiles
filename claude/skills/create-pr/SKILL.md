---
name: create-pr
description: 現在のブランチからプルリクエストを作成する
user-invocable: true
allowed-tools: Bash(git push*), Bash(git checkout -b *), Bash(gh pr create*)
---

現在のブランチの変更内容を分析し、PRを作成する。

## 現在の状態

- **未コミットの変更**:
!`git status`

- **現在のブランチ**:
!`git rev-parse --abbrev-ref HEAD`

- **デフォルトブランチ**:
!`git symbolic-ref refs/remotes/origin/HEAD | sed 's|refs/remotes/origin/||'`

- **含まれるコミット一覧**:
!`git log $(git symbolic-ref refs/remotes/origin/HEAD | sed 's|refs/remotes/origin/||')..HEAD --oneline`

- **差分全体**:
!`git diff $(git symbolic-ref refs/remotes/origin/HEAD | sed 's|refs/remotes/origin/||')...HEAD`

## 手順

### 1. 未コミットの変更がある場合

未コミットの変更があれば警告し、先にコミットするよう促して終了。

### 2. デフォルトブランチ上にいる場合

デフォルトブランチ上にいる場合は、適切なブランチ名を提案して `git checkout -b <ブランチ名>` で新しいブランチを作成する。

### 3. 変更内容の分析

上記の「含まれるコミット一覧」と「差分全体」から変更の目的と影響範囲を把握する。

### 4. リモートにプッシュ

1. `git push -u origin <ブランチ名>` でリモートにプッシュ

### 5. PR作成

PRタイトルとサマリを作成し、`gh pr create` で作成する:

- タイトルは70文字以内で簡潔に
- 本文は HEREDOC 形式で渡す:
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

### 6. 結果報告

作成したPRのURLを報告する。
