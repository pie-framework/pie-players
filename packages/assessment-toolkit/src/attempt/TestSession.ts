export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

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
	 * Managed by ContextVariableStore.
	 */
	contextVariables?: Record<string, any>;
}

const TEST_ATTEMPT_SESSION_VERSION = 1 as const;
const STORAGE_PREFIX = "pieoneer:testAttemptSession:v1:";
const ANON_DEVICE_ID_KEY = "pieoneer:anonymousDeviceId:v1";

export function createMemoryStorage(
	initial: Record<string, string> = {},
): StorageLike {
	const store = new Map(Object.entries(initial));
	return {
		getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
		setItem: (k, v) => {
			store.set(k, v);
		},
		removeItem: (k) => {
			store.delete(k);
		},
	};
}

export function getBrowserLocalStorage(): StorageLike | null {
	try {
		// eslint-disable-next-line no-undef
		if (typeof window === "undefined") return null;
		// eslint-disable-next-line no-undef
		if (!window.localStorage) return null;
		// eslint-disable-next-line no-undef
		return window.localStorage;
	} catch {
		return null;
	}
}

function nowIso(): string {
	return new Date().toISOString();
}

// Lightweight, deterministic hash for IDs (no crypto dependency).
function fnv1a32Hex(input: string): string {
	let hash = 0x811c9dc5; // offset basis
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		// hash *= 16777619 (with 32-bit overflow)
		hash =
			(hash +
				((hash << 1) +
					(hash << 4) +
					(hash << 7) +
					(hash << 8) +
					(hash << 24))) >>>
			0;
	}
	return hash.toString(16).padStart(8, "0");
}

function randomId(): string {
	const cryptoAny = (globalThis as any)?.crypto;
	const uuid = cryptoAny?.randomUUID?.();
	if (typeof uuid === "string" && uuid.length > 0) {
		return uuid;
	}
	return `anon_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function getOrCreateAnonymousDeviceId(storage: StorageLike): string {
	const existing = storage.getItem(ANON_DEVICE_ID_KEY);
	if (existing) return existing;
	const created = randomId();
	storage.setItem(ANON_DEVICE_ID_KEY, created);
	return created;
}

export function createTestAttemptSessionIdentifier(args: {
	assessmentId: string;
	assignmentId?: string | null;
	userId?: string | null;
	storage: StorageLike;
}): { testAttemptSessionIdentifier: string; seed: string } {
	const { assessmentId, assignmentId, userId, storage } = args;
	if (!assessmentId) {
		throw new Error(
			"assessmentId is required to create a TestSession identifier",
		);
	}

	const subject = userId || getOrCreateAnonymousDeviceId(storage);
	const source = `v1|${assessmentId}|${assignmentId || ""}|${subject}`;
	const seed = fnv1a32Hex(source);
	return { testAttemptSessionIdentifier: `tas_v1_${seed}`, seed };
}

export function getTestAttemptSessionStorageKey(
	testAttemptSessionIdentifier: string,
): string {
	return `${STORAGE_PREFIX}${testAttemptSessionIdentifier}`;
}

export function loadTestAttemptSession(
	storage: StorageLike,
	testAttemptSessionIdentifier: string,
): TestAttemptSession | null {
	const raw = storage.getItem(
		getTestAttemptSessionStorageKey(testAttemptSessionIdentifier),
	);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as TestAttemptSession;
		if (!parsed || parsed.version !== TEST_ATTEMPT_SESSION_VERSION) return null;
		if (parsed.testAttemptSessionIdentifier !== testAttemptSessionIdentifier) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function saveTestAttemptSession(
	storage: StorageLike,
	session: TestAttemptSession,
): void {
	const updated: TestAttemptSession = {
		...session,
		updatedAt: nowIso(),
	};
	storage.setItem(
		getTestAttemptSessionStorageKey(session.testAttemptSessionIdentifier),
		JSON.stringify(updated),
	);
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
