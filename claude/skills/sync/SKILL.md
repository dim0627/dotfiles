---
name: sync
description: デフォルトブランチに切り替えて最新を pull する
user-invocable: true
allowed-tools: Bash(git fetch*), Bash(git symbolic-ref*|*), Bash(git checkout*), Bash(git pull*)
---

デフォルトブランチに同期する:

### 1. リモート取得 & デフォルトブランチ名の特定（並行実行）

以下の2つを **並行して** 実行する:

1. `git fetch` でリモートの最新情報を取得
2. `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'` でデフォルトブランチ名を取得

### 2. チェックアウト & プル（順次実行）

1. `git checkout <ブランチ名>` でデフォルトブランチに切り替え
2. `git pull` で最新を取得

### 3. 結果を簡潔に報告
