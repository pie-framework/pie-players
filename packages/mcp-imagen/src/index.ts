#!/usr/bin/env node
/**
 * Entry point for Nano Banana MCP server
 */

import { NanoBananaMcpServer } from './server.js';
import { runSetup } from './setup.js';
import { logger } from './logger.js';

async function main() {
  const args = process.argv.slice(2);

  // Handle setup command
  if (args.includes('setup') || args.includes('--setup')) {
    await runSetup();
    process.exit(0);
  }

  // Handle help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Nano Banana MCP Server 🍌 - Gemini Image Generation

Usage:
  imagen-mcp              Start the MCP server
  imagen-mcp setup        Run interactive setup wizard
  imagen-mcp --help       Show this help message

Environment Variables:
  GOOGLE_API_KEY          Google API key (required)
  LOG_LEVEL               Logging level (error, warn, info, debug)

Configuration:
  Configuration is stored in: ~/.imagen-mcp/config.json
  Run 'imagen-mcp setup' to configure interactively.

MCP Configuration:
  Add this to your .mcp.json:
  {
    "mcpServers": {
      "imagen": {
        "command": "bun",
        "args": ["run", "packages/mcp-imagen/src/index.ts"],
        "env": {
          "GOOGLE_API_KEY": "your-api-key-here"
        }
      }
    }
  }

More Info:
  - Get API key: https://aistudio.google.com/
  - Documentation: https://ai.google.dev/gemini-api/docs/imagen
`);
    process.exit(0);
  }

  // Start server
  try {
    logger.info('Starting Nano Banana MCP server');
    const server = new NanoBananaMcpServer();
    await server.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    console.error('Failed to start Nano Banana MCP server:', error);
    process.exit(1);
  }
}

main();
