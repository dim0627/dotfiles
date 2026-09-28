#!/bin/sh
# gcloud CLI のユーザー認証が生きているかを判定し、結果をキャッシュに書く。
#
# 判定材料は `gcloud auth print-access-token` の終了コードのみ。ADC
# (application_default_credentials.json) は別系統で、こちらは対象外。
#
# access token は約1時間ローカルにキャッシュされるため、refresh token が
# 失効していてもキャッシュが生きている間は成功が返る（最大1時間は見逃す）。
# 裏を返すと、朝イチのセッション開始時は前日のキャッシュが確実に期限切れで
# refresh が走るので、そこで失効が表に出る。SessionStart から呼ぶのが最も
# 検知精度が高いのはこの非対称性による。
#
# --hook を付けると、失効時のみ SessionStart 用の additionalContext JSON を
# stdout に出す（正常時は無出力）。

set -u

cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/claude"
cache_file="$cache_dir/gcloud-auth-status"
log_file="$cache_dir/gcloud-auth-failures.log"

mkdir -p "$cache_dir"

if err=$(gcloud auth print-access-token 2>&1 >/dev/null); then
	state="ok"
else
	state="expired"
	# 失効時の stderr を残す。invalid_grant なのか再認証要求なのかで、
	# 組織のセッションポリシー側で直せる話かどうかの判断が変わる。
	{
		printf '=== %s ===\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
		printf '%s\n' "$err"
	} >>"$log_file"
fi

# statusline が読んでいる最中に中途半端な内容を見せないよう、mv で差し替える。
tmp_file="$cache_file.$$"
printf '%s %s\n' "$state" "$(date +%s)" >"$tmp_file" && mv -f "$tmp_file" "$cache_file"

# ユーザーはセッション開始直後に再ログインすることが多く、この通知は数秒で古くなる。
# 開始時点のスナップショットだと明示し、伝える直前に再判定させる。
if [ "${1:-}" = "--hook" ] && [ "$state" = "expired" ]; then
	account=$(gcloud config get-value account 2>/dev/null)
	printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"セッション開始時点の判定では gcloud CLI の認証が切れていた（アカウント: %s）。ユーザーはこの直後に再ログインすることが多いので、この判定をそのまま伝えないこと。gcloud / bq などを使う作業に入るときだけ、直前に sh $HOME/.claude/gcloud-auth-check.sh を実行し、$HOME/.cache/claude/gcloud-auth-status の先頭が expired のままならユーザー本人による gcloud auth login での再認証を提示する。再認証コマンドは代理実行しない。gcloud を使わない作業では話題にしない。"}}\n' "${account:-unknown}"
fi
