#!/usr/bin/env bash
# Stop フック。ターン終わりの音。/loop-* の tick で始まったターンは黙る（10分おきに鳴るとうるさい。新しい仕事はループが herdr のトーストで鳴らす）。
# herdr はターンを見分けられないので、herdr 側の Claude の音は切って、ここに一本化している。
set -uo pipefail # -e なし: jq が落ちても音は鳴らす

transcript="$(jq -r '.transcript_path // empty')"

# ターンの始まりは turnOrigin の付いた user 行（画像付きは本文が配列）。tick の途中で人が打った発言は queued_command として後から入る。
# transcript は数 MB になるので末尾だけ読む。取りこぼすなら鳴る側に倒す。
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
	last="$(tail -n 2000 "$transcript" | jq -rs '
		map(select((.type == "user" and .turnOrigin != null)
			or (.type == "attachment" and .attachment.type == "queued_command" and .attachment.origin.kind == "human")))
		| last
		| if . != null and .type == "user" and .turnOrigin == "scheduled" then (.message.content | tostring) else empty end' 2>/dev/null)"
	if [[ "$last" == *"/loop-"* && "$last" == *"tick"* ]]; then
		exit 0
	fi
fi

afplay /System/Library/Sounds/Purr.aiff
