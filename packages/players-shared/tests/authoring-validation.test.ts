import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { validateAuthoringModels } from "../src/pie/authoring.js";
import { BundleType, Status } from "../src/pie/types.js";
import type { ConfigEntity, PieController } from "../src/types/index.js";

const TAG = "pie-mc--version-1-0-0";
const CONFIGURE_TAG = `${TAG}-config`;
const PACKAGE_SPEC = "@pie-element/multiple-choice@1.0.0";

const model = {
	id: "q1",
	element: TAG,
	prompt: "<p>Pick one</p>",
	choices: [
		{ value: "a", label: "" },
		{ value: "b", label: "B" },
	],
};

// multiple-choice's `validate` shape: a field → message map.
const mcErrors = {
	prompt: "This field is required.",
	choices: { a: "Content should not be empty." },
	correctResponse: "No correct response defined.",
};

const config: ConfigEntity = {
	markup: `<${TAG} id="q1"></${TAG}>`,
	elements: { [TAG]: PACKAGE_SPEC },
	models: [model],
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

function registerController(controller: Partial<PieController>) {
	(window as any).PIE_REGISTRY[CONFIGURE_TAG] = {
		package: PACKAGE_SPEC,
		status: Status.loaded,
		tagName: CONFIGURE_TAG,
		controller,
		bundleType: BundleType.editor,
	};
}

function renderConfigureElement(): HTMLElement & { model?: any } {
	const element = document.createElement(CONFIGURE_TAG) as HTMLElement & {
		model?: any;
	};
	element.id = model.id;
	element.model = model;
	document.body.append(element);
	return element;
}

describe("validateAuthoringModels", () => {
	test("attaches a field → message map as errors without overwriting model fields", async () => {
		registerController({ validate: () => mcErrors });
		const element = renderConfigureElement();

		const result = await validateAuthoringModels(config);

		expect(result.hasErrors).toBe(true);
		expect(result.validatedModels).toEqual([{ ...model, errors: mcErrors }]);
		expect(element.model).toEqual({ ...model, errors: mcErrors });
	});

	test("reports no errors for an empty map", async () => {
		registerController({ validate: () => ({}) });
		renderConfigureElement();

		const result = await validateAuthoringModels(config);

		expect(result.hasErrors).toBe(false);
		expect(result.validatedModels).toEqual([{ ...model, errors: {} }]);
	});

	test("checks each ebsr part", async () => {
		let errors: Record<string, unknown> = { partA: {}, partB: {} };
		registerController({ validate: () => errors });
		renderConfigureElement();

		expect((await validateAuthoringModels(config)).hasErrors).toBe(false);

		errors = { partA: {}, partB: { prompt: "This field is required." } };
		expect((await validateAuthoringModels(config)).hasErrors).toBe(true);
	});

	test("passes the resolved authoring configuration to validate", async () => {
		const received: unknown[] = [];
		registerController({
			validate: (_model, configuration) => {
				received.push(configuration);
				return {};
			},
		});
		renderConfigureElement();

		await validateAuthoringModels(config, {
			[PACKAGE_SPEC]: { deliveryShared: "delivery" },
			authoring: { [TAG]: { requirePrompt: true } },
		});

		expect(received).toEqual([
			{ deliveryShared: "delivery", requirePrompt: true },
		]);
	});

	test("leaves the configure model alone when its errors are unchanged", async () => {
		registerController({ validate: () => mcErrors });
		const element = renderConfigureElement();
		const current = { ...model, errors: { ...mcErrors } };
		element.model = current;

		await validateAuthoringModels(config);

		expect(element.model).toBe(current);
	});

	test("returns the model unchanged when the controller has no validate", async () => {
		registerController({});
		const element = renderConfigureElement();

		const result = await validateAuthoringModels(config);

		expect(result).toEqual({ hasErrors: false, validatedModels: [model] });
		expect(element.model).toBe(model);
	});
});
