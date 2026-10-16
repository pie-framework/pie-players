import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	DEFAULT_RENDERER_SRE_VERSION,
	initializeMathRendering,
	type MathRenderingAPI,
	setMathRenderer,
} from "../src/pie/math-rendering";

const makeRenderer = (): MathRenderingAPI => ({
	renderMath: () => {},
});

// Either shape of the module. bun updates an imported mock in place and keeps
// the export names it first had, so every mock names both.
const moduleShape = (
	exports:
		| { _dll_pie_lib__math_rendering: MathRenderingAPI }
		| { evaluateMathRenderingModule: () => MathRenderingAPI },
) => ({
	_dll_pie_lib__math_rendering: undefined,
	evaluateMathRenderingModule: undefined,
	...exports,
});

const SHARED_INSTANCE_KEY = "@pie-lib/math-rendering@2";

describe("initializeMathRendering", () => {
	const originalWindow = (globalThis as any).window;
	const originalDocument = (globalThis as any).document;

	afterEach(() => {
		mock.restore();
		(globalThis as any).window = originalWindow;
		(globalThis as any).document = originalDocument;
	});

	// Records the elements created, so a test can tell a detached element from
	// the page.
	const stubDocument = () => {
		const created: object[] = [];
		const body = {};
		(globalThis as any).document = {
			body,
			createElement: (tagName: string) => {
				const element = { tagName };
				created.push(element);
				return element;
			},
		};
		return { body, created };
	};

	test("shares one in-flight init across parallel calls", async () => {
		let importCount = 0;
		let setCount = 0;

		mock.module("@pie-lib/math-rendering-module/module/index.js", () => {
			importCount += 1;
			return moduleShape({
				_dll_pie_lib__math_rendering: makeRenderer(),
			});
		});

		const windowStub: Record<string, unknown> = {};
		Object.defineProperty(windowStub, "@pie-lib/math-rendering", {
			configurable: true,
			get() {
				return undefined;
			},
			set(_value: unknown) {
				setCount += 1;
			},
		});
		Object.defineProperty(windowStub, "_dll_pie_lib__math_rendering", {
			configurable: true,
			get() {
				return undefined;
			},
			set() {},
		});
		(globalThis as any).window = windowStub;

		await Promise.all([initializeMathRendering(), initializeMathRendering()]);

		expect(importCount).toBe(1);
		expect(setCount).toBe(1);
	});

	test("evaluates a deferred module and installs its renderer", async () => {
		const renderer = makeRenderer();
		let evaluations = 0;
		mock.module("@pie-lib/math-rendering-module/module/index.js", () =>
			moduleShape({
				evaluateMathRenderingModule: () => {
					evaluations += 1;
					return renderer;
				},
			}),
		);

		const windowStub: Record<string, unknown> = {};
		(globalThis as any).window = windowStub;

		await initializeMathRendering();

		expect(evaluations).toBe(1);
		expect(windowStub["@pie-lib/math-rendering"]).toBe(renderer);
		expect(windowStub._dll_pie_lib__math_rendering).toBe(renderer);
	});

	test("does not replace a custom renderer installed while the default import is in flight", async () => {
		const defaultRenderer = makeRenderer();
		const customRenderer = makeRenderer();
		mock.module("@pie-lib/math-rendering-module/module/index.js", () =>
			moduleShape({ _dll_pie_lib__math_rendering: defaultRenderer }),
		);

		const windowStub: Record<string, unknown> = {};
		(globalThis as any).window = windowStub;

		const defaultInitialization = initializeMathRendering();
		setMathRenderer(customRenderer);
		await defaultInitialization;

		expect(windowStub["@pie-lib/math-rendering"]).toBe(customRenderer);
		expect(windowStub._dll_pie_lib__math_rendering).toBe(customRenderer);
	});

	test("creates the shared MathJax instance from the default module", async () => {
		const { body, created } = stubDocument();
		const windowStub: Record<string, any> = {};
		const typeset: unknown[] = [];
		mock.module("@pie-lib/math-rendering-module/module/index.js", () =>
			moduleShape({
				_dll_pie_lib__math_rendering: {
					renderMath: (element: unknown) => {
						typeset.push(element);
						windowStub[SHARED_INSTANCE_KEY] ??= {};
						windowStub[SHARED_INSTANCE_KEY].instance ??= { Typeset() {} };
					},
				},
			}),
		);
		(globalThis as any).window = windowStub;

		await initializeMathRendering();

		expect(windowStub[SHARED_INSTANCE_KEY]?.instance).toBeDefined();
		expect(typeset).toEqual([created[0]]);
		expect(typeset[0]).not.toBe(body);
	});

	test("leaves a shared instance the page already holds", async () => {
		stubDocument();
		const existing = { Typeset() {} };
		const renderMath = mock(() => {});
		mock.module("@pie-lib/math-rendering-module/module/index.js", () =>
			moduleShape({
				_dll_pie_lib__math_rendering: { renderMath },
			}),
		);
		const windowStub: Record<string, any> = {
			[SHARED_INSTANCE_KEY]: { instance: existing },
		};
		(globalThis as any).window = windowStub;

		await initializeMathRendering();

		expect(renderMath).not.toHaveBeenCalled();
		expect(windowStub[SHARED_INSTANCE_KEY].instance).toBe(existing);
	});

	test("does not create the shared instance for a renderer the host installed", async () => {
		stubDocument();
		const defaultRenderMath = mock(() => {});
		const customRenderMath = mock(() => {});
		mock.module("@pie-lib/math-rendering-module/module/index.js", () =>
			moduleShape({
				_dll_pie_lib__math_rendering: { renderMath: defaultRenderMath },
			}),
		);
		const windowStub: Record<string, any> = {};
		(globalThis as any).window = windowStub;

		const defaultInitialization = initializeMathRendering();
		setMathRenderer({ renderMath: customRenderMath });
		await defaultInitialization;

		expect(defaultRenderMath).not.toHaveBeenCalled();
		expect(customRenderMath).not.toHaveBeenCalled();
		expect(windowStub[SHARED_INSTANCE_KEY]).toBeUndefined();
	});

	test("installs the renderer when the shared instance cannot be created", async () => {
		stubDocument();
		const renderer: MathRenderingAPI = {
			renderMath: () => {
				throw new Error("MathJax failed");
			},
		};
		mock.module("@pie-lib/math-rendering-module/module/index.js", () =>
			moduleShape({
				_dll_pie_lib__math_rendering: renderer,
			}),
		);
		const windowStub: Record<string, unknown> = {};
		(globalThis as any).window = windowStub;
		const warn = spyOn(console, "warn").mockImplementation(() => {});

		await initializeMathRendering();

		expect(windowStub["@pie-lib/math-rendering"]).toBe(renderer);
		expect(warn).toHaveBeenCalledTimes(1);
	});
});

describe("initializeMathRendering — speech rules", () => {
	const originalWindow = (globalThis as any).window;
	const originalDocument = (globalThis as any).document;
	const MODULE = "@pie-lib/math-rendering-module/module/index.js";
	const rulesUnder = (root: string) =>
		`${root}/speech-rule-engine@${DEFAULT_RENDERER_SRE_VERSION}/lib/mathmaps`;

	afterEach(() => {
		mock.restore();
		(globalThis as any).window = originalWindow;
		(globalThis as any).document = originalDocument;
	});

	// A page with no body, so no shared instance is created, and the given
	// `text/x-sre-config` blocks.
	const stubPage = (window: Record<string, unknown>, sreConfigBlocks: string[] = []) => {
		(globalThis as any).window = window;
		(globalThis as any).document = {
			querySelectorAll: (selector: string) =>
				selector === 'script[type="text/x-sre-config"]'
					? sreConfigBlocks.map((textContent) => ({ textContent }))
					: [],
		};
	};

	// What `SREfeature` holds while the module evaluates, which is when its SRE
	// reads it.
	const featureDuringEvaluation = (window: Record<string, unknown>) => {
		let seen: unknown;
		mock.module(MODULE, () =>
			moduleShape({
				evaluateMathRenderingModule: () => {
					seen = window.SREfeature;
					return makeRenderer();
				},
			}),
		);
		return () => seen;
	};

	test("points the rules at the asset root while the module evaluates", async () => {
		const window: Record<string, unknown> = {};
		stubPage(window);
		const seen = featureDuringEvaluation(window);

		await initializeMathRendering({ assetRoot: "https://mirror.test/esm/" });

		expect(seen()).toEqual({ json: rulesUnder("https://mirror.test/esm") });
		expect("SREfeature" in window).toBe(false);
	});

	test("prefers the page's math asset root", async () => {
		const window: Record<string, unknown> = {
			[SHARED_INSTANCE_KEY]: { opts: { assetRoot: "https://page.test/npm" } },
		};
		stubPage(window);
		const seen = featureDuringEvaluation(window);

		await initializeMathRendering({ assetRoot: "https://mirror.test/esm" });

		expect(seen()).toEqual({ json: rulesUnder("https://page.test/npm") });
	});

	test("keeps the page's other SRE features and restores them", async () => {
		const pageFeature = { locale: "es" };
		const window: Record<string, unknown> = { SREfeature: pageFeature };
		stubPage(window);
		const seen = featureDuringEvaluation(window);

		await initializeMathRendering({ assetRoot: "https://mirror.test/esm" });

		expect(seen()).toEqual({ locale: "es", json: rulesUnder("https://mirror.test/esm") });
		expect(window.SREfeature).toBe(pageFeature);
	});

	test("keeps a rules directory the page names", async () => {
		const pageFeature = { json: "https://host.test/mathmaps" };
		const window: Record<string, unknown> = { SREfeature: pageFeature };
		stubPage(window);
		const seen = featureDuringEvaluation(window);

		await initializeMathRendering({ assetRoot: "https://mirror.test/esm" });

		expect(seen()).toBe(pageFeature);
	});

	test("keeps a rules directory a text/x-sre-config block names", async () => {
		const window: Record<string, unknown> = {};
		stubPage(window, ['{"json": "https://host.test/mathmaps"}']);
		const seen = featureDuringEvaluation(window);

		await initializeMathRendering({ assetRoot: "https://mirror.test/esm" });

		expect(seen()).toBeUndefined();
	});

	test("names the speech-rule-engine version the module bundles", () => {
		const source = readFileSync(Bun.resolveSync(MODULE, import.meta.dir), "utf8");
		expect(source).toContain(`Variables.VERSION = '${DEFAULT_RENDERER_SRE_VERSION}'`);
	});
});
