import type {
	TestAttemptSession,
} from "@pie-players/pie-assessment-toolkit";
import type {
	ItemEntity,
	PassageEntity,
	QtiAssessmentSection,
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
	section: QtiAssessmentSection | null;
	view: SectionView;
	assessmentId: string;
	sectionId: string;
	itemSessions?: Record<string, any>;
	testAttemptSession?: TestAttemptSession | null;
	activityDefinition?: Record<string, any> | null;
	activitySession?: Record<string, any> | null;
}

export interface SectionViewModel extends SectionContentModel {
	currentItemIndex: number;
	isPageMode: boolean;
}

export interface SessionChangedResult {
	testAttemptSession: TestAttemptSession;
	itemSessions: Record<string, any>;
	eventDetail: {
		itemId: string;
		session: unknown;
		testAttemptSession: TestAttemptSession;
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
