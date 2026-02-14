# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

macOS向けのdotfilesリポジトリ。`bootstrap.sh` でHomebrewのインストール、各種ツールのセットアップ、シンボリックリンクの作成を行う。

## Structure

- `bootstrap.sh` — セットアップスクリプト。brew installとシンボリックリンク作成を実行
- `.zshrc`, `.tmux.conf`, `.gitconfig` — ホームディレクトリにシンボリックリンクされる設定ファイル
- `claude/` — `~/.claude/` にシンボリックリンクされるClaude Code設定（CLAUDE.md, settings.json）
- `bin/` — `~/bin` にシンボリックリンクされるユーティリティスクリプト

## Conventions

- シンボリックリンクは `bootstrap.sh` で一元管理する

## Language

ユーザーには日本語で応答してください。
