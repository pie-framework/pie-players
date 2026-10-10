/** Fully bundled open-source calculator adapter for the tool-provider registry. */

import type {
	CalculatorToolProviderInitConfig,
	LazyCalculatorProviderDefinition,
} from "./LazyCalculatorToolProvider.js";
import { LazyCalculatorToolProvider } from "./LazyCalculatorToolProvider.js";

export type CortexToolProviderConfig = CalculatorToolProviderInitConfig;

export class CortexToolProvider extends LazyCalculatorToolProvider<CortexToolProviderConfig> {
	readonly providerName = "PIE Open-Source Calculator";
	readonly version = "1";
	readonly requiresAuth = false;

	protected getDefinition(): LazyCalculatorProviderDefinition<CortexToolProviderConfig> {
		return {
			backend: "cortex",
			moduleImportOperation: "cortex-provider-module-import",
			loadProvider: async () => {
				const module = await import("@pie-players/pie-calculator-cortex");
				return module.CortexCalculatorProvider;
			},
			initializationErrorMessage:
				"Failed to initialize the PIE open-source calculator provider. Confirm that this browser supports module workers and that the bundled worker assets are available.",
		};
	}
}
