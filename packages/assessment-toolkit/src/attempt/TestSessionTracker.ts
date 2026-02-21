import {
	createNewTestAttemptSession,
	createTestAttemptSessionIdentifier,
	getBrowserLocalStorage,
	loadTestAttemptSession,
	saveTestAttemptSession,
	setCurrentPosition,
	type StorageLike,
	type TestAttemptSession,
	upsertItemSessionFromPieSessionChange,
	upsertVisitedItem,
} from "./TestSession.js";

export interface TestAttemptSessionTrackerConfig {
	assessmentId: string;
	assignmentId?: string | null;
	userId?: string | null;
	storage?: StorageLike | null;
}

export interface TestAttemptSessionPosition {
	itemIdentifier?: string;
	currentItemIndex: number;
	currentSectionIdentifier?: string;
}

export interface TestAttemptSessionItemChange {
	itemIdentifier: string;
	pieSessionId: string;
	isCompleted?: boolean;
	currentItemIndex?: number;
	currentSectionIdentifier?: string;
}

/**
 * Backend-agnostic test attempt tracker.
 *
 * - Owns no network logic
 * - Emits snapshot updates for hosts to persist if desired
 * - Can be used with section-player, assessment-player, or custom hosts
 */
export class TestAttemptSessionTracker {
	private readonly assessmentId: string;
	private readonly assignmentId?: string | null;
	private readonly userId?: string | null;
	private readonly storage: StorageLike | null;

	private session: TestAttemptSession | null = null;
	private subscribers = new Set<(session: TestAttemptSession) => void>();

	constructor(config: TestAttemptSessionTrackerConfig) {
		if (!config.assessmentId) {
			throw new Error("TestAttemptSessionTracker requires assessmentId");
		}
		this.assessmentId = config.assessmentId;
		this.assignmentId = config.assignmentId;
		this.userId = config.userId;
		this.storage =
			config.storage !== undefined ? config.storage : getBrowserLocalStorage();
	}

	initialize(itemIdentifiers: string[]): TestAttemptSession {
		const normalized = itemIdentifiers.filter(Boolean);
		const existing = this.getOrCreateSession(normalized);
		this.session = {
			...existing,
			realization: {
				...existing.realization,
				itemIdentifiers: normalized,
			},
		};
		this.persistAndEmit();
		return this.session;
	}

	getSnapshot(): TestAttemptSession | null {
		return this.session;
	}

	setCurrentPosition(
		position: TestAttemptSessionPosition,
	): TestAttemptSession | null {
		if (!this.session) return null;
		let next = setCurrentPosition(this.session, {
			currentItemIndex: position.currentItemIndex,
			currentSectionIdentifier: position.currentSectionIdentifier,
		});
		if (position.itemIdentifier) {
			next = upsertVisitedItem(next, position.itemIdentifier);
		}
		this.session = next;
		this.persistAndEmit();
		return this.session;
	}

	recordItemSessionChange(
		change: TestAttemptSessionItemChange,
	): TestAttemptSession | null {
		if (!this.session) return null;
		let next = upsertItemSessionFromPieSessionChange(this.session, {
			itemIdentifier: change.itemIdentifier,
			pieSessionId: change.pieSessionId,
			isCompleted: change.isCompleted,
		});
		if (change.currentItemIndex !== undefined) {
			next = setCurrentPosition(next, {
				currentItemIndex: change.currentItemIndex,
				currentSectionIdentifier: change.currentSectionIdentifier,
			});
		}
		next = upsertVisitedItem(next, change.itemIdentifier);
		this.session = next;
		this.persistAndEmit();
		return this.session;
	}

	subscribe(listener: (session: TestAttemptSession) => void): () => void {
		this.subscribers.add(listener);
		if (this.session) {
			listener(this.session);
		}
		return () => {
			this.subscribers.delete(listener);
		};
	}

	private getOrCreateSession(itemIdentifiers: string[]): TestAttemptSession {
		if (!this.storage) {
			const fallback = createNewTestAttemptSession({
				testAttemptSessionIdentifier: `tas_mem_${Date.now()}`,
				assessmentId: this.assessmentId,
				seed: `${Date.now()}`,
				itemIdentifiers,
			});
			return fallback;
		}

		const { testAttemptSessionIdentifier, seed } =
			createTestAttemptSessionIdentifier({
			assessmentId: this.assessmentId,
			assignmentId: this.assignmentId,
			userId: this.userId,
			storage: this.storage,
			});
		const existing = loadTestAttemptSession(
			this.storage,
			testAttemptSessionIdentifier,
		);
		if (existing) {
			return existing;
		}
		return createNewTestAttemptSession({
			testAttemptSessionIdentifier,
			assessmentId: this.assessmentId,
			seed,
			itemIdentifiers,
		});
	}

	private persistAndEmit(): void {
		if (!this.session) return;
		if (this.storage) {
			saveTestAttemptSession(this.storage, this.session);
		}
		for (const listener of this.subscribers) {
			listener(this.session);
		}
	}
}
