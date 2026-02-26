export { default as PieSectionPlayer } from "./PieSectionPlayer.svelte";
export {
	DEFAULT_LAYOUT_DEFINITIONS,
	DEFAULT_PLAYER_DEFINITIONS,
	mergeComponentDefinitions,
	type ComponentDefinition,
	type LayoutDefinitionMap,
	type PlayerDefinitionMap,
} from "./component-definitions.js";
export { SectionController } from "./controllers/SectionController.js";
export type {
	SectionCompositionModel,
	SectionControllerInput,
	SectionViewModel,
	SectionNavigationState,
	SectionSessionState,
} from "./controllers/types.js";

// Make sure the web component is registered
// This is what makes it available as <pie-section-player> in HTML
import "./PieSectionPlayer.svelte";
