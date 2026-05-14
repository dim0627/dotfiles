---
name: update-ticket
description: コードベースの現状をもとに、GitHub Issue / Linear / Notion のチケットを最新状態に更新する
user-invocable: true
allowed-tools: Bash(gh pr list*), Bash(gh pr view*), Bash(gh issue view*), Bash(gh issue edit*), Bash(gh api repos*), Read, Grep, Glob, mcp__claude_ai_Notion__*, mcp__claude_ai_Linear__*
---

コードベースの進捗をもとに、指定された GitHub Issue / Linear / Notion のチケットを最新状態に同期する。

## 引数

- **URL or チケット番号**（必須）: 更新対象のチケット
  - GitHub: `https://github.com/owner/repo/issues/123` / `owner/repo#123` / `#123` / `123`
  - Linear: `XXX-123` 形式のチケットID / `linear.app` URL
  - Notion: `https://www.notion.so/...` / 32桁hex / ハイフン付きUUID

## 手順

### 1. 対象チケットの判別と取得

入力値からバックエンドを自動判別し、本文・コメントを取得する。

| バックエンド | 判別パターン | 取得コマンド |
| --- | --- | --- |
| GitHub | `github.com` URL / `owner/repo#N` / `#N` / 数字のみ | `gh issue view <参照> --json number,title,body,labels,state,url` + `gh issue view <参照> --comments` |
| Linear | `XXX-123` 形式 / `linear.app` URL | `mcp__claude_ai_Linear__get_issue` + `mcp__claude_ai_Linear__list_comments` |
| Notion | `notion.so` URL / 32桁hex / ハイフン付きUUID | `mcp__claude_ai_Notion__notion-fetch` |
| 判別不能 | — | ユーザーに確認 |

### 2. コードベース現状の確認

チケット内容を起点に、関連するコードの現状を把握する。

#### 2.1 チケットに紐づくPR・ブランチの確認

チケットに GitHub PR のリンクやブランチ名が含まれている場合、PR から変更内容を把握する:

```bash
gh pr view <番号> --json title,state,files,commits
```

```bash
gh pr list --search "<チケットID or キーワード>" --json number,title,state,headRefName
```

GitHub Issueがバックエンドの場合は、Issue本文や `closingIssuesReferences` から関連PRを辿るのが簡単:

```bash
gh issue view <番号> --json closedByPullRequestsReferences,title,body
```

PR が見つかれば、変更ファイル一覧から効率的に現状を把握できる。

#### 2.2 関連ファイルの確認

チケットに記載されたタスク・TODO・仕様に関連するファイルを Read/Grep で確認する。
関連ファイルの特定はチケット内容から判断する（ファイル名、機能名、コンポーネント名等）。
PR の変更ファイル一覧がある場合はそれも参照する。

### 3. 乖離の特定

チケット記載内容とコード現状を突き合わせ、以下を特定する:

- **完了済み**: チケットに書かれているがコードでは既に実装済みの項目
- **変更あり**: チケットの前提・方針と異なる実装になっている箇所
- **新規判明**: チケットに記載がないが作業中に判明した事実・追加タスク
- **未着手**: チケットに書かれていてまだ未実装の項目

### 4. 更新案の提示

乖離箇所をもとに更新案を作成し、ユーザーに提示する。

#### 出力フォーマット

```markdown
## 🔄 チケット更新案

**対象**: [チケットタイトル] (URL)

**✅ 完了に更新**
- 項目A — 実装済み（コミット abc1234）
- 項目B — 実装済み

**📝 内容変更**
- 項目C — チケット: 「〜する予定」→ 実態: 「〜の方式で実装済み」
  - 理由: 〜のため方針変更

**➕ 追加**
- 項目D — 作業中に判明した追加タスク

**⏳ 未着手（変更なし）**
- 項目E
```

該当がないセクションは省略する。

### 5. ユーザー承認後の反映

ユーザーが承認したら、バックエンドごとの書き戻しコマンドでチケットを更新する。

| バックエンド | 書き戻しコマンド | 補足 |
| --- | --- | --- |
| GitHub | `gh issue edit <番号 or URL> --body-file <一時ファイル>` | 他リポジトリは URL 直指定か `--repo owner/repo` を併用。改行・コードブロックを含むため `--body` 直渡しは避け、一時ファイル経由が安全 |
| Linear | `mcp__claude_ai_Linear__save_issue` | チケットIDを指定して `description` を更新 |
| Notion | `mcp__claude_ai_Notion__notion-update-page` | ページIDを指定して本文を更新 |

更新時の注意:
- 既存の構造・フォーマットを維持する
- バックエンドごとのレンダリング差:
  - GitHub: GitHub Flavored Markdown。テーブルも安定して使える
  - Linear / Notion: テーブル記法はレンダリング互換性が低いため、箇条書き・見出し・太字を優先する
- フラットな構造を保つ
- 変更箇所のみ更新し、関係ない部分は触らない

## 注意事項

- 更新は必ずユーザー承認後に実行する。勝手に書き込まない
- チケットの既存フォーマット・構造を壊さない
- ステータス変更（Open→Closed/Done等）はユーザーに確認してから行う
