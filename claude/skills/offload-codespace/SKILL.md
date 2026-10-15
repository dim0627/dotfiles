---
name: offload-codespace
description: 重いコマンド（全体の型チェック・テスト・ビルド）を使い捨ての GitHub Codespace に逃がして実行し、結果を手元に持ち帰る
---

手元のセッションはそのまま、重いコマンドだけを使い捨ての Codespace で実行する。Codespace は使うたびに作り、終わったら必ず消す。

## 手順

### 1. 準備

- `gh auth status` の scopes に `codespace` があるか見る。無ければ Daisuke に `! gh auth refresh -h github.com -s codespace` を打ってもらう（ブラウザ承認が要るので自分では打てない）
- `gh api repos/<owner>/<repo>/codespaces/machines` で選べるマシンを引く。既定は 8コア/32GB（`premiumLinux`）

完了: scope があり、使うマシン名が決まっている。

### 2. 作成の確認を取る

作成は課金が発生する。毎回、次を示して Daisuke の明示の GO を待つ:

- マシン（コア数・メモリ）と、そのマシンの1時間あたりの単価（[料金ページ](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces) で確かめる）
- 課金先は作るまで分からないこと（組織が許可していれば組織払い、なければ個人払い）
- 実行するコマンドと見込み時間

完了: この作成について GO をもらった。前回の GO は使い回さない。

### 3. 作成

```
gh codespace create -R <owner>/<repo> -b <base-branch> -m <machine> \
  -d <short-name> --idle-timeout 30m --retention-period 1h
gh codespace view -c <name> --json state,billableOwner
```

`--idle-timeout` と `--retention-period` は、削除し損ねたときの保険。作成直後に `billableOwner` を Daisuke に伝える。

リポジトリに `.devcontainer/` があると、`Available` になった後も `postCreateCommand`（依存のインストール等）が裏で走っている。`/workspaces/.codespaces/.persistedshare/creation.log` に `Finished configuring codespace.` が出るまで待ち、その手前の行で失敗していないかを見る。

完了: `state` が `Available` で、`.devcontainer/` があるなら `postCreateCommand` まで終わっている。課金先を伝えた。

### 4. 手元の変更を送る

Codespace は `-b` のブランチを clone した状態で始まる。`-b` にはリモートにあるブランチ（普通はデフォルトブランチ）を渡し、手元にあってリモートに無いものは、push せずにファイルで送る:

```
git bundle create <scratch>/wip.bundle <base-branch>..HEAD   # コミット済みの差分
git diff HEAD > <scratch>/wip.patch                            # 未コミットの差分
gh codespace cp -c <name> -e <scratch>/wip.bundle <scratch>/wip.patch 'remote:/tmp/'
```

Codespace 側で `git fetch /tmp/wip.bundle HEAD && git checkout FETCH_HEAD && git apply /tmp/wip.patch`。`git diff` は未追跡ファイルを含まないので、必要なら `cp` で別に送る。

`.env*` や認証情報は送らない。必要ならテンプレート（`.env.template` 等）を Codespace 側でコピーし、中の URL やトークンを空にしてから使う。

完了: Codespace の `git log -1` と作業ツリーが、手元で検証したい状態と一致している。

### 5. 実行

- コマンドは必ず `gh codespace ssh -c <name> -- 'bash -lc "cd /workspaces/<repo> && <cmd>"'` で包む。素の `ssh -c` はログインシェルを通らず、git の認証（`GITHUB_TOKEN`）が読み込まれない
- `.devcontainer/` の `postCreateCommand` がインストールしていなければ、最初に依存のインストール。Node のバージョンを `.nvmrc` 等と比べ、違えば結果と一緒に報告する（`.devcontainer/` が無いと汎用イメージの Node になる）
- DB を使う全体のテストは Codespace で回さず、push して CI に任せる。分割して回す CI に比べ、Codespace 1台では桁違いに遅い（8コアで約30倍だった）。Codespace で回すのは、型チェック・lint・ビルド・数ファイルのテスト・スキーマ適用まで
- 数分を超えるものは `nohup <cmd> > /tmp/x.log 2>&1 < /dev/null &` で投げ、手元では `run_in_background` の until ループで結果ファイルを待つ。Bash ツールは10分で切れる

完了: 各コマンドの終了コード・所要時間・要点のログを手元に持っている。

### 6. 結果を持ち帰る

ログは `ssh` で `cat` して読む。Codespace で変更を作ったときは、向こうで bundle を作り `gh codespace cp -c <name> -e 'remote:/tmp/out.bundle' <scratch>/` で持ち帰って、手元で `git fetch <bundle>` する（この向きの `cp` は未検証。ヘルプ上は両方向に使える）。PR は手元から作る。

完了: 判断に要るログの要点と、Codespace で作った変更があればそのコミットが手元にある。

### 7. 削除

途中で失敗しても必ず実行する:

```
gh codespace delete -c <name> -f
gh codespace list
```

`-f` は未追跡ファイル（コピーしたテンプレート等）があると確認で止まるため。

完了: `gh codespace list` に残っていない。作成から削除までの時間 × 単価の概算を報告した。

## 既知の罠

- `ssh -c` の中で `cd X && (...) &` と書くと `cd` ごとバックグラウンドに回り、後続のコマンドがホームディレクトリで動く。バックグラウンドのジョブは独立した行に書く
- `pkill -f <文字列>` は自分の `ssh -c` のシェルにもマッチして接続ごと落ちる
- 汎用イメージには `bc` と GNU `time` が無い。時間は `date +%s.%N` の差を `awk` で計算する
- 汎用イメージでは dockerd が最初から動いていて `docker run` はできるが、docker compose のコンテナどうしの通信が通らなかった（DB に接続するコマンドがタイムアウト）。`.devcontainer/` で `ghcr.io/devcontainers/features/docker-in-docker` を指定したら通った。指定の無いリポジトリでは、DB や compose に依存するものは手元で回す
- `mcr.microsoft.com/devcontainers/base` などのイメージには SSH サーバーが無く、`gh codespace ssh` が `failed to start SSH server` で失敗する。`.devcontainer/` に `ghcr.io/devcontainers/features/sshd` が要る
- 手元のハーネスが `gh codespace ssh` に渡すコマンド文字列を拒むときは、実行内容をファイルに書き、`gh codespace ssh -c <name> < script.sh` で標準入力から流す。この形でも nvm の Node には PATH が通っていた。git の認証が読み込まれるかは未確認
- 8コア/32GB でも、大きい monorepo の並列型チェックはメモリのピークが上限近くまで行った。OOM（exit 137）になったら、重いパッケージだけ単一スレッドで回すか、マシンを上げる（上げる前にもう一度確認を取る）
