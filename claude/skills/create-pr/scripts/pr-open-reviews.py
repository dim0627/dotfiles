#!/usr/bin/env python3
"""List the review feedback on a PR that the PR author has not handled yet.

Usage: pr-open-reviews.py [PR] [-R owner/repo] [--wait]

Open feedback:
- an unresolved review thread that the PR author has not replied to
- a comment from a person (not a bot, not the author) on the PR itself with no
  author comment after it
- a bot's latest summary that reports findings (ask/IMO/nits counts, or
  "N findings") when that bot has fewer answered inline threads than findings,
  so some findings live only in the summary, and the author has not commented
  after it

--wait first waits (up to 10 minutes) for every check whose name contains
"review" to finish, because the review bot comments a minute or two after the PR
is created. A repo without such a check is not waited on.

Exit status: 0 = nothing open, 1 = something open (listed on stdout), 2 = lookup failed.
"""
import argparse
import json
import re
import subprocess
import sys
import time

QUERY = """
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      author { login }
      comments(first: 100) { nodes { author { login __typename } body createdAt } }
      reviews(first: 100) { nodes { author { login __typename } body submittedAt state } }
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

WAIT_LIMIT_SECONDS = 600
POLL_SECONDS = 20


def gh(args):
    return subprocess.run(["gh", *args], capture_output=True, text=True, timeout=60, check=True).stdout


def is_bot(actor):
    # GraphQL drops the "[bot]" suffix from app logins, so go by the actor type.
    return not actor or actor.get("__typename") == "Bot"


def finding_count(body):
    m = re.search(r"ask:?\s*(\d+)\D+IMO:?\s*(\d+)\D+nits:?\s*(\d+)", body, re.IGNORECASE)
    if not m:
        m = re.search(r"\(\s*(\d+)\s*ask,\s*(\d+)\s*IMO,\s*(\d+)\s*nits", body, re.IGNORECASE)
    if m:
        return sum(int(g) for g in m.groups())
    m = re.search(r"\b(\d+)\s+findings?\b", body, re.IGNORECASE)
    return int(m.group(1)) if m else None


def short(body):
    return " ".join((body or "").split())[:120]


def wait_for_review_checks(view_args):
    started = time.time()
    deadline = started + WAIT_LIMIT_SECONDS
    while True:
        out = subprocess.run(
            ["gh", "pr", "checks", *view_args, "--json", "name,state"], capture_output=True, text=True, timeout=60
        )
        checks = json.loads(out.stdout or "[]")
        review = [c for c in checks if "review" in c["name"].lower()]
        pending = [c["name"] for c in review if c["state"] in ("PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED")]
        # Checks take a moment to register on a new PR, so "none" is only trusted after a minute.
        if not review and time.time() > started + 60:
            return "no review check on this PR"
        if review and not pending:
            return "review checks finished: " + ", ".join(c["name"] for c in review)
        if time.time() > deadline:
            return "gave up waiting for: " + ", ".join(pending or ["a review check to start"])
        time.sleep(POLL_SECONDS)


def open_items(view_args):
    info = json.loads(gh(["pr", "view", *view_args, "--json", "url"]))
    m = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", info["url"])
    owner, name, number = m.group(1), m.group(2), int(m.group(3))
    data = json.loads(
        gh(["api", "graphql", "-f", f"query={QUERY}", "-F", f"owner={owner}", "-F", f"repo={name}", "-F", f"number={number}"])
    )
    pull = data["data"]["repository"]["pullRequest"]
    author = (pull.get("author") or {}).get("login")
    items = []

    answered_threads_by = {}
    for t in pull["reviewThreads"]["nodes"]:
        comments = t["comments"]["nodes"]
        logins = [(c.get("author") or {}).get("login") for c in comments]
        opener = logins[0] if logins else None
        answered = t["isResolved"] or author in logins
        if answered:
            answered_threads_by[opener] = answered_threads_by.get(opener, 0) + 1
            continue
        items.append(f"inline {t['path']}:{t['line']} ({opener}) {short(comments[0]['body'] if comments else '')}")

    conversation = [
        {"login": (c.get("author") or {}).get("login"), "bot": is_bot(c.get("author")), "body": c.get("body") or "", "at": c.get("createdAt") or ""}
        for c in pull["comments"]["nodes"]
    ] + [
        {"login": (r.get("author") or {}).get("login"), "bot": is_bot(r.get("author")), "body": r.get("body") or "", "at": r.get("submittedAt") or ""}
        for r in pull["reviews"]["nodes"]
        # An approval's body ("LGTM") asks for nothing.
        if r.get("state") != "APPROVED"
    ]
    conversation.sort(key=lambda c: c["at"])
    author_times = [c["at"] for c in conversation if c["login"] == author]

    latest_bot_summary = {}
    for c in conversation:
        if c["login"] == author or not c["body"].strip():
            continue
        if c["bot"]:
            count = finding_count(c["body"])
            if count is not None:
                latest_bot_summary[c["login"]] = (count, c)
            continue
        if not any(t > c["at"] for t in author_times):
            items.append(f"comment ({c['login']}) {short(c['body'])}")

    for login, (count, c) in latest_bot_summary.items():
        replied = any(t > c["at"] for t in author_times)
        if count > answered_threads_by.get(login, 0) and not replied:
            items.append(
                f"bot summary ({login}) reports {count} finding(s), "
                f"{answered_threads_by.get(login, 0)} answered inline: {short(c['body'])}"
            )
    return info["url"], items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pr", nargs="?")
    parser.add_argument("-R", "--repo")
    parser.add_argument("--wait", action="store_true")
    args = parser.parse_args()
    view_args = [*([args.pr] if args.pr else []), *(["-R", args.repo] if args.repo else [])]
    try:
        if args.wait:
            print(wait_for_review_checks(view_args))
        url, items = open_items(view_args)
    except Exception as e:  # noqa: BLE001 - report any lookup failure as exit 2
        print(f"lookup failed: {e}", file=sys.stderr)
        sys.exit(2)
    if not items:
        print(f"{url}: no open review feedback")
        return
    print(f"{url}: {len(items)} open")
    for item in items:
        print(f"  - {item}")
    sys.exit(1)


if __name__ == "__main__":
    main()
