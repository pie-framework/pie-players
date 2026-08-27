import type { ToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	createPackagedToolRegistry,
	DEFAULT_TOOL_MODULE_LOADERS,
} from "@pie-players/pie-default-tool-loaders";

export function createSectionDemoToolRegistry(): ToolRegistry {
	return createSectionDemoToolRegistryForCalculator();
}

export function createSectionDemoToolRegistryForCalculator(
	calculatorProvider: "desmos" | "geogebra" = "desmos",
): ToolRegistry {
	const usesGeoGebra = calculatorProvider === "geogebra";
	return createPackagedToolRegistry({
		toolTagMap: usesGeoGebra
			? { calculator: "pie-tool-calculator-geogebra" }
			: undefined,
		toolModuleLoaders: usesGeoGebra
			? {
					...DEFAULT_TOOL_MODULE_LOADERS,
					calculator: () => import("@pie-players/pie-tool-calculator-geogebra"),
				}
			: DEFAULT_TOOL_MODULE_LOADERS,
	});
}
