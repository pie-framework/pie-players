import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { updatePieElement } from "../src/pie/updates.js";
import { BundleType, Status } from "../src/pie/types.js";
import type { ConfigEntity } from "../src/types/index.js";

const TAG = "pie-multiple-choice--version-13-3-1";

const config: ConfigEntity = {
	markup: `<${TAG} id="q1"></${TAG}><${TAG} id="q2"></${TAG}>`,
	elements: { [TAG]: "@pie-element/multiple-choice@13.3.1" },
	models: [{ id: "q1", element: TAG }],
};

const env = { mode: "gather", role: "student" } as const;

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
	(window as any).PIE_REGISTRY[TAG] = {
		package: config.elements[TAG],
		status: Status.loaded,
		tagName: TAG,
		controller: { model: async (model: unknown) => model },
		bundleType: BundleType.clientPlayer,
	};
});

describe("updatePieElement with a missing model", () => {
	test("updates the matched element and rejects naming the failed one", async () => {
		const container = document.createElement("section");
		container.innerHTML = config.markup;
		document.body.append(container);
		const q1 = container.querySelector("#q1");
		const q2 = container.querySelector("#q2");

		await expect(
			updatePieElement(TAG, { config, session: [], env, container }),
		).rejects.toThrow(`model not found for ${TAG}#q2`);

		expect((q1 as any).model).toEqual(config.models[0]);
		expect((q2 as any).model).toBeUndefined();
	});
});

describe("updatePieElement with no models", () => {
	test("rejects once, naming every failed element", async () => {
		const emptyConfig: ConfigEntity = { ...config, models: [] };
		const container = document.createElement("section");
		container.innerHTML = config.markup;
		document.body.append(container);

		await expect(
			updatePieElement(TAG, {
				config: emptyConfig,
				session: [],
				env,
				container,
			}),
		).rejects.toThrow(
			`2 of 2 elements failed to update: model not found for ${TAG}#q1 | model not found for ${TAG}#q2`,
		);
	});
});
