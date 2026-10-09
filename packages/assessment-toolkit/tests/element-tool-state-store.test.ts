import { describe, expect, spyOn, test } from "bun:test";

import { ElementToolStateStore } from "../src/services/ElementToolStateStore.js";

describe("ElementToolStateStore", () => {
	const key = (
		store: ElementToolStateStore,
		assessmentId: string,
		sectionId: string,
		attemptId: string,
		itemId = "i",
		elementId = "e",
	) =>
		store.getGlobalElementId({
			assessmentId,
			sectionId,
			attemptId,
			itemId,
			elementId,
		});

	test("ids containing ':' round-trip and do not collide", () => {
		const store = new ElementToolStateStore();
		const parts = {
			assessmentId: "urn:a:1",
			sectionId: "s%3A1",
			attemptId: "attempt:1",
			itemId: "item",
			elementId: "mc:1",
		};
		const id = store.getGlobalElementId(parts);
		expect(store.parseGlobalElementId(id)).toEqual(parts);
		expect(key(store, "a:b", "c", "")).not.toBe(key(store, "a", "b:c", ""));
		expect(store.parseGlobalElementId("a:s:i:e")).toBeNull();
	});

	test("two attempts at one element keep separate state", () => {
		const store = new ElementToolStateStore();
		store.setState(key(store, "a", "s", "attempt-1"), "answerEliminator", {
			eliminatedChoices: ["c1"],
		});
		expect(
			store.getState(key(store, "a", "s", "attempt-2"), "answerEliminator"),
		).toBeUndefined();
		expect(
			store.getState(key(store, "a", "s", ""), "answerEliminator"),
		).toBeUndefined();
	});

	test("clearSection clears the named section across attempts when ids contain ':'", () => {
		const store = new ElementToolStateStore();
		const cleared = [key(store, "a", "s", "t1"), key(store, "a", "s", "t2")];
		const kept = key(store, "a", "s:1", "t1");
		for (const id of cleared) store.setState(id, "answerEliminator", { x: 1 });
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

	test("subscribers get a copy, and a restore notifies them without persisting", () => {
		const store = new ElementToolStateStore();
		const snapshots: Map<string, Map<string, unknown>>[] = [];
		let persisted = 0;
		store.subscribe((state) => snapshots.push(state));
		store.setOnStateChange(() => {
			persisted += 1;
		});
		store.setState("a:s:i:e", "flag", true);
		snapshots[0]?.get("a:s:i:e")?.set("flag", false);
		snapshots[0]?.delete("a:s:i:e");
		expect(store.getState("a:s:i:e", "flag")).toBe(true);

		store.loadState({ "a:s:i:f": { flag: "restored" } });
		expect(snapshots).toHaveLength(2);
		expect(snapshots[1]?.get("a:s:i:f")?.get("flag")).toBe("restored");
		expect(persisted).toBe(1);
	});
});
