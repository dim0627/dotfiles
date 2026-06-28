#!/bin/sh
input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
model=$(echo "$input" | jq -r '.model.display_name // ""')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
worktree=$(echo "$input" | jq -r '.workspace.git_worktree // empty')

# Git branch (skip optional locks)
branch=""
if [ -d "$cwd/.git" ] || git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  branch=$(git -C "$cwd" -c core.useBuiltinFSMonitor=false symbolic-ref --short HEAD 2>/dev/null || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
fi

# Directory: basename of cwd
dir=$(basename "$cwd")

# Build status line
line=""

# dir + branch
if [ -n "$branch" ]; then
  line=$(printf "\033[34m%s\033[0m \033[32m(%s)\033[0m" "$dir" "$branch")
else
  line=$(printf "\033[34m%s\033[0m" "$dir")
fi

# worktree indicator
if [ -n "$worktree" ]; then
  line="$line $(printf "\033[33m🌳%s\033[0m" "$worktree")"
fi

# model
if [ -n "$model" ]; then
  line="$line $(printf "\033[35m%s\033[0m" "$model")"
fi

# context usage（絶対トークン基準。1M/200k どちらのウィンドウでも
# 作話バグの「枯渇型」発火帯（OP報告: 100k〜170k）で確実に色が変わるよう実トークン数で判定する。
#
# 注意：このトークン基準が捉えるのは作話バグの「コンテキスト枯渇型」変種のみ。
# issue #67606 の追調査で「コンテンツ誘発型」変種が報告された——LLMプロンプト文字列と
# XMLラッパー風語彙（</content>, </file> 等）が混在したファイルを Read した直後に、
# トークンがまだ少ない（~40k相当）段階でも発火しうる。Statusline はセッションのメタ情報しか
# 受け取れず「何を読んだか」は見えないため、コンテンツ誘発型は原理的に検知できない。
# よって下のシアンは「バグ非発火の保証」ではなく、あくまで「枯渇型の圧が低い」状態を指す。
tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
if [ -n "$tokens" ]; then
  k=$((tokens / 1000))
  if [ "$tokens" -ge 100000 ]; then
    color="\033[31m"   # 赤：枯渇型の発火帯（OP報告 100k〜）に到達、/clear 推奨
  elif [ "$tokens" -ge 70000 ]; then
    color="\033[33m"   # 黄：警戒、そろそろ畳む準備
  else
    color="\033[36m"   # シアン：コンテキスト圧が低い（※コンテンツ誘発型は別物・これでは検知不可）
  fi
  if [ -n "$used" ]; then
    pct=$(printf "%.0f" "$used")
    line="$line $(printf "${color}ctx:%sk(%s%%)\033[0m" "$k" "$pct")"
  else
    line="$line $(printf "${color}ctx:%sk\033[0m" "$k")"
  fi
fi

printf "%b" "$line"
