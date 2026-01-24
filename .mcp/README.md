# MCP Server Configuration for pie-players

This directory contains configuration for Model Context Protocol (MCP) servers that enhance the development workflow for the pie-players monorepo.

## Overview

Four MCP servers are configured to provide specialized capabilities:

1. **Browser Automation** (`@playwright/mcp`) - Extends Playwright testing
2. **npm/Package Registry** (`@modelcontextprotocol/server-npm`) - Manages workspace packages
3. **File System** (`@modelcontextprotocol/server-filesystem`) - Efficient monorepo navigation
4. **Memory/Context** (`@modelcontextprotocol/server-memory`) - Persistent project knowledge

## Configuration Files

- `servers.json` - Master configuration (generic, absolute paths)
- `claude-code-config.json` - **Claude Code CLI** configuration (relative paths)
- `cursor-config.json` - **Cursor IDE** configuration (workspace variables)
- `servers/` - Individual server configurations (for reference/testing)
  - `browser-automation.json`
  - `npm-registry.json`
  - `filesystem.json`
  - `memory.json`

### Configuration Notes

**Port Configuration**: The Browser Automation MCP is configured with `BASE_URL: "http://127.0.0.1:5200"` which matches the default dev server port in `apps/example/playwright.config.ts`. If your dev server runs on a different port, update the `BASE_URL` in your MCP configuration accordingly.

**Path Configuration**: The configurations use absolute paths for Claude Desktop and relative paths for Claude Code CLI. Update paths to match your local setup when copying configurations.

### Which Configuration to Use?

| Tool | Configuration File | Setup Location |
|------|-------------------|----------------|
| **Claude Desktop** | Copy from README | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Claude Code (CLI)** | `claude-code-config.json` | `~/.claude-code/mcp-servers.json` |
| **Cursor IDE** | `cursor-config.json` | `~/.cursor/mcp_settings.json` |
| **VSCode + Extension** | Copy from README | `.vscode/settings.json` |

## Setup Instructions

### Prerequisites

- **Node.js 18+** (for MCP servers)
- **Bun 1.3.5+** (already in use for the project)
- **Playwright browsers** (already installed for E2E tests)
- **Claude Desktop** or **Claude Code VSCode extension**

### Installation

MCP servers will be automatically installed on first use via `npx -y`. No manual installation required!

Alternatively, install globally for faster startup:

```bash
npm install -g @playwright/mcp
npm install -g @modelcontextprotocol/server-npm
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-memory
```

### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pie-players-browser": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"],
      "env": {
        "PLAYWRIGHT_CONFIG": "/Users/eelco.hillenius/dev/prj/pie/pie-players/apps/example/playwright.config.ts",
        "BASE_URL": "http://127.0.0.1:5200"
      }
    },
    "pie-players-npm": {
      "command": "bun",
      "args": ["run", "@modelcontextprotocol/server-npm"],
      "env": {
        "WORKSPACE_ROOT": "/Users/eelco.hillenius/dev/prj/pie/pie-players"
      }
    },
    "pie-players-fs": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/eelco.hillenius/dev/prj/pie/pie-players"
      ]
    },
    "pie-players-memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_DB_PATH": "/Users/eelco.hillenius/dev/prj/pie/pie-players/.mcp/memory.db"
      }
    }
  }
}
```

**Important**: Replace `/Users/eelco.hillenius/dev/prj/pie/pie-players` with your actual absolute path to the project.

### Claude Code (CLI) Configuration

If using Claude Code (the CLI tool), you have two options:

**Option 1: Project-level (Recommended)**

Create a symlink in your home directory:
```bash
ln -s /Users/eelco.hillenius/dev/prj/pie/pie-players/.mcp/claude-code-config.json ~/.claude-code/mcp-servers.json
```

Or copy the configuration:
```bash
mkdir -p ~/.claude-code
cp .mcp/claude-code-config.json ~/.claude-code/mcp-servers.json
```

**Option 2: Use project configuration directly**

The configuration file is at `.mcp/claude-code-config.json` with relative paths for workspace portability.

**Configuration file**: `.mcp/claude-code-config.json`

### Cursor IDE Configuration

Cursor supports MCP servers through its settings. Add the configuration from `.mcp/cursor-config.json` to your Cursor settings:

**Location**: Cursor Settings → Extensions → MCP Servers

Or manually edit `~/.cursor/mcp_settings.json`:

```bash
# Copy the configuration
mkdir -p ~/.cursor
cp .mcp/cursor-config.json ~/.cursor/mcp_settings.json
```

**Configuration file**: `.mcp/cursor-config.json`

### VSCode + Claude Code Extension Configuration

If using the Claude Code VSCode extension, add to `.vscode/settings.json`:

```json
{
  "claude.mcpServers": {
    "browser-automation": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"],
      "env": {
        "PLAYWRIGHT_CONFIG": "${workspaceFolder}/apps/example/playwright.config.ts",
        "BASE_URL": "http://127.0.0.1:5200"
      }
    },
    "npm-registry": {
      "command": "bun",
      "args": ["run", "@modelcontextprotocol/server-npm"],
      "env": {
        "WORKSPACE_ROOT": "${workspaceFolder}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "${workspaceFolder}"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "env": {
        "MEMORY_DB_PATH": "${workspaceFolder}/.mcp/memory.db"
      }
    }
  }
}
```

## Usage

### Browser Automation MCP

Interact with the example app and run automated tests:

```
# Examples:
- "Navigate to http://127.0.0.1:5200 and take a screenshot"
- "Run an accessibility scan on the /samples page"
- "Click on the Multiple Choice sample and verify it loads"
- "Generate a Playwright test for the assessment player flow"
```

**Prerequisites**: Dev server must be running (`bun run dev` in `apps/example`)

### npm/Package Registry MCP

Query package information and manage workspace:

```
# Examples:
- "Search for @pie-framework/pie-esm-player on npm"
- "Compare published versions with local package.json versions"
- "List all workspace packages"
- "Show the dependency tree for assessment-player"
- "Check which packages have unpublished changes"
```

### File System MCP

Navigate and search the monorepo efficiently:

```
# Examples:
- "Search for ToolCoordinator references across packages/"
- "List all Svelte components in packages/players-shared/"
- "Read docs/ARCHITECTURE.md"
- "Find all test files that mention accessibility"
- "Show me the structure of packages/tool-calculator/"
```

### Memory/Context MCP

Store and retrieve project knowledge:

```
# Store knowledge:
- "Remember that direct dist import is used because Bun can't transpile TypeScript in node_modules"
- "Store: The ToolCoordinator pattern requires each tool to register and coordinator manages state"
- "Remember that assessment-player depends on assessment-toolkit"

# Query knowledge:
- "Why do we import from dist directly?"
- "How do tools integrate with the coordinator?"
- "What are the trade-offs between ESM, IIFE, and Fixed players?"
- "What depends on assessment-toolkit?"
```

## Server Details

### Browser Automation
- **Server**: `@playwright/mcp`
- **Config**: `apps/example/playwright.config.ts`
- **Base URL**: `http://127.0.0.1:5200` (default dev server port - update if your port differs)
- **Capabilities**: Test recording, visual testing, accessibility scanning, browser control
- **Note**: The BASE_URL must match the port your dev server runs on

### npm/Registry
- **Server**: `@modelcontextprotocol/server-npm`
- **Registry**: https://registry.npmjs.org
- **Scope**: All `@pie-framework/pie-*` packages (23 workspace packages)
- **Capabilities**: Package search, version management, dependency analysis, publishing status

### File System
- **Server**: `@modelcontextprotocol/server-filesystem`
- **Root**: Project root directory
- **Watch**: Source files in `packages/*/src/`, `apps/*/src/`, `docs/`
- **Exclude**: `node_modules/`, `dist/`, `.turbo/`, `local-builds/`, `.playwright-browsers/`
- **Capabilities**: Fast search, file watching, directory navigation, content indexing

### Memory
- **Server**: `@modelcontextprotocol/server-memory`
- **Storage**: SQLite at `.mcp/memory.db` (git-ignored)
- **Embedding Model**: text-embedding-3-small
- **Capabilities**: Semantic search, entity relationships, decision tracking, pattern recognition

## Troubleshooting

### Server Not Starting

1. Check Node.js version: `node --version` (requires 18+)
2. Verify installation: `npx @modelcontextprotocol/server-memory --help`
3. Check logs in Claude Desktop (Help → View Logs)

### Browser Automation Issues

1. Ensure dev server is running: `bun run dev` in `apps/example`
2. Verify Playwright is installed: `bunx playwright --version`
3. Check browser installation: `bunx playwright install chromium`
4. **Port mismatch**: If your dev server uses a different port than 5200, update the `BASE_URL` in your MCP configuration to match (e.g., `"BASE_URL": "http://127.0.0.1:3000"`)

### File System Permission Errors

The file system server only has access to the project directory specified in `ALLOWED_DIRECTORIES`. To access other directories, update the configuration.

### Memory Database Locked

If multiple Claude instances try to access the memory database simultaneously:
- Close other Claude instances
- Or use per-user database paths in configuration

### npm Registry Timeout

If experiencing slow npm queries:
- Check internet connection
- Verify npm registry is accessible: `curl https://registry.npmjs.org`
- Consider using npm cache: `npm config get cache`

## Team Sharing

### Sharing Memory Knowledge

The memory database (`.mcp/memory.db`) is git-ignored. To share knowledge with the team:

1. **Export memory to version-controlled location**:
   ```bash
   mkdir -p docs/memory-exports
   # Export command will be available through Memory MCP
   ```

2. **Document important decisions** in:
   - `docs/ARCHITECTURE.md` - Architecture decisions
   - `docs/CDN_USAGE.md` - Integration patterns
   - `.claude/instructions.md` - Development conventions

3. **Rebuild memory from documentation**:
   - New team members can seed their local memory by reading docs
   - Memory MCP will index the documentation automatically

## Adding New Servers

To add additional MCP servers:

1. Add configuration to `servers.json`
2. Create individual config file in `servers/`
3. Update this README with usage examples
4. Update team members' Claude Desktop config

## Performance Tips

- **Browser Automation**: Keep dev server running to avoid startup delays
- **File System**: Use specific glob patterns for faster searches
- **Memory**: Query with specific keywords for more relevant results
- **npm**: Use local package.json for faster workspace queries

## Security Notes

- MCP servers run locally with your user permissions
- File system server is restricted to project directory
- Browser automation connects only to localhost dev server
- Memory database is local and not shared externally
- npm queries use public registry (https://registry.npmjs.org)

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Anthropic MCP Integration Guide](https://docs.anthropic.com/mcp)
- [Project Architecture](../docs/ARCHITECTURE.md)
- [Playwright Configuration](../apps/example/playwright.config.ts)
- [Workspace Configuration](../package.json)

## Support

For issues or questions:
- Check Claude Desktop logs (Help → View Logs)
- Review MCP server documentation
- Ask in team chat or create a GitHub issue
- Consult `.claude/instructions.md` for project conventions
