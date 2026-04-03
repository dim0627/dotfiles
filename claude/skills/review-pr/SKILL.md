---
name: review-pr
description: 現在のブランチのPRレビューコメントを取得・分類し、対応計画を立てる
user-invocable: true
allowed-tools: Bash(gh pr view*), Bash(gh api repos*), Bash(gh repo view*), Bash(git log*), Read, Grep, Glob, Agent
---

現在のブランチに紐づくPRのレビューコメントを精査し、対応計画を立てる。

## 手順

### 1. PR情報の取得

1. `gh pr view --json number,title,url,state,author,baseRefName,headRefName` で現在のブランチに紐づくPRを取得
2. PRが見つからない場合はその旨を報告して終了

### 2. リポジトリ情報の取得

1. `gh repo view --json owner,name --jq '.owner.login + "/" + .name'` でowner/repo形式を取得

### 3. レビューコメントの全量取得（3種類を並行取得）

以下の3つのコマンドを **並行して** 実行する:

1. **PR全体コメント**:
   ```bash
   gh pr view {number} --json comments --jq '.comments[] | {author: .author.login, body: .body, createdAt: .createdAt}'
   ```

2. **コードレビューコメント**:
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate --jq '.[] | {id: .id, author: .user.login, body: .body, path: .path, line: .line, createdAt: .created_at, in_reply_to_id: .in_reply_to_id}'
   ```

3. **レビューサマリ**:
   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/reviews --jq '[.[] | select(.body != "" or .state != "COMMENTED")] | .[] | {author: .user.login, state: .state, body: .body, submittedAt: .submitted_at}'
   ```

### 4. コメントの分類

以下の接頭辞で優先度分類する。接頭辞がないコメントは内容から判断する。
プロジェクトに AGENTS.md がある場合はそちらのレビュー規約も参照すること。

| 接頭辞 | 優先度 | 意味 | 対応 |
|--------|--------|------|------|
| `[must]` | 🔴 最高 | 必ず変更 | コード修正必須 |
| `[ask]` | 🟡 中 | 質問 | 回答が必要 |
| `[imo]` | 🟡 中 | 意見 | 検討して判断 |
| `[nits]` | 🔵 低 | 些細な指摘 | 余裕があれば対応 |
| `[fyi]` | ⚪ 情報 | 参考情報 | 対応不要（認識のみ） |

### 5. 対応済みの判別

- PR作者自身のコメント（返信・説明）は指摘から除外
- `in_reply_to_id` があるコメントはスレッドとしてグループ化
- スレッド内で作者が返信済み、または議論が収束しているものは「対応済み」とする
- bot によるコメント（CI結果等）は除外

### 6. 関連ファイルの確認

対応が必要なコードレビューコメントに紐づくファイルパスがある場合:
1. Read でファイルの該当箇所を確認
2. コメントの文脈を理解した上で具体的な修正方針を提案

### 7. 対応計画の出力

以下の形式でまとめて報告する:

#### 出力フォーマット

```
## PR概要
- タイトル: {title}
- URL: {url}
- 状態: {state}

## レビュー状態
- Approved: N件
- Changes Requested: N件
- Commented: N件

## 対応が必要なコメント

### 🔴 [must] 必須対応 (N件)
1. **{ファイルパス}:{行番号}** by @{author}
   > コメント内容
   → 修正方針: ...

### 🟡 [ask] 回答が必要 (N件)
1. ...

### 🟡 [imo] 検討事項 (N件)
1. ...

### 🔵 [nits] 軽微な指摘 (N件)
1. ...

### ⚪ [fyi] 参考情報 (N件)
1. ...

### ✅ 対応不要 (N件)
- 対応済み・bot・自己コメント等

## 推奨対応順序
1. ...
2. ...
```
