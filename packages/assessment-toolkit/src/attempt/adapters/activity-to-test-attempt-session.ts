import type {
	TestAttemptItemSession,
	TestAttemptSession,
} from "../TestSession.js";

export interface PieBackendActivityItemRef {
	identifier?: string;
	item?: {
		id?: string;
		identifier?: string;
	};
}

export interface PieBackendActivityDefinition {
	id?: string;
	identifier?: string;
	assessmentId?: string;
	assessmentItemRefs?: PieBackendActivityItemRef[];
}

export interface PieBackendActivitySession {
	id?: string;
	activitySessionId?: string;
	startedAt?: string;
	updatedAt?: string;
	completedAt?: string;
	currentItemIndex?: number;
	currentSectionIdentifier?: string;
	visitedItemIdentifiers?: string[];
	itemSessions?: Record<string, unknown>;
}

export interface MapActivityToTestAttemptSessionArgs {
	activityDefinition?: PieBackendActivityDefinition | null;
	activitySession?: PieBackendActivitySession | null;
	itemRefs?: PieBackendActivityItemRef[];
	itemSessionsByItemIdentifier?: Record<string, unknown>;
	assessmentId?: string;
	testAttemptSessionIdentifier?: string;
}

export interface ActivitySessionPatchPayload {
	activitySession: {
		id: string;
		startedAt?: string;
		updatedAt?: string;
		completedAt?: string;
		currentItemIndex: number;
		currentSectionIdentifier?: string;
		visitedItemIdentifiers: string[];
		itemSessions: Record<string, unknown>;
	};
}

function nowIso(): string {
	return new Date().toISOString();
}

function getItemIdentifier(itemRef: PieBackendActivityItemRef): string | null {
	return (
		itemRef.identifier ||
		itemRef.item?.identifier ||
		itemRef.item?.id ||
		null
	);
}

function resolveItemIdentifiers(args: MapActivityToTestAttemptSessionArgs): string[] {
	const refs = args.itemRefs || args.activityDefinition?.assessmentItemRefs || [];
	const identifiers = refs
		.map((itemRef) => getItemIdentifier(itemRef))
		.filter((itemIdentifier): itemIdentifier is string => !!itemIdentifier);
	return Array.from(new Set(identifiers));
}

function resolveAssessmentId(args: MapActivityToTestAttemptSessionArgs): string {
	return (
		args.assessmentId ||
		args.activityDefinition?.assessmentId ||
		args.activityDefinition?.identifier ||
		args.activityDefinition?.id ||
		"unknown-assessment"
	);
}

function resolveTestAttemptSessionIdentifier(
	args: MapActivityToTestAttemptSessionArgs,
	assessmentId: string,
): string {
	return (
		args.testAttemptSessionIdentifier ||
		args.activitySession?.activitySessionId ||
		args.activitySession?.id ||
		`tas_${assessmentId}`
	);
}

function resolveBackendItemSessions(
	args: MapActivityToTestAttemptSessionArgs,
): Record<string, unknown> {
	return {
		...(args.activitySession?.itemSessions || {}),
		...(args.itemSessionsByItemIdentifier || {}),
	};
}

function mapItemSessions(
	itemIdentifiers: string[],
	backendItemSessions: Record<string, unknown>,
): Record<string, TestAttemptItemSession> {
	return itemIdentifiers.reduce<Record<string, TestAttemptItemSession>>(
		(acc, itemIdentifier) => {
			const rawSession = backendItemSessions[itemIdentifier] as
				| Record<string, unknown>
				| undefined;
			if (!rawSession) return acc;

			const pieSessionId =
				typeof rawSession.id === "string" ? rawSession.id : undefined;
			const attemptCount =
				typeof rawSession.attemptCount === "number" && rawSession.attemptCount > 0
					? rawSession.attemptCount
					: pieSessionId
						? 1
						: 0;
			const isCompleted =
				typeof rawSession.isCompleted === "boolean"
					? rawSession.isCompleted
					: Boolean(rawSession.complete);
			const startedAt =
				typeof rawSession.startedAt === "string" ? rawSession.startedAt : undefined;
			const updatedAt =
				typeof rawSession.updatedAt === "string" ? rawSession.updatedAt : undefined;
			const completedAt =
				typeof rawSession.completedAt === "string"
					? rawSession.completedAt
					: undefined;

			acc[itemIdentifier] = {
				itemIdentifier,
				pieSessionId,
				attemptCount,
				isCompleted,
				startedAt,
				updatedAt,
				completedAt,
				session: rawSession,
			};
			return acc;
		},
		{},
	);
}

export function mapActivityToTestAttemptSession(
	args: MapActivityToTestAttemptSessionArgs,
): TestAttemptSession {
	const assessmentId = resolveAssessmentId(args);
	const itemIdentifiers = resolveItemIdentifiers(args);
	const testAttemptSessionIdentifier = resolveTestAttemptSessionIdentifier(
		args,
		assessmentId,
	);
	const backendItemSessions = resolveBackendItemSessions(args);
	const now = nowIso();
	const startedAt = args.activitySession?.startedAt || now;
	const updatedAt = args.activitySession?.updatedAt || startedAt;

	return {
		version: 1,
		testAttemptSessionIdentifier,
		assessmentId,
		startedAt,
		updatedAt,
		completedAt: args.activitySession?.completedAt,
		navigationState: {
			currentItemIndex: args.activitySession?.currentItemIndex ?? -1,
			visitedItemIdentifiers: [
				...(args.activitySession?.visitedItemIdentifiers || []),
			],
			currentSectionIdentifier: args.activitySession?.currentSectionIdentifier,
		},
		realization: {
			seed: testAttemptSessionIdentifier,
			itemIdentifiers,
		},
		itemSessions: mapItemSessions(itemIdentifiers, backendItemSessions),
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

export function buildActivitySessionPatchFromTestAttemptSession(
	testAttemptSession: TestAttemptSession,
): ActivitySessionPatchPayload {
	return {
		activitySession: {
			id: testAttemptSession.testAttemptSessionIdentifier,
			startedAt: testAttemptSession.startedAt,
			updatedAt: testAttemptSession.updatedAt,
			completedAt: testAttemptSession.completedAt,
			currentItemIndex: testAttemptSession.navigationState.currentItemIndex,
			currentSectionIdentifier:
				testAttemptSession.navigationState.currentSectionIdentifier,
			visitedItemIdentifiers: [
				...testAttemptSession.navigationState.visitedItemIdentifiers,
			],
			itemSessions: toItemSessionsRecord(testAttemptSession),
		},
	};
}

export function buildActivitySessionItemUpdate(
	testAttemptSession: TestAttemptSession,
	itemIdentifier: string,
): ActivitySessionPatchPayload {
	const itemSession = testAttemptSession.itemSessions[itemIdentifier];
	return {
		activitySession: {
			id: testAttemptSession.testAttemptSessionIdentifier,
			currentItemIndex: testAttemptSession.navigationState.currentItemIndex,
			currentSectionIdentifier:
				testAttemptSession.navigationState.currentSectionIdentifier,
			visitedItemIdentifiers: [
				...testAttemptSession.navigationState.visitedItemIdentifiers,
			],
			itemSessions: itemSession?.session ? { [itemIdentifier]: itemSession.session } : {},
		},
	};
}
