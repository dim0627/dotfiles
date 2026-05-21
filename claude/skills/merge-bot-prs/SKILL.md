---
name: merge-bot-prs
description: dependabot / renovate などのbotが出した依存更新PRを一括判定し、リスクが低いものは自動マージ、判断が必要なものはユーザーに提示する
user-invocable: true
allowed-tools: Bash(gh repo view*), Bash(gh pr list*), Bash(gh pr view*), Bash(gh pr merge*), Bash(gh pr comment*), Bash(gh api repos*), Bash(gh api user*), Read, Grep, AskUserQuestion
---

現在のリポジトリで dependabot / renovate などのbotが出した依存更新PRを一括処理する。攻めめ路線（minor までは自動マージ、major と breaking 記載ありのみ判断）で、判定 → 一括承認 → 自動マージ → 残りはエスカレーション、の流れを 1 コマンドにまとめる。

## 前提

- 現在ディレクトリが Git リポジトリで、GitHub リモートが存在する
- `gh` CLI が認証済み
- 対象は botアカウント（`dependabot[bot]` / `renovate[bot]`）が author の Open PR のみ

## 判定ロジック（攻めめ路線）

| 条件 | 判定 |
|------|------|
| `lockfile-only` 相当 (Renovate の Lock File Maintenance 等) | 🟢 自動マージ |
| `patch` バージョン更新 | 🟢 自動マージ |
| `minor` 更新 かつ PR body に breaking 記載なし | 🟢 自動マージ |
| `minor` 更新 かつ breaking 記載あり | 🟡 自己判断 |
| `major` 更新 | 🟡 自己判断 |
| CI 失敗 / コンフリクト / mergeable=UNKNOWN | 🔴 エスカレーション |

自己判断（🟡）では PR 内容を読んだ上で **「マージ推奨」または「エスカレーション推奨」** を判定する。最終的な実行はユーザーの一括承認後に行う。

## 引数

- **引数なし**: 現在のリポジトリの bot PR を全件処理
- **`--dry-run`**: 判定結果のみ表示し、マージは実行しない

## 手順

### 1. リポジトリ情報の取得

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
```

`owner/repo` を控える。

### 2. bot PR 一覧の取得

```bash
gh pr list --state open --limit 100 --json number,title,url,author,headRefName,mergeable,statusCheckRollup,body,labels,updatedAt
```

返ってきた配列から `author.login` が以下のいずれかに該当する PR のみを抽出する:

- `dependabot[bot]`
- `renovate[bot]`
- `app/dependabot`
- `app/renovate`

対象 0 件の場合はその旨を報告して終了。

### 3. 各 PR の判定

各 PR について、以下の項目を順に評価する。

#### 3.1 lockfile-only / メンテ系の検出

以下のいずれかに該当すれば `lockfile-only` 扱い → 🟢 自動マージ候補:

- `headRefName` が `renovate/lock-file-maintenance` を含む
- ラベルに `lockfile-only` / `lock-file` がある
- タイトルが `Lock file maintenance` / `chore: lock file maintenance` 等

#### 3.2 semver レベルの判定

PR タイトルから `from <old>` → `to <new>` を抽出してメジャー番号を比較する。

- **Dependabot**: `Bump <pkg> from 1.2.3 to 1.2.4` / `Bump <pkg> from 1.2.3 to 2.0.0` 等
- **Renovate**: `Update <pkg> to v2` / `Update dependency <pkg> to v1.2.4` 等。Renovate は from が無いケースもあるので、その場合は branch 名 `renovate/<pkg>-<major>.x` から推測するか、ラベル (`update:major` / `update:minor` / `update:patch`) を優先する。

判定:

- major 番号が変わる → `major`
- major 同じ・minor 番号が変わる → `minor`
- minor も同じ・patch のみ変わる → `patch`
- v 表記のみで詳細不明な場合は `unknown` 扱い → 🟡 自己判断へ

#### 3.3 breaking 記載の検出

PR body 内に以下のいずれかが含まれているかチェック:

- `BREAKING CHANGE` / `BREAKING CHANGES`（大文字、conventional commits 形式）
- 見出しの `## Breaking` / `### Breaking changes` / `### Breaking Changes`
- 箇条書きの `- Breaking:` / `* Breaking change:`
- `[breaking]` タグ、`💥` 絵文字、`:boom:` ショートコード

検出する場合は **文脈も確認する**。例: "No breaking changes in this release" のように否定文脈であれば breaking なしと判断してよい。release notes に "Breaking changes: (なし)" のような無害なパターンも除外する。

#### 3.4 CI / マージ可否の判定

- `mergeable` が `CONFLICTING` → 🔴 エスカレーション（コンフリクト）
- `mergeable` が `UNKNOWN` → 🔴 エスカレーション（判定不能）
- `statusCheckRollup` 内に `conclusion=FAILURE` のチェックあり → 🔴 エスカレーション（CI 失敗）
- 全 `SUCCESS` または `PENDING` のみ → OK

#### 3.5 最終判定

3.1〜3.4 をまとめて以下の判定を出す:

| 状況 | 判定 |
|------|------|
| 🔴 該当（CI / コンフリクト / mergeable 不明） | 🔴 エスカレーション |
| `lockfile-only` または `patch` | 🟢 自動マージ |
| `minor` かつ breaking 記載なし | 🟢 自動マージ |
| `minor` かつ breaking 記載あり | 🟡 自己判断 |
| `major` | 🟡 自己判断 |
| semver `unknown` | 🟡 自己判断 |

🟡 自己判断の PR については、PR body の release notes を読んだ上で、影響範囲（dev 依存か / 主要ロジックに触れるか / breaking の中身）を踏まえて **「マージ推奨」または「エスカレーション推奨」** をその場で判断し、理由も添える。

### 4. 判定結果の一覧表示

判定が揃ったら、ユーザーに対して以下の形式で一覧出力する:

```
## 🤖 Bot PR 判定結果 ({合計件数}件)

### 🟢 自動マージ予定 ({件数}件)
- #42 「Bump lodash from 4.17.20 to 4.17.21」 — patch, CI ✅
- #43 「Update eslint to v8.55.0」 — minor (dev), breakingなし, CI ✅
- #44 「Lock file maintenance」 — lockfile-only, CI ✅

### 🟡 自己判断 ({件数}件)
- #45 「Update typescript to v5」 — major
  - 判定: マージ推奨。release notes 確認、breaking は古い構文の削除のみで該当箇所なし
- #46 「Bump next from 14.0.0 to 15.0.0」 — major
  - 判定: エスカレーション推奨。App Router の挙動変更あり、要動作確認

### 🔴 エスカレーション ({件数}件)
- #47 「Bump react from 18.2 to 18.3」 — CI 失敗 (test-unit: FAILURE)
- #48 「Update vite to v5」 — コンフリクト
```

### 5. 一括承認

`AskUserQuestion` を 1 回呼び、以下のように尋ねる:

- 質問: 「この方針で進めていい？」
- 選択肢例:
  - **すべて実行** — 🟢 全件マージ + 🟡 マージ推奨も全件マージ + 🔴 はコメント下書きへ
  - **🟢 のみ実行** — 自動マージ対象だけマージ、🟡/🔴 はスキップ
  - **修正してから実行** — ユーザーが個別に指示を出したい場合
  - **中止** — マージ実行せず終了

`--dry-run` 引数が指定されている場合はこのステップをスキップし、判定結果のみ報告して終了する。

### 6. 自動マージの実行

承認された対象について、`gh pr merge` を実行する。

```bash
gh pr merge <番号> --squash --auto --delete-branch
```

ポイント:

- `--squash` を既定とする。深いコミット履歴を残さない方針。リポジトリの慣習が merge commit / rebase の場合はユーザーに合わせて変更（特殊な指示があった場合のみ）
- `--auto` を付与してGitHub の auto-merge を使う。CI が pending の場合でも GitHub 側でグリーン後にマージしてくれる
- `--delete-branch` で更新ブランチを掃除する
- リポジトリで auto-merge が無効な場合 `--auto` がエラーになる。その場合は `--auto` を外して即時マージにフォールバックする（CI が SUCCESS であることを再確認した上で）

各マージの結果を 1 行で報告する:

- 成功: `✅ #42 マージ実行 (auto-merge enqueued)`
- 失敗: `❌ #42 マージ失敗: <エラー要約>` — その PR はエスカレーション扱いに格上げする

### 7. エスカレーション対象の処理

🔴 エスカレーション PR について、後で自分が見返すための メモコメント を PR に残すかをユーザーに確認する。

コメント下書きの例:

```
要確認: CI失敗のため自動マージ対象外。test-unit ジョブの失敗原因を確認してください。
```

```
要確認: コンフリクト解消が必要。base ブランチに rebase してから再判定してください。
```

`AskUserQuestion` で「このコメントを各 PR に投稿していい？」と確認し、承認された場合のみ `gh pr comment` で投稿する。承認されなければ下書きを表示するだけで投稿はしない（CLAUDE.md の「人へのレス・コメント」ルール準拠）。

### 8. 完了報告

最終的に以下を報告する:

- 🟢 マージ実行した PR の番号と URL（auto-merge enqueued も含む）
- 🟡 自己判断でマージした PR / マージしなかった PR の内訳
- 🔴 エスカレーション PR の件数と、コメント投稿の有無
- 次回見るべき PR があれば（auto-merge enqueued 中のもの）リマインド

## 注意事項

- このスキルは**現在のリポジトリのみ**を対象とする。複数リポ横断は対象外
- マージ実行は必ずユーザーの一括承認後（ステップ 5）。承認なしでマージしない
- `--dry-run` モードでは絶対にマージ・コメント投稿を行わない
- semver 判定が `unknown`（タイトルから version が取れない）場合は安全側に倒して 🟡 自己判断に分類する
- breaking 検出は完璧ではないので、🟡 の判定では必ず PR body を読んで文脈確認する
- 自動マージ後に CI が落ちて auto-merge がキャンセルされる可能性はある。GitHub に任せた後の状態は次回の `/triage-prs` または `/merge-bot-prs` で確認する
