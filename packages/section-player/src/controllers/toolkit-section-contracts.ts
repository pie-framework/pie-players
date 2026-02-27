import type { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";

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

export type CoordinatorWithSectionControllers = ToolkitCoordinator & {
	getOrCreateSectionController(args: {
		sectionId: string;
		attemptId?: string;
		input?: unknown;
		updateExisting?: boolean;
		createDefaultController: () =>
			| SectionControllerHandle
			| Promise<SectionControllerHandle>;
	}): Promise<SectionControllerHandle>;
	disposeSectionController(args: {
		sectionId: string;
		attemptId?: string;
		persistBeforeDispose?: boolean;
		clearPersistence?: boolean;
	}): Promise<void>;
};
