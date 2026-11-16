#!/usr/bin/env python3
# PreToolUse(Bash) フック。`gh pr ready` の前に、PR 作者が返信も解決もしていないレビュースレッドが残っていたら止める。
# ボットのインライン指摘を要約だけ読んで返信せずに ready にした件の再発防止。
# スレッドを取れなかったときは止めずに人に聞く（ask）。`gh pr ready --undo` は対象外。
import json
import re
import shlex
import subprocess
import sys

QUERY = """
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      author { login }
      reviewThreads(first: 100) {
        nodes {
          isResolved
          path
          line
          comments(first: 50) { nodes { author { login } body } }
        }
      }
    }
  }
}
"""


def ready_targets(command: str):
    """Yield (pr_arg or None, repo or None) for each `gh pr ready` in the command."""
    for segment in re.split(r"&&|\|\||;|\n|\|", command):
        try:
            words = shlex.split(segment)
        except ValueError:
            words = segment.split()
        for i in range(len(words) - 2):
            if words[i : i + 3] != ["gh", "pr", "ready"]:
                continue
            rest = words[i + 3 :]
            if "--undo" in rest:
                break
            pr, repo, j = None, None, 0
            while j < len(rest):
                w = rest[j]
                if w in ("-R", "--repo") and j + 1 < len(rest):
                    repo = rest[j + 1]
                    j += 2
                    continue
                if w.startswith("--repo="):
                    repo = w.split("=", 1)[1]
                elif not w.startswith("-") and pr is None:
                    pr = w
                j += 1
            yield pr, repo
            break


def gh(args):
    return subprocess.run(["gh", *args], capture_output=True, text=True, timeout=30, check=True).stdout


def unanswered_threads(pr, repo):
    view = ["pr", "view", *([pr] if pr else []), *(["-R", repo] if repo else []), "--json", "number,url"]
    info = json.loads(gh(view))
    m = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", info["url"])
    owner, name, number = m.group(1), m.group(2), int(m.group(3))
    data = json.loads(
        gh(["api", "graphql", "-f", f"query={QUERY}", "-F", f"owner={owner}", "-F", f"repo={name}", "-F", f"number={number}"])
    )
    pull = data["data"]["repository"]["pullRequest"]
    author = (pull.get("author") or {}).get("login")
    open_threads = []
    for t in pull["reviewThreads"]["nodes"]:
        if t["isResolved"]:
            continue
        logins = [(c.get("author") or {}).get("login") for c in t["comments"]["nodes"]]
        if author in logins:
            continue
        first = t["comments"]["nodes"][0] if t["comments"]["nodes"] else {}
        summary = " ".join((first.get("body") or "").split())[:120]
        open_threads.append(f"{t['path']}:{t['line']} ({logins[0] if logins else '?'}) {summary}")
    return info["url"], open_threads


def decide(decision, reason):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": decision, "permissionDecisionReason": reason}}))


def main():
    payload = json.load(sys.stdin)
    command = (payload.get("tool_input") or {}).get("command") or ""
    if "gh" not in command or "ready" not in command:
        return
    blocked, errors = [], []
    for pr, repo in ready_targets(command):
        try:
            url, threads = unanswered_threads(pr, repo)
        except Exception as e:  # noqa: BLE001 - any lookup failure falls back to asking the user
            errors.append(f"{pr or '(current branch)'}: {e}")
            continue
        if threads:
            blocked.append(url + "\n" + "\n".join(f"  - {t}" for t in threads))
    if blocked:
        decide(
            "deny",
            "These PRs have review threads that are neither resolved nor answered by the PR author. "
            "Read every thread, fix or reply to each one, then run `gh pr ready` again.\n" + "\n".join(blocked),
        )
    elif errors:
        decide("ask", "Could not check review threads before `gh pr ready`:\n" + "\n".join(errors))


if __name__ == "__main__":
    main()
