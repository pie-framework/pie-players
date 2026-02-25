import type {
	TestAttemptSession,
} from "@pie-players/pie-assessment-toolkit";
import type {
	ItemEntity,
	PassageEntity,
	AssessmentSection,
	RubricBlock,
} from "@pie-players/pie-players-shared";

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
	adapterItemRefs: Array<{
		identifier: string;
		item: {
			id?: string;
			identifier?: string;
		};
	}>;
}

export interface SectionControllerInput {
	section: AssessmentSection | null;
	view: SectionView;
	assessmentId: string;
	sectionId: string;
	/**
	 * Minimal host-facing session model.
	 * The section runtime adapts this into canonical TestAttemptSession internally.
	 */
	sessionState?: SectionSessionState | null;
}

export interface SectionSessionState {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
}

export interface SectionViewModel extends SectionContentModel {
	currentItemIndex: number;
	isPageMode: boolean;
}

export interface SectionAttemptSessionSlice {
	sectionId: string;
	sectionIdentifier?: string;
	currentItemIndex: number;
	currentItemId: string;
	itemIdentifiers: string[];
	visitedItemIdentifiers: string[];
	itemSessions: Record<string, unknown>;
}

export interface SessionChangedResult {
	testAttemptSession: TestAttemptSession;
	itemSessions: Record<string, any>;
	sessionState: SectionSessionState;
	eventDetail: {
		itemId: string;
		session: unknown;
		sessionState: SectionSessionState;
		itemSessions: Record<string, unknown>;
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
