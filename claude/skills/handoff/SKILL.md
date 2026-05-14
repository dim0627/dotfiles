---
name: handoff
description: セッションの作業内容を要約し、引き継ぎ用にまとめる
user-invocable: true
allowed-tools: Bash(git log*), Bash(git diff*), Bash(git status*), Bash(gh issue*), Bash(gh pr*), mcp__claude_ai_Linear__*, mcp__claude_ai_Notion__*
---

現在のセッションで行った作業を要約し、次のセッションや外部ツールへの引き継ぎ用にまとめる。

## 現在の状態

- **現在のブランチ**:
!`git rev-parse --abbrev-ref HEAD`

- **未コミットの変更**:
!`git status --short`

## 手順

### 1. セッション内容の把握

会話履歴から以下を抽出する:

- このセッションで取り組んだタスク・目的
- 実施した変更の内容
- 判断・意思決定のポイント
- 発生した問題とその解決方法
- 未完了の作業・残タスク

### 2. git履歴の確認

セッション中のコミットがあれば確認し、実施内容の裏付けとする:

```bash
git log --oneline --since="today" --all
```

### 3. 要約の出力

以下のフォーマットで出力する。GitHub Issue / PR / Linear / Notion などのチケット管理ツールにそのまま貼れる、シンプルなMarkdown形式とする。
該当内容がないセクションは省略する。

```
**目的**
- このセッションで達成しようとしたこと

**実施内容**
- 行った変更・作業を箇条書き
- 判断ポイントがあればその理由も添える

**結果**
- 現在の状態（完了/途中/ブロック中）
- 作成したPR・コミット等のリンク

**未完了・次にやること**
- 残っているタスク
- 次のセッションで最初にやるべきこと

**備考**
- ハマったポイント、注意事項、今後の参考情報
```

### 4. 出力形式の注意

- 箇条書き・見出し・太字を基本に。テーブルは Linear/Notion では崩れやすいため、貼付先が GitHub と確定している場合のみ使ってよい
- フラットな構造を保つ（深いネスト不可）
- 簡潔に。冗長な説明は省く
- ユーザーが特定の貼付先を指定した場合（GitHub Issue/PR コメント・Linear チケット・Notion ページ等）、該当ツールに直接書き込むか確認する
  - GitHub: `gh issue comment <番号>` / `gh pr comment <番号>` / `gh issue edit <番号>`
  - Linear: `mcp__claude_ai_Linear__save_comment` / `mcp__claude_ai_Linear__save_issue`
  - Notion: `mcp__claude_ai_Notion__notion-update-page`
