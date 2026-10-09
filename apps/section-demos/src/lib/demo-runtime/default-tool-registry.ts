import type { ToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	createPackagedToolRegistry,
	DEFAULT_TOOL_MODULE_LOADERS,
} from "@pie-players/pie-default-tool-loaders";

export type SectionDemoCalculatorProvider = "desmos" | "geogebra" | "cortex";

// The calculator provider comes from `tools.providers.calculator`; the registry
// is the same for every provider.
export function createSectionDemoToolRegistry(): ToolRegistry {
	return createPackagedToolRegistry({
		toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
	});
}
