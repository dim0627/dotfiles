---
name: sync
description: デフォルトブランチに切り替えて最新を pull する
user-invocable: true
allowed-tools: Bash(git symbolic-ref*), Bash(git checkout * && git pull)
---

デフォルトブランチに同期する:
1. `git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'` でデフォルトブランチ名を取得
2. 取得したブランチ名で `git checkout <ブランチ名> && git pull` を実行
3. 結果を簡潔に報告
