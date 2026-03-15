export interface SectionSessionSnapshot {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
}

export interface AssessmentSessionSnapshot {
	version: 1;
	assessmentAttemptSessionIdentifier: string;
	assessmentId: string;
	startedAt: string;
	updatedAt: string;
	navigationState: {
		currentSectionIndex: number;
		visitedSectionIdentifiers: string[];
		currentSectionIdentifier?: string;
	};
	realization: {
		seed: string;
		sectionIdentifiers: string[];
	};
	sectionSessions: Record<
		string,
		{
			sectionIdentifier: string;
			updatedAt: string;
			session: SectionSessionSnapshot | null;
		}
	>;
	contextVariables?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface SessionDemoSeedPayload {
	assessmentId: string;
	attemptId: string;
	snapshot: AssessmentSessionSnapshot;
}

export interface SessionDemoActivityLoadResponse {
	ok: boolean;
	activitySessionId: string;
	assessment: Record<string, unknown> | null;
	sessionState: AssessmentSessionSnapshot | null;
	activityDefinition: {
		sections: Array<Record<string, unknown>>;
		stats: {
			totalItems: number;
			totalSections: number;
		};
	};
}

export const SESSION_DEMO_SECTION_IDS = [
	"assessment-session-db-section-one",
	"assessment-session-db-section-two",
] as const;

function nowIso(): string {
	return new Date().toISOString();
}

function createAttemptSessionIdentifier(assessmentId: string, attemptId: string): string {
	return `aas_v1_${assessmentId.replace(/[^a-zA-Z0-9_-]/g, "-")}_${attemptId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function createSessionDemoSeedPayload(
	assessmentId: string,
	attemptId: string,
): SessionDemoSeedPayload {
	const startedAt = nowIso();
	const sectionSessions = Object.fromEntries(
		SESSION_DEMO_SECTION_IDS.map((sectionId) => [
			sectionId,
			{
				sectionIdentifier: sectionId,
				updatedAt: startedAt,
				session: {
					currentItemIndex: 0,
					visitedItemIdentifiers: [],
					itemSessions: {},
				},
			},
		]),
	) as AssessmentSessionSnapshot["sectionSessions"];
	return {
		assessmentId,
		attemptId,
		snapshot: {
			version: 1,
			assessmentAttemptSessionIdentifier: createAttemptSessionIdentifier(
				assessmentId,
				attemptId,
			),
			assessmentId,
			startedAt,
			updatedAt: startedAt,
			navigationState: {
				currentSectionIndex: 0,
				visitedSectionIdentifiers: [],
				currentSectionIdentifier: "assessment-session-db-section-one",
			},
			realization: {
				seed: `${assessmentId}:${attemptId}`,
				sectionIdentifiers: [...SESSION_DEMO_SECTION_IDS],
			},
			sectionSessions,
		},
	};
}

function keyQuery(assessmentId: string, attemptId: string): string {
	const query = new URLSearchParams({
		assessmentId,
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
				: `Failed to bootstrap assessment session demo DB (${response.status})`,
		);
	}
}

export async function loadSessionDemoActivity(args: {
	assessmentId: string;
	attemptId: string;
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
			reset: args.reset === true,
		}),
	});
	if (!response.ok) {
		const errorPayload = await response.json().catch(() => ({}));
		throw new Error(
			typeof errorPayload?.error === "string"
				? errorPayload.error
				: `Failed to load assessment session demo activity (${response.status})`,
		);
	}
	return (await response.json()) as SessionDemoActivityLoadResponse;
}

export async function loadSnapshotFromSessionDb(args: {
	assessmentId: string;
	attemptId: string;
}): Promise<AssessmentSessionSnapshot | null> {
	const response = await fetch(
		`/api/session-demo/snapshot?${keyQuery(args.assessmentId, args.attemptId)}`,
	);
	if (!response.ok) return null;
	const payload = await response.json().catch(() => ({}));
	return payload?.snapshot || null;
}

export async function saveSnapshotToSessionDb(args: {
	assessmentId: string;
	attemptId: string;
	snapshot: AssessmentSessionSnapshot | null;
}): Promise<void> {
	const response = await fetch("/api/session-demo/snapshot", {
		method: "PUT",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			assessmentId: args.assessmentId,
			attemptId: args.attemptId,
			snapshot: args.snapshot,
		}),
	});
	if (!response.ok) {
		throw new Error(`Failed to save assessment session snapshot (${response.status})`);
	}
}

export async function deleteSnapshotFromSessionDb(args: {
	assessmentId: string;
	attemptId: string;
}): Promise<void> {
	const response = await fetch(
		`/api/session-demo/snapshot?${keyQuery(args.assessmentId, args.attemptId)}`,
		{
			method: "DELETE",
		},
	);
	if (!response.ok) {
		throw new Error(`Failed to delete assessment session snapshot (${response.status})`);
	}
}
