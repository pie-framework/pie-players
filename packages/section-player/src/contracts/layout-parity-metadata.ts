import type { SectionPlayerLayoutContract } from "./layout-contract.js";
import { SECTION_PLAYER_PUBLIC_EVENTS } from "./public-events.js";

const SHARED_PROPS = [
	"assessmentId",
	"runtime",
	"section",
	"sectionId",
	"attemptId",
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
	"showToolbar",
	"toolbarPosition",
	"enabledTools",
	"itemToolbarTools",
	"passageToolbarTools",
] as const;

const SHARED_EVENTS = [
	SECTION_PLAYER_PUBLIC_EVENTS.runtimeOwned,
	SECTION_PLAYER_PUBLIC_EVENTS.runtimeInherited,
	SECTION_PLAYER_PUBLIC_EVENTS.runtimeError,
	SECTION_PLAYER_PUBLIC_EVENTS.compositionChanged,
	SECTION_PLAYER_PUBLIC_EVENTS.sessionChanged,
	SECTION_PLAYER_PUBLIC_EVENTS.navigationChange,
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
	events: SHARED_EVENTS,
	commands: SHARED_COMMANDS,
	capabilities: SHARED_CAPABILITIES,
};

export const VERTICAL_LAYOUT_CONTRACT: SectionPlayerLayoutContract = {
	version: 1,
	layout: "vertical",
	props: SHARED_PROPS,
	events: SHARED_EVENTS,
	commands: SHARED_COMMANDS,
	capabilities: SHARED_CAPABILITIES,
};
