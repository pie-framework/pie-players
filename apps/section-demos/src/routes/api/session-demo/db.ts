import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import schemaSql from "./schema.sql?raw";

export const DEMO_USER_ID = "demo-user-1";

export interface SessionDemoKey {
	assessmentId: string;
	sectionId: string;
	attemptId: string;
}

export interface SessionDemoSnapshot {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
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

const dbDirectory = join(tmpdir(), "pie-section-demos");
const dbPath = join(dbDirectory, "session-hydrate-demo.sqlite");
mkdirSync(dbDirectory, { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(schemaSql);

const readAttemptByKey = db.prepare(
	`SELECT *
	 FROM attempt_sessions
	 WHERE assessment_id = ? AND attempt_id = ? AND demo_user_id = ?`,
);
const insertAttempt = db.prepare(
	`INSERT INTO attempt_sessions (
		 assessment_id, attempt_id, demo_user_id, created_at, updated_at
	 )
	 VALUES (?, ?, ?, ?, ?)`,
);
const touchAttempt = db.prepare(
	`UPDATE attempt_sessions SET updated_at = ? WHERE id = ?`,
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
const deleteSectionById = db.prepare(
	`DELETE FROM section_sessions WHERE id = ?`,
);
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
				console.error("[SessionDemoDB] state change listener failed:", error);
			}
		}
	});
}

function parseVisited(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is string => typeof id === "string" && !!id);
	} catch {
		return [];
	}
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

function ensureAttemptSessionId(key: SessionDemoKey): number {
	const existing = readAttemptByKey.get(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
	) as AttemptSessionRow | undefined;
	if (existing) {
		touchAttempt.run(nowIso(), existing.id);
		return existing.id;
	}
	const now = nowIso();
	insertAttempt.run(key.assessmentId, key.attemptId, DEMO_USER_ID, now, now);
	const created = readAttemptByKey.get(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
	) as AttemptSessionRow | undefined;
	if (!created) {
		throw new Error("Failed to create attempt session record");
	}
	return created.id;
}

function ensureSectionSessionId(key: SessionDemoKey, snapshot: SessionDemoSnapshot): number {
	const attemptSessionId = ensureAttemptSessionId(key);
	const existing = readSectionByKey.get(
		attemptSessionId,
		key.sectionId,
	) as SectionSessionRow | undefined;
	const now = nowIso();
	const currentItemIndex = clampIndex(snapshot.currentItemIndex);
	const visited = JSON.stringify(snapshot.visitedItemIdentifiers || []);
	if (existing) {
		updateSection.run(currentItemIndex, visited, now, existing.id);
		return existing.id;
	}
	insertSection.run(attemptSessionId, key.sectionId, currentItemIndex, visited, now, now);
	const created = readSectionByKey.get(
		attemptSessionId,
		key.sectionId,
	) as SectionSessionRow | undefined;
	if (!created) {
		throw new Error("Failed to create section session record");
	}
	return created.id;
}

function materializeSnapshot(section: SectionSessionRow): SessionDemoSnapshot {
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

export function upsertSectionSnapshot(
	key: SessionDemoKey,
	snapshot: SessionDemoSnapshot,
): void {
	const sectionSessionId = ensureSectionSessionId(key, snapshot);
	const existingRows = readSectionItems.all(sectionSessionId) as ItemSessionRow[];
	const existingSessionIdByCanonicalItemId = new Map<string, string>();
	for (const row of existingRows) {
		const payload = parsePayload(row.session_payload);
		const payloadId =
			typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : "";
		if (!payloadId) continue;
		existingSessionIdByCanonicalItemId.set(row.canonical_item_id, payloadId);
	}
	deleteSectionItems.run(sectionSessionId);
	for (const [itemId, rawValue] of Object.entries(snapshot.itemSessions || {})) {
		const normalized = normalizeItemEntry(itemId, rawValue);
		if (!normalized) continue;
		if (!isMeaningfulItemSessionEntry(normalized)) continue;
		const existingSessionId =
			existingSessionIdByCanonicalItemId.get(normalized.canonicalItemId) || "";
		const fallbackSessionId =
			existingSessionId ||
			`${key.attemptId}:${key.sectionId}:${normalized.canonicalItemId}`;
		const normalizedSessionPayload = withEnsuredSessionId(
			normalized.sessionPayload,
			fallbackSessionId,
		);
		insertItem.run(
			sectionSessionId,
			normalized.itemId,
			normalized.canonicalItemId,
			JSON.stringify(normalizedSessionPayload),
			normalized.complete,
			nowIso(),
		);
	}
	notifySessionDemoStateChanged("upsert");
}

export function getSectionSnapshot(key: SessionDemoKey): SessionDemoSnapshot | null {
	const attempt = readAttemptByKey.get(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
	) as AttemptSessionRow | undefined;
	if (!attempt) return null;
	const section = readSectionByKey.get(
		attempt.id,
		key.sectionId,
	) as SectionSessionRow | undefined;
	if (!section) return null;
	return materializeSnapshot(section);
}

export function deleteSectionSnapshot(key: SessionDemoKey): void {
	const attempt = readAttemptByKey.get(
		key.assessmentId,
		key.attemptId,
		DEMO_USER_ID,
	) as AttemptSessionRow | undefined;
	if (!attempt) return;
	const section = readSectionByKey.get(
		attempt.id,
		key.sectionId,
	) as SectionSessionRow | undefined;
	if (!section) return;
	deleteSectionItems.run(section.id);
	deleteSectionById.run(section.id);
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
	sections: Array<{ sectionId: string; snapshot: SessionDemoSnapshot }>;
}): void {
	clearAllSessionDemoData();
	for (const sectionEntry of args.sections) {
		upsertSectionSnapshot(
			{
				assessmentId: args.assessmentId,
				attemptId: args.attemptId,
				sectionId: sectionEntry.sectionId,
			},
			sectionEntry.snapshot,
		);
	}
	notifySessionDemoStateChanged("seed");
}

export function getSessionDemoState(): {
	dbPath: string;
	demoUserId: string;
	tables: {
		attempt_sessions: AttemptSessionRow[];
		section_sessions: Array<Omit<SectionSessionRow, "visited_item_identifiers"> & { visited_item_identifiers: unknown }>;
		item_sessions: Array<Omit<ItemSessionRow, "session_payload"> & { session_payload: unknown }>;
	};
	reconstructedSnapshots: Record<string, SessionDemoSnapshot>;
} {
	const attempts = readAllAttempts.all() as AttemptSessionRow[];
	const sections = readAllSections.all() as SectionSessionRow[];
	const items = readAllItems.all() as ItemSessionRow[];
	const reconstructedSnapshots: Record<string, SessionDemoSnapshot> = {};

	for (const section of sections) {
		const attempt = attempts.find((entry) => entry.id === section.attempt_session_id);
		if (!attempt) continue;
		const key = `${attempt.assessment_id}:${section.section_id}:${attempt.attempt_id}`;
		reconstructedSnapshots[key] = materializeSnapshot(section);
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

export function parseSessionDemoKeyFromSearch(searchParams: URLSearchParams): SessionDemoKey {
	return {
		assessmentId: searchParams.get("assessmentId") || "",
		sectionId: searchParams.get("sectionId") || "",
		attemptId: searchParams.get("attemptId") || "",
	};
}

export function isValidSessionDemoKey(key: SessionDemoKey): boolean {
	return Boolean(key.assessmentId && key.sectionId && key.attemptId);
}
