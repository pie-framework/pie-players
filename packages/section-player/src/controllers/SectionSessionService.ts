import {
	createNewTestAttemptSession,
	toItemSessionsRecord,
	upsertItemSessionFromPieSessionChange,
	type TestAttemptSession,
} from "@pie-players/pie-assessment-toolkit";
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

	private normalizeToItemSession(
		itemId: string,
		rawSession: any,
		previousItemSession: any,
		componentId?: string,
	): { id: string; data: any[] } | null {
		if (!rawSession || typeof rawSession !== "object") return null;

		// Canonical PIE item session shape: { id, data: [...] }
		if (Array.isArray(rawSession.data)) {
			return {
				id: String(rawSession.id || previousItemSession?.id || itemId),
				data: rawSession.data,
			};
		}

		// Element-level entry shape: { id: "<elementId>", ... }
		if (typeof rawSession.id === "string" && rawSession.id) {
			const base =
				previousItemSession &&
				typeof previousItemSession === "object" &&
				Array.isArray(previousItemSession.data)
					? {
							id: String(previousItemSession.id || itemId),
							data: [...previousItemSession.data],
						}
					: { id: itemId, data: [] as any[] };
			const idx = base.data.findIndex((entry: any) => entry?.id === rawSession.id);
			if (idx >= 0) {
				base.data[idx] = { ...base.data[idx], ...rawSession };
			} else {
				base.data.push(rawSession);
			}
			return base;
		}

		// Generic object payload shape from session-changed events (no id/data keys).
		// Coerce into an element-level entry so canonical attempt state still updates.
		const inferredEntryId =
			(typeof componentId === "string" && componentId) ||
			(typeof rawSession.component === "string" && rawSession.component) ||
			"response";
		const base =
			previousItemSession &&
			typeof previousItemSession === "object" &&
			Array.isArray(previousItemSession.data)
				? {
						id: String(previousItemSession.id || itemId),
						data: [...previousItemSession.data],
					}
				: { id: itemId, data: [] as any[] };
		const entry = { id: inferredEntryId, ...rawSession };
		const idx = base.data.findIndex((existing: any) => existing?.id === inferredEntryId);
		if (idx >= 0) {
			base.data[idx] = { ...base.data[idx], ...entry };
		} else {
			base.data.push(entry);
		}
		return base;
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
		const actualSession = args.sessionDetail?.session || args.sessionDetail;
		const safeItemId =
			typeof args.itemId === "string" && args.itemId
				? args.itemId
				: typeof actualSession?.id === "string"
					? String(actualSession.id)
					: "";
		const normalizedSession = this.normalizeToItemSession(
			safeItemId,
			actualSession,
			args.itemSessions[safeItemId],
			args.sessionDetail?.component,
		);
		const beforeItemSession = args.itemSessions[safeItemId];
		const beforeDataLength = Array.isArray(beforeItemSession?.data)
			? beforeItemSession.data.length
			: null;
		let nextTestAttemptSession = args.testAttemptSession;

		if (normalizedSession && safeItemId) {
			nextTestAttemptSession = upsertItemSessionFromPieSessionChange(
				args.testAttemptSession,
				{
					itemIdentifier: safeItemId,
					pieSessionId: String(normalizedSession.id || safeItemId),
					isCompleted: Boolean(args.sessionDetail?.complete),
					session: normalizedSession,
				},
			);
		}

		const nextItemSessions = toItemSessionsRecord(
			nextTestAttemptSession,
		) as Record<string, any>;
		const afterItemSession = nextItemSessions[safeItemId];
		const afterDataLength = Array.isArray(afterItemSession?.data)
			? afterItemSession.data.length
			: null;
		const logData = {
			safeItemId,
			hasActualSession: !!actualSession,
			normalized: !!normalizedSession,
			beforeDataLength,
			afterDataLength,
			attemptReferenceChanged: nextTestAttemptSession !== args.testAttemptSession,
			itemSessionReferenceChanged: afterItemSession !== beforeItemSession,
		};
		console.debug(
			"[SectionSessionService][SessionTrace] applyItemSessionChanged",
			logData,
		);

		const fallbackSession =
			nextItemSessions[safeItemId] ||
			normalizedSession ||
			(actualSession && typeof actualSession === "object"
				? actualSession
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
				complete: args.sessionDetail?.complete,
				component: args.sessionDetail?.component,
				timestamp: Date.now(),
			},
		};
	}
}
