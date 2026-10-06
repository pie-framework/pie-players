import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { observePieElements } from "../src/pie/element-observer.js";
import { initializePieElement } from "../src/pie/initialize-element.js";
import { findPieController, scorePieItem } from "../src/pie/scoring.js";
import { BundleType, Status } from "../src/pie/types.js";
import { updatePieElement } from "../src/pie/updates.js";
import type { ConfigEntity, Env } from "../src/types/index.js";

/**
 * A hosted player delivers as `player.js`: models and scores come from the
 * server. The registry is shared with every loader on the page, so a hosted
 * player must resolve no controller even where one is registered.
 */

const TAG = "pie-gated--version-1-0-0";
const ENV: Env = { mode: "gather", role: "student", partialScoring: false };
const config: ConfigEntity = {
	markup: `<${TAG} id="q1"></${TAG}>`,
	elements: { [TAG]: "@pie-element/gated@1.0.0" },
	models: [{ id: "q1", element: TAG, prompt: "server model" }],
};

let calls: string[] = [];

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
	calls = [];
	// What a non-hosted ESM load leaves behind: an entry with a controller.
	(window as any).PIE_REGISTRY = {
		[TAG]: {
			package: "@pie-element/gated@1.0.0",
			status: Status.loaded,
			tagName: TAG,
			bundleType: "esm",
			controller: {
				model: async (model: any) => {
					calls.push("model");
					return { ...model, prompt: "client model" };
				},
				outcome: async () => {
					calls.push("outcome");
					return { score: 1 };
				},
			},
		},
	};
});

const renderElement = (): HTMLElement & { model?: any } => {
	const element = document.createElement(TAG) as HTMLElement & { model?: any };
	element.id = "q1";
	document.body.append(element);
	return element;
};

describe("hosted controller gate", () => {
	test("findPieController resolves no controller for a player.js delivery", () => {
		expect(findPieController(TAG, BundleType.player)).toBeUndefined();
		expect(findPieController(TAG, BundleType.clientPlayer)).toBeDefined();
		expect(findPieController(TAG)).toBeDefined();
	});

	test("updatePieElement assigns the server model when delivered as player.js", async () => {
		const hosted = renderElement();
		await updatePieElement(TAG, {
			config,
			session: [],
			env: ENV,
			bundleType: BundleType.player,
		});
		expect(hosted.model?.prompt).toBe("server model");
		expect(calls).toEqual([]);

		await updatePieElement(TAG, {
			config,
			session: [],
			env: ENV,
			bundleType: BundleType.clientPlayer,
		});
		expect(hosted.model?.prompt).toBe("client model");
		expect(calls).toEqual(["model"]);
	});

	test("initializePieElement binds the server model when delivered as player.js", () => {
		const hosted = renderElement();
		initializePieElement(hosted as any, {
			config,
			session: [],
			env: ENV,
			bundleType: BundleType.player,
		});
		expect(hosted.model?.prompt).toBe("server model");

		const client = renderElement();
		initializePieElement(client as any, {
			config,
			session: [],
			env: ENV,
			bundleType: BundleType.clientPlayer,
		});
		// A client-player binding leaves the model to the controller pass.
		expect(client.model).toBeUndefined();
	});

	test("the late-arrival observer honours the context's bundle type", async () => {
		const release = observePieElements(document.body, () => ({
			config,
			session: [],
			env: ENV,
			bundleType: BundleType.player,
		}));
		try {
			const element = renderElement();
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(element.model?.prompt).toBe("server model");
		} finally {
			release();
		}
	});

	test("scorePieItem scores nothing locally when delivered as player.js", async () => {
		renderElement();
		const session = [{ id: "q1", element: TAG, value: "a" }];

		const hosted = await scorePieItem(config, session, {
			bundleType: BundleType.player,
			includeMissingResults: true,
		});
		expect(hosted.results).toEqual([undefined]);
		expect(calls).toEqual([]);

		const client = await scorePieItem(config, session, {
			bundleType: BundleType.clientPlayer,
		});
		expect(client.results).toHaveLength(1);
		expect(calls).toEqual(["outcome"]);
	});
});
