/** Desmos calculator adapter for the generic tool-provider registry. */

import type { CalculatorToolProviderInitConfig } from "./LazyCalculatorToolProvider.js";
import { LazyCalculatorToolProvider } from "./LazyCalculatorToolProvider.js";
import type { ToolProviderCapabilities } from "./ToolProviderApi.js";

export interface DesmosToolProviderConfig
	extends CalculatorToolProviderInitConfig {
	/** Desmos API key licensed for this application. */
	apiKey?: string;
	/**
	 * Runtime endpoint returning `{ apiKey: string }`. The browser still receives
	 * the key in the Desmos script URL; this only keeps it out of static assets.
	 */
	proxyEndpoint?: string;
}

export class DesmosToolProvider extends LazyCalculatorToolProvider<DesmosToolProviderConfig> {
	readonly providerId = "desmos-calculator";
	readonly providerName = "Desmos Calculator";
	readonly version = "1.12";
	readonly requiresAuth = true;

	protected getDefinition() {
		return {
			backend: "desmos",
			moduleImportOperation: "desmos-provider-module-import",
			loadProvider: async () => {
				const module = await import("@pie-players/pie-calculator-desmos");
				return module.DesmosCalculatorProvider;
			},
			initializationErrorMessage:
				"Failed to initialize Desmos calculator provider. Check the application key, preloaded API, runtime endpoint, or network access.",
		};
	}

	getCapabilities(): ToolProviderCapabilities {
		return {
			supportsOffline: false,
			requiresAuth: true,
			maxInstances: null,
			features: {
				basic: true,
				scientific: true,
				graphing: true,
				fourFunction: true,
			},
		};
	}
}
