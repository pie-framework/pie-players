import type { TestAttemptSession } from "@pie-players/pie-assessment-toolkit";
import type { ItemSessionUpdateIntent } from "@pie-players/pie-players-shared";
import type {
	AssessmentItemRef,
	AssessmentSection,
	ItemEntity,
	PassageEntity,
	RubricBlock,
} from "@pie-players/pie-players-shared";
import type { ConfigContainerEntity } from "@pie-players/pie-players-shared/types";

export type SectionView =
	| "candidate"
	| "scorer"
	| "author"
	| "proctor"
	| "testConstructor"
	| "tutor";

export interface SectionContentModel {
	passages: PassageEntity[];
	items: ItemEntity[];
	rubricBlocks: RubricBlock[];
	instructions: RubricBlock[];
	renderables: SectionRenderable[];
	adapterItemRefs: Array<{
		identifier: string;
		item: {
			id?: string;
			identifier?: string;
		};
	}>;
}

export type SectionRenderableFlavor = "item" | "passage" | "rubric";

export interface SectionRenderable {
	flavor: SectionRenderableFlavor;
	entity: ConfigContainerEntity;
}

export interface SectionControllerInput {
	section: AssessmentSection | null;
	view: SectionView;
	assessmentId: string;
	sectionId: string;
}

export interface SectionSessionState {
	/**
	 * Persistence payload for section controller host APIs.
	 * This shape is produced by getSession() and should be preferred for applySession().
	 */
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
}

export interface SectionViewModel extends SectionContentModel {
	currentItemIndex: number;
	isPageMode: boolean;
}

export interface SectionCompositionModel {
	section: AssessmentSection | null;
	assessmentItemRefs: AssessmentItemRef[];
	passages: PassageEntity[];
	items: ItemEntity[];
	rubricBlocks: RubricBlock[];
	instructions: RubricBlock[];
	renderables: SectionRenderable[];
	currentItemIndex: number;
	currentItem: ItemEntity | null;
	isPageMode: boolean;
	itemSessionsByItemId: Record<string, unknown>;
	testAttemptSession: TestAttemptSession | null;
	itemViewModels: SectionCanonicalItemViewModel[];
}

export interface SectionCanonicalItemViewModel {
	item: ItemEntity;
	itemId: string;
	canonicalItemId: string;
	index: number;
	isCurrent: boolean;
	session: unknown;
}

export interface SectionCanonicalSectionViewModel {
	sectionId: string;
	currentItemIndex: number;
	items: SectionCanonicalItemViewModel[];
}

export interface SectionCanonicalSessionViewModel {
	currentItemIndex: number;
	itemSessionsByCanonicalId: Record<string, unknown>;
}

export interface SectionAttemptSessionSlice {
	sectionId: string;
	sectionIdentifier?: string;
	currentItemIndex: number;
	currentItemId: string;
	itemIdentifiers: string[];
	visitedItemIdentifiers: string[];
	itemSessions: Record<string, unknown>;
	loadingComplete: boolean;
	totalRegistered: number;
	totalLoaded: number;
	itemsComplete: boolean;
	completedCount: number;
	totalItems: number;
}

export interface SessionChangedResult {
	testAttemptSession: TestAttemptSession;
	itemSessions: Record<string, any>;
	sessionState: SectionSessionState;
	eventDetail: {
		itemId: string;
		session: unknown;
		intent?: ItemSessionUpdateIntent;
		complete?: boolean;
		component?: string;
		timestamp: number;
	};
}

export interface NavigationResult {
	nextIndex: number;
	// Intra-section item navigation event detail (not section-to-section routing).
	eventDetail: {
		previousItemId: string;
		currentItemId: string;
		itemIndex: number;
		totalItems: number;
		timestamp: number;
	};
	testAttemptSession: TestAttemptSession;
}

export interface SectionNavigationState {
	currentIndex: number;
	totalItems: number;
	canNext: boolean;
	canPrevious: boolean;
	isLoading: boolean;
}

export type SectionContentKind = "item" | "passage" | "rubric" | "unknown";

interface SectionControllerEventBase {
	type:
		| "item-session-data-changed"
		| "item-session-meta-changed"
		| "item-selected"
		| "section-navigation-change"
		| "section-session-applied"
		| "content-loaded"
		| "item-player-error"
		| "item-complete-changed"
		| "section-loading-complete"
		| "section-items-complete-changed"
		| "section-error";
	timestamp: number;
}

interface ItemScopedControllerEventBase extends SectionControllerEventBase {
	currentItemIndex: number;
}

export interface ItemSessionDataChangedEvent
	extends ItemScopedControllerEventBase {
	type: "item-session-data-changed";
	itemId: string;
	canonicalItemId: string;
	session: unknown;
	intent?: ItemSessionUpdateIntent;
	complete?: boolean;
	component?: string;
}

export interface ItemSessionMetaChangedEvent
	extends ItemScopedControllerEventBase {
	type: "item-session-meta-changed";
	itemId: string;
	canonicalItemId: string;
	complete?: boolean;
	component?: string;
}

export interface ItemSelectedEvent extends ItemScopedControllerEventBase {
	type: "item-selected";
	previousItemId: string;
	currentItemId: string;
	itemIndex: number;
	totalItems: number;
}

export interface SectionNavigationChangeEvent extends SectionControllerEventBase {
	type: "section-navigation-change";
	previousSectionId?: string;
	currentSectionId?: string;
	attemptId?: string;
	reason?: "input-change" | "runtime-transition";
}

export interface SectionSessionAppliedEvent extends SectionControllerEventBase {
	type: "section-session-applied";
	mode: "replace" | "merge";
	itemSessionCount: number;
	replay: boolean;
	currentItemIndex: number;
}

export interface ContentLoadedEvent extends ItemScopedControllerEventBase {
	type: "content-loaded";
	contentKind: SectionContentKind;
	itemId: string;
	canonicalItemId: string;
	detail?: unknown;
}

export interface ItemPlayerErrorEvent extends ItemScopedControllerEventBase {
	type: "item-player-error";
	contentKind: SectionContentKind;
	itemId: string;
	canonicalItemId: string;
	error: unknown;
}

export interface ItemCompleteChangedEvent extends ItemScopedControllerEventBase {
	type: "item-complete-changed";
	itemId: string;
	canonicalItemId: string;
	complete: boolean;
	previousComplete: boolean;
}

export interface SectionLoadingCompleteEvent extends ItemScopedControllerEventBase {
	type: "section-loading-complete";
	totalRegistered: number;
	totalLoaded: number;
}

export interface SectionItemsCompleteChangedEvent
	extends ItemScopedControllerEventBase {
	type: "section-items-complete-changed";
	complete: boolean;
	completedCount: number;
	totalItems: number;
}

export interface SectionErrorEvent extends ItemScopedControllerEventBase {
	type: "section-error";
	source: "item-player" | "section-runtime" | "toolkit" | "controller";
	error: unknown;
	itemId?: string;
	canonicalItemId?: string;
	contentKind?: SectionContentKind;
}

export type SectionControllerChangeEvent =
	| ItemSessionDataChangedEvent
	| ItemSessionMetaChangedEvent
	| ItemSelectedEvent
	| SectionNavigationChangeEvent
	| SectionSessionAppliedEvent
	| ContentLoadedEvent
	| ItemPlayerErrorEvent
	| ItemCompleteChangedEvent
	| SectionLoadingCompleteEvent
	| SectionItemsCompleteChangedEvent
	| SectionErrorEvent;

export type SectionControllerChangeListener = (
	event: SectionControllerChangeEvent,
) => void;
