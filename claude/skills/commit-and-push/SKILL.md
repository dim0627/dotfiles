---
name: commit-and-push
description: 変更をステージングしてコミットし、リモートにプッシュする
user-invocable: true
allowed-tools: Bash(git status*), Bash(git diff*), Bash(git log*), Bash(git add *), Bash(git commit *), Bash(git push*), Bash(git rev-parse*)
---

変更内容を確認し、コミットしてリモートにプッシュする。

## 手順

### 1. 現在の状態を把握（並行実行）

以下の3つを **並行して** 実行する:

1. `git status` で変更ファイル一覧を取得
2. `git diff` と `git diff --staged` で差分を確認
3. `git log --oneline -10` で直近のコミットメッセージのスタイルを確認

### 2. 変更がない場合

変更がなければその旨を報告して終了。

### 3. コミットメッセージの作成

- 変更内容を分析し、簡潔なコミットメッセージを作成する
- リポジトリの既存コミットメッセージのスタイルに合わせる
- 「何を変えたか」ではなく「なぜ変えたか」にフォーカスする
- `.env` やクレデンシャル系ファイルが含まれていたら警告して除外する

### 4. ステージングとコミット

1. 関連ファイルを `git add` でステージング（`git add -A` は使わず、ファイル名を明示する）
2. コミットメッセージは HEREDOC 形式で渡す:
   ```bash
   git commit -m "$(cat <<'EOF'
   コミットメッセージ

   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```
3. `git status` で結果を確認

### 5. プッシュ

1. `git rev-parse --abbrev-ref HEAD` で現在のブランチ名を取得
2. `git push origin <ブランチ名>` でリモートにプッシュ
   - リモートブランチが存在しない場合は `git push -u origin <ブランチ名>` を使う

### 6. 結果報告

コミットとプッシュの結果を簡潔に報告する。
