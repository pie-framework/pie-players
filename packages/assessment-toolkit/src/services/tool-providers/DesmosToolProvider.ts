/** Desmos calculator adapter for the generic tool-provider registry. */

import type { CalculatorProviderInit } from "@pie-players/pie-calculator";
import {
	LazyCalculatorToolProvider,
	type LazyCalculatorProviderDefinition,
} from "./LazyCalculatorToolProvider.js";
import type { ToolProviderCapabilities } from "./ToolProviderApi.js";

/** Provider initialization is the provider-neutral calculator contract. */
export type DesmosToolProviderConfig = CalculatorProviderInit;

export class DesmosToolProvider extends LazyCalculatorToolProvider<DesmosToolProviderConfig> {
	readonly providerId = "desmos-calculator";
	readonly providerName = "Desmos Calculator";
	readonly version = "1.12";
	readonly requiresAuth = true;

	protected getDefinition(): LazyCalculatorProviderDefinition<DesmosToolProviderConfig> {
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
