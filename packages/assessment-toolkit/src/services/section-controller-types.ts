export interface SectionControllerKey {
	assessmentId: string;
	sectionId: string;
	attemptId?: string;
}

export interface SectionControllerContext {
	key: SectionControllerKey;
	coordinator: unknown;
	input?: unknown;
}

export interface SectionControllerPersistenceStrategy {
	load(context: SectionControllerContext): unknown | Promise<unknown>;
	save(
		context: SectionControllerContext,
		snapshot: unknown,
	): void | Promise<void>;
	clear?(context: SectionControllerContext): void | Promise<void>;
}

export interface SectionControllerRuntimeState {
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

export interface SectionControllerSessionState {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
}

type SectionControllerEventBase = {
	timestamp: number;
};

export type SectionControllerItemSessionDataChangedEvent =
	SectionControllerEventBase & {
		type: "item-session-data-changed";
		itemId: string;
		canonicalItemId: string;
		session: unknown;
		intent?: string;
		complete?: boolean;
		component?: string;
		currentItemIndex: number;
	};

export type SectionControllerItemSessionMetaChangedEvent =
	SectionControllerEventBase & {
		type: "item-session-meta-changed";
		itemId: string;
		canonicalItemId: string;
		complete?: boolean;
		component?: string;
		currentItemIndex: number;
	};

export type SectionControllerItemSelectedEvent = SectionControllerEventBase & {
	type: "item-selected";
	previousItemId: string;
	currentItemId: string;
	itemIndex: number;
	totalItems: number;
	currentItemIndex: number;
};

export type SectionControllerSectionNavigationChangedEvent =
	SectionControllerEventBase & {
		type: "section-navigation-change";
		previousSectionId?: string;
		currentSectionId?: string;
		attemptId?: string;
		reason?: "input-change" | "runtime-transition";
	};

export type SectionControllerContentLoadedEvent = SectionControllerEventBase & {
	type: "content-loaded";
	contentKind: "item" | "passage" | "rubric" | "unknown";
	itemId: string;
	canonicalItemId: string;
	detail?: unknown;
	currentItemIndex: number;
};

export type SectionControllerItemPlayerErrorEvent = SectionControllerEventBase & {
	type: "item-player-error";
	contentKind: "item" | "passage" | "rubric" | "unknown";
	itemId: string;
	canonicalItemId: string;
	error: unknown;
	currentItemIndex: number;
};

export type SectionControllerItemCompleteChangedEvent =
	SectionControllerEventBase & {
		type: "item-complete-changed";
		itemId: string;
		canonicalItemId: string;
		complete: boolean;
		previousComplete: boolean;
		currentItemIndex: number;
	};

export type SectionControllerSectionLoadingCompleteEvent =
	SectionControllerEventBase & {
		type: "section-loading-complete";
		totalRegistered: number;
		totalLoaded: number;
		currentItemIndex: number;
	};

export type SectionControllerSectionItemsCompleteChangedEvent =
	SectionControllerEventBase & {
		type: "section-items-complete-changed";
		complete: boolean;
		completedCount: number;
		totalItems: number;
		currentItemIndex: number;
	};

export type SectionControllerSectionErrorEvent = SectionControllerEventBase & {
	type: "section-error";
	source: "item-player" | "section-runtime" | "toolkit" | "controller";
	error: unknown;
	itemId?: string;
	canonicalItemId?: string;
	contentKind?: "item" | "passage" | "rubric" | "unknown";
	currentItemIndex: number;
};

export type SectionControllerEvent =
	| SectionControllerItemSessionDataChangedEvent
	| SectionControllerItemSessionMetaChangedEvent
	| SectionControllerItemSelectedEvent
	| SectionControllerSectionNavigationChangedEvent
	| SectionControllerContentLoadedEvent
	| SectionControllerItemPlayerErrorEvent
	| SectionControllerItemCompleteChangedEvent
	| SectionControllerSectionLoadingCompleteEvent
	| SectionControllerSectionItemsCompleteChangedEvent
	| SectionControllerSectionErrorEvent;

export type SectionControllerEventType = SectionControllerEvent["type"];

export interface SectionControllerHandle {
	initialize?(input?: unknown): void | Promise<void>;
	updateInput?(input?: unknown): void | Promise<void>;
	hydrate?(): void | Promise<void>;
	persist?(): void | Promise<void>;
	dispose?(): void | Promise<void>;
	subscribe?(listener: (event: SectionControllerEvent) => void): () => void;
	getRuntimeState?(): SectionControllerRuntimeState | null;
	getSessionState?(): SectionControllerSessionState | null;
	setPersistenceContext?(
		context: SectionControllerContext,
	): void | Promise<void>;
	setPersistenceStrategy?(
		strategy: SectionControllerPersistenceStrategy,
	): void | Promise<void>;
}

export interface SectionControllerFactoryDefaults {
	createDefaultController: () =>
		| SectionControllerHandle
		| Promise<SectionControllerHandle>;
}

export interface SectionPersistenceFactoryDefaults {
	createDefaultPersistence: () =>
		| SectionControllerPersistenceStrategy
		| Promise<SectionControllerPersistenceStrategy>;
}
