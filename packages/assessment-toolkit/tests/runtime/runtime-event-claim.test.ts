import { describe, expect, test } from "bun:test";
import { isRuntimeEventClaimed } from "../../src/runtime/runtime-event-claim.js";

const shellEvent = (detail: unknown) =>
	new CustomEvent("pie-register", { detail, bubbles: true });

describe("isRuntimeEventClaimed", () => {
	test("claims an event addressed to its runtime without resolving the target", () => {
		const targets: Array<EventTarget | null> = [];
		const local = (target: EventTarget | null) => {
			targets.push(target);
			return false;
		};
		expect(
			isRuntimeEventClaimed(
				shellEvent({ runtimeId: "toolkit-a" }),
				"toolkit-a",
				local,
			),
		).toBe(true);
		expect(targets).toEqual([]);
	});

	test("leaves an event addressed to another runtime even when the target resolves here", () => {
		expect(
			isRuntimeEventClaimed(
				shellEvent({ runtimeId: "toolkit-b" }),
				"toolkit-a",
				() => true,
			),
		).toBe(false);
	});

	test("resolves the target for an event that names no runtime", () => {
		for (const detail of [{ itemId: "q1" }, { runtimeId: "" }, null]) {
			expect(
				isRuntimeEventClaimed(shellEvent(detail), "toolkit-a", () => true),
			).toBe(true);
			expect(
				isRuntimeEventClaimed(shellEvent(detail), "toolkit-a", () => false),
			).toBe(false);
		}
	});
});
