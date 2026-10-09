export interface TestAttemptSessionNavigationState {
	currentItemIndex: number;
	visitedItemIdentifiers: string[];
	currentSectionIdentifier?: string;
}

export interface TestAttemptSessionRealization {
	/**
	 * Deterministic seed for shuffling/selection.
	 * (Future: use for QTI ordering.shuffle / selection rules.)
	 */
	seed: string;
	/**
	 * Realized item order for this attempt (QTI item identifiers).
	 */
	itemIdentifiers: string[];
}

export interface TestAttemptItemSession {
	/**
	 * QTI assessmentItemRef identifier (same as questionRef.identifier).
	 */
	itemIdentifier: string;

	/**
	 * PIE session id for the underlying item attempt (if/when created).
	 */
	pieSessionId?: string;

	attemptCount: number;
	isCompleted: boolean;

	startedAt?: string;
	updatedAt?: string;
	completedAt?: string;
	session?: unknown;
}

export interface TestAttemptSession {
	version: 1;

	/**
	 * QTI-like identifier for the delivery attempt (administration).
	 */
	testAttemptSessionIdentifier: string;

	assessmentId: string;

	startedAt: string;
	updatedAt: string;
	completedAt?: string;

	navigationState: TestAttemptSessionNavigationState;
	realization: TestAttemptSessionRealization;

	/**
	 * Keyed by QTI item identifier (questionRef.identifier).
	 */
	itemSessions: Record<string, TestAttemptItemSession>;

	/**
	 * QTI 3.0 context variables (global assessment-level variables).
	 */
	contextVariables?: Record<string, any>;
}

const TEST_ATTEMPT_SESSION_VERSION = 1 as const;

function nowIso(): string {
	return new Date().toISOString();
}

export function createNewTestAttemptSession(args: {
	testAttemptSessionIdentifier: string;
	assessmentId: string;
	seed: string;
	itemIdentifiers: string[];
}): TestAttemptSession {
	const startedAt = nowIso();
	return {
		version: TEST_ATTEMPT_SESSION_VERSION,
		testAttemptSessionIdentifier: args.testAttemptSessionIdentifier,
		assessmentId: args.assessmentId,
		startedAt,
		updatedAt: startedAt,
		navigationState: {
			currentItemIndex: -1,
			visitedItemIdentifiers: [],
		},
		realization: {
			seed: args.seed,
			itemIdentifiers: args.itemIdentifiers,
		},
		itemSessions: {},
	};
}

export function upsertVisitedItem(
	session: TestAttemptSession,
	itemIdentifier: string,
): TestAttemptSession {
	if (!itemIdentifier) return session;
	const visited = new Set(session.navigationState.visitedItemIdentifiers || []);
	visited.add(itemIdentifier);
	return {
		...session,
		navigationState: {
			...session.navigationState,
			visitedItemIdentifiers: Array.from(visited),
		},
	};
}

export function setCurrentPosition(
	session: TestAttemptSession,
	args: {
		currentItemIndex: number;
		currentSectionIdentifier?: string;
	},
): TestAttemptSession {
	return {
		...session,
		navigationState: {
			...session.navigationState,
			currentItemIndex: args.currentItemIndex,
			currentSectionIdentifier: args.currentSectionIdentifier,
		},
	};
}

export function upsertItemSessionFromPieSessionChange(
	session: TestAttemptSession,
	args: {
		itemIdentifier: string;
		pieSessionId: string;
		isCompleted?: boolean;
		session?: unknown;
	},
): TestAttemptSession {
	const { itemIdentifier, pieSessionId, isCompleted } = args;
	if (!itemIdentifier || !pieSessionId) return session;

	const now = nowIso();
	const existing = session.itemSessions[itemIdentifier];

	const attemptCount =
		existing && existing.pieSessionId && existing.pieSessionId !== pieSessionId
			? existing.attemptCount + 1
			: existing
				? existing.attemptCount
				: 1;

	const completed = !!(isCompleted ?? existing?.isCompleted);

	const next: TestAttemptItemSession = {
		itemIdentifier,
		pieSessionId,
		attemptCount,
		isCompleted: completed,
		startedAt: existing?.startedAt || now,
		updatedAt: now,
		completedAt: completed ? existing?.completedAt || now : undefined,
		session: args.session ?? existing?.session,
	};

	return {
		...session,
		itemSessions: {
			...session.itemSessions,
			[itemIdentifier]: next,
		},
	};
}

export function toItemSessionsRecord(
	testAttemptSession: TestAttemptSession,
): Record<string, unknown> {
	return Object.entries(testAttemptSession.itemSessions).reduce<
		Record<string, unknown>
	>((acc, [itemIdentifier, itemSession]) => {
		if (itemSession.session) {
			acc[itemIdentifier] = itemSession.session;
		}
		return acc;
	}, {});
}
