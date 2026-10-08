import { describe, expect, spyOn, test } from "bun:test";

import { ElementToolStateStore } from "../src/services/ElementToolStateStore.js";

describe("ElementToolStateStore", () => {
	test("ids containing ':' round-trip and do not collide", () => {
		const store = new ElementToolStateStore();
		const parts = {
			assessmentId: "urn:a:1",
			sectionId: "s%3A1",
			itemId: "item",
			elementId: "mc:1",
		};
		const id = store.getGlobalElementId(
			parts.assessmentId,
			parts.sectionId,
			parts.itemId,
			parts.elementId,
		);
		expect(store.parseGlobalElementId(id)).toEqual(parts);
		expect(store.getGlobalElementId("a:b", "c", "d", "e")).not.toBe(
			store.getGlobalElementId("a", "b:c", "d", "e"),
		);
	});

	test("clearSection clears only the named section when ids contain ':'", () => {
		const store = new ElementToolStateStore();
		const cleared = store.getGlobalElementId("a", "s", "i", "e");
		const kept = store.getGlobalElementId("a", "s:1", "i", "e");
		store.setState(cleared, "answerEliminator", { x: 1 });
		store.setState(kept, "answerEliminator", { x: 2 });
		store.clearSection("a", "s");
		expect(Object.keys(store.getAllState())).toEqual([kept]);
		store.clearSection("a", "s:1");
		expect(store.getAllState()).toEqual({});
	});

	test("a throwing listener does not stop later listeners", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const store = new ElementToolStateStore();
			const seen: string[] = [];
			store.subscribe(() => {
				throw new Error("boom");
			});
			store.subscribe(() => seen.push("second"));
			store.setOnStateChange(() => {
				throw new Error("persist failed");
			});
			store.setState("a:s:i:e", "flag", true);
			expect(seen).toEqual(["second"]);
			expect(store.getState("a:s:i:e", "flag")).toBe(true);
			expect(warn).toHaveBeenCalledTimes(2);
		} finally {
			warn.mockRestore();
		}
	});
});
