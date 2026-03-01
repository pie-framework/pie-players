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
	save(context: SectionControllerContext, snapshot: unknown): void | Promise<void>;
	clear?(context: SectionControllerContext): void | Promise<void>;
}

export interface SectionControllerHandle {
	initialize?(input?: unknown): void | Promise<void>;
	updateInput?(input?: unknown): void | Promise<void>;
	hydrate?(): void | Promise<void>;
	persist?(): void | Promise<void>;
	dispose?(): void | Promise<void>;
	subscribe?(listener: (event: unknown) => void): () => void;
	getSnapshot?(): unknown;
	// Runtime/debugger-oriented section slice (not host persistence shape).
	getCurrentSectionAttemptSlice?(): unknown;
	setPersistenceContext?(context: SectionControllerContext): void | Promise<void>;
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
