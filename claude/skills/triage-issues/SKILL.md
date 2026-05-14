---
name: triage-issues
description: 自分にアサインされた Issue（GitHub / Linear）の状態を一括確認し、対応が必要なものを優先度付きで報告する
user-invocable: true
allowed-tools: Bash(gh issue list*), Bash(gh issue view*), Bash(gh api repos*), Bash(gh repo view*), Bash(gh api user*), Read, Grep, Glob, mcp__claude_ai_Linear__*
---

自分にアサインされた Issue を一括トリアージし、ネクストアクションを明確にする。`triage-prs` の Issue 版。

## 引数

- **引数なし**: カレントリポジトリ（GitHub）または接続済み Linear ワークスペースから自分の Issue を取得
- **`--backend github` / `--backend linear`**: バックエンドを明示指定
- **`--all-repos`**: GitHub の場合、自分が関わる全リポジトリの Issue を横断検索（`gh search issues --assignee @me`）
- **`--with-comments`**: 各 Issue の未読コメントも取得（トークン消費 大）

## 手順

### 1. バックエンドの判定

| 判別根拠 | バックエンド |
| --- | --- |
| `--backend` 明示指定 | 指定通り |
| カレントディレクトリが Git リポジトリ + GitHub remote あり | GitHub（デフォルト） |
| Linear ワークスペースのみ接続 | Linear |
| 判別不能 | ユーザーに確認 |

複数バックエンドを並行運用している場合は、ユーザーに「どちらを見る？」と確認するか、両方取得してマージする。

### 2. 自分の Issue 一覧を取得

#### GitHub

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'   # owner/repo 取得
gh issue list --assignee @me --state open --json number,title,url,labels,updatedAt,comments,milestone,author
```

`--all-repos` 指定時:

```bash
gh search issues --assignee @me --state open --json number,title,url,repository,labels,updatedAt
```

#### Linear

```
mcp__claude_ai_Linear__list_issues  # assignee = me フィルタを使う
```

Issue が 0 件の場合はその旨を報告して終了。

### 3. 各 Issue の状態を判定

取得データから以下を判定する:

- **状態（state）**:
  - GitHub: `open` のみ対象、`closed` は除外
  - Linear: `In Progress` / `Todo` / `Backlog` / `In Review` などのワークフローステート
- **ラベル / 優先度**:
  - `bug`, `critical`, `P0`, `P1` などの優先度ラベル → 🔴 高優先
  - `enhancement`, `feature` → 🟡 中
  - `chore`, `docs` → 🔵 低
  - ラベル無し → 🟡 中（デフォルト）
- **更新の鮮度**:
  - 7日以上更新なし → ⏰ 古い
  - 当日更新あり → 🆕 アクティブ
- **未対応コメント数**:
  - GitHub: `comments` フィールド > 0 で「コメントあり」
  - Linear: コメント数を別途取得（重い場合は `--with-comments` 指定時のみ）

### 4. ネクストアクションの推定

各 Issue について、次に何をすべきかを1行で示す:

- 仕様未確定 → `/ralph-ready <番号>` で詰める
- 実装着手可 → 実装開始（必要ならブランチ作成）
- レビュー待ち → 関連 PR を確認
- ブロック中 → ブロック要因を明記
- 完了済みの可能性 → `/update-ticket <番号>` で同期確認

### 5. 優先度順に出力

並び順:
1. 🔴 高優先 + アクティブ
2. 🔴 高優先 + 古い（停滞）
3. 🟡 中 + アクティブ
4. 🟡 中 + 古い
5. 🔵 低
6. ⏰ 1ヶ月以上停滞（要棚卸し）

#### 出力フォーマット

```
## 📋 Issue トリアージ結果

**バックエンド**: GitHub (owner/repo) ※または Linear (workspace)
**対象**: 自分にアサインされたOpen Issue N件

### 🔴 高優先

- **#42 「認証バグ」** [bug, P0] 🆕 (2 comments)
  → `/ralph-ready #42` で仕様確定 → 実装

### 🟡 中優先

- **#38 「API追加」** [enhancement] (updated 3d ago)
  → 実装着手可
- **#35 「ドキュメント整備」** [docs] ⏰ (updated 12d ago)
  → 着手 or クローズ判断

### 🔵 低優先

- **#22 「タイポ修正」** [chore]
  → 余裕があれば

### ⏰ 棚卸し候補

- **#10 「Phase 2 議論」** (updated 45d ago, 0 comments)
  → 完了？保留？クローズ検討
```

各 Issue にネクストアクションを1行で必ず付与する。

---

## `--with-comments` モード

`--with-comments` 指定時、各 Issue の未対応コメントも取得して内容を要約する。

### 6. コメント取得（GitHub）

```bash
gh api repos/{owner}/{repo}/issues/{number}/comments --jq '.[] | {author: .user.login, body: .body, createdAt: .created_at}'
```

### 7. コメント取得（Linear）

```
mcp__claude_ai_Linear__list_comments
```

### 8. フィルタリング

以下を除外:
- 自分自身のコメント
- 通知系 bot（github-actions, dependabot, renovate）
- 既に解決済みの議論

### 9. コメント要約の付与

各 Issue の下に未対応コメント概要を添える:

```
- **#42 「認証バグ」**
  → **未対応コメント**: @tanaka 「再現手順を教えて」（要返信）
```

## 注意事項

- このスキルは状況報告のみ。Issue の更新・クローズ・コメント投稿は行わない
- 具体対応が必要な場合は `/ralph-ready <番号>` `/update-ticket <番号>` `/review-pr` 等への誘導を提案する
- `--with-comments` なしの軽量モードでは、コメント「件数」だけ表示し中身は読まない（トークン節約）
- 人宛のコメント返信ドラフトを作る場合はグローバル CLAUDE.md「人へのレス・コメント」のルールに従う
