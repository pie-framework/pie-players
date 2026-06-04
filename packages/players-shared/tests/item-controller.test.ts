import { describe, expect, test } from "bun:test";
import {
	ItemController,
	normalizeItemSessionContainer,
} from "../src/pie/item-controller";
import type {
	ItemSessionContainer,
	ItemSessionStorageStrategy,
} from "../src/pie/item-controller-storage";

class FakeStorage implements ItemSessionStorageStrategy {
	private value: ItemSessionContainer | null;

	constructor(value: ItemSessionContainer | null = null) {
		this.value = value;
	}

	load(_key: string): ItemSessionContainer | null {
		return this.value;
	}

	save(_key: string, session: ItemSessionContainer): void {
		this.value = session;
	}
}

describe("normalizeItemSessionContainer", () => {
	test("normalizes container input", () => {
		expect(
			normalizeItemSessionContainer({ id: "s1", data: [{ id: "i1" }] }),
		).toEqual({ id: "s1", data: [{ id: "i1" }] });
	});

	test("normalizes single entry objects and arrays", () => {
		expect(normalizeItemSessionContainer([{ id: "i1" }], "sess")).toEqual({
			id: "sess",
			data: [{ id: "i1" }],
		});
		expect(
			normalizeItemSessionContainer({ id: "i1", value: "A" }, "sess"),
		).toEqual({
			id: "sess",
			data: [{ id: "i1", value: "A" }],
		});
	});
});

describe("ItemController", () => {
	test("hydrates and persists using storage strategy", async () => {
		const storage = new FakeStorage({
			id: "stored",
			data: [{ id: "q1", value: "B" }],
		});
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "initial", data: [] },
			storage,
		});

		const hydrated = await controller.hydrate();
		expect(hydrated).toEqual({
			id: "stored",
			data: [{ id: "q1", value: "B" }],
		});

		controller.setSession({ id: "new", data: [{ id: "q1", value: "C" }] });
		expect(storage.load("ignored")).toEqual({
			id: "new",
			data: [{ id: "q1", value: "C" }],
		});
	});

	test("does not overwrite responseful session with metadata-only update", () => {
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "", data: [{ id: "q1", value: ["A"] }] },
			storage: new FakeStorage(),
		});

		const out = controller.setSession(
			{ id: "", data: [{ id: "q1", meta: { element: "mc" } }] },
			{ persist: false, allowMetadataOverwrite: false },
		);
		expect(out).toEqual({ id: "", data: [{ id: "q1", value: ["A"] }] });
	});

	test("allows explicit response clear updates", () => {
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "", data: [{ id: "q1", value: ["A", "B"] }] },
			storage: new FakeStorage(),
		});

		const out = controller.setSession(
			{ id: "", data: [{ id: "q1", value: [] }] },
			{ persist: false, allowMetadataOverwrite: false },
		);
		expect(out).toEqual({ id: "", data: [{ id: "q1", value: [] }] });
	});

	test("updates from event detail.session payload", () => {
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "", data: [] },
			storage: new FakeStorage(),
		});

		const out = controller.updateFromEventDetail(
			{
				complete: true,
				session: { id: "evt", data: [{ id: "q1", value: "D" }] },
			},
			{ persist: false },
		);
		expect(out).toEqual({ id: "evt", data: [{ id: "q1", value: "D" }] });
	});
});

describe("ItemController.mergeElementSession", () => {
	test("merged element-session writes survive a getSession round-trip", () => {
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "", data: [{ id: "q1", element: "ebsr" }] },
			storage: new FakeStorage(),
		});

		const shuffledValues = {
			partA: ["a", "b", "c"],
			partB: ["d", "e", "f"],
		};
		controller.mergeElementSession("q1", { shuffledValues });

		const first = controller.getSession();
		expect(first.data).toEqual([{ id: "q1", element: "ebsr", shuffledValues }]);

		// A second read still returns it (proves it lives on the authoritative
		// session, not a throwaway clone).
		const second = controller.getSession();
		expect(second.data).toEqual([
			{ id: "q1", element: "ebsr", shuffledValues },
		]);
	});

	test("appends an entry when the element id is not present", () => {
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "", data: [] },
			storage: new FakeStorage(),
		});

		controller.mergeElementSession("q2", { shuffledValues: { partA: ["x"] } });

		expect(controller.getSession().data).toEqual([
			{ id: "q2", shuffledValues: { partA: ["x"] } },
		]);
	});

	test("does not clear an existing response and is not blocked by response-protection", () => {
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "", data: [{ id: "q1", value: ["A"] }] },
			storage: new FakeStorage(),
		});

		controller.mergeElementSession("q1", {
			shuffledValues: { partA: ["b", "a"] },
		});

		expect(controller.getSession().data).toEqual([
			{ id: "q1", value: ["A"], shuffledValues: { partA: ["b", "a"] } },
		]);
	});

	test("does not persist by default", () => {
		const storage = new FakeStorage();
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "", data: [{ id: "q1", element: "ebsr" }] },
			storage,
		});

		controller.mergeElementSession("q1", { shuffledValues: { partA: ["a"] } });
		expect(storage.load("ignored")).toBeNull();
	});

	test("persists when persist: true is requested", () => {
		const storage = new FakeStorage();
		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "sess", data: [{ id: "q1", element: "ebsr" }] },
			storage,
		});

		controller.mergeElementSession(
			"q1",
			{ shuffledValues: { partA: ["a"] } },
			{ persist: true },
		);
		expect(storage.load("ignored")).toEqual({
			id: "sess",
			data: [{ id: "q1", element: "ebsr", shuffledValues: { partA: ["a"] } }],
		});
	});
});
