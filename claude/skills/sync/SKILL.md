---
name: sync
description: デフォルトブランチに切り替えて最新を pull する
user-invocable: true
allowed-tools: Bash(git fetch*), Bash(git checkout*), Bash(git pull*)
---

デフォルトブランチに同期する。

## 現在の状態

- **デフォルトブランチ参照**:
!`git symbolic-ref refs/remotes/origin/HEAD`

## 手順

### 1. リモート取得

`git fetch` でリモートの最新情報を取得する。

### 2. チェックアウト & プル

上記の「デフォルトブランチ参照」からブランチ名を特定し（例: `refs/remotes/origin/main` → `main`）:

1. `git checkout <ブランチ名>` でデフォルトブランチに切り替え
2. `git pull` で最新を取得

### 3. 結果を簡潔に報告
