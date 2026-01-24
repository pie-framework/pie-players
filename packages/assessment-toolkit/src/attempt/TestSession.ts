export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface TestSessionNavigationState {
	currentItemIndex: number;
	visitedItemIdentifiers: string[];
	currentSectionIdentifier?: string;
}

export interface TestSessionRealization {
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

export interface ItemSession {
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
}

export interface TestSession {
	version: 1;

	/**
	 * QTI-like identifier for the delivery attempt (administration).
	 */
	testSessionIdentifier: string;

	assessmentId: string;

	startedAt: string;
	updatedAt: string;
	completedAt?: string;

	navigationState: TestSessionNavigationState;
	realization: TestSessionRealization;

	/**
	 * Keyed by QTI item identifier (questionRef.identifier).
	 */
	itemSessions: Record<string, ItemSession>;
}

const TEST_SESSION_VERSION = 1 as const;
const STORAGE_PREFIX = "pieoneer:testSession:v1:";
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

export function createTestSessionIdentifier(args: {
	assessmentId: string;
	assignmentId?: string | null;
	userId?: string | null;
	storage: StorageLike;
}): { testSessionIdentifier: string; seed: string } {
	const { assessmentId, assignmentId, userId, storage } = args;
	if (!assessmentId) {
		throw new Error(
			"assessmentId is required to create a TestSession identifier",
		);
	}

	const subject = userId || getOrCreateAnonymousDeviceId(storage);
	const source = `v1|${assessmentId}|${assignmentId || ""}|${subject}`;
	const seed = fnv1a32Hex(source);
	return { testSessionIdentifier: `ts_v1_${seed}`, seed };
}

export function getTestSessionStorageKey(
	testSessionIdentifier: string,
): string {
	return `${STORAGE_PREFIX}${testSessionIdentifier}`;
}

export function loadTestSession(
	storage: StorageLike,
	testSessionIdentifier: string,
): TestSession | null {
	const raw = storage.getItem(getTestSessionStorageKey(testSessionIdentifier));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as TestSession;
		if (!parsed || parsed.version !== TEST_SESSION_VERSION) return null;
		if (parsed.testSessionIdentifier !== testSessionIdentifier) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveTestSession(
	storage: StorageLike,
	session: TestSession,
): void {
	const updated: TestSession = {
		...session,
		updatedAt: nowIso(),
	};
	storage.setItem(
		getTestSessionStorageKey(session.testSessionIdentifier),
		JSON.stringify(updated),
	);
}

export function createNewTestSession(args: {
	testSessionIdentifier: string;
	assessmentId: string;
	seed: string;
	itemIdentifiers: string[];
}): TestSession {
	const startedAt = nowIso();
	return {
		version: TEST_SESSION_VERSION,
		testSessionIdentifier: args.testSessionIdentifier,
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
	session: TestSession,
	itemIdentifier: string,
): TestSession {
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
	session: TestSession,
	args: {
		currentItemIndex: number;
		currentSectionIdentifier?: string;
	},
): TestSession {
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
	session: TestSession,
	args: { itemIdentifier: string; pieSessionId: string; isCompleted?: boolean },
): TestSession {
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

	const next: ItemSession = {
		itemIdentifier,
		pieSessionId,
		attemptCount,
		isCompleted: completed,
		startedAt: existing?.startedAt || now,
		updatedAt: now,
		completedAt: completed ? existing?.completedAt || now : undefined,
	};

	return {
		...session,
		itemSessions: {
			...session.itemSessions,
			[itemIdentifier]: next,
		},
	};
}
