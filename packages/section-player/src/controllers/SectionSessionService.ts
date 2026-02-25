import {
	mapActivityToTestAttemptSession,
	toItemSessionsRecord,
	upsertItemSessionFromPieSessionChange,
	type TestAttemptSession,
} from "@pie-players/pie-assessment-toolkit";
import type { SectionControllerInput, SessionChangedResult } from "./types.js";

export class SectionSessionService {
	private normalizeToItemSession(
		itemId: string,
		rawSession: any,
		previousItemSession: any,
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

		return null;
	}

	public resolve(input: SectionControllerInput & { adapterItemRefs: any[] }): {
		testAttemptSession: TestAttemptSession;
		itemSessions: Record<string, any>;
	} {
		const testAttemptSession =
			input.testAttemptSession ||
			mapActivityToTestAttemptSession({
				activityDefinition: input.activityDefinition,
				activitySession: input.activitySession,
				itemRefs: input.adapterItemRefs,
				itemSessionsByItemIdentifier: input.itemSessions || {},
				assessmentId: input.assessmentId,
			});

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
		);
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

		const fallbackSession =
			nextItemSessions[safeItemId] ||
			normalizedSession ||
			(actualSession && typeof actualSession === "object"
				? actualSession
				: { id: safeItemId, data: [] });

		return {
			testAttemptSession: nextTestAttemptSession,
			itemSessions: nextItemSessions,
			eventDetail: {
				itemId: safeItemId,
				session: fallbackSession,
				testAttemptSession: nextTestAttemptSession,
				complete: args.sessionDetail?.complete,
				component: args.sessionDetail?.component,
				timestamp: Date.now(),
			},
		};
	}
}
