#!/bin/bash

# Powerhouse - Universal Agent Skills Installer
# Installs skills and configurations for multiple AI coding assistants

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL_SKILLS_DIR="$SCRIPT_DIR/global/skills"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           🚀 Powerhouse Agent Skills Installer            ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
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

# Backup existing directory if it exists
backup_if_exists() {
    local dir="$1"
    if [ -d "$dir" ] && [ ! -L "$dir" ]; then
        local backup_dir="${dir}.backup.$(date +%Y%m%d%H%M%S)"
        print_warning "Backing up existing $dir to $backup_dir"
        mv "$dir" "$backup_dir"
    fi
}

# Create symlink for skills directory
create_skills_symlink() {
    local target_dir="$1"
    local skills_subdir="$2"
    
    mkdir -p "$target_dir"
    
    for skill_dir in "$GLOBAL_SKILLS_DIR"/*/; do
        if [ -d "$skill_dir" ]; then
            local skill_name=$(basename "$skill_dir")
            local target_skill_dir="$target_dir/$skills_subdir/$skill_name"
            
            # Remove existing symlink or directory
            if [ -L "$target_skill_dir" ]; then
                rm "$target_skill_dir"
            elif [ -d "$target_skill_dir" ]; then
                backup_if_exists "$target_skill_dir"
            fi
            
            mkdir -p "$(dirname "$target_skill_dir")"
            ln -sf "$skill_dir" "$target_skill_dir"
            print_success "Linked $skill_name → $target_skill_dir"
        fi
    done
}

# Copy files instead of symlink (for agents that don't support symlinks well)
copy_skills() {
    local target_dir="$1"
    local skills_subdir="$2"
    
    mkdir -p "$target_dir/$skills_subdir"
    cp -r "$GLOBAL_SKILLS_DIR"/* "$target_dir/$skills_subdir/"
    print_success "Copied skills to $target_dir/$skills_subdir"
}

install_claude() {
    echo ""
    echo -e "${BLUE}Installing for Claude Code...${NC}"
    
    local claude_dir="$HOME/.claude"
    mkdir -p "$claude_dir/skills"
    
    create_skills_symlink "$claude_dir" "skills"
    
    # Copy commands if they exist
    if [ -d "$SCRIPT_DIR/agents/claude/commands" ]; then
        mkdir -p "$claude_dir/commands"
        cp -r "$SCRIPT_DIR/agents/claude/commands"/* "$claude_dir/commands/" 2>/dev/null || true
        print_success "Copied Claude commands"
    fi
    
    print_success "Claude Code installation complete"
}

install_opencode() {
    echo ""
    echo -e "${BLUE}Installing for OpenCode...${NC}"
    
    local opencode_dir="$HOME/.config/opencode"
    mkdir -p "$opencode_dir/skills"
    
    create_skills_symlink "$opencode_dir" "skills"
    
    if [ -d "$SCRIPT_DIR/agents/opencode/commands" ]; then
        mkdir -p "$opencode_dir/commands"
        cp -r "$SCRIPT_DIR/agents/opencode/commands"/* "$opencode_dir/commands/" 2>/dev/null || true
        print_success "Copied OpenCode commands"
    fi
    
    print_success "OpenCode installation complete"
}

install_gemini() {
    echo ""
    echo -e "${BLUE}Installing for Gemini CLI...${NC}"
    
    local gemini_dir="$HOME/.gemini"
    mkdir -p "$gemini_dir/skills"
    
    create_skills_symlink "$gemini_dir" "skills"
    
    if [ -d "$SCRIPT_DIR/agents/gemini/commands" ]; then
        mkdir -p "$gemini_dir/commands"
        cp -r "$SCRIPT_DIR/agents/gemini/commands"/* "$gemini_dir/commands/" 2>/dev/null || true
        print_success "Copied Gemini commands"
    fi
    
    print_success "Gemini CLI installation complete"
}

install_codex() {
    echo ""
    echo -e "${BLUE}Installing for OpenAI Codex...${NC}"
    
    local codex_dir="$HOME/.codex"
    mkdir -p "$codex_dir/skills"
    
    create_skills_symlink "$codex_dir" "skills"
    
    print_success "OpenAI Codex installation complete"
}

install_continue() {
    echo ""
    echo -e "${BLUE}Installing for Continue.dev...${NC}"
    
    local continue_dir="$HOME/.continue"
    mkdir -p "$continue_dir"
    
    if [ -f "$SCRIPT_DIR/agents/continue/config.yaml" ]; then
        if [ -f "$continue_dir/config.yaml" ]; then
            backup_if_exists "$continue_dir/config.yaml"
        fi
        cp "$SCRIPT_DIR/agents/continue/config.yaml" "$continue_dir/config.yaml"
        print_success "Installed Continue.dev config.yaml"
    fi
    
    if [ -d "$SCRIPT_DIR/agents/continue/prompts" ]; then
        mkdir -p "$continue_dir/prompts"
        cp -r "$SCRIPT_DIR/agents/continue/prompts"/* "$continue_dir/prompts/" 2>/dev/null || true
        print_success "Copied Continue.dev prompts"
    fi
    
    print_success "Continue.dev installation complete"
}

show_project_instructions() {
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Project-Level Installation (run in your project root)${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "For GitHub Copilot and Cursor, copy files to your project:"
    echo ""
    echo "  # GitHub Copilot"
    echo "  mkdir -p .github"
    echo "  cp $SCRIPT_DIR/agents/copilot/copilot-instructions.md .github/"
    echo ""
    echo "  # Cursor"
    echo "  mkdir -p .cursor/rules"
    echo "  cp $SCRIPT_DIR/agents/cursor/rules/* .cursor/rules/"
    echo ""
}

main() {
    print_header
    
    echo "This script will install global skills for:"
    echo "  • Claude Code"
    echo "  • OpenCode"
    echo "  • Gemini CLI"
    echo "  • OpenAI Codex"
    echo "  • Continue.dev"
    echo ""
    
    read -p "Continue with installation? [Y/n] " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    install_claude
    install_opencode
    install_gemini
    install_codex
    install_continue
    
    show_project_instructions
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ Installation Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Available skills:"
    for skill_dir in "$GLOBAL_SKILLS_DIR"/*/; do
        if [ -d "$skill_dir" ]; then
            echo "  • $(basename "$skill_dir")"
        fi
    done
    echo ""
    echo "Available commands (use with /command-name):"
    echo "  • review-pr       - Review pull requests"
    echo "  • create-component - Create React components"
    echo "  • fix-tests       - Fix failing tests"
    echo "  • commit          - Create conventional commits"
    echo "  • add-shadcn      - Add shadcn/ui components"
    echo "  • a11y-audit      - Audit accessibility"
    echo ""
}

main "$@"
