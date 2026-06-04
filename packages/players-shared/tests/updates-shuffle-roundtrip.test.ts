import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { ItemController } from "../src/pie/item-controller.js";
import { updatePieElement } from "../src/pie/updates.js";
import { BundleType, Status } from "../src/pie/types.js";
import type { ConfigEntity, PieController } from "../src/types/index.js";

const TAG = "pie-ebsr--version-1-0-0";

const config: ConfigEntity = {
	markup: `<${TAG} id="q1"></${TAG}>`,
	elements: {
		[TAG]: "@pie-element/ebsr@1.0.0",
	},
	models: [{ id: "q1", element: TAG, lockChoiceOrder: false }],
};

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

beforeEach(() => {
	document.body.innerHTML = "";
	(window as unknown as { PIE_REGISTRY?: unknown }).PIE_REGISTRY = {};
});

/**
 * Stand-in for the EBSR controller: when no shuffle order is present on the
 * session it produces one (deterministically here, where the real element uses
 * Math.random) and persists it via updateSession; when an order is already
 * present it reuses it and does NOT call updateSession. This mirrors the
 * lockChoiceOrder:false code path that triggers PIE-631.
 */
function registerShufflingController(counters: {
	shuffles: number;
	reuses: number;
}) {
	const controller: Partial<PieController> = {
		model: (async (
			_question: any,
			session: any,
			_env: any,
			updateSession: any,
		) => {
			const existing = session?.shuffledValues;
			if (!existing) {
				counters.shuffles += 1;
				const shuffledValues = { partA: ["b", "a"], partB: ["d", "c"] };
				await updateSession(session.id, session.element, { shuffledValues });
			} else {
				counters.reuses += 1;
			}
			return { mode: "gather", partA: {}, partB: {} };
		}) as any,
	};
	(window as any).PIE_REGISTRY[TAG] = {
		package: "@pie-element/ebsr@1.0.0",
		status: Status.loaded,
		tagName: TAG,
		controller,
		bundleType: BundleType.clientPlayer,
	};
}

describe("updatePieElement shuffle round-trip (PIE-631)", () => {
	test("persisted shuffle order survives re-render and is reused without re-emitting", async () => {
		const counters = { shuffles: 0, reuses: 0 };
		registerShufflingController(counters);

		const controller = new ItemController({
			itemId: "item-1",
			initialSession: { id: "", data: [{ id: "q1", element: TAG }] },
		});

		const player = document.createElement("section");
		player.innerHTML = `<${TAG} id="q1"></${TAG}>`;
		document.body.append(player);

		const updates: Array<{ id: string; element: string; properties: any }> = [];
		const onElementSessionUpdate = (
			id: string,
			element: string,
			properties: any,
		) => {
			updates.push({ id, element, properties });
			controller.mergeElementSession(id, properties);
		};

		// Pass 1 — fresh session, controller must shuffle and persist.
		await updatePieElement(TAG, {
			config,
			session: controller.getSession().data,
			env: { mode: "gather", role: "student", partialScoring: false },
			container: player,
			onElementSessionUpdate,
		});

		expect(counters.shuffles).toBe(1);
		expect(counters.reuses).toBe(0);
		expect(updates).toHaveLength(1);
		expect(controller.getSession().data).toEqual([
			{
				id: "q1",
				element: TAG,
				shuffledValues: { partA: ["b", "a"], partB: ["d", "c"] },
			},
		]);

		// Pass 2 — re-derive the session from the authoritative controller (as a
		// real re-render would) and run again. The order must be reused; no new
		// shuffle, no new updateSession → nothing that would re-emit session-changed.
		await updatePieElement(TAG, {
			config,
			session: controller.getSession().data,
			env: { mode: "gather", role: "student", partialScoring: false },
			container: player,
			onElementSessionUpdate,
		});

		expect(counters.shuffles).toBe(1);
		expect(counters.reuses).toBe(1);
		expect(updates).toHaveLength(1);
	});
});
