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
export { default as PieItemShellElement } from "./components/ItemShellElement.svelte";
export { default as PiePassageShellElement } from "./components/PassageShellElement.svelte";
export { default as PieSectionPlayerBaseElement } from "./components/PieSectionPlayerBaseElement.svelte";
export { default as PieSectionPlayerSplitPaneElement } from "./components/PieSectionPlayerSplitPaneElement.svelte";
export { default as PieSectionPlayerVerticalElement } from "./components/PieSectionPlayerVerticalElement.svelte";

// Make sure the web component is registered
// This is what makes it available as <pie-section-player> in HTML
import "./PieSectionPlayer.svelte";
import "./components/ItemShellElement.svelte";
import "./components/PassageShellElement.svelte";
import "./components/section-player-base-element";
import "./components/item-shell-element";
import "./components/passage-shell-element";
import "./components/section-player-splitpane-element";
import "./components/section-player-vertical-element";
