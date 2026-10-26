import type {
	ToolConfigStrictness,
	ToolRegistry,
	ToolbarItem,
} from "@pie-players/pie-assessment-toolkit";
import type {
	AssessmentEntity,
	AssessmentSection,
	SectionControllerSessionState,
} from "@pie-players/pie-players-shared/types";
import type { SectionPlayerRuntimeConfig } from "../components/shared/section-player-backend-delivery.js";
import type { withHostMethods } from "../components/shared/layout-host-methods.js";
import type { SectionPlayerPolicies } from "../policies/types.js";
import type { SectionPlayerHostHooks } from "./host-hooks.js";
import type { SectionPlayerRuntimeHostContract } from "./runtime-host-contract.js";

/** Property inputs shared by the section layouts and their native host interfaces. */
export interface SectionPlayerElementProps {
	runtime?: SectionPlayerRuntimeConfig | null;
	ndsIcons?: boolean;
	locale?: string;
	section?: AssessmentSection | null;
	session?: SectionControllerSessionState | null;
	assessment?: AssessmentEntity | null;
	sectionId?: string;
	attemptId?: string;
	iifeBundleHost?: string;
	debug?: string | boolean;
	baseHeadingLevel?: number;
	showToolbar?: boolean | string | null;
	toolbarPosition?: string;
	toolRegistry?: ToolRegistry | null;
	sectionHostButtons?: ToolbarItem[];
	itemHostButtons?: ToolbarItem[];
	passageHostButtons?: ToolbarItem[];
	policies?: Partial<SectionPlayerPolicies>;
	hooks?: SectionPlayerHostHooks;
	toolConfigStrictness?: ToolConfigStrictness;
	narrowLayoutBreakpoint?: number;
	contentMaxWidthNoPassage?: number;
	contentMaxWidthWithPassage?: number;
}

/** Additional property inputs of the split-pane layout. */
export interface SectionPlayerSplitPaneElementProps extends SectionPlayerElementProps {
	splitPaneMinRegionWidth?: number;
	splitPaneInitialPassageWidth?: number | string;
	splitPaneCollapseStrategy?: string;
}

// Derive methods from the subclass that actually installs them on each host,
// including its nullable snapshot before the Svelte component mounts.
type HostMethods = Pick<
	InstanceType<ReturnType<ReturnType<typeof withHostMethods>>>,
	keyof SectionPlayerRuntimeHostContract
>;

/** Native host interface shared by the section player's public layouts. */
export interface PieSectionPlayerElement extends HTMLElement, SectionPlayerElementProps, HostMethods {}

/** Native host interface for `<pie-section-player-splitpane>`. */
export interface PieSectionPlayerSplitPaneElement extends PieSectionPlayerElement, SectionPlayerSplitPaneElementProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-section-player-splitpane": PieSectionPlayerSplitPaneElement;
		"pie-section-player-vertical": PieSectionPlayerElement;
		"pie-section-player-tabbed": PieSectionPlayerElement;
	}
}
