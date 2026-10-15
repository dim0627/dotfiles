---
name: offload-codespace
description: 全体の型チェック・ビルドなど、手元で数分かかるコマンドを流すときに使う。作業のあいだ GitHub Codespace を1台用意して使い回し、そこで実行して結果を手元に持ち帰る。DB を使う全体のテストは CI に任せる
---

手元のセッションはそのまま、重いコマンドだけを Codespace で実行する。Codespace は1つの作業（ブランチ）につき1台。最初に要ったときに作り、作業のあいだ使い回し、作業の区切りで消す。

## 手順

### 1. 準備

- `gh auth status` の scopes に `codespace` があるか見る。無ければユーザーに `! gh auth refresh -h github.com -s codespace` を打ってもらう（ブラウザ承認が要るので自分では打てない）
- `gh api repos/<owner>/<repo>/codespaces/machines` で選べるマシンを引く。既定は 8コア/32GB（`premiumLinux`）

完了: scope があり、使うマシン名が決まっている。

### 2. この作業の Codespace を探す

```
gh codespace list -R <owner>/<repo> --json name,displayName,state,lastUsedAt
```

表示名がこの作業のブランチ名のものが、この作業の Codespace。shu のタスクがあれば、ログに残した Codespace 名でも探す。

- 見つかった: 手順5へ。`Shutdown` なら `ssh` でつなぐと起動する（未確認。起動にかかった時間を測り、ここに書き足す）
- 見つからない: 手順3へ

完了: 使う Codespace の名前が決まっているか、新しく作ると決まっている。

### 3. 作成の確認を取る

作成は課金が発生する。次を示してユーザーの明示の GO を待つ:

- マシン（コア数・メモリ）と、そのマシンの1時間あたりの単価（[料金ページ](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces) で確かめる）
- 課金先は作るまで分からないこと（Org の Settings → Codespaces → General の「Codespace ownership」で決まる）
- この作業のあいだ使い回すこと。操作が無ければ30分で止まり、止まったまま24時間たつと自動で消える

完了: この Codespace の作成について GO をもらった。GO が要るのは作るときだけで、使い回しと起動には要らない。

### 4. 作成

```
gh codespace create -R <owner>/<repo> -b <base-branch> -m <machine> \
  -d <branch-name> --idle-timeout 30m --retention-period 24h
gh codespace view -c <name> --json state,billableOwner
```

`-d` は48文字まで。作成直後に `billableOwner` をユーザーに伝え、shu のタスクがあれば Codespace 名をログに残す。

リポジトリに `.devcontainer/` があると、`Available` になった後も `postCreateCommand`（依存のインストール等）が裏で走っている。`/workspaces/.codespaces/.persistedshare/creation.log` に `Finished configuring codespace.` が出るまで待ち、その手前の行で失敗していないかを見る。

完了: `state` が `Available` で、`.devcontainer/` があるなら `postCreateCommand` まで終わっている。課金先を伝えた。

### 5. 手元の状態を送る

実行のたびに、Codespace の作業ツリーを手元の状態に揃え直す。手元にあってリモートに無いものは、push せずにファイルで送る:

```
git bundle create <scratch>/wip.bundle <base-branch>..HEAD   # コミット済みの差分
git diff HEAD > <scratch>/wip.patch                            # 未コミットの差分
gh codespace cp -c <name> -e <scratch>/wip.bundle <scratch>/wip.patch 'remote:/tmp/'
```

Codespace 側:

```
git fetch origin <base-branch>
git fetch /tmp/wip.bundle HEAD && git checkout -f FETCH_HEAD
git clean -fd
git apply /tmp/wip.patch
```

- 先に `origin` を取り込むのは、手元で `<base-branch>` を取り込み直していると、bundle の土台になるコミットが Codespace に無く `fetch` が失敗するため
- `git clean -fd` は前回送った未追跡ファイルを消す。`-x` を付けないので、`node_modules` やビルド結果など ignore されたものは残り、次の実行が速い
- `git diff` は未追跡ファイルを含まないので、必要なら `cp` で別に送る
- `package.json` やロックファイルが前回から変わっていたら、依存を入れ直す（`.devcontainer/` があれば `postCreateCommand` と同じコマンド）

`.env*` や認証情報は送らない。必要ならテンプレート（`.env.template` 等）を Codespace 側でコピーし、中の URL やトークンを空にしてから使う。

完了: Codespace の `git rev-parse HEAD` が手元と一致し、`git diff HEAD --stat` も手元と同じ。

### 6. 実行

- コマンドは必ず `gh codespace ssh -c <name> -- 'bash -lc "cd /workspaces/<repo> && <cmd>"'` で包む。素の `ssh -c` はログインシェルを通らず、git の認証（`GITHUB_TOKEN`）が読み込まれない
- `.devcontainer/` が無いリポジトリでは、作って最初の実行の前に依存をインストールする。Node のバージョンを `.nvmrc` 等と比べ、違えば結果と一緒に報告する（汎用イメージの Node になる）
- DB を使う全体のテストは Codespace で回さず、push して CI に任せる。分割して回す CI に比べ、Codespace 1台では桁違いに遅い（8コアで約30倍だった）。Codespace で回すのは、型チェック・lint・ビルド・数ファイルのテスト・スキーマ適用まで
- 数分を超えるものは `nohup <cmd> > /tmp/x.log 2>&1 < /dev/null &` で投げ、手元では `run_in_background` の until ループで結果ファイルを待つ。Bash ツールは10分で切れる

完了: 各コマンドの終了コード・所要時間・要点のログを手元に持っている。

### 7. 結果を持ち帰る

ログは `ssh` で `cat` して読む。Codespace で変更を作ったときは、向こうで bundle を作り `gh codespace cp -c <name> -e 'remote:/tmp/out.bundle' <scratch>/` で持ち帰って、手元で `git fetch <bundle>` する（この向きの `cp` は未検証。ヘルプ上は両方向に使える）。PR は手元から作る。

完了: 判断に要るログの要点と、Codespace で作った変更があればそのコミットが手元にある。

作業が続くなら、Codespace は消さずに残す。次の重いコマンドは手順2から。

### 8. 作業の区切りで削除

PR を出した、ユーザーがその作業を終えた、Codespace が壊れて作り直す、のどれかで消す:

```
gh codespace delete -c <name> -f
gh codespace list
```

`-f` は未追跡ファイル（コピーしたテンプレート等）があると確認で止まるため。作業が続くか分からないときは残す。止まっていれば計算の課金は無く、`--retention-period` で消える。

完了: `gh codespace list` に残っていない。作成から削除までのおおよその稼働時間 × 単価の概算を報告した。

## 既知の罠

- `ssh -c` の中で `cd X && (...) &` と書くと `cd` ごとバックグラウンドに回り、後続のコマンドがホームディレクトリで動く。バックグラウンドのジョブは独立した行に書く
- `pkill -f <文字列>` は自分の `ssh -c` のシェルにもマッチして接続ごと落ちる
- 汎用イメージには `bc` と GNU `time` が無い。時間は `date +%s.%N` の差を `awk` で計算する
- 汎用イメージでは dockerd が最初から動いていて `docker run` はできるが、docker compose のコンテナどうしの通信が通らなかった（DB に接続するコマンドがタイムアウト）。`mcr.microsoft.com/devcontainers/base` に `ghcr.io/devcontainers/features/docker-in-docker` を足した `.devcontainer/` では通った。汎用イメージにも同じ feature が入っているので、差の原因は分かっていない。`.devcontainer/` の無いリポジトリでは、DB や compose に依存するものは手元で回す
- `mcr.microsoft.com/devcontainers/base` などのイメージには SSH サーバーが無く、`gh codespace ssh` が `failed to start SSH server` で失敗する。`.devcontainer/` に `ghcr.io/devcontainers/features/sshd` が要る
- 手元のハーネスが `gh codespace ssh` に渡すコマンド文字列を拒むときは、実行内容をファイルに書き、`gh codespace ssh -c <name> < script.sh` で標準入力から流す。この形でも nvm の Node には PATH が通っていた。git の認証が読み込まれるかは未確認
- 8コア/32GB でも、大きい monorepo の並列型チェックはメモリのピークが上限近くまで行った。OOM（exit 137）になったら、重いパッケージだけ単一スレッドで回すか、マシンを上げる（上げる前にもう一度確認を取る）
