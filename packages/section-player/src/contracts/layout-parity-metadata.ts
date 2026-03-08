import type { SectionPlayerLayoutContract } from "./layout-contract.js";
import { SECTION_PLAYER_PUBLIC_EVENTS } from "./public-events.js";

const RECOMMENDED_BASIC_PROPS = [
	"assessmentId",
	"section",
	"sectionId",
	"attemptId",
	"showToolbar",
	"toolbarPosition",
	"enabledTools",
	"itemToolbarTools",
	"passageToolbarTools",
] as const;

const ADVANCED_ESCAPE_HATCH_PROPS = [
	"runtime",
	"playerType",
	"player",
	"lazyInit",
	"tools",
	"accessibility",
	"coordinator",
	"createSectionController",
	"isolation",
	"env",
	"iifeBundleHost",
] as const;

const SHARED_PROPS = [
	...RECOMMENDED_BASIC_PROPS,
	...ADVANCED_ESCAPE_HATCH_PROPS,
] as const;

const SHARED_EVENTS = [
	SECTION_PLAYER_PUBLIC_EVENTS.runtimeOwned,
	SECTION_PLAYER_PUBLIC_EVENTS.runtimeInherited,
	SECTION_PLAYER_PUBLIC_EVENTS.runtimeError,
	SECTION_PLAYER_PUBLIC_EVENTS.compositionChanged,
	SECTION_PLAYER_PUBLIC_EVENTS.sessionChanged,
	SECTION_PLAYER_PUBLIC_EVENTS.sectionControllerReady,
	SECTION_PLAYER_PUBLIC_EVENTS.readinessChange,
	SECTION_PLAYER_PUBLIC_EVENTS.interactionReady,
	SECTION_PLAYER_PUBLIC_EVENTS.ready,
] as const;

const SHARED_COMMANDS = [
	"getSnapshot",
	"selectComposition",
	"selectNavigation",
	"selectReadiness",
	"navigateTo",
	"navigateNext",
	"navigatePrevious",
	"preloadNow",
	"getSectionController",
	"waitForSectionController",
] as const;

const SHARED_CAPABILITIES = [
	"items-pane",
	"passages-pane",
	"section-toolbar",
	"item-toolbar",
	"passage-toolbar",
	"readiness-events",
	"navigation-events",
] as const;

export const SPLITPANE_LAYOUT_CONTRACT: SectionPlayerLayoutContract = {
	version: 1,
	layout: "splitpane",
	props: SHARED_PROPS,
	recommendedBasicProps: RECOMMENDED_BASIC_PROPS,
	advancedEscapeHatchProps: ADVANCED_ESCAPE_HATCH_PROPS,
	events: SHARED_EVENTS,
	commands: SHARED_COMMANDS,
	capabilities: SHARED_CAPABILITIES,
};

export const VERTICAL_LAYOUT_CONTRACT: SectionPlayerLayoutContract = {
	version: 1,
	layout: "vertical",
	props: SHARED_PROPS,
	recommendedBasicProps: RECOMMENDED_BASIC_PROPS,
	advancedEscapeHatchProps: ADVANCED_ESCAPE_HATCH_PROPS,
	events: SHARED_EVENTS,
	commands: SHARED_COMMANDS,
	capabilities: SHARED_CAPABILITIES,
};
