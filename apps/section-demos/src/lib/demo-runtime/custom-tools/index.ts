import {
	createPackagedToolRegistry,
	type ToolbarItem,
	type ToolRegistry,
} from "@pie-players/pie-assessment-toolkit";
import { sectionMetaInfoToolRegistration } from "./progress-jump";
import { wordCounterToolRegistration } from "./word-counter";

export interface DemoCustomToolsIntegration {
	toolRegistry: ToolRegistry;
	sectionHostButtons: ToolbarItem[];
	itemHostButtons: ToolbarItem[];
	passageHostButtons: ToolbarItem[];
}

export function createDemoCustomToolsIntegration(): DemoCustomToolsIntegration {
	const toolRegistry = createPackagedToolRegistry();
	toolRegistry.register(wordCounterToolRegistration);
	toolRegistry.register(sectionMetaInfoToolRegistration);

	return {
		toolRegistry,
		sectionHostButtons: [],
		itemHostButtons: [],
		passageHostButtons: [],
	};
}
