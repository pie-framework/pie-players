export interface SessionDemoSeedPayload {
	assessmentId: string;
	attemptId: string;
	sections: Array<{
		sectionId: string;
		snapshot: {
			currentItemIndex: number;
			visitedItemIdentifiers: string[];
			itemSessions: Record<string, unknown>;
		};
	}>;
}

export interface SectionSessionSnapshot {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
}

export const SESSION_DEMO_SECTION_IDS = [
	"session-persistence-page-one",
	"session-persistence-page-two",
] as const;

export interface SessionDemoActivityLoadResponse {
	ok: boolean;
	activityDefinition: {
		sections: Array<Record<string, unknown>>;
		stats: {
			totalItems: number;
			totalSections: number;
		};
	};
	itemToSession: Record<string, { id: string; data: unknown[] }>;
	itemToJs: Record<string, { view: string[] }>;
	activitySessionId: string;
	section: Record<string, unknown> | null;
	sessionState: SectionSessionSnapshot | null;
}

export function createSessionDemoSeedPayload(
	assessmentId: string,
	attemptId: string,
): SessionDemoSeedPayload {
	return {
		assessmentId,
		attemptId,
		sections: [
			{
				sectionId: "session-persistence-page-one",
				snapshot: {
					currentItemIndex: 2,
					visitedItemIdentifiers: ["sp1-q1", "sp1-q2", "sp1-q3"],
					itemSessions: {
						"sp1-q1": {
							itemIdentifier: "sp1-q1",
							attemptCount: 1,
							isCompleted: true,
							session: {
								id: "sp1-q1-seeded",
								complete: true,
								data: [{ id: "sp1q1", value: "b" }],
							},
						},
						"sp1-q2": {
							itemIdentifier: "sp1-q2",
							attemptCount: 1,
							isCompleted: false,
							session: {
								id: "sp1-q2-seeded",
								complete: false,
								data: [{ id: "sp1q2", value: "a" }],
							},
						},
						"sp1-q3": {
							itemIdentifier: "sp1-q3",
							attemptCount: 1,
							isCompleted: true,
							session: {
								id: "sp1-q3-seeded",
								complete: true,
								data: [{ id: "sp1q3", value: "b" }],
							},
						},
					},
				},
			},
			{
				sectionId: "session-persistence-page-two",
				snapshot: {
					currentItemIndex: 0,
					visitedItemIdentifiers: ["sp2-q1", "sp2-q2"],
					itemSessions: {
						"sp2-q1": {
							itemIdentifier: "sp2-q1",
							attemptCount: 1,
							isCompleted: true,
							session: {
								id: "sp2-q1-seeded",
								complete: true,
								data: [{ id: "sp2q1", value: "b" }],
							},
						},
						"sp2-q2": {
							itemIdentifier: "sp2-q2",
							attemptCount: 1,
							isCompleted: false,
							persistWhenEmpty: true,
							session: {
								id: "sp2-q2-seeded",
								complete: false,
								data: [],
							},
						},
					},
				},
			},
		],
	};
}

export function createSessionDemoEmptySeedPayload(
	assessmentId: string,
	attemptId: string,
): SessionDemoSeedPayload {
	return {
		assessmentId,
		attemptId,
		sections: SESSION_DEMO_SECTION_IDS.map((sectionId) => ({
			sectionId,
			snapshot: {
				currentItemIndex: 0,
				visitedItemIdentifiers: [],
				itemSessions: {},
			},
		})),
	};
}

function snapshotQuery(assessmentId: string, sectionId: string, attemptId: string): string {
	const query = new URLSearchParams({
		assessmentId,
		sectionId,
		attemptId,
	});
	return query.toString();
}

export async function bootstrapSessionDemoDb(payload: SessionDemoSeedPayload): Promise<void> {
	const response = await fetch("/api/session-demo/bootstrap", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(payload),
	});
	if (!response.ok) {
		const errorPayload = await response.json().catch(() => ({}));
		throw new Error(
			typeof errorPayload?.error === "string"
				? errorPayload.error
				: `Failed to bootstrap session demo DB (${response.status})`,
		);
	}
}

export async function loadSessionDemoActivity(args: {
	assessmentId: string;
	attemptId: string;
	sectionId: string;
	reset?: boolean;
}): Promise<SessionDemoActivityLoadResponse> {
	const response = await fetch("/api/session-demo/activity/load", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			assessmentId: args.assessmentId,
			attemptId: args.attemptId,
			sectionId: args.sectionId,
			reset: args.reset === true,
		}),
	});
	if (!response.ok) {
		const errorPayload = await response.json().catch(() => ({}));
		throw new Error(
			typeof errorPayload?.error === "string"
				? errorPayload.error
				: `Failed to load session demo activity (${response.status})`,
		);
	}
	return (await response.json()) as SessionDemoActivityLoadResponse;
}

export async function clearSessionDemoDb(
	assessmentId: string,
	attemptId: string,
): Promise<void> {
	const response = await fetch("/api/session-demo/bootstrap", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			assessmentId,
			attemptId,
			clearOnly: true,
		}),
	});
	if (!response.ok) {
		throw new Error(`Failed to clear session demo DB (${response.status})`);
	}
}

export async function loadSnapshotFromSessionDb(args: {
	assessmentId: string;
	sectionId: string;
	attemptId: string;
}): Promise<SectionSessionSnapshot | null> {
	const response = await fetch(
		`/api/session-demo/snapshot?${snapshotQuery(args.assessmentId, args.sectionId, args.attemptId)}`,
	);
	if (!response.ok) return null;
	const payload = await response.json().catch(() => ({}));
	return payload?.snapshot || null;
}

export async function saveSnapshotToSessionDb(args: {
	assessmentId: string;
	sectionId: string;
	attemptId: string;
	snapshot: SectionSessionSnapshot | null;
}): Promise<void> {
	const response = await fetch("/api/session-demo/snapshot", {
		method: "PUT",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			assessmentId: args.assessmentId,
			sectionId: args.sectionId,
			attemptId: args.attemptId,
			snapshot: args.snapshot || { itemSessions: {} },
		}),
	});
	if (!response.ok) {
		throw new Error(`Failed to save session snapshot (${response.status})`);
	}
}

export async function deleteSnapshotFromSessionDb(args: {
	assessmentId: string;
	sectionId: string;
	attemptId: string;
}): Promise<void> {
	const response = await fetch(
		`/api/session-demo/snapshot?${snapshotQuery(args.assessmentId, args.sectionId, args.attemptId)}`,
		{
			method: "DELETE",
		},
	);
	if (!response.ok) {
		throw new Error(`Failed to delete session snapshot (${response.status})`);
	}
}
