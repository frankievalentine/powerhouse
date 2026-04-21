#!/usr/bin/env bash

set -euo pipefail

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  PH_RESET=$'\033[0m'
  PH_BOLD=$'\033[1m'
  PH_DIM=$'\033[2m'
  PH_RED=$'\033[31m'
  PH_GREEN=$'\033[32m'
  PH_YELLOW=$'\033[33m'
  PH_BLUE=$'\033[34m'
  PH_CYAN=$'\033[36m'
else
  PH_RESET=''
  PH_BOLD=''
  PH_DIM=''
  PH_RED=''
  PH_GREEN=''
  PH_YELLOW=''
  PH_BLUE=''
  PH_CYAN=''
fi

ph_header() {
  printf '\n%s%spowerhouse%s %sbootstrap%s\n' "$PH_BOLD" "$PH_CYAN" "$PH_RESET" "$PH_DIM" "$PH_RESET"
  printf '%s%s%s\n\n' "$PH_DIM" 'AI-native workstation setup' "$PH_RESET"
}

ph_info() {
  printf '%s›%s %s\n' "$PH_CYAN" "$PH_RESET" "$1"
}

ph_step() {
  printf '%s•%s %s\n' "$PH_BLUE" "$PH_RESET" "$1"
}

ph_skip() {
  printf '%s↷%s %s\n' "$PH_DIM" "$PH_RESET" "$1"
}

ph_success() {
  printf '%s✓%s %s\n' "$PH_GREEN" "$PH_RESET" "$1"
}

ph_warn() {
  printf '%s!%s %s\n' "$PH_YELLOW" "$PH_RESET" "$1"
}

ph_error() {
  printf '%s✗%s %s\n' "$PH_RED" "$PH_RESET" "$1" >&2
}

ph_log_excerpt() {
  local logfile="$1"
  if [[ ! -s "$logfile" ]]; then
    return
  fi

  printf '%sLast output:%s\n' "$PH_BOLD" "$PH_RESET" >&2
  tail -n 25 "$logfile" | sed 's/^/  | /' >&2
}

ph_run() {
  local label="$1"
  shift

  local logfile
  logfile="$(mktemp "${TMPDIR:-/tmp}/powerhouse.XXXXXX.log")"

  ph_step "$label"
  if "$@" >"$logfile" 2>&1; then
    rm -f "$logfile"
    ph_success "$label"
    return 0
  fi

  local status=$?
  ph_error "$label"
  printf '%sLog:%s %s\n' "$PH_BOLD" "$PH_RESET" "$logfile" >&2
  ph_log_excerpt "$logfile"
  return "$status"
}

