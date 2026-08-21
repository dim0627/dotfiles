# 信頼度ルーブリック

採点者サブエージェントには、下の英文を**逐語で**渡す。要約・翻訳・言い換えをしない。原典が「give this rubric to the agent verbatim」と指定しているスケールで、刻みの文言そのものが基準になっている。

読み替えは1点だけ。原典は GitHub の Pull Request を対象に書かれている。**"the PR" はレビュー対象の変更（作業ツリーの差分、またはブランチの差分）と読む。**

## スケール（逐語）

> Score each issue on a scale from 0-100, indicating your level of confidence. For issues that were flagged due to CLAUDE.md instructions, double check that the CLAUDE.md actually calls out that issue specifically. The scale is:
>
> a. 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
> b. 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant CLAUDE.md.
> c. 50: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the PR, it's not very important.
> d. 75: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach in the PR is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant CLAUDE.md.
> e. 100: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.

## このスケールの使いどころ

**確度は「出すかどうか」ではなく「どの札を付けるか」だけを決める。** 出すかどうかは SKILL.md の3つの足切り（事実判定が誤り / 対応が書けない / 差分が作った問題でない）で決める。

このスケールは刻みの文言の中に**重要度を混ぜている**点に注意する。50 は「本物だと確認できた**が** nitpick かもしれず、この変更の中では重要でない」と定義されているので、**検証済みで正しいが軽い指摘は構造上 50 を超えられない**。ここに 80 の一律カットを当てると、「このコメントは言い過ぎだから緩める」「既存ヘルパと重複している」のような、正しくて直すのが一瞬の指摘が必ず全滅する。だから採点者には確度と別に**事実判定**（重要度を考慮しない真偽）を出させ、足切りにはそちらを使う。

50 未満は札に関係なく出さない。裏が取り切れていないものを混ぜると、正しい指摘まで巻き添えで読まれなくなる。

## 出典

Anthropic 公式プラグイン `code-review`（`claude-plugins-official` マーケットプレイス）の `commands/code-review.md` ステップ5より。

Copyright Anthropic, PBC. Licensed under the Apache License, Version 2.0.
<http://www.apache.org/licenses/LICENSE-2.0>

原典の入手元: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/code-review/`
