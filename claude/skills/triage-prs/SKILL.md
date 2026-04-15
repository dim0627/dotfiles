---
name: triage-prs
description: 自分が出したPRの状態（レビュー・CI・コンフリクト）を一括確認し、対応が必要なものを優先度付きで報告する
user-invocable: true
allowed-tools: Bash(gh pr list*), Bash(gh pr view*), Bash(gh api repos*), Bash(gh repo view*), Read, Grep, Glob
---

自分が出したPRを一括トリアージし、ネクストアクションを明確にする。

## 引数

- **引数なし**: 現在リポジトリの自分のPR全件を軽量チェック
- **`--with-comments`**: 未解決コメントを取得しAIで分類（トークン消費 大）
- **`--with-comments --pr <番号>`**: 特定PRのコメントだけ深掘り（トークン消費 中）

## 手順

### 1. リポジトリ情報の取得

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

owner/repo を特定する。

### 2. 自分のPR一覧を取得

```bash
gh pr list --author @me --json number,title,url,reviewDecision,mergeable,statusCheckRollup,updatedAt,headRefName,additions,deletions,reviewRequests
```

PRが0件の場合はその旨を報告して終了。

### 3. 各PRの状態を判定

取得したデータから以下を判定する:

- **reviewDecision**:
  - `APPROVED` → 🟢 Approved
  - `CHANGES_REQUESTED` → 🔴 Changes Requested
  - `REVIEW_REQUIRED` → 🟡 Review待ち
  - 空 → 🟡 Review待ち
- **mergeable**:
  - `CONFLICTING` → 💥 コンフリクト
  - `MERGEABLE` → OK
  - `UNKNOWN` → 判定中
- **statusCheckRollup**: 各チェックの `conclusion` を集約
  - 全て `SUCCESS` → ✅ CI通過
  - いずれか `FAILURE` → 🔵 CI失敗
  - いずれか `PENDING` or `null` → ⏳ CI実行中

### 4. 未返信コメント数の取得（デフォルトモード）

各PRについて、コメント数だけ軽量に取得する:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --jq '[.[] | select(.user.login != "{自分のユーザー名}")] | length'
```

```bash
gh api repos/{owner}/{repo}/pulls/{number}/reviews --jq '[.[] | select(.state == "CHANGES_REQUESTED" or (.state == "COMMENTED" and .body != ""))] | length'
```

自分のユーザー名は以下で取得:
```bash
gh api user --jq '.login'
```

### 5. 出力（デフォルトモード）

優先度順に並べて報告する。並び順:
1. 💥 コンフリクト（マージブロック）
2. 🔴 Changes Requested（対応必要）
3. 🔵 CI失敗（修正必要）
4. 🟢 Approved + CI通過（マージ可能！）
5. 🟡 Review待ち
6. ⏳ CI実行中

#### 出力フォーマット

```
## 📋 PR トリアージ結果

### 💥 要対応
- **#42 「認証リファクタ」** — コンフリクト & Changes Requested (未返信コメント3件)
  → コンフリクト解消 → コメント対応
- **#38 「API追加」** — 🔴 Changes Requested (未返信コメント2件)
  → コメント対応

### 🔵 CI失敗
- **#39 「テスト追加」** — CI失敗 (test-unit: FAILURE)
  → `/fix-ci` で診断

### 🚀 マージ可能
- **#35 「バグ修正」** — 🟢 Approved, ✅ CI通過
  → マージ！

### 🟡 待ち
- **#41 「画面改善」** — Review待ち (3日経過, 未返信コメント0件)
  → レビュアーにリマインド検討

### ⏳ 進行中
- **#40 「設定変更」** — CI実行中
  → 待機
```

各PRに具体的なネクストアクションを1行で付与する。

---

## `--with-comments` モード

引数に `--with-comments` が含まれる場合、以下の追加手順を実行する。

### 6. 対象PRの決定

- `--pr <番号>` 指定あり → そのPRのみ
- `--pr` 指定なし → ステップ3で「要対応」と判定された全PR

### 7. コメントの取得

review-pr スキルと同様の2段階取得を行う:

**第1段階** — ID とメタデータ:
```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate --jq '.[] | {id: .id, author: .user.login, path: .path, line: .line, in_reply_to_id: .in_reply_to_id, created_at: .created_at}'
```

**第2段階** — 各コメントの本文を個別取得:
```bash
gh api repos/{owner}/{repo}/pulls/comments/{id} --jq '{path: .path, line: .line, body: .body}'
```

PR全体コメントも取得:
```bash
gh pr view {number} --json comments --jq '.comments[] | {author: .author.login, body: .body, createdAt: .createdAt}'
```

### 8. コメントのフィルタリング

以下を除外:
- 自分自身のコメント
- resolved 済みスレッド
- 通知系 bot（github-actions, circleci, vercel, netlify, dependabot, renovate）
- 自分が返信済みのスレッド（`in_reply_to_id` で判定）

以下は対象に含める:
- コードレビュー bot（coderabbitai, sonarcloud, codacy 等）
- `path` フィールドを持つインラインコメント

### 9. コメントの分類

未対応コメントをAIで分類する:

- 🔴 **修正依頼** — 「直して」「バグ」「〜すべき」「変更して」
- 🟡 **質問** — 「なぜ？」「意図は？」「〜ではないか？」→ 返答必要
- 🟢 **感想/LGTM** — 「いいね」「なるほど」「良さそう」→ 対応不要
- ⚪ **情報共有** — 「FYI」「参考までに」→ 認識のみ

### 10. `--with-comments` 出力

デフォルト出力のPR一覧に加え、各PRのコメント詳細を表示:

```
### 💥 #42 「認証リファクタ」 — コンフリクト & Changes Requested

**未対応コメント:**
- 🔴 @tanaka: "nullチェックが抜けている" (`src/auth.ts:42`)
- 🟡 @suzuki: "この設計の意図は？" (`src/middleware.ts:15`)
- 🟢 @yamada: "いい感じ 👍" ← 対応不要

**ネクストアクション:**
1. コンフリクト解消
2. `src/auth.ts:42` nullチェック追加
3. @suzuki に設計意図を返信
```

## 注意事項

- このスキルは状況報告のみ。コード修正やコミットは行わない
- 修正が必要な場合は `/review-pr <番号>` や `/fix-ci` への誘導を提案する
- `--with-comments` なしでもコメント「件数」は表示する（中身は見ない）
