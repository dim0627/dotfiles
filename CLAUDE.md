# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

macOS向けのdotfilesリポジトリ。`bootstrap.sh` でHomebrewのインストール、各種ツールのセットアップ、シンボリックリンクの作成を行う。just導入済みの環境では `justfile` からも同様の操作が可能。

## Structure

- `bootstrap.sh` — 初回セットアップスクリプト。just未インストール環境で使用
- `justfile` — タスクランナー。`just setup` で全セットアップ、`just brew` / `just link` で個別実行
- `Brewfile` — Homebrewでインストールするパッケージ一覧
- `.zshrc`, `.tmux.conf`, `.gitconfig` — ホームディレクトリにシンボリックリンクされる設定ファイル
- `claude/` — `~/.claude/` にシンボリックリンクされるClaude Code設定（CLAUDE.md, settings.json）
- `bin/` — `~/bin` にシンボリックリンクされるユーティリティスクリプト

## Conventions

- シンボリックリンクは `bootstrap.sh` および `justfile` の `link` レシピで一元管理する

## Language

ユーザーには日本語で応答してください。
