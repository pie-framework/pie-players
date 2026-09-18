import { describe, expect, test } from "bun:test";
import type {
	AssessmentSection,
	ItemEntity,
} from "@pie-players/pie-players-shared";
import { SectionController } from "../src/controllers/SectionController";

function makeItem(id: string): ItemEntity {
	return {
		id,
		name: id,
		config: { elements: {}, models: [], markup: "<div></div>" },
	} as unknown as ItemEntity;
}

function makeSection(sectionId: string, itemIds: string[]): AssessmentSection {
	return {
		identifier: sectionId,
		assessmentItemRefs: itemIds.map((itemId, index) => ({
			identifier: `canonical-${index + 1}`,
			item: makeItem(itemId),
		})),
		rubricBlocks: [],
	} as unknown as AssessmentSection;
}

async function initialized(sectionId = "section-1") {
	const controller = new SectionController();
	await controller.initialize({
		section: makeSection(sectionId, ["item-1", "item-2"]),
		sectionId,
		assessmentId: "assessment-1",
		view: ["candidate"],
	});
	return controller;
}

describe("SectionController pending session commit", () => {
	test("commits while the item being left is still the current one", async () => {
		// Asserting the call count alone passes with the commit moved after
		// `navigate`, which is the ordering the hook exists to guarantee: the
		// response belongs to the item the learner is leaving.
		const controller = await initialized();
		controller.navigateToItem(0);
		const indexAtCommit: Array<number | undefined> = [];
		controller.setPendingSessionCommit(() => {
			indexAtCommit.push(controller.getViewModel().currentItemIndex);
		});

		controller.navigateToItem(1);

		expect(indexAtCommit).toEqual([0]);
		expect(controller.getViewModel().currentItemIndex).toBe(1);
	});

	test("commits before a section swap snapshots the session", async () => {
		// A response committed by the hook has to be inside the snapshot
		// `updateInput` carries across the swap. Moving the commit after
		// `getSession()` loses it, and an order-of-labels assertion would not
		// notice.
		const controller = await initialized();
		controller.setPendingSessionCommit(() => {
			controller.updateItemSession("item-1", {
				session: { id: "item-1", data: [{ id: "el-1", value: ["A"] }] },
			});
		});

		await controller.updateInput({
			section: makeSection("section-2", ["item-1"]),
			sectionId: "section-2",
			assessmentId: "assessment-1",
			view: ["candidate"],
		});

		expect(JSON.stringify(controller.getSession())).toContain('"value":["A"]');
	});

	test("commits before persisting, and the save sees the committed response", async () => {
		const controller = await initialized();
		const order: string[] = [];
		let saved: unknown = null;
		controller.setPendingSessionCommit(() => {
			order.push("commit");
			controller.updateItemSession("item-1", {
				session: { id: "item-1", data: [{ id: "el-1", value: ["A"] }] },
			});
		});
		controller.configureSessionPersistence({
			context: { assessmentId: "assessment-1", sectionId: "section-1" },
			strategy: {
				loadSession: async () => null,
				saveSession: async (_context: unknown, session: unknown) => {
					order.push("save");
					saved = session;
				},
			},
		} as never);

		await controller.persist();

		expect(order).toEqual(["commit", "save"]);
		expect(JSON.stringify(saved)).toContain('"value":["A"]');
	});

	test("a throwing commit does not break navigation", async () => {
		const controller = await initialized();
		controller.setPendingSessionCommit(() => {
			throw new Error("commit exploded");
		});

		expect(() => controller.navigateToItem(1)).not.toThrow();
	});

	test("navigation works with no commit registered", async () => {
		const controller = await initialized();

		expect(() => controller.navigateToItem(1)).not.toThrow();
	});

	test("disposal releases the commit", async () => {
		const controller = await initialized();
		let commits = 0;
		controller.setPendingSessionCommit(() => {
			commits += 1;
		});

		controller.dispose();
		controller.navigateToItem(1);

		expect(commits).toBe(0);
	});
});
