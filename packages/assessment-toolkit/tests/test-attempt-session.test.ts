import { describe, expect, test } from "bun:test";
import {
	createNewTestAttemptSession,
	toItemSessionsRecord,
	upsertItemSessionFromPieSessionChange,
} from "../src/index";

const newSession = () =>
	createNewTestAttemptSession({
		testAttemptSessionIdentifier: "tas-1",
		assessmentId: "activity-1",
		seed: "seed-1",
		itemIdentifiers: ["item-1"],
	});

describe("test attempt session", () => {
	test("hands the section player raw item sessions keyed by item", () => {
		const session = upsertItemSessionFromPieSessionChange(newSession(), {
			itemIdentifier: "item-1",
			pieSessionId: "pie-session-99",
			session: { id: "pie-session-99", data: [{ id: "mc1", value: "B" }] },
		});

		expect(toItemSessionsRecord(session)).toEqual({
			"item-1": { id: "pie-session-99", data: [{ id: "mc1", value: "B" }] },
		});
	});

	test("upsert increments attempt count for a new pie session id", () => {
		const original = upsertItemSessionFromPieSessionChange(newSession(), {
			itemIdentifier: "item-1",
			pieSessionId: "pie-session-1",
			session: { id: "pie-session-1", data: [{ value: "A" }] },
		});

		const updated = upsertItemSessionFromPieSessionChange(original, {
			itemIdentifier: "item-1",
			pieSessionId: "pie-session-2",
			isCompleted: true,
			session: { id: "pie-session-2", data: [{ value: "C" }] },
		});

		expect(original.itemSessions["item-1"]?.attemptCount).toBe(1);
		expect(updated.itemSessions["item-1"]?.attemptCount).toBe(2);
		expect(updated.itemSessions["item-1"]?.isCompleted).toBe(true);
		expect(updated.itemSessions["item-1"]?.pieSessionId).toBe("pie-session-2");
		expect(updated.itemSessions["item-1"]?.session).toEqual({
			id: "pie-session-2",
			data: [{ value: "C" }],
		});
	});
});
