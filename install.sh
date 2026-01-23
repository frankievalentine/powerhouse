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
CYAN='\033[0;36m'
BOLD='\033[1m'
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

install_antigravity() {
    echo ""
    echo -e "${BLUE}Installing for Antigravity...${NC}"
    
    local antigravity_dir="$HOME/.gemini/antigravity"
    mkdir -p "$antigravity_dir/skills"
    
    create_skills_symlink "$antigravity_dir" "skills"
    
    if [ -d "$SCRIPT_DIR/agents/gemini/commands" ]; then
        mkdir -p "$antigravity_dir/commands"
        cp -r "$SCRIPT_DIR/agents/gemini/commands"/* "$antigravity_dir/commands/" 2>/dev/null || true
        print_success "Copied Antigravity commands"
    fi
    
    print_success "Antigravity installation complete"
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

show_completion() {
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

# Interactive agent selection menu
select_agents() {
    local agents=("Claude Code" "OpenCode" "Antigravity" "OpenAI Codex" "Continue.dev")
    local selected=(0 0 0 0 0)
    local current=0
    local total=${#agents[@]}
    
    echo ""
    echo -e "${BOLD}Select which agents to install:${NC}"
    echo -e "${CYAN}(Use arrow keys to navigate, space to toggle, enter to confirm)${NC}"
    echo ""
    
    # Check if we're in an interactive terminal
    if [ ! -t 0 ]; then
        # Non-interactive mode (piped from curl) - show simple numbered menu
        echo "Available agents:"
        echo ""
        for i in "${!agents[@]}"; do
            echo "  $((i+1)). ${agents[$i]}"
        done
        echo "  a. All agents"
        echo "  q. Quit"
        echo ""
        read -p "Enter your choices (e.g., 1 3 5 or 'a' for all): " choices
        
        if [[ "$choices" == "q" ]]; then
            echo "Installation cancelled."
            exit 0
        fi
        
        if [[ "$choices" == "a" ]]; then
            selected=(1 1 1 1 1)
        else
            for choice in $choices; do
                if [[ "$choice" =~ ^[1-5]$ ]]; then
                    selected[$((choice-1))]=1
                fi
            done
        fi
    else
        # Interactive mode - use arrow keys and highlighting
        while true; do
            # Clear and redraw menu
            tput cuu $((total + 2)) 2>/dev/null || true
            
            for i in "${!agents[@]}"; do
                local checkbox="[ ]"
                local prefix="  "
                
                if [ "${selected[$i]}" -eq 1 ]; then
                    checkbox="[${GREEN}✓${NC}]"
                fi
                
                if [ "$i" -eq "$current" ]; then
                    prefix="${CYAN}▸${NC} "
                    echo -e "${prefix}${checkbox} ${BOLD}${agents[$i]}${NC}"
                else
                    echo -e "${prefix}${checkbox} ${agents[$i]}"
                fi
            done
            
            echo ""
            echo -e "  ${CYAN}[A]${NC} Select All  ${CYAN}[N]${NC} Select None  ${CYAN}[Enter]${NC} Confirm"
            
            # Read single character
            read -rsn1 key
            
            case "$key" in
                A|B|C|D)
                    read -rsn2 key
                    case "$key" in
                        "[A") # Up arrow
                            ((current--))
                            [ $current -lt 0 ] && current=$((total-1))
                            ;;
                        "[B") # Down arrow
                            ((current++))
                            [ $current -ge $total ] && current=0
                            ;;
                    esac
                    ;;
                " ") # Space - toggle selection
                    if [ "${selected[$current]}" -eq 1 ]; then
                        selected[$current]=0
                    else
                        selected[$current]=1
                    fi
                    ;;
                "a"|"A") # Select all
                    for i in "${!selected[@]}"; do
                        selected[$i]=1
                    done
                    ;;
                "n"|"N") # Select none
                    for i in "${!selected[@]}"; do
                        selected[$i]=0
                    done
                    ;;
                "") # Enter - confirm
                    break
                    ;;
            esac
        done
    fi
    
    # Return selected indices
    SELECTED_AGENTS=()
    for i in "${!selected[@]}"; do
        if [ "${selected[$i]}" -eq 1 ]; then
            SELECTED_AGENTS+=($i)
        fi
    done
}

main() {
    print_header
    
    echo "This installer will configure skills for your AI coding assistants."
    echo "You can choose which agents to install for."
    
    select_agents
    
    if [ ${#SELECTED_AGENTS[@]} -eq 0 ]; then
        print_warning "No agents selected. Exiting."
        exit 0
    fi
    
    echo ""
    echo -e "${BLUE}Installing for selected agents...${NC}"
    
    for idx in "${SELECTED_AGENTS[@]}"; do
        case $idx in
            0) install_claude ;;
            1) install_opencode ;;
            2) install_antigravity ;;
            3) install_codex ;;
            4) install_continue ;;
        esac
    done
    
    show_project_instructions
    show_completion
}

main "$@"
