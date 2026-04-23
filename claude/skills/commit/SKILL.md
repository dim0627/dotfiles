---
name: commit
description: 変更をステージングしてコミットする
user-invocable: true
allowed-tools: Bash(git add *), Bash(git commit *), Bash(git status *)
---

変更内容を確認し、適切なコミットメッセージでコミットする。

## 現在の状態

- **変更ファイル一覧**:
!`git status`

- **未ステージの差分**:
!`git diff`

- **ステージ済みの差分**:
!`git diff --staged`

- **直近のコミット履歴**:
!`git log --oneline -10`

## 手順

### 1. 変更がない場合

変更がなければその旨を報告して終了。

### 2. コミットメッセージの作成

- 上記の差分を分析し、簡潔なコミットメッセージを作成する
- リポジトリの既存コミットメッセージのスタイルに合わせる
- 「何を変えたか」ではなく「なぜ変えたか」にフォーカスする
- `.env` やクレデンシャル系ファイルが含まれていたら警告して除外する

### 3. ステージングとコミット

**重要**: 以下の各コマンドは `&&` や `;` で連結せず、**それぞれ別々の Bash ツール呼び出しで実行する**。複合コマンドは allowed-tools のパターンにマッチせずパーミッションプロンプトが出るため。

1. 関連ファイルを `git add` でステージング（`git add -A` は使わず、ファイル名を明示する）
2. コミットメッセージは HEREDOC 形式で渡す:
   ```bash
   git commit -m "$(cat <<'EOF'
   コミットメッセージ

   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```
3. `git status` で結果を確認

### 4. 結果報告

コミット結果を簡潔に報告する。
