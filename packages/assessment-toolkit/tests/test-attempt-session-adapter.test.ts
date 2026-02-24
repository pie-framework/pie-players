import { describe, expect, test } from "bun:test";
import {
	buildActivitySessionItemUpdate,
	buildActivitySessionPatchFromTestAttemptSession,
	mapActivityToTestAttemptSession,
	toItemSessionsRecord,
	upsertItemSessionFromPieSessionChange,
} from "../src/index";

describe("test attempt session adapter", () => {
	test("maps backend activity payload to canonical test attempt session", () => {
		const session = mapActivityToTestAttemptSession({
			activityDefinition: {
				identifier: "activity-1",
				assessmentItemRefs: [
					{ identifier: "item-1", item: { id: "item-1" } },
					{ identifier: "item-2", item: { id: "item-2" } },
				],
			},
			activitySession: {
				id: "activity-session-1",
				currentItemIndex: 1,
				visitedItemIdentifiers: ["item-1"],
				itemSessions: {
					"item-1": { id: "pie-session-1", data: [{ value: "A" }], complete: false },
				},
			},
		});

		expect(session.testAttemptSessionIdentifier).toBe("activity-session-1");
		expect(session.assessmentId).toBe("activity-1");
		expect(session.navigationState.currentItemIndex).toBe(1);
		expect(session.navigationState.visitedItemIdentifiers).toEqual(["item-1"]);
		expect(session.realization.itemIdentifiers).toEqual(["item-1", "item-2"]);
		expect(session.itemSessions["item-1"]?.pieSessionId).toBe("pie-session-1");
		expect(session.itemSessions["item-1"]?.attemptCount).toBe(1);
		expect(session.itemSessions["item-1"]?.session).toEqual({
			id: "pie-session-1",
			data: [{ value: "A" }],
			complete: false,
		});
	});

	test("keeps raw item session handoff shape for section player", () => {
		const session = mapActivityToTestAttemptSession({
			activityDefinition: {
				identifier: "activity-1",
				assessmentItemRefs: [{ identifier: "item-1", item: { id: "item-1" } }],
			},
			itemSessionsByItemIdentifier: {
				"item-1": { id: "pie-session-99", data: [{ id: "mc1", value: "B" }] },
			},
		});

		expect(toItemSessionsRecord(session)).toEqual({
			"item-1": { id: "pie-session-99", data: [{ id: "mc1", value: "B" }] },
		});
	});

	test("upsert preserves behavior and increments attempt count for new pie session id", () => {
		const original = mapActivityToTestAttemptSession({
			activityDefinition: {
				identifier: "activity-1",
				assessmentItemRefs: [{ identifier: "item-1", item: { id: "item-1" } }],
			},
			itemSessionsByItemIdentifier: {
				"item-1": { id: "pie-session-1", data: [{ value: "A" }] },
			},
		});

		const updated = upsertItemSessionFromPieSessionChange(original, {
			itemIdentifier: "item-1",
			pieSessionId: "pie-session-2",
			isCompleted: true,
			session: { id: "pie-session-2", data: [{ value: "C" }] },
		});

		expect(updated.itemSessions["item-1"]?.attemptCount).toBe(2);
		expect(updated.itemSessions["item-1"]?.isCompleted).toBe(true);
		expect(updated.itemSessions["item-1"]?.pieSessionId).toBe("pie-session-2");
		expect(updated.itemSessions["item-1"]?.session).toEqual({
			id: "pie-session-2",
			data: [{ value: "C" }],
		});
	});

	test("builds outbound backend update payloads", () => {
		const session = mapActivityToTestAttemptSession({
			activityDefinition: {
				identifier: "activity-1",
				assessmentItemRefs: [{ identifier: "item-1", item: { id: "item-1" } }],
			},
			activitySession: {
				id: "activity-session-1",
				currentItemIndex: 0,
				itemSessions: {
					"item-1": { id: "pie-session-1", data: [{ value: "A" }] },
				},
			},
		});

		expect(buildActivitySessionPatchFromTestAttemptSession(session)).toEqual({
			activitySession: {
				id: "activity-session-1",
				startedAt: session.startedAt,
				updatedAt: session.updatedAt,
				completedAt: undefined,
				currentItemIndex: 0,
				currentSectionIdentifier: undefined,
				visitedItemIdentifiers: [],
				itemSessions: {
					"item-1": { id: "pie-session-1", data: [{ value: "A" }] },
				},
			},
		});

		expect(buildActivitySessionItemUpdate(session, "item-1")).toEqual({
			activitySession: {
				id: "activity-session-1",
				currentItemIndex: 0,
				currentSectionIdentifier: undefined,
				visitedItemIdentifiers: [],
				itemSessions: {
					"item-1": { id: "pie-session-1", data: [{ value: "A" }] },
				},
			},
		});
	});
});
