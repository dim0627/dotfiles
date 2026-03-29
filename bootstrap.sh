#!/bin/sh

SCRIPT_DIR=$(cd $(dirname $0); pwd)

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew update
brew bundle --file=$SCRIPT_DIR/Brewfile

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
ln -snf $SCRIPT_DIR/claude/skills $HOME/.claude/skills
