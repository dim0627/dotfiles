#!/usr/bin/env bash
# SessionStart フック。cs-claude を使うリポジトリでは、セッション開始時に Codespace を裏で起こしておく。
# 作成直後の1回目は準備に4分ほどかかるので、最初の /review-code までに済ませておくため。
# 対象は CLAUDE_CODE_OAUTH_TOKEN シークレットを配っているリポジトリだけ。
set -euo pipefail

WARM_REPOS="AnotherBall/persona-server"

[ "${CODESPACES:-}" = "true" ] && exit 0

cwd="$(jq -r '.cwd // empty')"
origin="$(git -C "${cwd:-.}" remote get-url origin 2>/dev/null || true)"
for repo in $WARM_REPOS; do
	case "$origin" in
	*"$repo"*)
		cd "$cwd"
		nohup "$HOME/bin/cs-claude" --warm </dev/null >"/tmp/cs-claude-warm.log" 2>&1 &
		disown
		;;
	esac
done
exit 0
