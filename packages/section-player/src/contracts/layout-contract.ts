import type { SectionPlayerPublicEventName } from "./public-events.js";

export type SectionPlayerLayoutName = "splitpane" | "vertical" | "tabbed";

export type SectionPlayerLayoutCapability =
	| "items-pane"
	| "passages-pane"
	| "section-toolbar"
	| "item-toolbar"
	| "passage-toolbar"
	| "readiness-events"
	| "navigation-events";

export type SectionPlayerBasicPropName =
	| "assessmentId"
	| "section"
	| "sectionId"
	| "attemptId"
	| "debug"
	| "showToolbar"
	| "toolbarPosition"
	| "narrowLayoutBreakpoint"
	| "contentMaxWidthNoPassage"
	| "contentMaxWidthWithPassage"
	| "splitPaneMinRegionWidth"
	| "splitPaneCollapseStrategy"
	| "enabledTools"
	| "itemToolbarTools"
	| "passageToolbarTools";

export type SectionPlayerAdvancedPropName =
	| "runtime"
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
	| "toolRegistry"
	| "sectionHostButtons"
	| "itemHostButtons"
	| "passageHostButtons"
	| "policies"
	| "toolConfigStrictness"
	| "hooks"
	| "onFrameworkError";

export type SectionPlayerLayoutPropName =
	| SectionPlayerBasicPropName
	| SectionPlayerAdvancedPropName;

export type SectionPlayerLayoutCommandName =
	| "getSnapshot"
	| "selectComposition"
	| "selectNavigation"
	| "selectReadiness"
	| "navigateTo"
	| "navigateNext"
	| "navigatePrevious"
	| "getSectionController"
	| "waitForSectionController";

export type SectionPlayerLayoutContract = {
	version: 1;
	layout: SectionPlayerLayoutName;
	props: readonly SectionPlayerLayoutPropName[];
	recommendedBasicProps: readonly SectionPlayerBasicPropName[];
	advancedEscapeHatchProps: readonly SectionPlayerAdvancedPropName[];
	events: readonly SectionPlayerPublicEventName[];
	commands: readonly SectionPlayerLayoutCommandName[];
	capabilities: readonly SectionPlayerLayoutCapability[];
};
