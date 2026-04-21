#!/usr/bin/env bash

set -euo pipefail

# shellcheck source=/dev/null
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ui.sh"

if [[ $# -ne 1 ]]; then
  ph_error "install-wrapper.sh expects the repository root path."
  exit 1
fi

ROOT_DIR="$1"
BIN_DIR="${POWERHOUSE_BIN_DIR:-${XDG_BIN_HOME:-$HOME/.local/bin}}"
TARGET="$BIN_DIR/powerhouse"

mkdir -p "$BIN_DIR"

cat >"$TARGET" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec bun "$ROOT_DIR/packages/cli/src/index.ts" "\$@"
EOF

chmod +x "$TARGET"

case ":$PATH:" in
  *":$BIN_DIR:"*)
    ph_success "Installed wrapper at $TARGET"
    ;;
  *)
    ph_success "Installed wrapper at $TARGET"
    ph_warn "Add $BIN_DIR to PATH to run powerhouse directly."
    ;;
esac
