import type { ToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	createDefaultToolModuleLoaders,
	createPackagedToolRegistry,
} from "@pie-players/pie-default-tool-loaders";

export function createSectionDemoToolRegistry(): ToolRegistry {
	return createSectionDemoToolRegistryForCalculator();
}

export function createSectionDemoToolRegistryForCalculator(
	calculatorProvider: "desmos" | "geogebra" = "desmos",
): ToolRegistry {
	const calculatorProviderConfig =
		calculatorProvider === "geogebra"
			? { provider: { id: "calculator-geogebra" } }
			: undefined;
	return createPackagedToolRegistry({
		calculatorProviderConfig,
		toolModuleLoaders: createDefaultToolModuleLoaders({
			calculatorProviderConfig,
		}),
	});
}
