#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/ui.sh"

if [[ $# -ne 3 ]]; then
  ph_error "configure-shell.sh expects: <brew-bin> <wrapper-bin-dir> <shell-name>"
  exit 1
fi

BREW_BIN="$1"
WRAPPER_BIN_DIR="$2"
SHELL_NAME="$3"

START_MARKER="# >>> powerhouse shell setup >>>"
END_MARKER="# <<< powerhouse shell setup <<<"

shell_target_file() {
  case "$SHELL_NAME" in
    bash)
      echo "$HOME/.bashrc"
      ;;
    zsh)
      echo "$HOME/.zshrc"
      ;;
    fish)
      echo "${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"
      ;;
    *)
      echo "$HOME/.profile"
      ;;
  esac
}

render_shell_block() {
  case "$SHELL_NAME" in
    bash)
      cat <<EOF
$START_MARKER
eval "\$("$BREW_BIN" shellenv bash)"
export PATH="$WRAPPER_BIN_DIR:\$PATH"
$END_MARKER
EOF
      ;;
    zsh)
      cat <<EOF
$START_MARKER
eval "\$("$BREW_BIN" shellenv zsh)"
export PATH="$WRAPPER_BIN_DIR:\$PATH"
$END_MARKER
EOF
      ;;
    fish)
      cat <<EOF
$START_MARKER
eval ($BREW_BIN shellenv fish)
fish_add_path --global --move --path "$WRAPPER_BIN_DIR"
$END_MARKER
EOF
      ;;
    *)
      cat <<EOF
$START_MARKER
eval "\$("$BREW_BIN" shellenv bash)"
export PATH="$WRAPPER_BIN_DIR:\$PATH"
$END_MARKER
EOF
      ;;
  esac
}

remove_existing_block() {
  local target_file="$1"
  local temp_file
  temp_file="$(mktemp "${TMPDIR:-/tmp}/powerhouse-shell.XXXXXX")"

  awk -v start="$START_MARKER" -v end="$END_MARKER" '
    $0 == start { skip = 1; next }
    $0 == end { skip = 0; next }
    !skip { print }
  ' "$target_file" >"$temp_file"

  mv "$temp_file" "$target_file"
}

target_file="$(shell_target_file)"
mkdir -p "$(dirname "$target_file")"
touch "$target_file"
remove_existing_block "$target_file"

{
  printf '\n'
  render_shell_block
  printf '\n'
} >>"$target_file"

ph_success "Updated shell startup for $SHELL_NAME at $target_file"

