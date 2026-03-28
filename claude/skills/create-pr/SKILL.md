---
name: create-pr
description: 現在のブランチからプルリクエストを作成する
user-invocable: true
allowed-tools: Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git push*), Bash(git rev-parse*), Bash(git symbolic-ref*), Bash(git checkout -b *), Bash(gh pr create*)
---

現在のブランチの変更内容を分析し、PRを作成する。

## 手順

### 1. 現在の状態を把握（並行実行）

以下を **並行して** 実行する:

1. `git status` で未コミットの変更がないか確認
2. `git rev-parse --abbrev-ref HEAD` で現在のブランチ名を取得
3. `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'` でデフォルトブランチ名を取得

### 2. 未コミットの変更がある場合

未コミットの変更があれば警告し、先にコミットするよう促して終了。

### 3. デフォルトブランチ上にいる場合

デフォルトブランチ上にいる場合は、適切なブランチ名を提案して `git checkout -b <ブランチ名>` で新しいブランチを作成する。

### 4. 変更内容の分析

1. `git log <デフォルトブランチ>..HEAD --oneline` で含まれるコミット一覧を取得
2. `git diff <デフォルトブランチ>...HEAD` で差分全体を確認
3. 変更の目的と影響範囲を把握する

### 5. リモートにプッシュ

1. `git push -u origin <ブランチ名>` でリモートにプッシュ

### 6. PR作成

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

### 7. 結果報告

作成したPRのURLを報告する。
