# ステータス変更の叩き方

**ユーザーの明示的な承認を得てから読む。** 承認前にこのファイルの内容を実行することはない。

```
update_issue(
  organizationSlug=<org>,
  issueId=<ISSUE-ID>,
  status='ignored',
  ignoreMode='untilEscalating',
  reason='<なぜノイズと判断したかの一文>'
)
```

- ノイズの ignore は `ignoreMode='untilEscalating'`（既定）にする。急増したら再浮上するので、`forever` より誤判定に強い
- `reason` は必ず入れる。Sentry の activity feed に残り、後から判断を検証できる
- 修正コミットで閉じる場合は、コミットメッセージに `Fixes <ISSUE-ID>` を書いて Sentry 側に閉じさせる

**完了条件**: 承認された issue だけが変更され、変更した issue ID と理由を報告に列挙していること。
