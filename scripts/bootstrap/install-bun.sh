#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=/dev/null
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ui.sh"

has() {
  command -v "$1" >/dev/null 2>&1
}

if has bun; then
  ph_skip "Bun already available"
  exit 0
fi

if has brew; then
  ph_info "Using Homebrew to install Bun"
  brew install bun
  exit 0
fi

ph_info "Using the official Bun install script"
curl -fsSL https://bun.sh/install | bash
