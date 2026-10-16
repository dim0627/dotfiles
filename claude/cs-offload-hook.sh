#!/usr/bin/env bash
# PreToolUse(Skill) フック。サブエージェントを大量に立てるスキルを、手元でなく Codespace で動かさせる（bin/cs-claude）。
# 対象は MCP・手元の認証・ローカル DB を使わないスキルだけ。Codespace にはそれらが無い。
# cs-claude が失敗したときは /tmp/cs-offload-fallback-<skill> を置けば、15分以内の1回だけ手元で通す。
set -euo pipefail

OFFLOAD_SKILLS="review-code"

input="$(cat)"
skill="$(jq -r '.tool_input.skill // empty' <<<"$input")"
skill="${skill#*:}"

if [ "${CODESPACES:-}" = "true" ] || [ -z "$skill" ] || ! grep -qw -- "$skill" <<<"$OFFLOAD_SKILLS"; then
	exit 0
fi

fallback="/tmp/cs-offload-fallback-$skill"
if [ -n "$(find "$fallback" -mmin -15 2>/dev/null)" ]; then
	rm -f "$fallback"
	exit 0
fi

args="$(jq -r '.tool_input.args // empty' <<<"$input")"
reason="The ${skill} skill runs in a Codespace, not on this Mac. Instead of the Skill tool, run this with Bash (run_in_background: true; it can take 3-15 minutes):
  ~/bin/cs-claude '/${skill} ${args}'
The remote session sees this working tree (commits, uncommitted changes, untracked files) but has no MCP servers, no local credentials and no conversation context. Put every input the skill needs into the prompt as text, such as the review target and any spec or ticket body you already fetched.
Relay its stdout as the skill's result.
If cs-claude fails, run: touch ${fallback}
then call the Skill tool again to run it locally once."

jq -n --arg r "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
