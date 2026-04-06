#!/bin/sh
input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
model=$(echo "$input" | jq -r '.model.display_name // ""')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

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

# model
if [ -n "$model" ]; then
  line="$line $(printf "\033[35m%s\033[0m" "$model")"
fi

# context usage
if [ -n "$used" ]; then
  used_int=$(printf "%.0f" "$used")
  if [ "$used_int" -ge 80 ]; then
    color="\033[31m"
  elif [ "$used_int" -ge 50 ]; then
    color="\033[33m"
  else
    color="\033[36m"
  fi
  line="$line $(printf "${color}ctx:%s%%\033[0m" "$used_int")"
fi

printf "%b" "$line"
