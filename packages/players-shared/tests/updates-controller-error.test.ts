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
import type {
	ConfigEntity,
	PieItemPlayerErrorDetail,
} from "../src/types/index.js";

const TAG = "pie-multiple-choice--version-13-3-1";

const config: ConfigEntity = {
	markup: `<${TAG} id="q1"></${TAG}>`,
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
});

describe("a controller that throws", () => {
	test("reports a recoverable error and leaves the element on its authored model", async () => {
		(window as any).PIE_REGISTRY[TAG] = {
			package: config.elements[TAG],
			status: Status.loaded,
			tagName: TAG,
			controller: {
				model: async () => {
					throw new Error("controller exploded");
				},
			},
			bundleType: BundleType.clientPlayer,
		};
		const container = document.createElement("section");
		container.innerHTML = config.markup;
		document.body.append(container);
		const element = container.querySelector(TAG) as HTMLElement & {
			model?: unknown;
		};
		const reported: PieItemPlayerErrorDetail[] = [];
		container.addEventListener("pie-controller-error", (event) => {
			reported.push((event as CustomEvent<PieItemPlayerErrorDetail>).detail);
		});

		await updatePieElement(TAG, { config, session: [], env, container });

		expect(reported).toHaveLength(1);
		expect(reported[0]?.code).toBe("PIE_CONTROLLER_RUNTIME_ERROR");
		expect(reported[0]?.recoverable).toBe(true);
		expect(element.model).toEqual(config.models[0]);
	});
});
