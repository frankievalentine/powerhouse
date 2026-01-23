#!/bin/bash

# Powerhouse - Universal Agent Skills Installer
# Installs skills and configurations directly to each agent's config directory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# GitHub raw content base URL
GITHUB_RAW="https://raw.githubusercontent.com/frankievalentine/powerhouse/main"

# Temporary directory for downloads
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

print_header() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}           ${BOLD}🚀 Powerhouse Agent Skills Installer${NC}            ${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Download a file from GitHub
download_file() {
    local path="$1"
    local dest="$2"
    local url="$GITHUB_RAW/$path"
    
    mkdir -p "$(dirname "$dest")"
    if curl -fsSL "$url" -o "$dest" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Download a directory from GitHub (using git sparse checkout)
download_directory() {
    local path="$1"
    local dest="$2"
    
    mkdir -p "$dest"
    
    # Clone with sparse checkout to get only the needed directory
    cd "$TMP_DIR"
    if [ ! -d "powerhouse" ]; then
        git clone --quiet --depth 1 --filter=blob:none --sparse \
            https://github.com/frankievalentine/powerhouse.git powerhouse 2>/dev/null || {
            print_error "Failed to clone repository"
            return 1
        }
    fi
    
    cd powerhouse
    git sparse-checkout add "$path" 2>/dev/null || true
    
    if [ -d "$path" ]; then
        cp -r "$path"/* "$dest/" 2>/dev/null || true
        return 0
    else
        return 1
    fi
}

# Backup existing directory if it exists
backup_if_exists() {
    local dir="$1"
    if [ -d "$dir" ] && [ ! -L "$dir" ]; then
        local backup_dir="${dir}.backup.$(date +%Y%m%d%H%M%S)"
        print_warning "Backing up existing $dir to $backup_dir"
        mv "$dir" "$backup_dir"
    fi
}

install_claude() {
    print_info "Installing Claude Code..."
    
    local claude_dir="$HOME/.claude"
    mkdir -p "$claude_dir/commands"
    
    # Download commands
    download_directory "agents/claude/commands" "$claude_dir/commands"
    
    # Download global skills
    download_directory "global/skills" "$claude_dir/skills"
    
    print_success "Claude Code configured → $claude_dir"
}

install_opencode() {
    print_info "Installing OpenCode..."
    
    local opencode_dir="$HOME/.config/opencode"
    mkdir -p "$opencode_dir/commands"
    
    # Download commands
    download_directory "agents/opencode/commands" "$opencode_dir/commands"
    
    # Download global skills
    download_directory "global/skills" "$opencode_dir/skills"
    
    print_success "OpenCode configured → $opencode_dir"
}

install_antigravity() {
    print_info "Installing Antigravity..."
    
    local antigravity_dir="$HOME/.gemini/antigravity"
    mkdir -p "$antigravity_dir/commands"
    
    # Download commands
    download_directory "agents/gemini/commands" "$antigravity_dir/commands"
    
    # Download global skills
    download_directory "global/skills" "$antigravity_dir/skills"
    
    print_success "Antigravity configured → $antigravity_dir"
}

install_codex() {
    print_info "Installing OpenAI Codex..."
    
    local codex_dir="$HOME/.codex"
    mkdir -p "$codex_dir"
    
    # Download global skills
    download_directory "global/skills" "$codex_dir/skills"
    
    print_success "OpenAI Codex configured → $codex_dir"
}

install_continue() {
    print_info "Installing Continue.dev..."
    
    local continue_dir="$HOME/.continue"
    mkdir -p "$continue_dir/prompts"
    
    # Download config
    download_file "agents/continue/config.yaml" "$continue_dir/config.yaml"
    
    # Download prompts
    download_directory "agents/continue/prompts" "$continue_dir/prompts"
    
    print_success "Continue.dev configured → $continue_dir"
}

install_cursor() {
    print_info "Installing Cursor..."
    
    local cursor_dir="$HOME/.cursor"
    mkdir -p "$cursor_dir/rules"
    
    # Download rules
    download_directory "agents/cursor/rules" "$cursor_dir/rules"
    
    # Download global skills
    download_directory "global/skills" "$cursor_dir/skills"
    
    print_success "Cursor configured → $cursor_dir"
}

install_copilot() {
    print_info "Installing GitHub Copilot..."
    
    # Copilot is project-level, show instructions
    echo ""
    echo -e "  ${DIM}GitHub Copilot requires project-level setup.${NC}"
    echo -e "  ${DIM}Run in your project root:${NC}"
    echo ""
    echo -e "  mkdir -p .github"
    echo -e "  curl -fsSL $GITHUB_RAW/agents/copilot/copilot-instructions.md -o .github/copilot-instructions.md"
    echo ""
    
    print_success "GitHub Copilot instructions shown"
}

show_completion() {
    echo ""
    echo -e "${GREEN}───────────────────────────────────────────────────────────${NC}"
    echo -e "${GREEN}  ✓ Installation Complete!${NC}"
    echo -e "${GREEN}───────────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "  ${BOLD}Available commands:${NC}"
    echo -e "    ${DIM}/review-pr${NC}        Review pull requests"
    echo -e "    ${DIM}/create-component${NC} Create React components"
    echo -e "    ${DIM}/fix-tests${NC}        Fix failing tests"
    echo -e "    ${DIM}/commit${NC}           Conventional commits"
    echo ""
}

# Interactive agent selection menu
interactive_menu() {
    echo -e "${BOLD}Select agents to install:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Claude Code      ${DIM}→ ~/.claude${NC}"
    echo -e "  ${CYAN}2)${NC} OpenCode         ${DIM}→ ~/.config/opencode${NC}"
    echo -e "  ${CYAN}3)${NC} Antigravity      ${DIM}→ ~/.gemini/antigravity${NC}"
    echo -e "  ${CYAN}4)${NC} OpenAI Codex     ${DIM}→ ~/.codex${NC}"
    echo -e "  ${CYAN}5)${NC} Continue.dev     ${DIM}→ ~/.continue${NC}"
    echo -e "  ${CYAN}6)${NC} Cursor           ${DIM}→ ~/.cursor${NC}"
    echo -e "  ${CYAN}7)${NC} GitHub Copilot   ${DIM}→ project-level${NC}"
    echo ""
    echo -e "  ${CYAN}a)${NC} Install all"
    echo -e "  ${CYAN}q)${NC} Quit"
    echo ""
    echo -e "${DIM}Enter choices separated by spaces (e.g., 1 3 6):${NC}"
    
    # Read from /dev/tty to handle curl pipe
    read -p "> " choices </dev/tty
    
    if [[ "$choices" == "q" || "$choices" == "Q" ]]; then
        echo ""
        print_info "Installation cancelled."
        exit 0
    fi
    
    SELECTED=()
    
    if [[ "$choices" == "a" || "$choices" == "A" ]]; then
        SELECTED=(1 2 3 4 5 6 7)
    else
        for choice in $choices; do
            case "$choice" in
                1|2|3|4|5|6|7) SELECTED+=("$choice") ;;
            esac
        done
    fi
}

main() {
    print_header
    
    # Check for git
    if ! command -v git &> /dev/null; then
        print_error "git is required but not installed."
        exit 1
    fi
    
    interactive_menu
    
    if [ ${#SELECTED[@]} -eq 0 ]; then
        echo ""
        print_warning "No agents selected. Exiting."
        exit 0
    fi
    
    echo ""
    echo -e "${BLUE}Installing selected agents...${NC}"
    echo ""
    
    for choice in "${SELECTED[@]}"; do
        case "$choice" in
            1) install_claude ;;
            2) install_opencode ;;
            3) install_antigravity ;;
            4) install_codex ;;
            5) install_continue ;;
            6) install_cursor ;;
            7) install_copilot ;;
        esac
    done
    
    show_completion
}

main "$@"
