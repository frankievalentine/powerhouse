#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/../bootstrap/ui.sh"

has() {
  command -v "$1" >/dev/null 2>&1
}

linux_distro_field() {
  local key="$1"
  if [[ ! -r /etc/os-release ]]; then
    return 1
  fi

  awk -F= -v wanted="$key" '$1 == wanted { gsub(/^"/, "", $2); gsub(/"$/, "", $2); print $2 }' /etc/os-release
}

linux_package_manager() {
  if has apt-get; then
    echo "apt"
    return 0
  fi
  if has dnf; then
    echo "dnf"
    return 0
  fi
  if has pacman; then
    echo "pacman"
    return 0
  fi

  return 1
}

run_as_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
    return
  fi

  if has sudo; then
    sudo "$@"
    return
  fi

  ph_error "Linux preflight needs root privileges to install system packages."
  ph_warn "Install the Homebrew Linux prerequisites manually or re-run with sudo available."
  exit 1
}

linux_build_tools_ready() {
  has bash && has gcc && has make && has git && has curl && has file && has ps
}

install_linux_build_tools() {
  local manager="$1"
  local distro_id="${2:-unknown}"

  case "$manager" in
    apt)
      ph_info "Using apt to install Linux build prerequisites"
      run_as_root apt-get update
      run_as_root apt-get install -y build-essential procps curl file git
      ;;
    dnf)
      ph_info "Using dnf to install Linux build prerequisites"
      if [[ "$distro_id" == "fedora" ]]; then
        run_as_root dnf -y group install development-tools
      else
        run_as_root dnf -y group install "Development Tools"
      fi
      run_as_root dnf -y install procps-ng curl file git
      ;;
    pacman)
      ph_info "Using pacman to install Linux build prerequisites"
      run_as_root pacman -Sy --needed --noconfirm base-devel procps-ng curl file git
      ;;
    *)
      ph_error "Unsupported Linux package manager for automated preflight."
      ph_warn "Supported automated preflight backends are apt, dnf, and pacman."
      ph_warn "Homebrew's Linux docs recommend installing equivalent build tools before setup."
      exit 1
      ;;
  esac
}

platform_preflight() {
  if ! command -v bash >/dev/null 2>&1; then
    ph_error "bash is required on Linux."
    exit 1
  fi

  if linux_build_tools_ready; then
    ph_skip "Linux build prerequisites already available"
    return 0
  fi

  local distro_id
  distro_id="$(linux_distro_field ID || true)"
  local manager
  manager="$(linux_package_manager || true)"

  if [[ -z "$manager" ]]; then
    ph_error "Unable to detect a supported Linux package manager."
    ph_warn "powerhouse can currently automate Homebrew prerequisites for apt, dnf, and pacman systems."
    exit 1
  fi

  ph_warn "Linux build prerequisites are required before installing Homebrew."
  install_linux_build_tools "$manager" "$distro_id"

  if linux_build_tools_ready; then
    ph_success "Linux build prerequisites are ready"
    return 0
  fi

  ph_error "Linux build prerequisites still appear incomplete after installation."
  exit 1
}
