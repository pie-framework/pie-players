/** GeoGebra calculator adapter for the generic tool-provider registry. */

import type {
	CalculatorToolProviderInitConfig,
	LazyCalculatorProviderDefinition,
} from "./LazyCalculatorToolProvider.js";
import { LazyCalculatorToolProvider } from "./LazyCalculatorToolProvider.js";
import type { ToolProviderCapabilities } from "./ToolProviderApi.js";

export interface GeoGebraToolProviderConfig
	extends CalculatorToolProviderInitConfig {
	scriptUrl?: string;
	appletTimeoutMs?: number;
}

export class GeoGebraToolProvider extends LazyCalculatorToolProvider<GeoGebraToolProviderConfig> {
	readonly providerId = "geogebra-calculator";
	readonly providerName = "GeoGebra Calculator";
	readonly version = "6";
	readonly requiresAuth = false;

	protected getDefinition(): LazyCalculatorProviderDefinition<GeoGebraToolProviderConfig> {
		return {
			backend: "geogebra",
			moduleImportOperation: "geogebra-provider-module-import",
			loadProvider: async () => {
				const module = await import("@pie-players/pie-calculator-geogebra");
				return module.GeoGebraCalculatorProvider;
			},
			initializationErrorMessage:
				"Failed to initialize GeoGebra calculator provider. Confirm that the deployment may load GeoGebra and that its script URL is reachable.",
		};
	}

	getCapabilities(): ToolProviderCapabilities {
		return {
			supportsOffline: false,
			requiresAuth: false,
			maxInstances: null,
			features: {
				basic: true,
				scientific: true,
				graphing: true,
				fourFunction: false,
			},
		};
	}
}
