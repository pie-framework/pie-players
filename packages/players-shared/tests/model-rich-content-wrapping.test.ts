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
import { updatePieElementWithRef } from "../src/pie/updates.js";
import { BundleType, Status } from "../src/pie/types.js";
import type { ConfigEntity } from "../src/types/index.js";

const TAG = "pie-multiple-choice--version-1-0-0";
const INIT_TAG = "pie-rich-content-init-test";
const INIT_PACKAGE = "@pie-element/rich-content-init-test@1.0.0";

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
	(window as any).pie = undefined;
	(window as unknown as { PIE_REGISTRY?: unknown }).PIE_REGISTRY = {
		[TAG]: {
			package: "@pie-element/multiple-choice@1.0.0",
			status: Status.loaded,
			tagName: TAG,
			bundleType: BundleType.player,
		},
	};
});

describe("PIE model rich content wrapping", () => {
	test("wraps model HTML fields before assigning them to the rendered PIE element", async () => {
		const catalogTextWithMarkup =
			'<img src="/tts-catalog.png" alt="catalog only"><table><tr><td>tts</td></tr></table>';
		const config: ConfigEntity = {
			markup: `<${TAG} id="q1"></${TAG}>`,
			elements: {
				[TAG]: "@pie-element/multiple-choice@1.0.0",
			},
			models: [
				{
					id: "q1",
					element: TAG,
					prompt:
						'Use this diagram: <img src="/prompt.png" alt="prompt diagram" width="1800" height="900">',
					choices: [
						{
							value: "a",
							label:
								'Choice A <img src="/choice.png" alt="choice diagram" width="1600">',
						},
					],
					partA: {
						prompt:
							"<table><caption>Part A values</caption><tr><td>A</td></tr></table>",
					},
					accessibilityCatalogs: [
						{
							identifier: "tts",
							entries: [{ text: catalogTextWithMarkup }],
						},
					],
				},
			],
		};
		const element = document.createElement(TAG) as HTMLElement & {
			model?: Record<string, any>;
		};
		element.id = "q1";

		await updatePieElementWithRef(element, {
			config,
			session: [],
			env: { mode: "gather", role: "student", partialScoring: false },
		});

		expect(element.model?.prompt).toContain('class="pie-image-scroll"');
		expect(element.model?.prompt).toContain(
			'aria-label="Scrollable image: prompt diagram"',
		);
		expect(element.model?.choices?.[0]?.label).toContain(
			'class="pie-image-scroll"',
		);
		expect(element.model?.partA?.prompt).toContain('class="pie-table-scroll"');
		expect(element.model?.partA?.prompt).toContain(
			'aria-label="Scrollable table: Part A values"',
		);
		expect(element.model?.accessibilityCatalogs?.[0]?.entries?.[0]?.text).toBe(
			catalogTextWithMarkup,
		);

		expect(config.models[0].prompt).not.toContain("pie-image-scroll");
		expect(config.models[0].choices?.[0]?.label).not.toContain(
			"pie-image-scroll",
		);
	});

	test("wraps model HTML when initializing a newly registered player.js element", async () => {
		const config: ConfigEntity = {
			markup: `<${INIT_TAG} id="q-init"></${INIT_TAG}>`,
			elements: {
				[INIT_TAG]: INIT_PACKAGE,
			},
			models: [
				{
					id: "q-init",
					element: INIT_TAG,
					prompt:
						'Initialization path <img src="/init.png" alt="init diagram" width="1800">',
				},
			],
		};
		const element = document.createElement(INIT_TAG) as HTMLElement & {
			model?: Record<string, any>;
		};
		element.id = "q-init";
		document.body.append(element);
		(window as any).pie = {
			default: {
				"@pie-element/rich-content-init-test": {
					Element: class extends HTMLElement {},
				},
			},
		};

		initializePiesFromLoadedBundle(config, [], {
			env: { mode: "gather", role: "student", partialScoring: false },
			bundleType: BundleType.player,
		});
		await customElements.whenDefined(INIT_TAG);
		await Promise.resolve();
		const initializedElement = document.querySelector(
			INIT_TAG,
		) as HTMLElement & {
			model?: Record<string, any>;
		};

		expect(initializedElement.model?.prompt).toContain(
			'class="pie-image-scroll"',
		);
		expect(initializedElement.model?.prompt).toContain(
			'aria-label="Scrollable image: init diagram"',
		);
		expect(config.models[0].prompt).not.toContain("pie-image-scroll");
	});
});
