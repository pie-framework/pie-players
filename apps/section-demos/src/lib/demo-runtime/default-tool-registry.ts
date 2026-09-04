import type { ToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	createDefaultToolModuleLoaders,
	createPackagedToolRegistry,
} from "@pie-players/pie-default-tool-loaders";

export function createSectionDemoToolRegistry(): ToolRegistry {
	return createSectionDemoToolRegistryForCalculator();
}

export type SectionDemoCalculatorProvider = "desmos" | "geogebra" | "cortex";

const CALCULATOR_PROVIDER_IDS: Record<
	SectionDemoCalculatorProvider,
	string | undefined
> = {
	// Undefined rather than `calculator-desmos`: passing nothing is what exercises
	// `DEFAULT_CALCULATOR_PROVIDER_ID`, which is the path most hosts are on.
	desmos: undefined,
	geogebra: "calculator-geogebra",
	cortex: "calculator-cortex",
};

export function createSectionDemoToolRegistryForCalculator(
	calculatorProvider: SectionDemoCalculatorProvider = "desmos",
): ToolRegistry {
	const providerId = CALCULATOR_PROVIDER_IDS[calculatorProvider];
	const calculatorProviderConfig = providerId
		? { provider: { id: providerId } }
		: undefined;
	return createPackagedToolRegistry({
		calculatorProviderConfig,
		toolModuleLoaders: createDefaultToolModuleLoaders({
			calculatorProviderConfig,
		}),
	});
}
