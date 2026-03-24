import { beforeEach, describe, expect, test } from "bun:test";
import { BundleType } from "../src/pie/types.js";

type MockScript = {
	src: string;
	removed: boolean;
	getAttribute: (name: string) => string | null;
	remove: () => void;
};

type MockDocument = Document & {
	_addBundleScript: (src: string) => MockScript;
	_listBundleScripts: () => MockScript[];
};

function createMockDocument(): MockDocument {
	const scripts: MockScript[] = [];
	const addBundleScript = (src: string): MockScript => {
		const script: MockScript = {
			src,
			removed: false,
			getAttribute: (name: string) => {
				if (name === "src") return script.src;
				if (name === "data-pie-bundle") return "true";
				return null;
			},
			remove: () => {
				script.removed = true;
			},
		};
		scripts.push(script);
		return script;
	};
	const listBundleScripts = () => scripts.filter((script) => !script.removed);
	return {
		head: {
			appendChild: (el: unknown) => el,
		},
		createElement: () => ({}),
		querySelector: (selector: string) => {
			const match = selector.match(/^script\[src="(.+)"\]$/);
			if (!match) return null;
			const wantedSrc = match[1];
			return listBundleScripts().find((script) => script.src === wantedSrc) || null;
		},
		querySelectorAll: (selector: string) => {
			if (selector === 'script[data-pie-bundle="true"]') {
				return listBundleScripts() as unknown as NodeListOf<Element>;
			}
			return [] as unknown as NodeListOf<Element>;
		},
		_addBundleScript: addBundleScript,
		_listBundleScripts: listBundleScripts,
	} as unknown as MockDocument;
}

function setupDomGlobals() {
	(globalThis as any).window = {
		pie: undefined,
		pieHelpers: {
			loadingScripts: {},
			loadingPromises: {},
			globalLoadQueue: Promise.resolve(),
			activeBundleUrl: null,
		},
	};
	(globalThis as any).customElements = {
		get: () => undefined,
		define: () => undefined,
		whenDefined: async () => undefined,
	};
}

function createLoader(bundleHost = "https://proxy.pie-api.com/bundles/") {
	const { IifePieLoader } = require("../src/pie/iife-loader.js");
	return new IifePieLoader({
		bundleHost,
		debugEnabled: () => false,
	});
}

describe("IifePieLoader", () => {
	beforeEach(() => {
		setupDomGlobals();
	});

	test("reloads when active bundle lacks requested package despite matching script", async () => {
		const doc = createMockDocument();
		const loader = createLoader();
		const bundleUrl =
			"https://proxy.pie-api.com/bundles/@pie-element/ebsr@1.0.0/client-player.js?elements=pie-ebsr";
		doc._addBundleScript(bundleUrl);
		(window as any).pieHelpers.activeBundleUrl = bundleUrl;
		(window as any).pie = {
			default: {
				"@pie-element/multiple-choice": {},
			},
		};

		let scriptLoadCalls = 0;
		(loader as any).loadBundleScript = async (url: string, targetDoc: MockDocument) => {
			scriptLoadCalls += 1;
			targetDoc._addBundleScript(url);
			(window as any).pie = {
				default: {
					"@pie-element/ebsr": {},
				},
			};
		};
		(loader as any).registerElementsFromBundle = async () => undefined;

		await loader.load(
			{ elements: { "pie-ebsr": "@pie-element/ebsr@1.0.0" } },
			doc,
			BundleType.clientPlayer,
			true,
		);

		expect(scriptLoadCalls).toBe(1);
		expect(doc._listBundleScripts().length).toBe(1);
		expect(doc._listBundleScripts()[0]?.src).toBe(bundleUrl);
		expect((window as any).pieHelpers.activeBundleUrl).toBe(bundleUrl);
	});

	test("recovers by reloading when active-bundle registration fails with missing window.pie", async () => {
		const doc = createMockDocument();
		const loader = createLoader();
		const bundleUrl =
			"https://proxy.pie-api.com/bundles/@pie-element/ebsr@1.0.0/client-player.js?elements=pie-ebsr";
		doc._addBundleScript(bundleUrl);
		(window as any).pieHelpers.activeBundleUrl = bundleUrl;
		(window as any).pie = {
			default: {
				"@pie-element/ebsr": {},
			},
		};

		let scriptLoadCalls = 0;
		let registerCalls = 0;
		(loader as any).loadBundleScript = async (url: string, targetDoc: MockDocument) => {
			scriptLoadCalls += 1;
			targetDoc._addBundleScript(url);
			(window as any).pie = {
				default: {
					"@pie-element/ebsr": {},
				},
			};
		};
		(loader as any).registerElementsFromBundle = async () => {
			registerCalls += 1;
			if (registerCalls === 1) {
				throw new Error("window.pie not found - simulated transient mismatch");
			}
		};

		await loader.load(
			{ elements: { "pie-ebsr": "@pie-element/ebsr@1.0.0" } },
			doc,
			BundleType.clientPlayer,
			true,
		);

		expect(scriptLoadCalls).toBe(1);
		expect(registerCalls).toBe(2);
		expect((window as any).pieHelpers.activeBundleUrl).toBe(bundleUrl);
	});

	test("retries fresh load once when registration reports package mismatch", async () => {
		const doc = createMockDocument();
		const loader = createLoader();
		let scriptLoadCalls = 0;
		let registerCalls = 0;
		(loader as any).loadBundleScript = async (url: string, targetDoc: MockDocument) => {
			scriptLoadCalls += 1;
			targetDoc._addBundleScript(url);
			(window as any).pie = {
				default: {
					"@pie-element/multiple-choice": {},
				},
			};
		};
		(loader as any).registerElementsFromBundle = async () => {
			registerCalls += 1;
			if (registerCalls === 1) {
				throw new Error(
					'Package "@pie-element/ebsr" not found in IIFE bundle. Available: @pie-element/multiple-choice',
				);
			}
		};

		await loader.load(
			{ elements: { "pie-ebsr": "@pie-element/ebsr@1.0.0" } },
			doc,
			BundleType.clientPlayer,
			true,
		);

		expect(scriptLoadCalls).toBe(2);
		expect(registerCalls).toBe(2);
	});

	test("dedupes in-flight loads for the same bundle URL", async () => {
		const doc = createMockDocument();
		const loader = createLoader();
		let scriptLoadCalls = 0;
		let releaseLoad: (() => void) | null = null;

		(loader as any).loadBundleScript = async (url: string, targetDoc: MockDocument) => {
			scriptLoadCalls += 1;
			await new Promise<void>((resolve) => {
				releaseLoad = resolve;
			});
			targetDoc._addBundleScript(url);
			(window as any).pie = {
				default: {
					"@pie-element/multiple-choice": {},
				},
			};
		};
		(loader as any).registerElementsFromBundle = async () => undefined;

		const loadOne = loader.load(
			{ elements: { "pie-multiple-choice": "@pie-element/multiple-choice@1.0.0" } },
			doc,
			BundleType.clientPlayer,
			true,
		);
		const loadTwo = loader.load(
			{ elements: { "pie-multiple-choice": "@pie-element/multiple-choice@1.0.0" } },
			doc,
			BundleType.clientPlayer,
			true,
		);

		await new Promise((resolve) => setTimeout(resolve, 0));
		releaseLoad?.();
		await Promise.all([loadOne, loadTwo]);

		expect(scriptLoadCalls).toBe(1);
		expect(Object.keys((window as any).pieHelpers.loadingPromises)).toHaveLength(0);
	});

	test("serializes concurrent loads for different bundle URLs", async () => {
		const doc = createMockDocument();
		const loader = createLoader();
		let activeLoads = 0;
		let maxActiveLoads = 0;

		(loader as any).loadBundleScript = async (url: string, targetDoc: MockDocument) => {
			activeLoads += 1;
			maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
			await new Promise((resolve) => setTimeout(resolve, 10));
			targetDoc._addBundleScript(url);
			const packageName = url.includes("ebsr")
				? "@pie-element/ebsr"
				: "@pie-element/multiple-choice";
			(window as any).pie = {
				default: {
					[packageName]: {},
				},
			};
			activeLoads -= 1;
		};
		(loader as any).registerElementsFromBundle = async () => undefined;

		await Promise.all([
			loader.load(
				{ elements: { "pie-multiple-choice": "@pie-element/multiple-choice@1.0.0" } },
				doc,
				BundleType.clientPlayer,
				true,
			),
			loader.load(
				{ elements: { "pie-ebsr": "@pie-element/ebsr@1.0.0" } },
				doc,
				BundleType.clientPlayer,
				true,
			),
		]);

		expect(maxActiveLoads).toBe(1);
	});

	test("removes all stale bundle scripts before loading next URL", async () => {
		const doc = createMockDocument();
		const loader = createLoader();
		doc._addBundleScript("https://proxy.pie-api.com/bundles/old-a/client-player");
		doc._addBundleScript("https://proxy.pie-api.com/bundles/old-b/client-player");

		(loader as any).loadBundleScript = async (url: string, targetDoc: MockDocument) => {
			targetDoc._addBundleScript(url);
			(window as any).pie = {
				default: {
					"@pie-element/ebsr": {},
				},
			};
		};
		(loader as any).registerElementsFromBundle = async () => undefined;

		await loader.load(
			{ elements: { "pie-ebsr": "@pie-element/ebsr@1.0.0" } },
			doc,
			BundleType.clientPlayer,
			true,
		);

		const scripts = doc._listBundleScripts();
		expect(scripts).toHaveLength(1);
		expect(scripts[0]?.src.includes("ebsr")).toBe(true);
	});
});
