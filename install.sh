#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$ROOT_DIR/scripts/bootstrap/ui.sh"

resolve_data_home() {
  echo "${XDG_DATA_HOME:-$HOME/.local/share}"
}

resolve_managed_runtime_dir() {
  echo "$(resolve_data_home)/powerhouse/runtime"
}

fail() {
  ph_error "$1"
  exit 1
}

has() {
  command -v "$1" >/dev/null 2>&1
}

resolve_brew_bin() {
  if has brew; then
    command -v brew
    return 0
  fi

  if [[ -x /opt/homebrew/bin/brew ]]; then
    echo /opt/homebrew/bin/brew
    return 0
  fi

  if [[ -x /usr/local/bin/brew ]]; then
    echo /usr/local/bin/brew
    return 0
  fi

  if [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
    echo /home/linuxbrew/.linuxbrew/bin/brew
    return 0
  fi

  if [[ -x "$HOME/.linuxbrew/bin/brew" ]]; then
    echo "$HOME/.linuxbrew/bin/brew"
    return 0
  fi

  return 1
}

activate_brew_shellenv() {
  local brew_bin
  brew_bin="$(resolve_brew_bin)" || return 1
  # shellcheck disable=SC1090
  eval "$("$brew_bin" shellenv)"
}

detect_platform() {
  local uname_out
  uname_out="$(uname -s)"
  case "$uname_out" in
    Darwin)
      echo "macos"
      ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then
        echo "wsl"
      else
        echo "linux"
      fi
      ;;
    *)
      echo "unsupported"
      ;;
  esac
}

require_command() {
  local cmd="$1"
  if ! has "$cmd"; then
    fail "Missing required command: $cmd"
  fi
}

platform="$(detect_platform)"
MANAGED_ROOT="$ROOT_DIR"

if [[ "$platform" == "unsupported" ]]; then
  fail "Unsupported platform. powerhouse currently targets macOS, Linux, and WSL."
fi

require_command curl
if ! has git; then
  ph_warn "git is not installed yet; the selected profile can install it."
fi

install_homebrew() {
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
}

install_workspace_dependencies() {
  bun install
}

install_wrapper() {
  "$ROOT_DIR/scripts/bootstrap/install-wrapper.sh" "$MANAGED_ROOT"
}

configure_shell_startup() {
  local brew_bin
  brew_bin="$(resolve_brew_bin)" || fail "Homebrew is not available for shell configuration."
  "$ROOT_DIR/scripts/bootstrap/configure-shell.sh" "$brew_bin" "${POWERHOUSE_BIN_DIR:-${XDG_BIN_HOME:-$HOME/.local/bin}}" "${SHELL##*/}"
}

sync_managed_runtime() {
  local source_root="$1"
  local runtime_dir="$2"
  local temp_runtime

  if [[ "$source_root" == "$runtime_dir" ]]; then
    MANAGED_ROOT="$source_root"
    return 0
  fi

  temp_runtime="$(mktemp -d "${TMPDIR:-/tmp}/powerhouse-runtime.XXXXXX")"
  mkdir -p "$(dirname "$runtime_dir")"

  (
    cd "$source_root"
    tar \
      --exclude='./node_modules' \
      --exclude='./apps/web/node_modules' \
      --exclude='./packages/cli/node_modules' \
      --exclude='./packages/core/node_modules' \
      -cf - .
  ) | (
    cd "$temp_runtime"
    tar -xf -
  )

  rm -rf "$runtime_dir"
  mv "$temp_runtime" "$runtime_dir"
  MANAGED_ROOT="$runtime_dir"
}

ph_header
ph_info "Platform: $platform"
ph_info "Shell: ${SHELL:-unknown}"
activate_brew_shellenv || true

if [[ "$platform" == "macos" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/scripts/platform/macos.sh"
  ph_step "Preparing macOS prerequisites"
  platform_preflight
  ph_success "macOS prerequisites ready"
elif [[ "$platform" == "linux" || "$platform" == "wsl" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT_DIR/scripts/platform/linux.sh"
  ph_step "Preparing ${platform^^} prerequisites"
  platform_preflight
  ph_success "${platform^^} prerequisites ready"
fi

if ! has brew; then
  ph_run "Installing Homebrew" install_homebrew
  activate_brew_shellenv || true
else
  ph_skip "Homebrew already available"
fi

if ! has brew; then
  fail "Homebrew was installed but is not available in the current shell."
fi

if ! has bun; then
  ph_run "Installing Bun" "$ROOT_DIR/scripts/bootstrap/install-bun.sh"
else
  ph_skip "Bun already available"
fi

ph_run "Preparing managed runtime" sync_managed_runtime "$ROOT_DIR" "$(resolve_managed_runtime_dir)"
ph_info "Managed runtime: $MANAGED_ROOT"

cd "$MANAGED_ROOT"
ph_run "Installing workspace dependencies" install_workspace_dependencies

if [[ -f "$ROOT_DIR/scripts/bootstrap/install-wrapper.sh" ]]; then
  ph_run "Installing powerhouse command wrapper" install_wrapper
fi

ph_run "Configuring shell startup" configure_shell_startup

ph_info "Handing off to the interactive bootstrap CLI"
exec bun "$MANAGED_ROOT/packages/cli/src/index.ts" bootstrap "$@"
