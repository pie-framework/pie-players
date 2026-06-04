import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import schemaSql from "./schema.sql?raw";

export type DemoItemConfig = {
	id: string;
	markup: string;
	elements: Record<string, string>;
	models: Array<Record<string, unknown> & { id: string; element: string }>;
};

export type DemoItem = {
	id: string;
	name: string;
	description: string;
	config: DemoItemConfig;
	createdAt: string;
	updatedAt: string;
};

export type DemoSession = {
	id: string;
	itemId: string;
	data: unknown[];
	createdAt: string;
	updatedAt: string;
};

type DemoItemRow = {
	id: string;
	name: string;
	description: string;
	config_json: string;
	created_at: string;
	updated_at: string;
};

type DemoSessionRow = {
	id: string;
	item_id: string;
	data_json: string;
	created_at: string;
	updated_at: string;
};

const DEFAULT_ITEM_ID = "backend-delivery-planets";
const MULTIPLE_CHOICE_ELEMENT = "multiple-choice";
const MULTIPLE_CHOICE_PACKAGE = "@pie-element/multiple-choice@latest";

const seededItems: Array<{
	id: string;
	name: string;
	description: string;
	config: DemoItemConfig;
}> = [
	{
		id: DEFAULT_ITEM_ID,
		name: "Largest Planet",
		description:
			"Single-select multiple choice with correct-response data in the raw model.",
		config: {
			id: DEFAULT_ITEM_ID,
			markup: '<multiple-choice id="planet-choice"></multiple-choice>',
			elements: {
				[MULTIPLE_CHOICE_ELEMENT]: MULTIPLE_CHOICE_PACKAGE,
			},
			models: [
				{
					id: "planet-choice",
					element: MULTIPLE_CHOICE_ELEMENT,
					choiceMode: "radio",
					choicePrefix: "letters",
					choices: [
						{
							correct: false,
							value: "mercury",
							label: "Mercury",
							feedback: {
								type: "default",
								value: "Mercury is tiny compared with the gas giants.",
							},
						},
						{
							correct: true,
							value: "jupiter",
							label: "Jupiter",
							feedback: {
								type: "default",
								value: "Correct. Jupiter is the largest planet.",
							},
						},
						{
							correct: false,
							value: "earth",
							label: "Earth",
							feedback: {
								type: "default",
								value: "Earth is the third planet from the Sun.",
							},
						},
						{
							correct: false,
							value: "mars",
							label: "Mars",
							feedback: {
								type: "default",
								value: "Mars is smaller than Earth.",
							},
						},
					],
					prompt:
						"<p>Backend demo: which is the largest planet in our solar system?</p>",
					promptEnabled: true,
					toolbarEditorPosition: "bottom",
				},
			],
		},
	},
	{
		id: "backend-delivery-arithmetic",
		name: "Arithmetic Check",
		description:
			"A second item proving item selection comes from the backend database.",
		config: {
			id: "backend-delivery-arithmetic",
			markup: '<multiple-choice id="sum-choice"></multiple-choice>',
			elements: {
				[MULTIPLE_CHOICE_ELEMENT]: MULTIPLE_CHOICE_PACKAGE,
			},
			models: [
				{
					id: "sum-choice",
					element: MULTIPLE_CHOICE_ELEMENT,
					choiceMode: "radio",
					choicePrefix: "numbers",
					choices: [
						{ correct: false, value: "7", label: "7" },
						{ correct: true, value: "8", label: "8" },
						{ correct: false, value: "9", label: "9" },
						{ correct: false, value: "10", label: "10" },
					],
					prompt: "<p>Backend demo: what is 3 + 5?</p>",
					promptEnabled: true,
					toolbarEditorPosition: "bottom",
				},
			],
		},
	},
	{
		id: "backend-delivery-colors",
		name: "Primary Color",
		description:
			"A third seeded item with the same controller but distinct stored config.",
		config: {
			id: "backend-delivery-colors",
			markup: '<multiple-choice id="color-choice"></multiple-choice>',
			elements: {
				[MULTIPLE_CHOICE_ELEMENT]: MULTIPLE_CHOICE_PACKAGE,
			},
			models: [
				{
					id: "color-choice",
					element: MULTIPLE_CHOICE_ELEMENT,
					choiceMode: "radio",
					choicePrefix: "letters",
					choices: [
						{ correct: false, value: "green", label: "Green" },
						{ correct: false, value: "purple", label: "Purple" },
						{ correct: true, value: "red", label: "Red" },
						{ correct: false, value: "orange", label: "Orange" },
					],
					prompt: "<p>Backend demo: which one is a primary color?</p>",
					promptEnabled: true,
					toolbarEditorPosition: "bottom",
				},
			],
		},
	},
];

const dbDirectory = join(tmpdir(), "pie-backend-demos");
export const dbPath = join(dbDirectory, "backend-demo.sqlite");
mkdirSync(dbDirectory, { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(schemaSql);

const readItemById = db.prepare(`SELECT * FROM demo_items WHERE id = ?`);
const readItems = db.prepare(`SELECT * FROM demo_items ORDER BY id ASC`);
const upsertItem = db.prepare(
	`INSERT INTO demo_items (id, name, description, config_json, created_at, updated_at)
	 VALUES (?, ?, ?, ?, ?, ?)
	 ON CONFLICT(id) DO UPDATE SET
		name = excluded.name,
		description = excluded.description,
		config_json = excluded.config_json,
		updated_at = excluded.updated_at`,
);
const readSessionById = db.prepare(`SELECT * FROM demo_sessions WHERE id = ?`);
const readSessions = db.prepare(
	`SELECT * FROM demo_sessions ORDER BY updated_at DESC`,
);
const insertSession = db.prepare(
	`INSERT INTO demo_sessions (id, item_id, data_json, created_at, updated_at)
	 VALUES (?, ?, ?, ?, ?)`,
);
const updateSession = db.prepare(
	`UPDATE demo_sessions
	 SET item_id = ?, data_json = ?, updated_at = ?
	 WHERE id = ?`,
);
const countSessions = db.prepare(`SELECT COUNT(*) as count FROM demo_sessions`);

function nowIso(): string {
	return new Date().toISOString();
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function parseJson<T>(value: string, fallback: T): T {
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function toItem(row: DemoItemRow): DemoItem {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		config: parseJson<DemoItemConfig>(row.config_json, {
			id: row.id,
			markup: "",
			elements: {},
			models: [],
		}),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toSession(row: DemoSessionRow): DemoSession {
	return {
		id: row.id,
		itemId: row.item_id,
		data: parseJson<unknown[]>(row.data_json, []),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function seedDemoItems(): void {
	const now = nowIso();
	for (const item of seededItems) {
		upsertItem.run(
			item.id,
			item.name,
			item.description,
			JSON.stringify(item.config),
			now,
			now,
		);
	}
}

seedDemoItems();

export function createSessionId(): string {
	const row = countSessions.get() as { count?: number } | undefined;
	const next = Number(row?.count || 0) + 1;
	return `backend-demo-session-${next}`;
}

export function ensureSession(itemId: string, sessionId?: string): DemoSession {
	const item = getDemoItem(itemId);
	if (!item) {
		throw new Error(`Unknown demo itemId: ${itemId}`);
	}
	const id = sessionId || createSessionId();
	const existing = readSessionById.get(id) as DemoSessionRow | undefined;
	if (existing && existing.item_id === itemId) return toSession(existing);
	if (existing && existing.item_id !== itemId) {
		throw new Error(
			`Session ${id} belongs to ${existing.item_id}, not requested item ${itemId}.`,
		);
	}
	const now = nowIso();
	const session: DemoSession = {
		id,
		itemId,
		data: [],
		createdAt: now,
		updatedAt: now,
	};
	insertSession.run(id, itemId, JSON.stringify([]), now, now);
	return clone(session);
}

export function saveSession(
	sessionId: string,
	data: unknown[],
	itemId?: string,
): DemoSession {
	const existing = readSessionById.get(sessionId) as DemoSessionRow | undefined;
	if (existing && itemId && existing.item_id !== itemId) {
		throw new Error(
			`Session ${sessionId} belongs to ${existing.item_id}, not requested item ${itemId}.`,
		);
	}
	const resolvedItemId = itemId || existing?.item_id || getDemoItemId();
	const item = getDemoItem(resolvedItemId);
	if (!item) {
		throw new Error(`Unknown demo itemId: ${resolvedItemId}`);
	}
	const now = nowIso();
	if (existing) {
		updateSession.run(
			resolvedItemId,
			JSON.stringify(Array.isArray(data) ? data : []),
			now,
			sessionId,
		);
		return {
			id: sessionId,
			itemId: resolvedItemId,
			data: Array.isArray(data) ? clone(data) : [],
			createdAt: existing.created_at,
			updatedAt: now,
		};
	}
	const session: DemoSession = {
		id: sessionId,
		itemId: resolvedItemId,
		data: Array.isArray(data) ? clone(data) : [],
		createdAt: now,
		updatedAt: now,
	};
	insertSession.run(
		sessionId,
		resolvedItemId,
		JSON.stringify(session.data),
		now,
		now,
	);
	return clone(session);
}

export function getSession(sessionId: string): DemoSession | null {
	const existing = readSessionById.get(sessionId) as DemoSessionRow | undefined;
	return existing ? toSession(existing) : null;
}

export function getDemoItem(itemId: string): DemoItem | null {
	const row = readItemById.get(itemId) as DemoItemRow | undefined;
	return row ? toItem(row) : null;
}

export function listDemoItems(): DemoItem[] {
	return (readItems.all() as DemoItemRow[]).map(toItem);
}

export function getItemForSession(sessionId: string): DemoItem | null {
	const session = getSession(sessionId);
	if (!session) return null;
	return getDemoItem(session.itemId);
}

export function getDemoState(): {
	dbPath: string;
	items: DemoItem[];
	sessions: DemoSession[];
} {
	return {
		dbPath,
		items: listDemoItems(),
		sessions: (readSessions.all() as DemoSessionRow[]).map(toSession),
	};
}

export function getDemoItemId(): string {
	return DEFAULT_ITEM_ID;
}
