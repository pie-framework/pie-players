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

function makeSection(itemIds: string[]): AssessmentSection {
	return {
		identifier: "section-1",
		assessmentItemRefs: itemIds.map((itemId, index) => ({
			identifier: `canonical-${index + 1}`,
			item: makeItem(itemId),
		})),
		rubricBlocks: [],
	} as unknown as AssessmentSection;
}

type Saved = { currentItemIndex: number } | null;

/**
 * A strategy whose Nth write takes `delays[N]` ms, so unordered saves would
 * land in delay order. `stored` is the backing store's write order.
 */
function delayedStore(delays: number[], failAt = -1) {
	const stored: number[] = [];
	const landed: string[] = [];
	let call = 0;
	return {
		stored,
		landed,
		strategy: {
			loadSession: async () => null,
			saveSession: (_context: unknown, session: Saved) => {
				const index = call++;
				const value = session?.currentItemIndex ?? -1;
				return new Promise<void>((resolve, reject) =>
					setTimeout(() => {
						if (index === failAt) {
							reject(new Error("offline"));
							return;
						}
						stored.push(value);
						landed.push(JSON.stringify(session));
						resolve();
					}, delays[index] ?? 0),
				);
			},
		},
	};
}

async function makeController(store: ReturnType<typeof delayedStore>) {
	const controller = new SectionController();
	await controller.initialize({
		section: makeSection(["item-1", "item-2"]),
		sectionId: "section-1",
		assessmentId: "assessment-1",
		view: ["candidate"],
	});
	controller.configureSessionPersistence({
		context: { assessmentId: "assessment-1", sectionId: "section-1" },
		strategy: store.strategy,
	} as never);
	return controller;
}

describe("SectionController persistence order", () => {
	test("an older save that is slower still lands before the newer one", async () => {
		// Unserialized, the second write finishes first and the older snapshot
		// overwrites it.
		const store = delayedStore([30, 0]);
		const controller = await makeController(store);
		controller.navigateToItem(0);
		const older = controller.persist();
		controller.navigateToItem(1);
		const newer = controller.persist();
		await Promise.all([older, newer]);
		expect(store.stored).toEqual([0, 1]);
	});

	test("each save carries the session at its call, not at its turn in the queue", async () => {
		// PIE elements mutate their session object in place, and the controller
		// keeps that reference, so an answer changed while the first save waits
		// must not reach that save.
		const store = delayedStore([20, 0]);
		const controller = await makeController(store);
		const elementSession = { id: "el-1", value: ["A"] };
		controller.updateItemSession("item-1", {
			session: { id: "item-1", data: [elementSession] },
		});
		const first = controller.persist();
		elementSession.value = ["B"];
		const second = controller.persist();
		await Promise.all([first, second]);
		expect(store.landed[0]).toContain('"value":["A"]');
		expect(store.landed[1]).toContain('"value":["B"]');
	});

	test("a failed save rejects its own caller and the next save still lands", async () => {
		const store = delayedStore([10, 0], 0);
		const controller = await makeController(store);
		controller.navigateToItem(0);
		const failing = controller.persist();
		controller.navigateToItem(1);
		const next = controller.persist();
		await expect(failing).rejects.toThrow("offline");
		await next;
		expect(store.stored).toEqual([1]);
	});
});
