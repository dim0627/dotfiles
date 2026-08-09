# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

macOS向けのdotfilesリポジトリ。`Makefile` でHomebrewのインストール、各種ツールのセットアップ、シンボリックリンクの作成を行う。

## Structure

- `Makefile` — セットアップ。`make` で全実行、`make link-claude` 等で部分実行可能
- `.zshrc`, `.tmux.conf`, `.gitconfig` — ホームディレクトリにシンボリックリンクされる設定ファイル
- `claude/` — `~/.claude/` にシンボリックリンクされるClaude Code設定（CLAUDE.md, settings.json）
- `agents/skill-lock.json` — `~/.agents/.skill-lock.json` にリンク。`npx skills` で入れた外部スキルの出所リスト。新環境では `make link-agents` 後に `npx skills update` で復元
- `bin/` — `~/bin` にシンボリックリンクされるユーティリティスクリプト

## Conventions

- シンボリックリンクは `Makefile` で一元管理する

## Language

ユーザーには日本語で応答してください。
