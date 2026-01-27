/**
 * Configuration management for Nano Banana MCP server
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ConfigurationError } from "./errors.js";
import { logger } from "./logger.js";
import type { Config, NanoBananaModel } from "./types.js";

const CONFIG_DIR = join(homedir(), ".nanobanana-mcp");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export class ConfigManager {
	private config: Config = {};

	async load(): Promise<Config> {
		try {
			// Try environment variable first
			const apiKey = process.env.GOOGLE_API_KEY;
			if (apiKey) {
				logger.debug("Using API key from GOOGLE_API_KEY environment variable");
				this.config.apiKey = apiKey;
			}

			// Load from config file if exists
			if (existsSync(CONFIG_FILE)) {
				const content = await readFile(CONFIG_FILE, "utf-8");
				const fileConfig = JSON.parse(content);
				this.config = { ...fileConfig, ...this.config }; // env vars take precedence
				logger.debug("Loaded configuration from file", {
					configFile: CONFIG_FILE,
				});
			}

			// Set defaults
			if (!this.config.defaultModel) {
				this.config.defaultModel = "gemini-3-pro-image-preview";
			}
			if (!this.config.defaultOutputDir) {
				this.config.defaultOutputDir = process.cwd();
			}

			return this.config;
		} catch (error) {
			logger.error("Failed to load configuration", { error });
			throw new ConfigurationError(`Failed to load configuration: ${error}`);
		}
	}

	async save(config: Partial<Config>): Promise<void> {
		try {
			// Create config directory if it doesn't exist
			if (!existsSync(CONFIG_DIR)) {
				await mkdir(CONFIG_DIR, { recursive: true });
			}

			// Merge with existing config
			this.config = { ...this.config, ...config };

			// Save to file
			await writeFile(
				CONFIG_FILE,
				JSON.stringify(this.config, null, 2),
				"utf-8",
			);
			logger.info("Configuration saved", { configFile: CONFIG_FILE });
		} catch (error) {
			logger.error("Failed to save configuration", { error });
			throw new ConfigurationError(`Failed to save configuration: ${error}`);
		}
	}

	get(): Config {
		return this.config;
	}

	getApiKey(): string | undefined {
		return this.config.apiKey;
	}

	getDefaultModel(): NanoBananaModel {
		return this.config.defaultModel || "gemini-3-pro-image-preview";
	}

	getDefaultOutputDir(): string {
		return this.config.defaultOutputDir || process.cwd();
	}
}

export const configManager = new ConfigManager();
