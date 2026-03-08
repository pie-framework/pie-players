import type { SectionPlayerPublicEventName } from "./public-events.js";

export type SectionPlayerLayoutName = "splitpane" | "vertical";

export type SectionPlayerLayoutCapability =
	| "items-pane"
	| "passages-pane"
	| "section-toolbar"
	| "item-toolbar"
	| "passage-toolbar"
	| "readiness-events"
	| "navigation-events";

export type SectionPlayerLayoutPropName =
	| "assessmentId"
	| "runtime"
	| "section"
	| "sectionId"
	| "attemptId"
	| "playerType"
	| "player"
	| "lazyInit"
	| "tools"
	| "accessibility"
	| "coordinator"
	| "createSectionController"
	| "isolation"
	| "env"
	| "iifeBundleHost"
	| "showToolbar"
	| "toolbarPosition"
	| "enabledTools"
	| "itemToolbarTools"
	| "passageToolbarTools";

export type SectionPlayerLayoutCommandName =
	| "getSnapshot"
	| "selectComposition"
	| "selectNavigation"
	| "selectReadiness"
	| "navigateTo"
	| "navigateNext"
	| "navigatePrevious"
	| "preloadNow";

export type SectionPlayerLayoutContract = {
	version: 1;
	layout: SectionPlayerLayoutName;
	props: readonly SectionPlayerLayoutPropName[];
	events: readonly SectionPlayerPublicEventName[];
	commands: readonly SectionPlayerLayoutCommandName[];
	capabilities: readonly SectionPlayerLayoutCapability[];
};
