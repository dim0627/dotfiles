---
name: tidy-doc
description: GitHub Issue / Linear / Notion / リポジトリ内Markdown等の長文ドキュメントを精査し、陳腐化情報・重複・内部不整合を検出して整理案を提示する
user-invocable: true
allowed-tools: Bash(gh issue view*), Bash(gh issue edit*), Bash(gh api repos*), Read, Edit, Grep, Glob, mcp__claude_ai_Notion__*, mcp__claude_ai_Linear__*
---

長文ドキュメント（GitHub Issue / Linear / Notion / リポジトリ内Markdown）を読み込み、陳腐化した情報・重複・内部不整合を検出して整理案を提示する。

`update-ticket` がコードベースとチケットの乖離を埋める「外部参照ベース」の同期スキルなのに対し、`tidy-doc` はドキュメント内部の整合性を整える「自己参照ベース」の整理スキル。`update-ticket` 実行後の最終仕上げに `tidy-doc` を流す運用も想定する。

## 引数

- **URL or ID or ファイルパス**（必須）: 整理対象
  - GitHub Issue: `https://github.com/owner/repo/issues/123` / `owner/repo#123` / `#123` / `123`
  - Linear: `XXX-123` 形式 / `linear.app` を含む URL / コメント ID
  - Notion: `notion.so` を含む URL / Notion ページ ID
  - リポジトリ内Markdown: `docs/foo.md` などのファイルパス（README/設計書/手順書など長文Markdown）

判別不能な場合はユーザーに確認する。

## 手順

### 1. 対象の判別と取得

入力値からバックエンドを自動判別し、ドキュメント本文を取得する。

| バックエンド | 判別パターン | 取得コマンド |
| --- | --- | --- |
| GitHub Issue | `github.com` URL / `owner/repo#N` / `#N` / 数字のみ | `gh issue view <参照> --json number,title,body,url` + `gh issue view <参照> --comments` |
| Linear | `XXX-123` 形式 / `linear.app` URL | `mcp__claude_ai_Linear__get_issue` + `mcp__claude_ai_Linear__list_comments` |
| Notion | `notion.so` URL / 32桁hex / ハイフン付きUUID | `mcp__claude_ai_Notion__notion-fetch` |
| Markdown | `.md` で終わるファイルパス | `Read` で読み込み |
| 判別不能 | — | ユーザーに確認 |

### 2. 内部分析（4 観点）

ドキュメント本文を以下の 4 観点で精査し、整理候補を抽出する:

- **🔁 重複情報**: 同じ事実が複数箇所に書かれている。追記の積み重ねで起きやすい
- **🔢 数字の不整合**: サマリ・本文・推奨手順など複数セクションでカウントが食い違っている（例: サマリ「軽 13」/ 本文「軽 12」）
- **📅 状態の不整合**: 「Phase A 着手予定」と「Phase A 完了」が同居している等、時系列の整合が取れていない
- **📛 古い参照**: 既にマージされた PR を「OPEN」と表記、削除済みファイル・関数を参照、古いコメント ID 引用など

### 3. 整理案の提示

以下のフォーマットで整理案を提示する。該当がないセクションは省略する。

```markdown
## 🧹 ドキュメント整理案

**対象**: [タイトル] (URL)

**🔁 重複情報の統合**
- セクション X と Y で同じ「○○ 完了」記述 → X に統合、Y から削除

**🔢 数字の整合**
- サマリ「軽 13」/ 推奨手順「Phase A 軽 13」/ 詳細「軽 12」 → 軽 12 に統一

**📅 状態の整合**
- 「Phase A 着手予定」と「Phase A 完了」が同居 → 完了に統一

**📛 古い情報の更新**
- 「PR #XXX OPEN」→ 既にマージ済み（commit abc123）→ 「merged」に更新

**🗑 削除候補**
- 旧 Phase 1-3 着手前の TODO リスト → Phase 3 完了済みなので不要

差分案:
[具体的な before / after を提示]
```

### 4. ユーザー承認後の反映

ユーザーが承認したら、バックエンドごとの書き戻し方法でドキュメントを更新する。

| バックエンド | 書き戻し方法 |
| --- | --- |
| GitHub Issue | `gh issue edit <番号 or URL> --body-file <一時ファイル>`（コメントは `gh api repos/{owner}/{repo}/issues/comments/{id} -X PATCH -f body=...`） |
| Linear チケット本文 | `mcp__claude_ai_Linear__save_issue` |
| Linear コメント | `mcp__claude_ai_Linear__save_comment` |
| Notion ページ | `mcp__claude_ai_Notion__notion-update-page` |
| Markdown ファイル | `Edit` で差分適用 |

更新時の注意:
- 既存の構造・フォーマットを維持する（見出し・箇条書き・絵文字をそのまま踏襲）
- バックエンドごとのレンダリング差:
  - GitHub / Markdown: GitHub Flavored Markdown。テーブルも安定して使える
  - Linear / Notion: テーブル記法はレンダリング互換性が低いため、箇条書き・見出し・太字を優先する
- フラットな構造を保つ（深いネストや複雑レイアウトを新たに導入しない）
- 変更箇所のみ更新し、関係ない部分は触らない

## 注意事項

- 自動修正は誤判定リスクが高いため、必ずユーザー承認を得てから反映する
- 削除候補は理由を明示する（「Phase 3 マージ済みで不要」「サマリと重複」等）
- 既存フォーマットの変更（見出しレベルの統一・絵文字の整理など）はスコープ外。あくまで「内容の整合」に集中する
- 人宛のコメント返信は本スキルの対象外。グローバル CLAUDE.md「人へのレス・コメント」のルールに従う
