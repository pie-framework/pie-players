import type {
	ToolbarItem,
	ToolRegistry,
} from "@pie-players/pie-assessment-toolkit";
import { createSectionDemoToolRegistry } from "../default-tool-registry";
import { sectionMetaInfoToolRegistration } from "./progress-jump";
import { wordCounterToolRegistration } from "./word-counter";

export interface DemoCustomToolsIntegration {
	toolRegistry: ToolRegistry;
	sectionHostButtons: ToolbarItem[];
	itemHostButtons: ToolbarItem[];
	passageHostButtons: ToolbarItem[];
}

export function createDemoCustomToolsIntegration(): DemoCustomToolsIntegration {
	const toolRegistry = createSectionDemoToolRegistry();
	toolRegistry.register(wordCounterToolRegistration);
	toolRegistry.register(sectionMetaInfoToolRegistration);

	return {
		toolRegistry,
		sectionHostButtons: [],
		itemHostButtons: [],
		passageHostButtons: [],
	};
}
