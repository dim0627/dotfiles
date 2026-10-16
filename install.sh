#!/usr/bin/env bash
# GitHub Codespaces の dotfiles 機能が新しい Codespace ごとに実行する。
# install.sh があると Codespaces は .gitconfig などの自動リンクをしなくなる（Mac 用の設定を持ち込まないため）。
# settings.json は Mac 前提のフックを含むのでリンクしない。認証は Codespaces のユーザーシークレット CLAUDE_CODE_OAUTH_TOKEN。
set -euo pipefail

if [ "${CODESPACES:-}" != "true" ]; then
	echo "install.sh is for GitHub Codespaces only. On a Mac, use make link." >&2
	exit 0
fi

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v claude >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/claude" ]; then
	curl -fsSL https://claude.ai/install.sh | bash
fi

mkdir -p "$HOME/.claude/skills" "$HOME/.claude/agents"
ln -sf "$DOTFILES_DIR/claude/CLAUDE.md" "$HOME/.claude/CLAUDE.md"
for skill_dir in "$DOTFILES_DIR"/claude/skills/*/; do
	ln -snf "$skill_dir" "$HOME/.claude/skills/$(basename "$skill_dir")"
done
for agent_file in "$DOTFILES_DIR"/claude/agents/*.md; do
	ln -snf "$agent_file" "$HOME/.claude/agents/$(basename "$agent_file")"
done
