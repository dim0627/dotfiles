export XDG_CONFIG_HOME=~/.config

fpath=(/usr/local/share/zsh-completions $fpath)
autoload -U compinit
compinit -u

export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
autoload -Uz vcs_info
setopt prompt_subst
zstyle ':vcs_info:git:*' check-for-changes true
zstyle ':vcs_info:git:*' stagedstr "%F{yellow}!"
zstyle ':vcs_info:git:*' unstagedstr "%F{red}*"
zstyle ':vcs_info:*' formats "%F{green}(%c%u%b%f%F{green})%f "
zstyle ':vcs_info:*' actionformats '[%b|%a]'
precmd () { vcs_info }
PROMPT='[%D %T] %F{red}%~%f ${vcs_info_msg_0_}%F{blue}$%f '
PROMPT2='[%D] %F{red}%_%f %F{blue}~%f '
SPROMPT='%F{red}%r is correct? [n,y,a,e]:%f %F{blue}$%f '
[ -n '${REMOTEHOST}${SSH_CONNECTION}' ] &&

  HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000
setopt hist_ignore_dups # ignore duplication command history list
setopt share_history # share command history data

autoload history-search-end
zle -N history-beginning-search-backward-end history-search-end
zle -N history-beginning-search-forward-end history-search-end
bindkey "^[[A" history-beginning-search-backward-end
bindkey "^[[B" history-beginning-search-forward-end

zstyle ':completion:*:default' menu select # select by arrow key
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'

zmodload zsh/complist
bindkey -M menuselect 'h' vi-backward-char
bindkey -M menuselect 'j' vi-down-line-or-history
bindkey -M menuselect 'k' vi-up-line-or-history
bindkey -M menuselect 'l' vi-forward-char

setopt auto_cd
setopt auto_pushd
setopt correct
setopt list_packed
setopt nolistbeep
setopt noautoremoveslash
setopt hist_verify

typeset -U path cdpath fpath manpath # do not add the registered path

# ##### ##### ##### ##### #####
# PATH
export PATH=$PATH:~/bin

# ##### ##### ##### ##### #####
# Alias
setopt complete_aliases
# alias vim='env LANG=ja_JP.UTF-8 /Applications/MacVim.app/Contents/MacOS/Vim -g "$@"'
alias vim='nvim'
alias ls='ls -vFG'
alias l='ls -la'
alias ll="ls -l"
# alias ag="pt"
alias weather="curl http://wttr.in/"
alias be="bundle exec"
alias by="bundle && yarn"
alias ag='ag --path-to-ignore ~/.ignore'
alias git-rm-stale='git branch --merged | egrep -v "(^\*|master|main|development|develop)" | xargs git branch -d'
alias chrome="open -a /Applications/Google\ Chrome.app"

if type rmtrash > /dev/null 2>&1; then
  alias rm='rmtrash'
fi

# ##### ##### ##### ##### #####
# ssh-agent
# eval `ssh-agent`
SSH_KEY_LIFE_TIME_SEC=3600

SSH_AGENT_FILE=$HOME/.ssh-agent
test -f $SSH_AGENT_FILE && source $SSH_AGENT_FILE > /dev/null 2>&1
if [ $( ps -ef | grep ssh-agent | grep -v grep | wc -l ) -eq 0 ]; then
    ssh-agent -t $SSH_KEY_LIFE_TIME_SEC > $SSH_AGENT_FILE
    source $SSH_AGENT_FILE > /dev/null 2>&1
fi
ssh-add ~/.ssh/id_rsa

# ##### ##### ##### ##### #####
# Golang
# export GOPATH=$HOME/Develop/repositories
export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin/ #:$GOPATH/bin

# ##### ##### ##### ##### #####
# Function
chpwd() {
  ls_abbrev
}
ls_abbrev() {
  if [[ ! -r $PWD ]]; then
    return
  fi
  # -a : Do not ignore entries starting with ..
  # -C : Force multi-column output.
  # -F : Append indicator (one of */=>@|) to entries.
  local cmd_ls='ls'
  local -a opt_ls
  opt_ls=('-aCF' '--color=always')
  case "${OSTYPE}" in
    freebsd*|darwin*)
      if type gls > /dev/null 2>&1; then
        cmd_ls='gls'
      else
        # -G : Enable colorized output.
        opt_ls=('-aCFG')
      fi
      ;;
  esac

  local ls_result
  ls_result=$(CLICOLOR_FORCE=1 COLUMNS=$COLUMNS command $cmd_ls ${opt_ls[@]} | sed $'/^\e\[[0-9;]*m$/d')

  local ls_lines=$(echo "$ls_result" | wc -l | tr -d ' ')

  if [ $ls_lines -gt 10 ]; then
    echo "$ls_result" | head -n 5
    echo '...'
    echo "$ls_result" | tail -n 5
    echo "$(command ls -1 -A | wc -l | tr -d ' ') files exist"
  else
    echo "$ls_result"
  fi
}

# nodenv
eval "$(nodenv init -)"

# rbenv
export PATH=$PATH:$HOME/.rbenv/bin
eval "$(rbenv init -)"

# starship
# https://starship.rs
eval "$(starship init zsh)"

# ##### ##### ##### ##### #####
# direnv
# eval "$(direnv hook zsh)"

# ##### ##### ##### ##### #####
# Golang
export GOPATH=/Users/tsujidaisuke/go

# ##### ##### ##### ##### #####
# peco
# ## Git
function peco-src () {
  local selected_dir=$(ghq list -p | peco --query "$LBUFFER")
  if [ -n "$selected_dir" ]; then
    BUFFER="cd ${selected_dir}"
    zle accept-line
  fi
  zle clear-screen
}
zle -N peco-src
bindkey '^]' peco-src

# ## History
function peco-history-selection() {
    BUFFER=`history -n 1 | tail -r | awk '!a[$0]++' | peco`
    CURSOR=$#BUFFER
    zle reset-prompt
}

zle -N peco-history-selection
bindkey '^R' peco-history-selection

# The next line updates PATH for the Google Cloud SDK.
if [ -f '/Users/tsujidaisuke/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/tsujidaisuke/google-cloud-sdk/path.zsh.inc'; fi

# The next line enables shell command completion for gcloud.
if [ -f '/Users/tsujidaisuke/google-cloud-sdk/completion.zsh.inc' ]; then . '/Users/tsujidaisuke/google-cloud-sdk/completion.zsh.inc'; fi

# pnpm
export PNPM_HOME="/Users/tsujidaisuke/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end
