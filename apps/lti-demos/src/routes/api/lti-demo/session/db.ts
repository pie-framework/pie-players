import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
	AssessmentSessionSnapshot,
	SessionPersistenceKey,
} from "$lib/lti-demo/types";

type SessionRow = {
	snapshot: string;
};

const dbDirectory = join(tmpdir(), "pie-lti-demos");
const dbPath = join(dbDirectory, "lti-demo-sessions.sqlite");
mkdirSync(dbDirectory, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec(`
CREATE TABLE IF NOT EXISTS assessment_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	assessment_id TEXT NOT NULL,
	attempt_id TEXT NOT NULL,
	snapshot TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(assessment_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_lti_assessment_sessions_lookup
	ON assessment_sessions(assessment_id, attempt_id);
`);

const readSnapshot = db.prepare(
	`SELECT snapshot
	 FROM assessment_sessions
	 WHERE assessment_id = ? AND attempt_id = ?`,
);

const upsertSnapshot = db.prepare(
	`INSERT INTO assessment_sessions (
		 assessment_id,
		 attempt_id,
		 snapshot,
		 created_at,
		 updated_at
	 )
	 VALUES (?, ?, ?, ?, ?)
	 ON CONFLICT(assessment_id, attempt_id)
	 DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at`,
);

const deleteSnapshot = db.prepare(
	`DELETE FROM assessment_sessions
	 WHERE assessment_id = ? AND attempt_id = ?`,
);

export function isValidSessionKey(key: SessionPersistenceKey): boolean {
	return Boolean(key.assessmentId && key.attemptId);
}

export function parseSessionKeyFromSearch(
	searchParams: URLSearchParams,
): SessionPersistenceKey {
	return {
		assessmentId: searchParams.get("assessmentId") || "",
		attemptId: searchParams.get("attemptId") || "",
	};
}

export function getAssessmentSessionSnapshot(
	key: SessionPersistenceKey,
): AssessmentSessionSnapshot | null {
	const row = readSnapshot.get(key.assessmentId, key.attemptId) as
		| SessionRow
		| undefined;
	if (!row) return null;
	try {
		const parsed = JSON.parse(row.snapshot);
		return parsed && typeof parsed === "object"
			? (parsed as AssessmentSessionSnapshot)
			: null;
	} catch {
		return null;
	}
}

export function saveAssessmentSessionSnapshot(
	key: SessionPersistenceKey,
	snapshot: AssessmentSessionSnapshot | null,
): AssessmentSessionSnapshot | null {
	const now = new Date().toISOString();
	upsertSnapshot.run(
		key.assessmentId,
		key.attemptId,
		JSON.stringify(snapshot),
		now,
		now,
	);
	return getAssessmentSessionSnapshot(key);
}

export function deleteAssessmentSessionSnapshot(
	key: SessionPersistenceKey,
): void {
	deleteSnapshot.run(key.assessmentId, key.attemptId);
}
