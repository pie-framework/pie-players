import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import schemaSql from "./schema.sql?raw";

export const DEMO_USER_ID = "demo-user-1";

export interface SessionDemoKey {
	assessmentId: string;
	attemptId: string;
}

export interface SectionSessionSnapshot {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
}

export interface AssessmentSessionSnapshot {
	version?: number;
	assessmentAttemptSessionIdentifier?: string;
	assessmentId?: string;
	startedAt?: string;
	updatedAt?: string;
	completedAt?: string;
	navigationState?: {
		currentSectionIndex?: number;
		visitedSectionIdentifiers?: string[];
		currentSectionIdentifier?: string;
	};
	realization?: {
		seed?: string;
		sectionIdentifiers?: string[];
	};
	sectionSessions?: Record<string, unknown>;
	contextVariables?: Record<string, unknown>;
	[key: string]: unknown;
}

export type SessionDemoStateChangeReason =
	| "upsert"
	| "delete"
	| "clear"
	| "seed"
	| "update";

export interface SessionDemoStateChangeEvent {
	reason: SessionDemoStateChangeReason;
	timestamp: number;
}

type AttemptSessionRow = {
	id: number;
	assessment_id: string;
	attempt_id: string;
	demo_user_id: string;
	current_section_identifier: string;
	visited_section_identifiers: string;
	section_identifiers: string;
	created_at: string;
	updated_at: string;
};

type SectionSessionRow = {
	id: number;
	attempt_session_id: number;
	section_id: string;
	current_item_index: number;
	visited_item_identifiers: string;
	created_at: string;
	updated_at: string;
};

type ItemSessionRow = {
	id: number;
	section_session_id: number;
	item_id: string;
	canonical_item_id: string;
	session_payload: string;
	complete: number;
	updated_at: string;
};

const nowIso = (): string => new Date().toISOString();
const clampIndex = (value: unknown): number => {
	if (typeof value !== "number" || !Number.isFinite(value)) return 0;
	return value < 0 ? 0 : Math.floor(value);
};

const dbDirectory = join(tmpdir(), "pie-assessment-demos");
const dbPath = join(dbDirectory, "session-hydrate-demo.sqlite");
mkdirSync(dbDirectory, { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(schemaSql);
const attemptSessionColumns = db
	.prepare(`PRAGMA table_info(attempt_sessions)`)
	.all() as Array<{ name: string }>;
const attemptSessionColumnSet = new Set(
	attemptSessionColumns.map((column) => column.name),
);
if (!attemptSessionColumnSet.has("current_section_identifier")) {
	db.exec(
		`ALTER TABLE attempt_sessions ADD COLUMN current_section_identifier TEXT NOT NULL DEFAULT ''`,
	);
}
if (!attemptSessionColumnSet.has("visited_section_identifiers")) {
	db.exec(
		`ALTER TABLE attempt_sessions ADD COLUMN visited_section_identifiers TEXT NOT NULL DEFAULT '[]'`,
	);
}
if (!attemptSessionColumnSet.has("section_identifiers")) {
	db.exec(
		`ALTER TABLE attempt_sessions ADD COLUMN section_identifiers TEXT NOT NULL DEFAULT '[]'`,
	);
}

const readAttemptByKey = db.prepare(
	`SELECT *
	 FROM attempt_sessions
	 WHERE assessment_id = ? AND attempt_id = ? AND demo_user_id = ?`,
);
const insertAttempt = db.prepare(
	`INSERT INTO attempt_sessions (
		 assessment_id,
		 attempt_id,
		 demo_user_id,
		 current_section_identifier,
		 visited_section_identifiers,
		 section_identifiers,
		 created_at,
		 updated_at
	 )
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
const updateAttemptNavigation = db.prepare(
	`UPDATE attempt_sessions
	 SET updated_at = ?,
		 current_section_identifier = ?,
		 visited_section_identifiers = ?,
		 section_identifiers = ?
	 WHERE id = ?`,
);
const readSectionsByAttempt = db.prepare(
	`SELECT *
	 FROM section_sessions
	 WHERE attempt_session_id = ?`,
);
const readSectionByKey = db.prepare(
	`SELECT *
	 FROM section_sessions
	 WHERE attempt_session_id = ? AND section_id = ?`,
);
const insertSection = db.prepare(
	`INSERT INTO section_sessions (
		 attempt_session_id, section_id, current_item_index, visited_item_identifiers, created_at, updated_at
	 )
	 VALUES (?, ?, ?, ?, ?, ?)`,
);
const updateSection = db.prepare(
	`UPDATE section_sessions
	 SET current_item_index = ?, visited_item_identifiers = ?, updated_at = ?
	 WHERE id = ?`,
);
const deleteSectionItems = db.prepare(
	`DELETE FROM item_sessions WHERE section_session_id = ?`,
);
const deleteSectionById = db.prepare(`DELETE FROM section_sessions WHERE id = ?`);
const insertItem = db.prepare(
	`INSERT INTO item_sessions (
		 section_session_id, item_id, canonical_item_id, session_payload, complete, updated_at
	 )
	 VALUES (?, ?, ?, ?, ?, ?)`,
);
const readSectionItems = db.prepare(
	`SELECT *
	 FROM item_sessions
	 WHERE section_session_id = ?
	 ORDER BY canonical_item_id ASC`,
);
const readAllAttempts = db.prepare(`SELECT * FROM attempt_sessions ORDER BY id ASC`);
const readAllSections = db.prepare(`SELECT * FROM section_sessions ORDER BY id ASC`);
const readAllItems = db.prepare(`SELECT * FROM item_sessions ORDER BY id ASC`);
const clearItems = db.prepare(`DELETE FROM item_sessions`);
const clearSections = db.prepare(`DELETE FROM section_sessions`);
const clearAttempts = db.prepare(`DELETE FROM attempt_sessions`);

const stateChangeListeners = new Set<(event: SessionDemoStateChangeEvent) => void>();
let pendingStateChangeReason: SessionDemoStateChangeReason = "update";
let stateChangeNotifyQueued = false;

function parseVisited(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is string => typeof id === "string" && !!id);
	} catch {
		return [];
	}
}

function parseStringArray(raw: string): string[] {
	return parseVisited(raw);
}

function parsePayload(raw: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object"
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function normalizeItemEntry(
	itemId: string,
	value: unknown,
): {
	itemId: string;
	canonicalItemId: string;
	sessionPayload: Record<string, unknown>;
	complete: number;
	persistWhenEmpty: boolean;
} | null {
	if (!value || typeof value !== "object") return null;
	const asRecord = value as Record<string, unknown>;
	const canonicalItemId =
		typeof asRecord.itemIdentifier === "string" && asRecord.itemIdentifier
			? asRecord.itemIdentifier
			: itemId;
	const sessionPayload =
		asRecord.session && typeof asRecord.session === "object"
			? (asRecord.session as Record<string, unknown>)
			: asRecord;
	const complete =
		typeof asRecord.isCompleted === "boolean"
			? asRecord.isCompleted
				? 1
				: 0
			: typeof asRecord.complete === "boolean"
				? asRecord.complete
					? 1
					: 0
				: (sessionPayload.complete === true ? 1 : 0);
	const persistWhenEmpty = asRecord.persistWhenEmpty === true;
	return { itemId, canonicalItemId, sessionPayload, complete, persistWhenEmpty };
}

function isMeaningfulItemSessionEntry(entry: {
	sessionPayload: Record<string, unknown>;
	complete: number;
	persistWhenEmpty?: boolean;
}): boolean {
	if (entry.persistWhenEmpty) return true;
	if (entry.complete === 1) return true;
	const payload = entry.sessionPayload;
	const values = Array.isArray(payload.data) ? payload.data : [];
	if (values.length === 0) return false;
	return values.some((candidate) => {
		if (!candidate || typeof candidate !== "object") return false;
		const value = (candidate as Record<string, unknown>).value;
		return value !== null && value !== undefined && value !== "";
	});
}

function withEnsuredSessionId(
	payload: Record<string, unknown>,
	fallbackId: string,
): Record<string, unknown> {
	const currentId =
		typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : "";
	if (currentId) return payload;
	return {
		...payload,
		id: fallbackId,
	};
}

export function subscribeSessionDemoState(
	listener: (event: SessionDemoStateChangeEvent) => void,
): () => void {
	stateChangeListeners.add(listener);
	return () => {
		stateChangeListeners.delete(listener);
	};
}

export function notifySessionDemoStateChanged(
	reason: SessionDemoStateChangeReason = "update",
): void {
	pendingStateChangeReason = reason;
	if (stateChangeNotifyQueued) return;
	stateChangeNotifyQueued = true;
	queueMicrotask(() => {
		stateChangeNotifyQueued = false;
		const event: SessionDemoStateChangeEvent = {
			reason: pendingStateChangeReason,
			timestamp: Date.now(),
		};
		for (const listener of stateChangeListeners) {
			try {
				listener(event);
			} catch (error) {
				console.error("[AssessmentSessionDemoDB] state change listener failed:", error);
			}
		}
	});
}

function ensureAttemptSessionId(key: SessionDemoKey): number {
	const existing = readAttemptByKey.get(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
	) as AttemptSessionRow | undefined;
	if (existing) {
		return existing.id;
	}
	const now = nowIso();
	insertAttempt.run(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
		"",
		JSON.stringify([]),
		JSON.stringify([]),
		now,
		now,
	);
	const created = readAttemptByKey.get(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
	) as AttemptSessionRow | undefined;
	if (!created) {
		throw new Error("Failed to create assessment attempt session record");
	}
	return created.id;
}

function ensureSectionSessionId(
	attemptSessionId: number,
	sectionId: string,
	snapshot: SectionSessionSnapshot,
): number {
	const existing = readSectionByKey.get(
		attemptSessionId,
		sectionId,
	) as SectionSessionRow | undefined;
	const now = nowIso();
	const currentItemIndex = clampIndex(snapshot.currentItemIndex);
	const visited = JSON.stringify(snapshot.visitedItemIdentifiers || []);
	if (existing) {
		updateSection.run(currentItemIndex, visited, now, existing.id);
		return existing.id;
	}
	insertSection.run(
		attemptSessionId,
		sectionId,
		currentItemIndex,
		visited,
		now,
		now,
	);
	const created = readSectionByKey.get(
		attemptSessionId,
		sectionId,
	) as SectionSessionRow | undefined;
	if (!created) {
		throw new Error("Failed to create assessment section session record");
	}
	return created.id;
}

function materializeSectionSnapshot(section: SectionSessionRow): SectionSessionSnapshot {
	const itemRows = readSectionItems.all(section.id) as ItemSessionRow[];
	const itemSessions: Record<string, unknown> = {};
	for (const row of itemRows) {
		itemSessions[row.canonical_item_id] = {
			itemIdentifier: row.canonical_item_id,
			attemptCount: 1,
			isCompleted: row.complete === 1,
			session: parsePayload(row.session_payload),
		};
	}
	return {
		currentItemIndex: clampIndex(section.current_item_index),
		visitedItemIdentifiers: parseVisited(section.visited_item_identifiers),
		itemSessions,
	};
}

function createAttemptSessionIdentifier(
	assessmentId: string,
	attemptId: string,
): string {
	return `aas_v1_${assessmentId.replace(/[^a-zA-Z0-9_-]/g, "-")}_${attemptId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function materializeAssessmentSnapshot(
	key: SessionDemoKey,
	attempt: AttemptSessionRow,
	sections: SectionSessionRow[],
): AssessmentSessionSnapshot {
	const sectionSessions: Record<
		string,
		{
			sectionIdentifier: string;
			updatedAt: string;
			session: SectionSessionSnapshot | null;
		}
	> = {};
	const orderedSections = [...sections].sort((a, b) =>
		a.updated_at.localeCompare(b.updated_at),
	);
	const sectionIdentifiers: string[] = [];
	for (const section of orderedSections) {
		sectionIdentifiers.push(section.section_id);
		sectionSessions[section.section_id] = {
			sectionIdentifier: section.section_id,
			updatedAt: section.updated_at,
			session: materializeSectionSnapshot(section),
		};
	}
	const persistedSectionIdentifiers = parseStringArray(attempt.section_identifiers);
	const orderedSectionIdentifiers =
		persistedSectionIdentifiers.length > 0
			? persistedSectionIdentifiers
			: sectionIdentifiers;
	const fallbackCurrentSection =
		orderedSections[0]?.section_id || orderedSectionIdentifiers[0] || "";
	const persistedCurrentSection =
		typeof attempt.current_section_identifier === "string"
			? attempt.current_section_identifier
			: "";
	const currentSectionIdentifier =
		persistedCurrentSection &&
		orderedSectionIdentifiers.includes(persistedCurrentSection)
			? persistedCurrentSection
			: fallbackCurrentSection;
	const currentSectionIndex = Math.max(
		0,
		orderedSectionIdentifiers.indexOf(currentSectionIdentifier),
	);
	const persistedVisitedSections = parseStringArray(
		attempt.visited_section_identifiers,
	);
	const visitedSectionIdentifiers =
		persistedVisitedSections.length > 0
			? persistedVisitedSections.filter((sectionId) =>
					orderedSectionIdentifiers.includes(sectionId),
				)
			: [currentSectionIdentifier].filter(Boolean);

	return {
		version: 1,
		assessmentAttemptSessionIdentifier: createAttemptSessionIdentifier(
			key.assessmentId,
			key.attemptId,
		),
		assessmentId: key.assessmentId,
		startedAt: attempt.created_at,
		updatedAt: attempt.updated_at,
		navigationState: {
			currentSectionIndex,
			visitedSectionIdentifiers,
			currentSectionIdentifier,
		},
		realization: {
			seed: `${key.assessmentId}:${key.attemptId}`,
			sectionIdentifiers: orderedSectionIdentifiers,
		},
		sectionSessions,
	};
}

function resolveNavigationState(snapshot: AssessmentSessionSnapshot): {
	currentSectionIdentifier: string;
	visitedSectionIdentifiers: string[];
	sectionIdentifiers: string[];
} {
	const navigation = snapshot.navigationState || {};
	const realizationSections = Array.isArray(snapshot.realization?.sectionIdentifiers)
		? snapshot.realization?.sectionIdentifiers?.filter(
				(sectionId): sectionId is string =>
					typeof sectionId === "string" && sectionId.length > 0,
			)
		: [];
	const sectionPayload = (snapshot.sectionSessions || {}) as Record<string, unknown>;
	const sectionSessionIds = Object.keys(sectionPayload).filter(Boolean);
	const sectionIdentifiers =
		realizationSections.length > 0 ? realizationSections : sectionSessionIds;
	const currentSectionIdentifier =
		typeof navigation.currentSectionIdentifier === "string" &&
		navigation.currentSectionIdentifier.length > 0
			? navigation.currentSectionIdentifier
			: sectionIdentifiers[0] || "";
	const rawVisited = Array.isArray(navigation.visitedSectionIdentifiers)
		? navigation.visitedSectionIdentifiers.filter(
				(sectionId): sectionId is string =>
					typeof sectionId === "string" && sectionId.length > 0,
			)
		: [];
	const visitedSectionIdentifiers =
		rawVisited.length > 0
			? rawVisited
			: [currentSectionIdentifier].filter(Boolean);
	return {
		currentSectionIdentifier,
		visitedSectionIdentifiers,
		sectionIdentifiers,
	};
}

export function upsertAssessmentSnapshot(
	key: SessionDemoKey,
	snapshot: AssessmentSessionSnapshot,
): void {
	const attemptSessionId = ensureAttemptSessionId(key);
	const sectionPayload = (snapshot?.sectionSessions || {}) as Record<
		string,
		{
			sectionIdentifier?: string;
			session?: SectionSessionSnapshot | null;
		}
	>;
	const targetSectionIds = new Set<string>();
	const existingSections = readSectionsByAttempt.all(
		attemptSessionId,
	) as SectionSessionRow[];

	for (const [keySectionId, rawValue] of Object.entries(sectionPayload)) {
		if (!rawValue || typeof rawValue !== "object") continue;
		const sectionId =
			(typeof rawValue.sectionIdentifier === "string" &&
				rawValue.sectionIdentifier) ||
			keySectionId;
		if (!sectionId) continue;
		targetSectionIds.add(sectionId);
		const sectionSnapshot =
			(rawValue.session as SectionSessionSnapshot | null | undefined) || {
				currentItemIndex: 0,
				visitedItemIdentifiers: [],
				itemSessions: {},
			};
		const sectionSessionId = ensureSectionSessionId(
			attemptSessionId,
			sectionId,
			sectionSnapshot,
		);
		const priorItemRows = readSectionItems.all(sectionSessionId) as ItemSessionRow[];
		const priorSessionIdByCanonicalItemId = new Map<string, string>();
		for (const row of priorItemRows) {
			const payload = parsePayload(row.session_payload);
			const payloadId =
				typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : "";
			if (payloadId) {
				priorSessionIdByCanonicalItemId.set(row.canonical_item_id, payloadId);
			}
		}
		deleteSectionItems.run(sectionSessionId);
		for (const [itemId, rawItemValue] of Object.entries(
			sectionSnapshot.itemSessions || {},
		)) {
			const normalized = normalizeItemEntry(itemId, rawItemValue);
			if (!normalized) continue;
			const existingSessionId =
				priorSessionIdByCanonicalItemId.get(normalized.canonicalItemId) || "";
			const fallbackSessionId =
				existingSessionId ||
				`${key.attemptId}:${sectionId}:${normalized.canonicalItemId}`;
			const normalizedPayload = withEnsuredSessionId(
				normalized.sessionPayload,
				fallbackSessionId,
			);
			insertItem.run(
				sectionSessionId,
				normalized.itemId,
				normalized.canonicalItemId,
				JSON.stringify(normalizedPayload),
				normalized.complete,
				nowIso(),
			);
		}
	}

	for (const existing of existingSections) {
		if (targetSectionIds.has(existing.section_id)) continue;
		deleteSectionItems.run(existing.id);
		deleteSectionById.run(existing.id);
	}
	const navigationState = resolveNavigationState(snapshot);
	updateAttemptNavigation.run(
		nowIso(),
		navigationState.currentSectionIdentifier,
		JSON.stringify(navigationState.visitedSectionIdentifiers),
		JSON.stringify(navigationState.sectionIdentifiers),
		attemptSessionId,
	);
	notifySessionDemoStateChanged("upsert");
}

export function getAssessmentSnapshot(
	key: SessionDemoKey,
): AssessmentSessionSnapshot | null {
	const attempt = readAttemptByKey.get(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
	) as AttemptSessionRow | undefined;
	if (!attempt) return null;
	const sections = readSectionsByAttempt.all(attempt.id) as SectionSessionRow[];
	if (sections.length === 0) return null;
	return materializeAssessmentSnapshot(key, attempt, sections);
}

export function deleteAssessmentSnapshot(key: SessionDemoKey): void {
	const attempt = readAttemptByKey.get(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
	) as AttemptSessionRow | undefined;
	if (!attempt) return;
	const sections = readSectionsByAttempt.all(attempt.id) as SectionSessionRow[];
	for (const section of sections) {
		deleteSectionItems.run(section.id);
		deleteSectionById.run(section.id);
	}
	notifySessionDemoStateChanged("delete");
}

export function clearAllSessionDemoData(): void {
	clearItems.run();
	clearSections.run();
	clearAttempts.run();
	notifySessionDemoStateChanged("clear");
}

export function seedSessionDemoData(args: {
	assessmentId: string;
	attemptId: string;
	snapshot: AssessmentSessionSnapshot;
}): void {
	clearAllSessionDemoData();
	upsertAssessmentSnapshot(
		{
			assessmentId: args.assessmentId,
			attemptId: args.attemptId,
		},
		args.snapshot,
	);
	notifySessionDemoStateChanged("seed");
}

export function getSessionDemoState(): {
	dbPath: string;
	demoUserId: string;
	tables: {
		attempt_sessions: AttemptSessionRow[];
		section_sessions: Array<
			Omit<SectionSessionRow, "visited_item_identifiers"> & {
				visited_item_identifiers: unknown;
			}
		>;
		item_sessions: Array<
			Omit<ItemSessionRow, "session_payload"> & {
				session_payload: unknown;
			}
		>;
	};
	reconstructedSnapshots: Record<string, SectionSessionSnapshot>;
} {
	const attempts = readAllAttempts.all() as AttemptSessionRow[];
	const sections = readAllSections.all() as SectionSessionRow[];
	const items = readAllItems.all() as ItemSessionRow[];
	const reconstructedSnapshots: Record<string, SectionSessionSnapshot> = {};

	for (const section of sections) {
		const attempt = attempts.find((entry) => entry.id === section.attempt_session_id);
		if (!attempt) continue;
		const key = `${attempt.assessment_id}:${section.section_id}:${attempt.attempt_id}`;
		reconstructedSnapshots[key] = materializeSectionSnapshot(section);
	}

	return {
		dbPath,
		demoUserId: DEMO_USER_ID,
		tables: {
			attempt_sessions: attempts,
			section_sessions: sections.map((row) => ({
				...row,
				visited_item_identifiers: parseVisited(row.visited_item_identifiers),
			})),
			item_sessions: items.map((row) => ({
				...row,
				session_payload: parsePayload(row.session_payload),
			})),
		},
		reconstructedSnapshots,
	};
}

export function parseSessionDemoKeyFromSearch(
	searchParams: URLSearchParams,
): SessionDemoKey {
	return {
		assessmentId: searchParams.get("assessmentId") || "",
		attemptId: searchParams.get("attemptId") || "",
	};
}

export function isValidSessionDemoKey(key: SessionDemoKey): boolean {
	return Boolean(key.assessmentId && key.attemptId);
}
