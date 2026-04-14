SCRIPT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
HOME_DIR := $(HOME)

.PHONY: all brew link link-dotfiles link-claude

all: brew link

brew:
	/bin/bash -c "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	brew update
	brew bundle --file=$(SCRIPT_DIR)Brewfile

link: link-dotfiles link-claude

link-dotfiles:
	ln -sf $(SCRIPT_DIR).zshrc $(HOME_DIR)/.zshrc
	ln -sf $(SCRIPT_DIR).zlogout $(HOME_DIR)/.zlogout
	ln -sf $(SCRIPT_DIR).tmux.conf $(HOME_DIR)/.tmux.conf
	ln -sf $(SCRIPT_DIR).gitconfig $(HOME_DIR)/.gitconfig
	ln -sf $(SCRIPT_DIR).ignore $(HOME_DIR)/.ignore
	ln -sf $(SCRIPT_DIR)bin $(HOME_DIR)/bin

link-claude:
	mkdir -p $(HOME_DIR)/.claude
	ln -sf $(SCRIPT_DIR)claude/CLAUDE.md $(HOME_DIR)/.claude/CLAUDE.md
	ln -sf $(SCRIPT_DIR)claude/settings.json $(HOME_DIR)/.claude/settings.json
	ln -sf $(SCRIPT_DIR)claude/statusline-command.sh $(HOME_DIR)/.claude/statusline-command.sh
	@for skill_dir in $(SCRIPT_DIR)claude/skills/*/; do \
		skill_name=$$(basename "$$skill_dir"); \
		ln -snf "$$skill_dir" "$(HOME_DIR)/.claude/skills/$$skill_name"; \
	done
