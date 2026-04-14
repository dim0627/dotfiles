---
name: merge-main
description: デフォルトブランチの最新をフィーチャーブランチにマージする
user-invocable: true
allowed-tools: Bash(git fetch*), Bash(git merge*), Bash(git push*), Bash(git status*), Bash(git rev-parse*), Bash(git log*), Read, Edit
---

デフォルトブランチの最新変更を現在のブランチにマージする。

## 現在の状態

- **現在のブランチ**:
!`git rev-parse --abbrev-ref HEAD`

- **デフォルトブランチ参照**:
!`git symbolic-ref refs/remotes/origin/HEAD`

- **未コミットの変更**:
!`git status --short`

## 手順

### 1. 事前チェック

- 上記「デフォルトブランチ参照」からブランチ名を特定する（例: `refs/remotes/origin/main` → `main`）
- デフォルトブランチ上にいる場合は「既にデフォルトブランチ上。`/sync` を使って」と報告して終了
- 未コミットの変更がある場合は警告し、先にコミットするか stash するか確認する

### 2. リモート取得

```bash
git fetch origin
```

### 3. マージ実行

```bash
git merge origin/<デフォルトブランチ>
```

### 4. コンフリクト対応

コンフリクトが発生した場合:

1. `git status` でコンフリクトファイルを確認
2. 各ファイルを Read で確認し、コンフリクトマーカーの内容を把握
3. 両方の変更意図を理解した上で解消する
4. 解消方針が不明確な場合はユーザーに確認する
5. 解消後 `git add` でステージング
6. `git merge --continue` でマージ完了

### 5. プッシュ

マージ結果をリモートにプッシュする:

```bash
git push
```

### 6. 結果報告

以下を簡潔に報告する:

- マージ結果（クリーン or コンフリクト解消の内容）
- 取り込まれたコミット数
