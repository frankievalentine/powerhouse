#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/../bootstrap/ui.sh"

command_line_tools_installed() {
  xcode-select -p >/dev/null 2>&1
}

request_command_line_tools_install() {
  local output=''
  local status=0

  output="$(xcode-select --install 2>&1)" || status=$?

  if [[ $status -eq 0 ]]; then
    return 0
  fi

  case "$output" in
    *"already installed"*|*"install requested"*)
      return 0
      ;;
    *"not currently available"*|*"Can't install the software"*)
      ph_error "Apple Command Line Tools could not be requested automatically."
      printf '%s\n' "$output" >&2
      return 1
      ;;
    *)
      # Treat unknown non-zero responses as a best-effort request and fall through to polling.
      return 0
      ;;
  esac
}

wait_for_command_line_tools() {
  local timeout_seconds="${POWERHOUSE_MACOS_CLT_TIMEOUT_SECONDS:-1800}"
  local poll_seconds="${POWERHOUSE_MACOS_CLT_POLL_SECONDS:-5}"
  local waited=0

  while (( waited < timeout_seconds )); do
    if command_line_tools_installed; then
      return 0
    fi

    sleep "$poll_seconds"
    waited=$((waited + poll_seconds))
  done

  return 1
}

platform_preflight() {
  if command_line_tools_installed; then
    return 0
  fi

  ph_warn "Apple Command Line Tools are required on macOS."

  if [[ ! -t 1 ]]; then
    ph_error "Command Line Tools are missing and require Apple's installer UI."
    ph_warn "Run powerhouse again from a logged-in macOS desktop session so the installer prompt can be shown."
    exit 1
  fi

  ph_step "Requesting Apple Command Line Tools"
  request_command_line_tools_install
  ph_success "Requested Apple Command Line Tools"

  ph_info "Approve the Apple installer prompt if it appears. Waiting for installation to complete."
  if wait_for_command_line_tools; then
    ph_success "Apple Command Line Tools are ready"
    return 0
  fi

  ph_error "Apple Command Line Tools did not finish installing in time."
  ph_warn "If the installer is still running, let it finish and then re-run powerhouse."
  exit 1
}
