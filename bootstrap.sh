#!/bin/sh

SCRIPT_DIR=$(cd $(dirname $0); pwd)

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew update

brew install wget
brew install git
brew install tree
brew install ripgrep
brew install jq
brew install peco
brew install tmux
brew install fd
brew install reattach-to-user-namespace
brew install ghq
brew install nodenv
brew install starship
brew install gh
brew install pnpm
brew install zsh-autosuggestions
brew install zsh-syntax-highlighting

ln -s $SCRIPT_DIR/.zshrc $HOME/.zshrc
ln -s $SCRIPT_DIR/.zlogout $HOME/.zlogout
ln -s $SCRIPT_DIR/.tmux.conf $HOME/.tmux.conf
ln -s $SCRIPT_DIR/.gitconfig $HOME/.gitconfig
ln -s $SCRIPT_DIR/.ignore $HOME/.ignore
ln -s $SCRIPT_DIR/bin $HOME/bin

# Claude Code 設定
mkdir -p $HOME/.claude
ln -sf $SCRIPT_DIR/claude/CLAUDE.md $HOME/.claude/CLAUDE.md
ln -sf $SCRIPT_DIR/claude/settings.json $HOME/.claude/settings.json
mkdir -p $HOME/.claude/skills
ln -snf $SCRIPT_DIR/claude/skills/sync $HOME/.claude/skills/sync
