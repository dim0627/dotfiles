#!/usr/bin/env bash
# PreToolUse(Skill) フック。args に --cs が付いたスキル呼び出しを、手元でなく Codespace で動かさせる（bin/cs-claude）。
# 手元の負荷はユーザーにしか分からないので、付けるかどうかはユーザーが決める。付かなければ手元で通す。
# 対象は MCP・手元の認証・ローカル DB を使わないスキルだけ。Codespace にはそれらが無い。
set -euo pipefail

OFFLOAD_SKILLS="review-code"

input="$(cat)"
skill="$(jq -r '.tool_input.skill // empty' <<<"$input")"
skill="${skill#*:}"
args="$(jq -r '.tool_input.args // empty' <<<"$input")"

if [ "${CODESPACES:-}" = "true" ] || [ -z "$skill" ] || ! grep -qw -- "$skill" <<<"$OFFLOAD_SKILLS"; then
	exit 0
fi
if ! grep -qE '(^|[[:space:]])--cs([[:space:]]|$)' <<<"$args"; then
	exit 0
fi

args="$(sed -E 's/(^|[[:space:]])--cs([[:space:]]|$)/ /g; s/^ +| +$//g' <<<"$args")"
reason="The user asked to run ${skill} in a Codespace, not on this Mac. Instead of the Skill tool, run this with Bash (run_in_background: true; it can take 3-15 minutes):
  ~/bin/cs-claude '/${skill} ${args}'
The remote session sees this working tree (commits, uncommitted changes, untracked files) but has no MCP servers, no local credentials and no conversation context. Put every input the skill needs into the prompt as text, such as the review target and any spec or ticket body you already fetched.
Relay its stdout as the skill's result.
If cs-claude fails, tell the user, and call the Skill tool again without --cs only if they want it run locally."

jq -n --arg r "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
