#!/usr/bin/env bash
# MCP Server Setup Script for pie-players
# This script helps configure MCP servers for different Claude environments

set -e

echo "🚀 MCP Server Setup for pie-players"
echo ""

# Detect which tool to configure
echo "Which Claude environment are you using?"
echo "1) Claude Desktop"
echo "2) Claude Code (CLI)"
echo "3) Cursor IDE"
echo "4) VSCode + Claude Code Extension"
echo "5) Show all configurations"
echo ""
read -p "Enter choice (1-5): " choice

case $choice in
  1)
    echo ""
    echo "📋 Claude Desktop Configuration"
    echo "Location: ~/Library/Application Support/Claude/claude_desktop_config.json"
    echo ""
    echo "Copy the configuration from .mcp/README.md section 'Claude Desktop Configuration'"
    echo "Or use this command to open the README:"
    echo ""
    echo "  open .mcp/README.md"
    echo ""
    ;;
  2)
    echo ""
    echo "📋 Claude Code (CLI) Configuration"
    echo ""
    mkdir -p ~/.claude-code
    if [ -f ~/.claude-code/mcp-servers.json ]; then
      echo "⚠️  Warning: ~/.claude-code/mcp-servers.json already exists"
      read -p "Overwrite? (y/N): " overwrite
      if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "Skipping..."
        exit 0
      fi
    fi

    # Get absolute path to project
    PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

    # Copy and update paths
    cp "$PROJECT_DIR/.mcp/claude-code-config.json" ~/.claude-code/mcp-servers.json

    echo "✅ Configuration copied to ~/.claude-code/mcp-servers.json"
    echo ""
    echo "Note: Configuration uses relative paths and assumes you run claude-code from the project directory"
    echo ""
    ;;
  3)
    echo ""
    echo "📋 Cursor IDE Configuration"
    echo ""
    mkdir -p ~/.cursor
    if [ -f ~/.cursor/mcp_settings.json ]; then
      echo "⚠️  Warning: ~/.cursor/mcp_settings.json already exists"
      read -p "Overwrite? (y/N): " overwrite
      if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "Skipping..."
        exit 0
      fi
    fi

    cp .mcp/cursor-config.json ~/.cursor/mcp_settings.json

    echo "✅ Configuration copied to ~/.cursor/mcp_settings.json"
    echo ""
    echo "Restart Cursor to load the MCP servers"
    echo ""
    ;;
  4)
    echo ""
    echo "📋 VSCode + Claude Code Extension Configuration"
    echo ""
    echo "Add the configuration from .mcp/README.md to your .vscode/settings.json"
    echo ""
    echo "See section: 'VSCode + Claude Code Extension Configuration'"
    echo ""
    ;;
  5)
    echo ""
    echo "📋 All Configuration Files"
    echo ""
    echo "Available configurations in .mcp/:"
    ls -lh .mcp/*.json | awk '{print "  -", $9, "(" $5 ")"}'
    echo ""
    echo "Read .mcp/README.md for detailed setup instructions"
    echo ""
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo "📖 For detailed documentation, see: .mcp/README.md"
echo ""
echo "🔧 To test the setup:"
echo "  1. Start the dev server: cd apps/example && bun run dev"
echo "  2. Ask Claude: 'Navigate to http://127.0.0.1:5200 and take a screenshot'"
echo ""
