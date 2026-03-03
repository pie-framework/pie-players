import {
	createNewTestAttemptSession,
	toItemSessionsRecord,
	upsertItemSessionFromPieSessionChange,
	type TestAttemptSession,
} from "@pie-players/pie-assessment-toolkit";
import {
	normalizeItemSessionChange,
	type ItemSessionUpdateIntent,
} from "@pie-players/pie-players-shared";
import type { SectionControllerInput, SessionChangedResult } from "./types.js";

export class SectionSessionService {
	private createEmptyCanonicalAttempt(
		input: SectionControllerInput & { adapterItemRefs: any[] },
	): TestAttemptSession {
		const itemIdentifiers = input.adapterItemRefs
			.map((itemRef: any) => itemRef?.identifier || itemRef?.item?.id)
			.filter((id: unknown): id is string => typeof id === "string" && !!id);
		return createNewTestAttemptSession({
			testAttemptSessionIdentifier: `tas_${input.assessmentId}_${input.sectionId}`,
			assessmentId: input.assessmentId,
			seed: `${input.assessmentId}:${input.sectionId}`,
			itemIdentifiers,
		});
	}

	public toSessionState(testAttemptSession: TestAttemptSession): {
		currentItemIndex: number;
		visitedItemIdentifiers: string[];
		itemSessions: Record<string, unknown>;
	} {
		const currentItemIndex = testAttemptSession.navigationState?.currentItemIndex ?? 0;
		return {
			currentItemIndex: currentItemIndex >= 0 ? currentItemIndex : 0,
			visitedItemIdentifiers:
				testAttemptSession.navigationState?.visitedItemIdentifiers || [],
			itemSessions: (testAttemptSession.itemSessions || {}) as Record<string, unknown>,
		};
	}

	public resolve(input: SectionControllerInput & { adapterItemRefs: any[] }): {
		testAttemptSession: TestAttemptSession;
		itemSessions: Record<string, any>;
	} {
		const testAttemptSession = this.createEmptyCanonicalAttempt(input);

		return {
			testAttemptSession,
			itemSessions: toItemSessionsRecord(testAttemptSession) as Record<string, any>,
		};
	}

	public applyItemSessionChanged(args: {
		itemId: string;
		sessionDetail: any;
		testAttemptSession: TestAttemptSession;
		itemSessions: Record<string, any>;
	}): SessionChangedResult {
		const normalizedChange = normalizeItemSessionChange({
			itemId: args.itemId,
			sessionDetail: args.sessionDetail,
			previousItemSession: args.itemSessions[args.itemId],
		});
		const safeItemId = normalizedChange.itemId;
		const normalizedSession = normalizedChange.session;
		let nextTestAttemptSession = args.testAttemptSession;

		if (normalizedSession && safeItemId) {
			nextTestAttemptSession = upsertItemSessionFromPieSessionChange(
				args.testAttemptSession,
				{
					itemIdentifier: safeItemId,
					pieSessionId: String(normalizedSession.id || safeItemId),
					isCompleted: Boolean(normalizedChange.complete),
					session: normalizedSession,
				},
			);
		}

		const nextItemSessions = toItemSessionsRecord(
			nextTestAttemptSession,
		) as Record<string, any>;

		const fallbackSession =
			nextItemSessions[safeItemId] ||
			normalizedSession ||
			(args.sessionDetail && typeof args.sessionDetail === "object"
				? ((args.sessionDetail as Record<string, unknown>).session ??
					args.sessionDetail)
				: { id: safeItemId, data: [] });

		return {
			testAttemptSession: nextTestAttemptSession,
			itemSessions: nextItemSessions,
			sessionState: this.toSessionState(nextTestAttemptSession),
			eventDetail: {
				itemId: safeItemId,
				session: fallbackSession,
				sessionState: this.toSessionState(nextTestAttemptSession),
				itemSessions: (nextTestAttemptSession.itemSessions ||
					{}) as Record<string, unknown>,
				intent: normalizedChange.intent as ItemSessionUpdateIntent,
				complete: normalizedChange.complete,
				component: normalizedChange.component,
				timestamp: Date.now(),
			},
		};
	}
}
