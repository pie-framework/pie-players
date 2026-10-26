export type SectionAttemptSliceLike = {
	currentItemIndex?: number;
	currentItemId?: string;
	visitedItemIdentifiers?: string[];
	itemSessions?: Record<string, unknown>;
	loadingComplete?: boolean;
	totalRegistered?: number;
	totalLoaded?: number;
	itemsComplete?: boolean;
	completedCount?: number;
	totalItems?: number;
};

export type SectionSessionStateLike = {
	itemSessions?: Record<string, unknown>;
};

export type SectionControllerLike = {
	getRuntimeState?: () => SectionAttemptSliceLike | null;
	getSession?: () => SectionSessionStateLike | null;
	subscribe?: (
		listener: (event: { itemId?: string; timestamp?: number }) => void,
	) => () => void;
};

export type ToolkitCoordinatorLike = {
	getSectionController?: (args: {
		sectionId: string;
		attemptId?: string;
	}) => SectionControllerLike | undefined;
	// Phase D (>=0.3.35): subscribe* helpers follow the toolkit's
	// active section cohort automatically and do not accept
	// sectionId / attemptId arguments. The session panel keeps
	// `sectionId` + `attemptId` in the shared subscription manager purely
	// to gate same-target re-subscribe and to drive `getSectionController`.
	subscribeItemEvents?: (args: {
		listener: (event: { itemId?: string; timestamp?: number }) => void;
	}) => () => void;
	subscribeSectionLifecycleEvents?: (args: {
		listener: (event: { itemId?: string; timestamp?: number }) => void;
	}) => () => void;
	onSectionControllerLifecycle?: (
		listener: (event: {
			type: "ready" | "disposed";
			key?: { sectionId?: string; attemptId?: string };
		}) => void,
	) => () => void;
};

/** Inputs shared by the component and its native element declaration. */
export interface SessionDebuggerProps {
	toolkitCoordinator?: ToolkitCoordinatorLike | null;
	sectionId: string;
	attemptId?: string;
	persistenceScope?: string;
	persistencePanelId?: string;
}
