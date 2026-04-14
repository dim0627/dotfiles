# dotfiles

macOS 向けの個人用 dotfiles。

## セットアップ

```sh
git clone https://github.com/dim0627/dotfiles.git
cd dotfiles
make
```

個別実行も可能:

```sh
make brew          # Homebrew インストール + brew bundle
make link          # シンボリックリンク全部
make link-dotfiles # dotfiles のリンクだけ
make link-claude   # Claude Code 設定のリンクだけ
```

## 構成

```
.zshrc, .zlogout, .tmux.conf, .gitconfig, .ignore  → ~/
bin/                                                 → ~/bin
claude/                                              → ~/.claude/
```
