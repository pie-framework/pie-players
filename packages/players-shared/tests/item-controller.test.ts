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
		expect(normalizeItemSessionContainer({ id: "s1", data: [{ id: "i1" }] })).toEqual(
			{ id: "s1", data: [{ id: "i1" }] },
		);
	});

	test("normalizes single entry objects and arrays", () => {
		expect(normalizeItemSessionContainer([{ id: "i1" }], "sess")).toEqual({
			id: "sess",
			data: [{ id: "i1" }],
		});
		expect(normalizeItemSessionContainer({ id: "i1", value: "A" }, "sess")).toEqual(
			{
				id: "sess",
				data: [{ id: "i1", value: "A" }],
			},
		);
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
		expect(hydrated).toEqual({ id: "stored", data: [{ id: "q1", value: "B" }] });

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
