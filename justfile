set dotenv-load := false

SCRIPT_DIR := justfile_directory()

# デフォルト: レシピ一覧を表示
default:
    @just --list

# 全セットアップを実行
setup: brew link

# Homebrewのインストールとパッケージのセットアップ
brew:
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    brew update
    brew bundle --file={{SCRIPT_DIR}}/Brewfile

# シンボリックリンクの作成
link:
    ln -sf {{SCRIPT_DIR}}/.zshrc $HOME/.zshrc
    ln -sf {{SCRIPT_DIR}}/.zlogout $HOME/.zlogout
    ln -sf {{SCRIPT_DIR}}/.tmux.conf $HOME/.tmux.conf
    ln -sf {{SCRIPT_DIR}}/.gitconfig $HOME/.gitconfig
    ln -sf {{SCRIPT_DIR}}/.ignore $HOME/.ignore
    ln -snf {{SCRIPT_DIR}}/bin $HOME/bin
    mkdir -p $HOME/.claude
    ln -sf {{SCRIPT_DIR}}/claude/CLAUDE.md $HOME/.claude/CLAUDE.md
    ln -sf {{SCRIPT_DIR}}/claude/settings.json $HOME/.claude/settings.json
    mkdir -p $HOME/.claude/skills
    ln -snf {{SCRIPT_DIR}}/claude/skills/sync $HOME/.claude/skills/sync
