---
name: review-pr
description: PRのレビューコメントを取得・分類し、対応計画を立てる
user-invocable: true
allowed-tools: Bash(gh pr view*), Bash(gh api repos*), Bash(git log*), Bash(gh repo view*), Bash(git add *), Bash(git commit *), Bash(git push*), Bash(git status*), Bash(git diff*), Read, Edit, Grep, Glob, Agent
---

PRのレビューコメントを精査し、対応計画を立てる。

## 手順

### 1. PR情報の確認

引数の有無に応じてPR情報を取得する:

- **引数あり（PR URL or 番号）**: 引数をそのまま `gh pr view` に渡す
  ```bash
  gh pr view <引数> --json number,title,url,state,author,baseRefName,headRefName
  ```
- **引数なし**: 現在のブランチのPRを取得する
  ```bash
  gh pr view --json number,title,url,state,author,baseRefName,headRefName
  ```

PRが見つからない場合はその旨を報告して終了。

次に、取得したPRの URL からリポジトリの owner/name を特定する（`--repo` フラグや URL パースで対応）。

### 2. レビューコメントの全量取得

#### 2.1 コードレビューコメントを2段階で取得

CodeRabbit などの bot は本文が非常に長いため、全件 `body` を一度に取得すると出力が巨大化して打ち切られ、後半のコメントを見落とす危険がある。**必ず以下の2段階で取得すること**:

**第1段階** — まず ID とメタデータだけ取得して全件把握:
```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate --jq '.[] | {id: .id, author: .user.login, path: .path, line: .line, original_line: .original_line, in_reply_to_id: .in_reply_to_id, created_at: .created_at}'
```

**第2段階** — 第1段階で取得した ID リストをもとに、各コメントの本文を個別取得:
```bash
gh api repos/{owner}/{repo}/pulls/comments/{id} --jq '{path: .path, line: .line, body: .body}'
```

複数件ある場合は for ループで一括取得して構わない。第1段階の件数と第2段階で取得した件数が一致していることを必ず確認する。

#### 2.2 PR全体コメント・レビューサマリも並行取得

第1段階と同じタイミングで以下も並行取得する:

- **PR全体コメント**:
  ```bash
  gh pr view {number} --json comments --jq '.comments[] | {author: .author.login, body: .body, createdAt: .createdAt}'
  ```

- **レビューサマリ**:
  ```bash
  gh api repos/{owner}/{repo}/pulls/{number}/reviews --jq '[.[] | select(.body != "" or .state != "COMMENTED")] | .[] | {author: .user.login, state: .state, body: .body, submittedAt: .submitted_at}'
  ```

### 3. コメントの分類

以下の接頭辞で優先度分類する。接頭辞がないコメントは内容から判断する。
プロジェクトに AGENTS.md がある場合はそちらのレビュー規約も参照すること。

| 接頭辞 | 優先度 | 意味 | 対応 |
|--------|--------|------|------|
| `[must]` | 🔴 最高 | 必ず変更 | コード修正必須 |
| `[ask]` | 🟡 中 | 質問 | 回答が必要 |
| `[imo]` | 🟡 中 | 意見 | 検討して判断 |
| `[nits]` | 🔵 低 | 些細な指摘 | 余裕があれば対応 |
| `[fyi]` | ⚪ 情報 | 参考情報 | 対応不要（認識のみ） |

### 4. 対応済みの判別

- PR作者自身のコメント（返信・説明）は指摘から除外
- `in_reply_to_id` があるコメントはスレッドとしてグループ化
- スレッド内で作者が返信済み、または議論が収束しているものは「対応済み」とする
- **bot コメントの扱い**:
  - **除外対象**: CI/CD通知（github-actions, circleci）、デプロイ通知（vercel, netlify）、依存関係更新通知（dependabot, renovate）など、actionable でない通知系 bot
  - **対象に含める**: コードレビュー bot（coderabbitai, sonarcloud, codacy, sourcegraph, snyk, deepsource など）。これらはインライン `/comments` API 経由で actionable な指摘を投稿するため、人間レビュアーと同等に扱う
  - 迷ったら `path` フィールドを持つインラインコメントは対象に含める方針で判断する
- **コメント本文を grep などで filter しない**。CodeRabbit 等の冗長な bot コメントは出力が巨大になりがちだが、`grep -v` で除外すると見落としが発生する。代わりに `--jq` で `body` フィールドを切り詰める（例: `.body[:500]`）か、まず `id` と `path` だけ取得して全件 ID を把握してから個別に取得する

### 5. 関連ファイルの確認

対応が必要なコードレビューコメントに紐づくファイルパスがある場合:
1. Read でファイルの該当箇所を確認
2. コメントの文脈を理解した上で具体的な修正方針を提案

### 6. 対応計画の出力

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

### 7. 対応の実行

計画を報告した後、ユーザーに対応を実行するか確認する。

承認された場合、以下の順序で対応する:

1. **🔴 [must] から順に対応**: 優先度の高いものから修正を実施する
2. **該当ファイルを Read で確認** → コメントの文脈を理解した上で修正
3. **修正ごとに差分を報告**: 何を・なぜ変えたかを簡潔に説明する
4. **[ask] への回答案を作成**: ユーザーが PR 上で返信できるよう回答のドラフトを提示する
5. **[imo] は判断を添えて提案**: 同意する場合は修正を実施、しない場合は理由を説明しユーザーに判断を委ねる

対応完了後、コミット・プッシュするかユーザーに確認する。
