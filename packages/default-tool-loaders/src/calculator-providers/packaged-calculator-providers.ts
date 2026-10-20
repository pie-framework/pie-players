/**
 * The calculator backends of the packaged set, by `provider.id`. Every import
 * named here lands in a host bundle that inlines dynamic imports, so only thin
 * adapters over a vendor-hosted engine belong in it.
 */

import type { CalculatorProviderDefinition } from "./LazyCalculatorToolProvider.js";

export const DEFAULT_CALCULATOR_PROVIDER_ID = "calculator-desmos";

export const PACKAGED_CALCULATOR_PROVIDERS: Readonly<
	Record<string, CalculatorProviderDefinition>
> = {
	"calculator-desmos": {
		providerName: "Desmos Calculator",
		version: "1.12",
		requiresAuth: true,
		backend: "desmos",
		load: async () =>
			(await import("@pie-players/pie-calculator-desmos"))
				.DesmosCalculatorProvider,
		initializationErrorMessage:
			"Failed to initialize Desmos calculator provider. Check the application key, preloaded API, runtime endpoint, or network access.",
	},
	"calculator-geogebra": {
		providerName: "GeoGebra Calculator",
		version: "6",
		requiresAuth: false,
		backend: "geogebra",
		load: async () =>
			(await import("@pie-players/pie-calculator-geogebra"))
				.GeoGebraCalculatorProvider,
		initializationErrorMessage:
			"Failed to initialize GeoGebra calculator provider. Confirm that the deployment may load GeoGebra and that its script URL is reachable.",
	},
};
