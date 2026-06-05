import {
	createPackagedToolRegistry,
	type ToolRegistry,
} from "@pie-players/pie-assessment-toolkit";
import { DEFAULT_TOOL_MODULE_LOADERS } from "@pie-players/pie-default-tool-loaders";

export function createSectionDemoToolRegistry(): ToolRegistry {
	return createPackagedToolRegistry({
		toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
	});
}
