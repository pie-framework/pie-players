import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AssessmentSession } from "@pie-players/pie-players-shared/types";

// A separate scratch database: the lab never reads or clears the hydration demo.
let database: DatabaseSync | undefined;
function db() {
	if (!database) {
		const directory = join(tmpdir(), "pie-assessment-demos");
		mkdirSync(directory, { recursive: true });
		database = new DatabaseSync(join(directory, "persistence-lab.sqlite"));
		database.exec(`
			CREATE TABLE IF NOT EXISTS lab_attempts (id TEXT PRIMARY KEY, snapshot TEXT NOT NULL);
			CREATE TABLE IF NOT EXISTS lab_writes (
				id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id TEXT NOT NULL,
				snapshot TEXT NOT NULL, behavior TEXT NOT NULL, phase TEXT NOT NULL,
				committed_order INTEGER
			);
		`);
	}
	return database;
}

export type LabBehavior = "save" | "hold" | "reject" | "lose-ack";
type WriteRow = { id: number; snapshot: string; behavior: LabBehavior; phase: string; committed_order: number | null };
const held = new Map<number, { attemptId: string; finish: (commit: boolean) => void }>();

export function readLab(attemptId: string) {
	const stored = db().prepare("SELECT snapshot FROM lab_attempts WHERE id = ?").get(attemptId) as { snapshot: string } | undefined;
	const rows = db().prepare("SELECT id, snapshot, behavior, phase, committed_order FROM lab_writes WHERE attempt_id = ? ORDER BY id").all(attemptId) as WriteRow[];
	return {
		snapshot: stored ? JSON.parse(stored.snapshot) as AssessmentSession : null,
		writes: rows.map(({ snapshot, committed_order, ...row }) => ({
			...row, committedOrder: committed_order,
			sectionIndex: (JSON.parse(snapshot) as AssessmentSession).navigationState.currentSectionIndex,
		})),
	};
}

export async function saveLab(attemptId: string, snapshot: AssessmentSession, behavior: LabBehavior) {
	// The serialized HTTP payload is the immutable write proposal. The backend
	// deliberately implements ordinary last-writer-wins, with no hidden client queue.
	const payload = JSON.stringify(snapshot);
	const result = db().prepare("INSERT INTO lab_writes(attempt_id, snapshot, behavior, phase) VALUES (?, ?, ?, 'pending')").run(attemptId, payload, behavior);
	const id = Number(result.lastInsertRowid);
	let commit = behavior !== "reject";
	if (behavior === "hold") {
		commit = await new Promise<boolean>((resolve) => {
			const timer = setTimeout(() => finish(false), 60_000);
			function finish(accepted: boolean) {
				clearTimeout(timer);
				held.delete(id);
				resolve(accepted);
			}
			held.set(id, { attemptId, finish });
		});
	}
	if (!commit) {
		db().prepare("UPDATE lab_writes SET phase = 'rejected' WHERE id = ?").run(id);
		return { id, status: 503, error: "Injected save rejection; no snapshot was committed." };
	}
	// Commit the exact proposal and its diagnostic record together, before ACK.
	db().exec("BEGIN IMMEDIATE");
	try {
		db().prepare("INSERT INTO lab_attempts(id, snapshot) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot").run(attemptId, payload);
		db().prepare("UPDATE lab_writes SET phase = 'committed', committed_order = (SELECT COALESCE(MAX(committed_order), 0) + 1 FROM lab_writes WHERE attempt_id = ?) WHERE id = ?").run(attemptId, id);
		db().exec("COMMIT");
	} catch (error) {
		db().exec("ROLLBACK");
		throw error;
	}

	if (behavior === "lose-ack") {
		return { id, status: 504, error: "Injected acknowledgement failure; the snapshot was committed." };
	}
	return { id, status: 200 };
}

export function releaseLab(attemptId: string, id: number, commit: boolean) {
	const write = held.get(id);
	if (!write || write.attemptId !== attemptId) return false;
	write.finish(commit);
	return true;
}

export function clearLab(attemptId: string) {
	// Cancel before deletion, so a released request cannot recreate a cleared row.
	for (const write of held.values()) {
		if (write.attemptId === attemptId) write.finish(false);
	}
	db().prepare("DELETE FROM lab_writes WHERE attempt_id = ?").run(attemptId);
	db().prepare("DELETE FROM lab_attempts WHERE id = ?").run(attemptId);
}
