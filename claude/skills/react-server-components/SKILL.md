---
name: react-server-components
description: React Server/Client Componentの境界を検証する
user-invocable: true
allowed-tools: Read, Grep, Glob, Agent
---

React Server Components と Client Components の境界が正しいか検証する。

## 引数

- **scope**: 検証対象（デフォルト: 現在の変更差分）
  - `diff`: デフォルトブランチとの差分
  - `PR #123`: 指定PRの変更
  - ファイルパスやディレクトリパス: 指定範囲
  - `all`: コードベース全体
- **fix**: `true` で問題を自動修正（デフォルト: `false`、報告のみ）

## 手順

### 1. 対象ファイルの特定

scope に応じて検証対象の `.tsx` / `.jsx` ファイルを収集する。

### 2. 検証項目

各ファイルについて以下をチェックする:

**`'use client'` が不要なのに付いている**
- useState / useEffect / イベントハンドラを使っていないコンポーネント
- データフェッチのみのコンポーネント
- 静的なレイアウトコンポーネント

**`'use client'` が必要なのに付いていない**
- useState / useReducer / useEffect 等のクライアントフックを使用
- onClick / onChange 等のイベントハンドラを使用
- window / document 等のブラウザ API を参照
- クライアント専用ライブラリを import

**境界の設計が粗い**
- 大きなコンポーネントツリー全体に `'use client'` が付いている
- Client Component 部分を小さく切り出せる箇所がある
- Server Component で取得したデータを props で渡せる箇所がある

### 3. 結果報告

問題を検出した場合、ファイルごとに以下を報告する:

- ファイルパスと該当行
- 問題の種類
- 推奨する修正内容

`fix=true` の場合は修正を実施してから報告する。

問題がない場合はその旨を簡潔に報告する。
