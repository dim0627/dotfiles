---
name: tidy-doc
description: 長文ドキュメント（GitHub Issue / Linear / Notion / リポジトリ内Markdown）の陳腐化を棚卸しし、整理案を出す。「ドキュメント整理して」「このissue古くなってない？」で起動。
user-invocable: true
allowed-tools: Bash(gh issue view*), Bash(gh issue edit*), Bash(gh pr view*), Bash(gh api repos*), Read, Edit, Grep, Glob, mcp__claude_ai_Notion__*, mcp__claude_ai_Linear__*
---

局所追記が積み重なった長文ドキュメントに残る**陳腐化**を棚卸しする。直すのは内容の整合だけで、見出しレベルや絵文字などの体裁は対象外。

## 手順

### 1. 取得

引数（URL / ID / ファイルパス）からバックエンドを判別し、本文とコメントを全部取得する。どれにも当たらなければユーザーに確認する。

| バックエンド | 判別パターン | 取得 |
| --- | --- | --- |
| GitHub Issue | `github.com` URL / `owner/repo#N` / `#N` / 数字のみ | `gh issue view <参照> --json number,title,body,url` + `gh issue view <参照> --comments` |
| Linear | `XXX-123` / `linear.app` URL / コメント ID | `mcp__claude_ai_Linear__get_issue` + `mcp__claude_ai_Linear__list_comments` |
| Notion | `notion.so` URL / 32桁hex / ハイフン付きUUID | `mcp__claude_ai_Notion__notion-fetch` |
| Markdown | `.md` のファイルパス | `Read` |

### 2. 棚卸し

全セクションに 4 観点を当てる。

- **🔁 重複**: 同じ事実が複数箇所にある
- **🔢 数字**: サマリ・本文・推奨手順などでカウントが食い違う（例: サマリ「軽 13」/ 本文「軽 12」）
- **📅 状態**: 時系列が食い違う（「Phase A 着手予定」と「Phase A 完了」が同居）、完了済みで役目を終えた記述が残っている
- **📛 参照**: PR・ファイル・関数・コメント ID への言及が実態とずれている。ドキュメントの外と突き合わせる観点なので、言及を 1 つずつ `gh pr view` / `Glob` / `Grep` で実物確認する

食い違いは**正本**で決着させる: 数字は詳細セクションを数え直した値、状態と参照は実物確認の結果。正本が決まらない項目は ❓ 要確認に回す。

完了条件: 全セクションを 4 観点で見終え、📛 の言及がすべて実物確認済み。

### 3. 整理案の提示

該当のない観点は省く。各項目に**根拠**（数え直した結果・PR の状態・commit 等）を添える。

```markdown
## 🧹 ドキュメント整理案

**対象**: [タイトル] (URL)

**🔁 重複**
- セクション X と Y に同じ「○○ 完了」 → X に統合、Y から削除

**🔢 数字**
- サマリ「軽 13」/ 詳細「軽 12」 → 詳細を数え直すと 12 → 12 に統一

**📅 状態**
- 「Phase A 着手予定」と「Phase A 完了」が同居 → 完了に統一
- Phase 1-3 着手前の TODO リスト → Phase 3 完了済み → 削除

**📛 参照**
- 「PR #XXX OPEN」 → merged（commit abc123） → 「merged」に更新

**❓ 要確認**
- [正本が決まらなかった食い違いと、判断に要る情報]

差分案:
[項目ごとの before / after]
```

提示したらユーザーの承認を待つ。誤判定がありうるので、反映するのは承認された項目だけ。

### 4. 反映

承認された項目の箇所だけを書き換え、それ以外の文面と構造はそのまま残す。

| バックエンド | 書き戻し方法 |
| --- | --- |
| GitHub Issue | `gh issue edit <番号 or URL> --body-file <一時ファイル>`（コメントは `gh api repos/{owner}/{repo}/issues/comments/{id} -X PATCH -f body=...`） |
| Linear チケット本文 | `mcp__claude_ai_Linear__save_issue` |
| Linear コメント | `mcp__claude_ai_Linear__save_comment` |
| Notion ページ | `mcp__claude_ai_Notion__notion-update-page` |
| Markdown ファイル | `Edit` |
