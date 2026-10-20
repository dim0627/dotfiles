#!/usr/bin/env bash
# Stop フック。ターン終わりの音。/loop-* の tick で始まったターンは黙る（10分おきに鳴るとうるさい。新しい仕事はループが herdr のトーストで鳴らす）。
# herdr はターンを見分けられないので、herdr 側の Claude の音は切って、ここに一本化している。
set -uo pipefail

transcript="$(jq -r '.transcript_path // empty')"

# ターンを始めた入力は本文が文字列のユーザー行（ツール結果は配列）。transcript は数 MB になるので末尾だけ読み、見つからなければ鳴らす。
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
	prompt="$(tail -n 2000 "$transcript" |
		jq -rs 'map(select(.type == "user" and (.message.content | type) == "string")) | last | .message.content // empty' 2>/dev/null)"
	if [[ "$prompt" == *"<command-name>/loop-"* && "$prompt" == *"<command-args>tick</command-args>"* ]]; then
		exit 0
	fi
fi

afplay /System/Library/Sounds/Purr.aiff
