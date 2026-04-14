---
name: fix-ci
description: CIの失敗ログを取得・診断し、自動修正する
user-invocable: true
allowed-tools: Bash(gh run*), Bash(gh pr*), Bash(git add *), Bash(git commit *), Bash(git push*), Bash(git status*), Bash(git diff*), Read, Edit, Glob, Grep
---

CIの失敗を診断して修正する。

## 現在の状態

- **現在のブランチ**:
!`git rev-parse --abbrev-ref HEAD`

- **直近のCI実行状態**:
!`gh run list --branch $(git rev-parse --abbrev-ref HEAD) --limit 5 --json databaseId,status,conclusion,name,createdAt --jq '.[] | "\(.databaseId) \(.name) \(.status) \(.conclusion) \(.createdAt)"'`

## 手順

### 1. CI状態の確認

上記の実行状態を確認し、失敗している run を特定する。

- 全て成功している場合はその旨を報告して終了
- 失敗している run が複数ある場合は、最新のものから対応する

### 2. 失敗ログの取得

失敗した run の詳細ログを取得する:

```bash
gh run view <run-id> --log-failed
```

ログが長大な場合は、エラーメッセージやスタックトレースを含む末尾を重点的に確認する。

### 3. 診断

ログから失敗原因を特定する:

- **テスト失敗**: 失敗テスト名・アサーションエラー内容を特定
- **ビルドエラー**: コンパイルエラー・型エラーの該当箇所を特定
- **lint/format**: 違反ルールと該当ファイルを特定
- **依存関係**: パッケージ解決エラーの原因を特定
- **環境/設定**: CI設定ファイルの問題を特定

### 4. 該当ファイルの確認

診断結果をもとに、修正が必要なファイルを Read で確認する。

### 5. 修正の実施

原因に応じてコードを修正する。

- 修正は最小限にとどめ、CI失敗の解消に直接関係する変更のみ行う
- 修正内容が不明確な場合や、意図的な変更が必要な場合はユーザーに確認する

### 6. 修正の検証

可能であればローカルで同等のコマンドを実行して修正を検証する（テスト実行、lint、型チェック等）。

### 7. 結果報告

以下を簡潔に報告する:

- 失敗原因
- 修正内容
- ローカル検証結果（実施した場合）
- コミット・プッシュするかユーザーに確認する
