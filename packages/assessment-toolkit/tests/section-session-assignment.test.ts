import { describe, expect, test } from "bun:test";
import type { SectionControllerSessionState } from "@pie-players/pie-players-shared/types";
import { resolveSectionSessionAssignment } from "../src/services/section-session-assignment.js";

const answeredEntry = {
	itemIdentifier: "item-1",
	isCompleted: false,
	session: { id: "s-1", data: [{ id: "r1", value: ["a"] }] },
};

const current: SectionControllerSessionState = {
	currentItemIndex: 0,
	itemSessions: { "item-1": answeredEntry },
};

describe("resolveSectionSessionAssignment", () => {
	test("a controller without a session takes the value as assigned", () => {
		const next: SectionControllerSessionState = { itemSessions: {} };
		expect(resolveSectionSessionAssignment(null, next)).toBe(next);
	});

	test("an echo of the current session is a no-op", () => {
		expect(
			resolveSectionSessionAssignment(current, structuredClone(current)),
		).toBeNull();
	});

	test("a raw item session matching the canonical entry is a no-op", () => {
		expect(
			resolveSectionSessionAssignment(current, {
				itemSessions: { "item-1": answeredEntry.session },
			}),
		).toBeNull();
	});

	test("a different response applies", () => {
		const next: SectionControllerSessionState = {
			currentItemIndex: 0,
			itemSessions: {
				"item-1": { id: "s-1", data: [{ id: "r1", value: ["b"] }] },
			},
		};
		expect(resolveSectionSessionAssignment(current, next)).toEqual(next);
	});

	test("a response-free item session keeps the one holding responses", () => {
		const resolved = resolveSectionSessionAssignment(current, {
			currentItemIndex: 1,
			itemSessions: { "item-1": { id: "s-1", data: [{ id: "r1" }] } },
		});
		expect(resolved).toEqual({
			currentItemIndex: 1,
			itemSessions: { "item-1": answeredEntry },
		});
	});

	test("a response field without a value clears the response", () => {
		const cleared = { id: "s-1", data: [{ id: "r1", value: [] }] };
		expect(
			resolveSectionSessionAssignment(current, {
				itemSessions: { "item-1": cleared },
			}),
		).toEqual({ itemSessions: { "item-1": cleared } });
	});

	test("an item session left out keeps the one holding responses", () => {
		expect(
			resolveSectionSessionAssignment(current, { itemSessions: {} }),
		).toBeNull();
	});
});
