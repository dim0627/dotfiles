# dotfiles

macOS 向けの個人用 dotfiles。

## セットアップ

```sh
git clone https://github.com/dim0627/dotfiles.git
cd dotfiles
./bootstrap.sh
```

`bootstrap.sh` が以下を実行する:

1. Homebrew のインストール
2. CLI ツールのインストール（git, tmux, ripgrep, starship, gh, pnpm など）
3. 設定ファイルのシンボリックリンク作成（`.zshrc`, `.tmux.conf`, `.gitconfig` など）
4. Claude Code 設定のシンボリックリンク作成

## 構成

```
.zshrc, .zlogout, .tmux.conf, .gitconfig, .ignore  → ~/
bin/                                                 → ~/bin
claude/                                              → ~/.claude/
```
