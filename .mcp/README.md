# MCP Server Configuration for pie-players

This directory contains configuration for Model Context Protocol (MCP) servers used by the `pie-players` monorepo.

## Overview

The current setup includes:

1. **npm/Package Registry** (`@modelcontextprotocol/server-npm`)
2. **File System** (`@modelcontextprotocol/server-filesystem`)
3. **Memory/Context** (`@modelcontextprotocol/server-memory`)
4. **Imagen** (`@studio-gigs/mcp-imagen`)

## Configuration Files

- `servers.json` - shared project configuration
- `claude-code-config.json` - Claude Code CLI
- `cursor-config.json` - Cursor IDE
- `servers/` - per-server examples and overrides

## Setup

### Claude Code (CLI)

```bash
mkdir -p ~/.claude-code
cp .mcp/claude-code-config.json ~/.claude-code/mcp-servers.json
```

### Cursor IDE

```bash
mkdir -p ~/.cursor
cp .mcp/cursor-config.json ~/.cursor/mcp_settings.json
```

### VSCode + Claude Code extension

Copy the server entries from `.mcp/cursor-config.json` into your VSCode MCP settings.

## Usage

### npm/Registry MCP

Use this server to query package metadata, dependency graphs, and publish state.

### File System MCP

Use this server for fast workspace navigation and code search.

### Memory MCP

Use this server for storing and retrieving project notes and decisions.

## Troubleshooting

- Verify Node.js 18+ is installed.
- Verify Bun is installed and available on PATH.
- If a server fails to start, check command availability with `npx`/`bun`.
- For permission issues, ensure paths in config point to this workspace.

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Workspace Configuration](../package.json)
