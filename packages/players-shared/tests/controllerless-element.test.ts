import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { initializePiesFromLoadedBundle } from "../src/pie/initialization.js";
import { initializePieElement } from "../src/pie/initialize-element.js";
import { findPieController, scorePieItem } from "../src/pie/scoring.js";
import { BundleType, Status } from "../src/pie/types.js";
import { updatePieElement } from "../src/pie/updates.js";
import type { ConfigEntity, Env } from "../src/types/index.js";

/**
 * A package without a controller, such as a legacy `@pie-element/protractor`,
 * renders the model it is given under `client-player.js` too, as `<pie-player>`
 * passed it through.
 */

const TAG = "pie-controllerless--version-1-0-0";
const PACKAGE = "@pie-element/controllerless@1.0.0";
const ENV: Env = { mode: "gather", role: "student", partialScoring: false };
const AUTHORED = { id: "q1", element: TAG, prompt: "authored model" };
const config: ConfigEntity = {
	markup: `<${TAG} id="q1"></${TAG}>`,
	elements: { [TAG]: PACKAGE },
	models: [AUTHORED],
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
	delete (window as any).pie;
	// What a client-player.js load registers for a package without one.
	(window as any).PIE_REGISTRY = {
		[TAG]: {
			package: PACKAGE,
			status: Status.loaded,
			tagName: TAG,
			bundleType: BundleType.clientPlayer,
			controller: null,
		},
	};
});

const renderElement = (tag = TAG): HTMLElement & { model?: any } => {
	const element = document.createElement(tag) as HTMLElement & {
		model?: any;
	};
	element.id = "q1";
	document.body.append(element);
	return element;
};

describe("an element without a controller under client-player.js", () => {
	test("findPieController resolves none", () => {
		expect(findPieController(TAG, BundleType.clientPlayer)).toBeUndefined();
		expect(findPieController(TAG)).toBeUndefined();
	});

	test("updatePieElement assigns the model it is given", async () => {
		const element = renderElement();
		await updatePieElement(TAG, {
			config,
			session: [],
			env: ENV,
			bundleType: BundleType.clientPlayer,
		});
		expect(element.model).toEqual(AUTHORED);
	});

	test("initializePieElement binds the model it is given", () => {
		const element = renderElement();
		initializePieElement(element as any, {
			config,
			session: [],
			env: ENV,
			bundleType: BundleType.clientPlayer,
		});
		expect(element.model).toEqual(AUTHORED);
	});

	test("scorePieItem scores it as nothing", async () => {
		renderElement();
		const session = [{ id: "q1", element: TAG, value: "a" }];
		const scored = await scorePieItem(config, session, {
			bundleType: BundleType.clientPlayer,
			includeMissingResults: true,
		});
		expect(scored.results).toEqual([undefined]);
	});

	test("a client-player.js bundle registers it", async () => {
		const tag = "pie-controllerless-bundle--version-1-0-0";
		const bundled: ConfigEntity = {
			markup: `<${tag} id="q1"></${tag}>`,
			elements: { [tag]: "@pie-element/controllerless-bundle@1.0.0" },
			models: [{ ...AUTHORED, element: tag }],
		};
		(window as any).pie = {
			default: {
				"@pie-element/controllerless-bundle": {
					Element: class extends HTMLElement {},
				},
			},
		};
		renderElement(tag);

		initializePiesFromLoadedBundle(bundled, [], {
			env: ENV,
			bundleType: BundleType.clientPlayer,
		});
		await customElements.whenDefined(tag);
		await Promise.resolve();

		const element = document.querySelector(tag) as HTMLElement & {
			model?: any;
		};
		expect(element.model).toEqual(bundled.models[0]);
		expect((window as any).PIE_REGISTRY[tag].bundleType).toBe(
			BundleType.clientPlayer,
		);
	});
});
