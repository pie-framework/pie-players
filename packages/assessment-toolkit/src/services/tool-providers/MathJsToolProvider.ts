/**
 * Math.js Calculator Tool Provider
 *
 * Provides an open-source calculator provider that supports
 * basic and scientific calculator types without API keys.
 */

import type { CalculatorProvider } from "@pie-players/pie-calculator";
import { MathJsCalculatorProvider } from "../../tools/calculators/mathjs-provider.js";
import type { IToolProvider, ToolProviderCapabilities } from "./IToolProvider.js";

export interface MathJsToolProviderConfig {
	defaultConfig?: Record<string, unknown>;
}

export class MathJsToolProvider
	implements IToolProvider<MathJsToolProviderConfig, CalculatorProvider>
{
	readonly providerId = "mathjs-calculator";
	readonly providerName = "Math.js Calculator";
	readonly category = "calculator" as const;
	readonly version = "1.0";
	readonly requiresAuth = false;

	private mathjsProvider: MathJsCalculatorProvider | null = null;

	async initialize(_config: MathJsToolProviderConfig): Promise<void> {
		if (this.mathjsProvider) {
			return;
		}

		this.mathjsProvider = new MathJsCalculatorProvider();
		await this.mathjsProvider.initialize();
		console.log("[MathJsToolProvider] Initialized successfully");
	}

	async createInstance(): Promise<CalculatorProvider> {
		if (!this.mathjsProvider) {
			throw new Error(
				"[MathJsToolProvider] Provider not initialized. Call initialize() first.",
			);
		}

		return this.mathjsProvider;
	}

	getCapabilities(): ToolProviderCapabilities {
		return {
			supportsOffline: false,
			requiresAuth: false,
			maxInstances: null,
			features: {
				basic: true,
				scientific: true,
				graphing: false,
				fourFunction: true,
			},
		};
	}

	isReady(): boolean {
		return this.mathjsProvider !== null;
	}

	destroy(): void {
		if (this.mathjsProvider) {
			this.mathjsProvider.destroy();
			this.mathjsProvider = null;
		}
		console.log("[MathJsToolProvider] Destroyed");
	}
}
