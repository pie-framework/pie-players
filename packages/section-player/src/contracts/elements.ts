import type {
	SectionControllerHandle,
	SectionItemScorer,
	ToolConfigStrictness,
	ToolRegistry,
	ToolbarItem,
	TTSHighlightTargetResolver,
} from "@pie-players/pie-assessment-toolkit";
import type { RuntimeConfig } from "@pie-players/pie-assessment-toolkit/runtime/engine";
import type { ItemTryView } from "@pie-players/pie-players-shared/item-session-control";
import type {
	AssessmentEntity,
	AssessmentSection,
	ItemEntity,
	ItemSettings,
	PassageEntity,
	SectionControllerSessionState,
} from "@pie-players/pie-players-shared/types";
import type {
	PlayerElementAction,
	PlayerElementParams,
} from "../components/shared/player-action.js";
import type { SectionPlayerRuntimeConfig } from "../components/shared/section-player-backend-delivery.js";
import type { TimedMediaItemView } from "../components/shared/section-player-view-state.js";
import type { SectionPlayerPolicies } from "../policies/types.js";
import type { SectionPlayerHostHooks } from "./host-hooks.js";
import type {
	SectionPlayerRuntimeHostContract,
	SectionPlayerSnapshot,
} from "./runtime-host-contract.js";

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

/**
 * The methods `withHostMethods` installs on each layout host. `getSnapshot`
 * returns `null` before the Svelte component mounts.
 */
export interface SectionPlayerHostMethods extends Omit<SectionPlayerRuntimeHostContract, "getSnapshot"> {
	getSnapshot(): SectionPlayerSnapshot | null;
}

/** Native host interface shared by the section player's public layouts. */
export interface PieSectionPlayerElement extends HTMLElement, SectionPlayerElementProps, SectionPlayerHostMethods {}

/** Native host interface for `<pie-section-player-splitpane>`. */
export interface PieSectionPlayerSplitPaneElement extends PieSectionPlayerElement, SectionPlayerSplitPaneElementProps {}

/**
 * Property inputs of `<pie-section-player-kernel-host>`: the layout props
 * without the layout geometry, and with the toolkit's own `runtime` shape.
 */
export type SectionPlayerKernelHostElementProps = Omit<
	SectionPlayerElementProps,
	"runtime" | "narrowLayoutBreakpoint" | "contentMaxWidthNoPassage" | "contentMaxWidthWithPassage"
> & { runtime?: RuntimeConfig | null };

/** Native host interface for `<pie-section-player-kernel-host>`. */
export interface PieSectionPlayerKernelHostElement
	extends HTMLElement,
		SectionPlayerKernelHostElementProps,
		SectionPlayerRuntimeHostContract {}

/** Property inputs of `<pie-section-player-base>`. */
export interface SectionPlayerBaseElementProps {
	runtime?: RuntimeConfig | null;
	ndsIcons?: boolean;
	locale?: string;
	section?: AssessmentSection | null;
	session?: SectionControllerSessionState | null;
	assessment?: AssessmentEntity | null;
	sectionId?: string;
	attemptId?: string;
	toolRegistry?: ToolRegistry | null;
	toolConfigStrictness?: ToolConfigStrictness;
}

/** Navigation state `<pie-section-player-base>` reports. */
export interface SectionPlayerBaseNavigationState {
	currentIndex: number;
	totalItems: number;
	canNext: boolean;
	canPrevious: boolean;
	currentItemId?: string;
}

/** Native host interface for `<pie-section-player-base>`. */
export interface PieSectionPlayerBaseElement extends HTMLElement, SectionPlayerBaseElementProps {
	navigateToItem(index: number): unknown;
	getCompositionModelSnapshot(): unknown;
	getNavigationStateSnapshot(): SectionPlayerBaseNavigationState;
	getSectionController(): SectionControllerHandle | null;
	waitForSectionController(timeoutMs?: number): Promise<SectionControllerHandle | null>;
}

/** Property inputs of `<pie-section-player-shell>`. */
export interface SectionPlayerShellElementProps {
	showToolbar?: boolean | string | null;
	toolbarPosition?: string;
	enabledTools?: string;
	toolRegistry?: ToolRegistry | null;
	sectionHostButtons?: ToolbarItem[];
}

/** Native host interface for `<pie-section-player-shell>`. */
export interface PieSectionPlayerShellElement extends HTMLElement, SectionPlayerShellElementProps {}

/** Property inputs of `<pie-passage-shell>`. */
export interface PassageShellElementProps {
	itemId?: string;
	canonicalItemId?: string;
	contentKind?: string;
	regionPolicy?: string;
	scopeElement?: HTMLElement | null;
	ttsHighlightTargetResolver?: TTSHighlightTargetResolver | null;
	item?: unknown;
}

/** Native host interface for `<pie-passage-shell>`. */
export interface PiePassageShellElement extends HTMLElement, PassageShellElementProps {}

/** Property inputs of `<pie-section-player-item-card>`. */
export interface SectionItemCardElementProps {
	item?: ItemEntity;
	itemIndex?: number;
	itemCount?: number;
	isCurrent?: boolean;
	canonicalItemId?: string;
	itemSettings?: ItemSettings | null;
	baseHeadingLevel?: number;
	resolvedPlayerTag?: string;
	playerAction?: PlayerElementAction;
	playerParams?: PlayerElementParams;
	itemToolbarTools?: string;
	toolRegistry?: ToolRegistry | null;
	hostButtons?: ToolbarItem[];
	tryView?: ItemTryView | null;
	checkControlEnabled?: boolean;
	timedMediaView?: TimedMediaItemView | null;
}

/** Native host interface for `<pie-section-player-item-card>`. */
export interface PieSectionPlayerItemCardElement extends HTMLElement, SectionItemCardElementProps {
	/** The item player's `provideScore()`; `null` until the player has mounted. */
	provideScore(): ReturnType<SectionItemScorer>;
}

/** Property inputs of `<pie-section-player-passage-card>`. */
export interface SectionPassageCardElementProps {
	passage?: PassageEntity;
	baseHeadingLevel?: number;
	resolvedPlayerTag?: string;
	playerAction?: PlayerElementAction;
	playerParams?: PlayerElementParams;
	passageToolbarTools?: string;
	toolRegistry?: ToolRegistry | null;
	hostButtons?: ToolbarItem[];
	timedMediaStimulus?: boolean;
}

/** Native host interface for `<pie-section-player-passage-card>`. */
export interface PieSectionPlayerPassageCardElement extends HTMLElement, SectionPassageCardElementProps {}

/** Native host interface for `<pie-section-player-items-pane>`, which takes no properties. */
export interface PieSectionPlayerItemsPaneElement extends HTMLElement {
	/** Scores one item through its card; `null` for an unknown item or one not yet mounted. */
	scoreItem(canonicalItemId: string): ReturnType<SectionItemScorer>;
}

/** Native host interface for `<pie-section-player-passages-pane>`, which takes no properties. */
export interface PieSectionPlayerPassagesPaneElement extends HTMLElement {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-section-player-splitpane": PieSectionPlayerSplitPaneElement;
		"pie-section-player-vertical": PieSectionPlayerElement;
		"pie-section-player-tabbed": PieSectionPlayerElement;
		"pie-section-player-kernel-host": PieSectionPlayerKernelHostElement;
		"pie-section-player-base": PieSectionPlayerBaseElement;
		"pie-section-player-shell": PieSectionPlayerShellElement;
		"pie-passage-shell": PiePassageShellElement;
		"pie-section-player-item-card": PieSectionPlayerItemCardElement;
		"pie-section-player-passage-card": PieSectionPlayerPassageCardElement;
		"pie-section-player-items-pane": PieSectionPlayerItemsPaneElement;
		"pie-section-player-passages-pane": PieSectionPlayerPassagesPaneElement;
	}
}
