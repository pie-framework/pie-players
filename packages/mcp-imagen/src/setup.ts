/**
 * Interactive setup wizard for Nano Banana MCP server
 */

import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import { NanoBananaClient } from "./client.js";
import { configManager } from "./config.js";
import type { Config, NanoBananaModel } from "./types.js";

export async function runSetup(): Promise<void> {
	const rl = readline.createInterface({ input, output });

	console.log("\n=== Nano Banana 🍌 MCP Server Setup ===\n");
	console.log(
		"This wizard will help you configure the Nano Banana (Gemini Image) MCP server.\n",
	);

	try {
		// Load existing config
		await configManager.load();
		const existingConfig = configManager.get();

		// API Key
		console.log("Step 1: Google API Key");
		console.log("You can get an API key from: https://aistudio.google.com/");
		if (existingConfig.apiKey) {
			console.log(`Current: ${existingConfig.apiKey.substring(0, 10)}...`);
		}
		const apiKey = await rl.question(
			"Enter your Google API key (or press Enter to keep current): ",
		);
		const finalApiKey = apiKey.trim() || existingConfig.apiKey;

		if (!finalApiKey) {
			console.error("\nError: API key is required.");
			process.exit(1);
		}

		// Test API key
		console.log("\nTesting API key...");
		try {
			const client = new NanoBananaClient(finalApiKey);
			const isValid = await client.testConnection();
			if (isValid) {
				console.log("✓ API key is valid!\n");
			} else {
				console.log("✗ API key test failed. Continuing anyway...\n");
			}
		} catch (error) {
			console.log("✗ Could not validate API key:", error);
			const proceed = await rl.question("Continue anyway? (y/n): ");
			if (proceed.toLowerCase() !== "y") {
				console.log("Setup cancelled.");
				process.exit(0);
			}
		}

		// Default model
		console.log("\nStep 2: Default Model");
		console.log("Available models:");
		console.log(
			"  1. gemini-3-pro-image-preview (Nano Banana Pro - recommended)",
		);
		console.log("  2. gemini-2.5-flash-image (Nano Banana Fast)");
		if (existingConfig.defaultModel) {
			console.log(`Current: ${existingConfig.defaultModel}`);
		}
		const modelChoice = await rl.question(
			"Select default model (1-3, or press Enter for Standard): ",
		);

		let defaultModel: NanoBananaModel = "gemini-3-pro-image-preview";
		switch (modelChoice.trim()) {
			case "1":
			case "":
				defaultModel = "gemini-3-pro-image-preview";
				break;
			case "2":
				defaultModel = "gemini-2.5-flash-image";
				break;
			default:
				console.log("Invalid choice, using Nano Banana Pro.");
				defaultModel = "gemini-3-pro-image-preview";
				break;
		}

		// Default output directory
		console.log("\nStep 3: Default Output Directory");
		if (existingConfig.defaultOutputDir) {
			console.log(`Current: ${existingConfig.defaultOutputDir}`);
		}
		const outputDir = await rl.question(
			`Enter default output directory (or press Enter for current directory): `,
		);
		const finalOutputDir =
			outputDir.trim() || existingConfig.defaultOutputDir || process.cwd();

		// Save configuration
		const newConfig: Config = {
			apiKey: finalApiKey,
			defaultModel,
			defaultOutputDir: finalOutputDir,
		};

		await configManager.save(newConfig);

		console.log("\n✓ Configuration saved successfully!");
		console.log("\nYou can now use the Imagen MCP server.");
		console.log("Add this to your .mcp.json:");
		console.log(`
{
  "mcpServers": {
    "imagen": {
      "command": "bun",
      "args": ["run", "packages/mcp-imagen/src/index.ts"]
    }
  }
}`);
	} catch (error) {
		console.error("\nSetup failed:", error);
		process.exit(1);
	} finally {
		rl.close();
	}
}
