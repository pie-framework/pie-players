import type { ToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	createCalculatorToolRegistration,
	createPackagedToolRegistry,
} from "@pie-players/pie-default-tool-loaders";

export type SectionDemoCalculatorProvider = "desmos" | "geogebra" | "cortex";

// The packaged set covers Desmos and GeoGebra; the demos add Cortex, the way a
// host composes in a backend the packaged set leaves out. Which backend runs
// still comes from `tools.providers.calculator`.
const calculatorToolRegistration = createCalculatorToolRegistration({
	providers: {
		"calculator-cortex": {
			providerName: "PIE Open-Source Calculator",
			version: "1",
			requiresAuth: false,
			backend: "cortex",
			load: async () =>
				(await import("@pie-players/pie-calculator-cortex"))
					.CortexCalculatorProvider,
			initializationErrorMessage:
				"Failed to initialize the PIE open-source calculator provider. Confirm that this browser supports module workers and that the bundled worker assets are available.",
		},
	},
});

export function createSectionDemoToolRegistry(): ToolRegistry {
	return createPackagedToolRegistry({
		overrides: { calculator: calculatorToolRegistration },
	});
}
