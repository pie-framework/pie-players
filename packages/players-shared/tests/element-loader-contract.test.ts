/**
 * ElementLoader primitive — contract tests.
 *
 * These tests encode the "truthful promise" invariant the primitive must
 * satisfy:
 *
 *   ensureRegistered(elements, options) resolves iff every requested tag
 *   is in `customElements` at the moment of resolution. On partial success
 *   it rejects with an `ElementLoaderError` carrying `unregisteredTags`
 *   and a per-tag `reasons` map.
 *
 * Every test here corresponds to a real failure mode in the prior
 * per-strategy loader families where the load promise resolved while tags
 * were not actually registered. The primitive is expected to catch each of
 * these through a combination of adapter-level rejections and a post-load
 * `customElements.whenDefined` verification pass.
 *
 * The tests are written against the primitive's public contract — not
 * against internal plumbing — so they survive implementation
 * refactorings.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	__testing as elementLoaderTesting,
	ElementAssertionError,
	ElementLoaderError,
	assertRegistered,
	ensureRegistered,
	type ElementLoaderBackend,
	type RegistrationFailureReason,
} from "../src/loaders/element-loader.js";
import {
	createIifeBackend,
	type IifeBackendTestSeams,
} from "../src/loaders/iife-adapter.js";
import {
	createEsmBackend,
	type EsmBackendTestSeams,
} from "../src/loaders/esm-adapter.js";
import { BundleType } from "../src/pie/types.js";

// ─── Test harness ────────────────────────────────────────────────────────────

type GlobalWithDom = typeof globalThis & {
	customElements?: {
		get: (name: string) => CustomElementConstructor | undefined;
		define: (name: string, ctor: CustomElementConstructor) => void;
		whenDefined: (name: string) => Promise<CustomElementConstructor>;
	};
	HTMLElement?: typeof HTMLElement;
	HTMLScriptElement?: {
		supports?: (type: string) => boolean;
	};
	window?: {
		pie?: unknown;
		pieHelpers?: unknown;
		customElements?: unknown;
		fetch?: typeof fetch;
	};
};

const g = globalThis as GlobalWithDom;

const originalCustomElements = g.customElements;
const originalHtmlElement = g.HTMLElement;
const originalHtmlScriptElement = g.HTMLScriptElement;
const originalWindow = g.window;

/**
 * A scripted custom-elements registry we can control deterministically.
 * Tracks define/get/whenDefined state so tests can assert what the
 * primitive actually does vs customElements, not vs a mock with hidden
 * behavior.
 */
type ScriptedRegistry = {
	define(tag: string, ctor: CustomElementConstructor): void;
	markMissing(tag: string): void;
	snapshot(): string[];
	resetWhenDefinedBlockers(): void;
};

function installScriptedCustomElements(): ScriptedRegistry {
	const registry = new Map<string, CustomElementConstructor>();
	const pending = new Map<string, (ctor: CustomElementConstructor) => void>();

	const scriptedRegistry = {
		get(tag: string) {
			return registry.get(tag);
		},
		define(tag: string, ctor: CustomElementConstructor) {
			if (registry.has(tag)) {
				throw new DOMException(
					`the name "${tag}" has already been used with this registry`,
					"NotSupportedError",
				);
			}
			registry.set(tag, ctor);
			const waiter = pending.get(tag);
			if (waiter) {
				waiter(ctor);
				pending.delete(tag);
			}
		},
		whenDefined(tag: string): Promise<CustomElementConstructor> {
			const existing = registry.get(tag);
			if (existing) return Promise.resolve(existing);
			return new Promise((resolve) => {
				pending.set(tag, resolve);
			});
		},
		// Non-standard hook the primitive uses for diagnostic messages.
		__pieSnapshot(): string[] {
			return [...registry.keys()].sort();
		},
	};
	g.customElements = scriptedRegistry;

	return {
		define(tag, ctor) {
			registry.set(tag, ctor);
			const waiter = pending.get(tag);
			if (waiter) {
				waiter(ctor);
				pending.delete(tag);
			}
		},
		markMissing(tag) {
			registry.delete(tag);
		},
		snapshot() {
			return [...registry.keys()].sort();
		},
		resetWhenDefinedBlockers() {
			pending.clear();
		},
	};
}

function installHtmlElementBase(): void {
	if (typeof g.HTMLElement === "undefined") {
		g.HTMLElement = class {} as unknown as typeof HTMLElement;
	}
}

function createConstructorFor(tag: string): CustomElementConstructor {
	class ScriptedElement extends (g.HTMLElement as typeof HTMLElement) {
		static readonly tag = tag;
	}
	return ScriptedElement as unknown as CustomElementConstructor;
}

function createNonConstructor(): unknown {
	// Mimics a module whose "Element" export is an object literal (common ESM
	// bug) or a plain function (common IIFE bug) — not a CustomElementConstructor.
	return { render: () => "not a constructor" };
}

function createMockDocument(): Document {
	const scripts: Array<{ src: string; type?: string; textContent?: string }> =
		[];
	return {
		head: {
			appendChild: (el: unknown) => {
				scripts.push(el as (typeof scripts)[number]);
				return el;
			},
		},
		createElement: () => ({}),
		querySelector: () => null,
		querySelectorAll: () => [] as unknown as NodeListOf<Element>,
		_scripts: scripts,
	} as unknown as Document;
}

beforeEach(() => {
	installHtmlElementBase();
	installScriptedCustomElements();
	g.HTMLScriptElement = class {
		static supports(type: string) {
			return type === "importmap";
		}
	} as unknown as GlobalWithDom["HTMLScriptElement"];
	g.window = {
		customElements: g.customElements,
		fetch: async () =>
			({
				ok: true,
				async json() {
					return {
						pie: {
							browserSharedDependencies: {
								react: "18.2.0",
								"react-dom": "18.2.0",
							},
						},
					};
				},
			}) as Response,
		pieHelpers: {
			loadingScripts: {},
			loadingPromises: {},
			globalLoadQueue: Promise.resolve(),
			activeBundleUrl: null,
		},
	};
	elementLoaderTesting.resetDedupState();
});

afterEach(() => {
	elementLoaderTesting.resetDedupState();
	// Restore any globals this file stomped on so sibling test files that rely
	// on happy-dom (first-focusable, etc.) still see a clean slate.
	if (originalCustomElements === undefined) {
		delete (g as { customElements?: unknown }).customElements;
	} else {
		g.customElements = originalCustomElements;
	}
	if (originalHtmlElement === undefined) {
		delete (g as { HTMLElement?: unknown }).HTMLElement;
	} else {
		g.HTMLElement = originalHtmlElement;
	}
	if (originalHtmlScriptElement === undefined) {
		delete (g as { HTMLScriptElement?: unknown }).HTMLScriptElement;
	} else {
		g.HTMLScriptElement = originalHtmlScriptElement;
	}
	if (originalWindow === undefined) {
		delete (g as { window?: unknown }).window;
	} else {
		g.window = originalWindow;
	}
});

// ─── ensureRegistered — primitive-level contract ─────────────────────────────

describe("ensureRegistered — primitive-level contract", () => {
	test("empty element map resolves immediately and does not touch the backend", async () => {
		let backendCalls = 0;
		const fake: ElementLoaderBackend = {
			async load() {
				backendCalls++;
			},
		};

		await ensureRegistered(
			{},
			{
				backend: fake,
				doc: createMockDocument(),
			},
		);

		expect(backendCalls).toBe(0);
	});

	test("idempotent fast path: already-registered tags resolve without backend", async () => {
		const registry = installScriptedCustomElements();
		registry.define(
			"pie-already-there--version-1-0-0",
			createConstructorFor("pie-already-there--version-1-0-0"),
		);

		let backendCalls = 0;
		const fake: ElementLoaderBackend = {
			async load() {
				backendCalls++;
			},
		};

		await ensureRegistered(
			{
				"pie-already-there--version-1-0-0": "@pie-element/foo@1.0.0",
			},
			{
				backend: fake,
				doc: createMockDocument(),
			},
		);

		expect(backendCalls).toBe(0);
	});

	test("resolves iff every requested tag is in customElements after the backend returns", async () => {
		const registry = installScriptedCustomElements();
		const fake: ElementLoaderBackend = {
			async load(elements) {
				// Backend genuinely registers both tags.
				for (const tag of Object.keys(elements)) {
					registry.define(tag, createConstructorFor(tag));
				}
			},
		};

		await ensureRegistered(
			{
				"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
				"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
			},
			{
				backend: fake,
				doc: createMockDocument(),
			},
		);

		expect(registry.snapshot()).toContain("pie-mc--version-11-0-1");
		expect(registry.snapshot()).toContain("pie-passage--version-3-2-4");
	});

	test("rejects with ElementLoaderError when the backend resolves but a tag was never registered", async () => {
		const registry = installScriptedCustomElements();
		const fake: ElementLoaderBackend = {
			async load(elements) {
				// Backend LIES — it claims success but only registers one of two tags.
				const tags = Object.keys(elements);
				registry.define(tags[0], createConstructorFor(tags[0]));
			},
		};

		await expect(
			ensureRegistered(
				{
					"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
					"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
				},
				{
					backend: fake,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 50,
				},
			),
		).rejects.toBeInstanceOf(ElementLoaderError);
	});

	test("partial-success rejection carries {unregisteredTags, reasons} for every missing tag", async () => {
		const registry = installScriptedCustomElements();
		const fake: ElementLoaderBackend = {
			async load(elements) {
				const tags = Object.keys(elements);
				registry.define(tags[0], createConstructorFor(tags[0]));
			},
		};

		let error: ElementLoaderError | undefined;
		try {
			await ensureRegistered(
				{
					"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
					"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
					"pie-hotspot--version-9-0-0": "@pie-element/hotspot@9.0.0",
				},
				{
					backend: fake,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 50,
				},
			);
		} catch (err) {
			error = err as ElementLoaderError;
		}

		expect(error).toBeInstanceOf(ElementLoaderError);
		expect(error?.unregisteredTags.has("pie-passage--version-3-2-4")).toBe(
			true,
		);
		expect(error?.unregisteredTags.has("pie-hotspot--version-9-0-0")).toBe(
			true,
		);
		expect(error?.unregisteredTags.has("pie-mc--version-11-0-1")).toBe(false);
		expect(error?.reasons.size).toBe(2);
		const passageReason = error?.reasons.get("pie-passage--version-3-2-4");
		expect(passageReason?.kind).toBe("timeout");
	});

	test("whenDefined timeout is always a rejection, never silently swallowed", async () => {
		const fake: ElementLoaderBackend = {
			async load() {
				// Backend resolves without registering anything.
			},
		};

		await expect(
			ensureRegistered(
				{
					"pie-never--version-1-0-0": "@pie-element/never@1.0.0",
				},
				{
					backend: fake,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
				},
			),
		).rejects.toMatchObject({
			name: "ElementLoaderError",
		});
	});

	test("concurrent identical requests share one backend call (dedup)", async () => {
		const registry = installScriptedCustomElements();
		let loadInvocations = 0;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		const fake: ElementLoaderBackend = {
			async load(elements) {
				loadInvocations++;
				await gate;
				for (const tag of Object.keys(elements)) {
					registry.define(tag, createConstructorFor(tag));
				}
			},
		};

		const elements = {
			"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
		};

		const p1 = ensureRegistered(elements, {
			backend: fake,
			doc: createMockDocument(),
		});
		const p2 = ensureRegistered(elements, {
			backend: fake,
			doc: createMockDocument(),
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		await Promise.all([p1, p2]);

		expect(loadInvocations).toBe(1);
	});

	test("concurrent different requests are NOT deduplicated against each other", async () => {
		const registry = installScriptedCustomElements();
		let loadInvocations = 0;

		const fake: ElementLoaderBackend = {
			async load(elements) {
				loadInvocations++;
				for (const tag of Object.keys(elements)) {
					registry.define(tag, createConstructorFor(tag));
				}
			},
		};

		await Promise.all([
			ensureRegistered(
				{
					"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
				},
				{ backend: fake, doc: createMockDocument() },
			),
			ensureRegistered(
				{
					"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
				},
				{ backend: fake, doc: createMockDocument() },
			),
		]);

		expect(loadInvocations).toBe(2);
	});

	test("dedup cache clears after rejection so a subsequent retry re-invokes the backend", async () => {
		const registry = installScriptedCustomElements();
		let loadInvocations = 0;

		const fake: ElementLoaderBackend = {
			async load(elements) {
				loadInvocations++;
				if (loadInvocations === 1) {
					return; // Fail to register anything — primitive must reject.
				}
				for (const tag of Object.keys(elements)) {
					registry.define(tag, createConstructorFor(tag));
				}
			},
		};

		const elements = {
			"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
		};

		await expect(
			ensureRegistered(elements, {
				backend: fake,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 25,
			}),
		).rejects.toBeInstanceOf(ElementLoaderError);

		await ensureRegistered(elements, {
			backend: fake,
			doc: createMockDocument(),
			whenDefinedTimeoutMs: 25,
		});

		expect(loadInvocations).toBe(2);
	});
});

describe("ensureRegistered dedup key fingerprinting", () => {
	const elements = {
		"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
	};

	test("iife backend keys differ when bundleInfo differs", () => {
		const a = elementLoaderTesting.dedupKeyFor(elements, {
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleInfo: { hash: "bundle-a" },
		});
		const b = elementLoaderTesting.dedupKeyFor(elements, {
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleInfo: { hash: "bundle-b" },
		});

		expect(a).not.toBe(b);
	});

	test("iife backend keys differ when retry config differs", () => {
		const a = elementLoaderTesting.dedupKeyFor(elements, {
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleRetry: { retryDelayMs: 50, timeoutMs: 5000 },
		});
		const b = elementLoaderTesting.dedupKeyFor(elements, {
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleRetry: { retryDelayMs: 10, timeoutMs: 1000 },
		});

		expect(a).not.toBe(b);
	});

	test("esm backend keys differ when viewConfig differs", () => {
		const a = elementLoaderTesting.dedupKeyFor(elements, {
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
			viewConfig: { subpath: "/delivery", tagSuffix: "" },
		});
		const b = elementLoaderTesting.dedupKeyFor(elements, {
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
			viewConfig: { subpath: "/author", tagSuffix: "-config" },
		});

		expect(a).not.toBe(b);
	});

	test("direct backend identity semantics are preserved", () => {
		const backendA: ElementLoaderBackend = {
			async load() {
				/* no-op */
			},
		};
		const backendB: ElementLoaderBackend = {
			async load() {
				/* no-op */
			},
		};

		const keyA1 = elementLoaderTesting.dedupKeyFor(elements, backendA);
		const keyA2 = elementLoaderTesting.dedupKeyFor(elements, backendA);
		const keyB = elementLoaderTesting.dedupKeyFor(elements, backendB);

		expect(keyA1).toBe(keyA2);
		expect(keyA1).not.toBe(keyB);
	});
});

// ─── assertRegistered — synchronous contract ─────────────────────────────────

describe("assertRegistered — synchronous contract", () => {
	test("no-op when every tag is registered", () => {
		const registry = installScriptedCustomElements();
		registry.define("pie-a--version-1-0-0", createConstructorFor("pie-a"));
		registry.define("pie-b--version-2-0-0", createConstructorFor("pie-b"));

		expect(() =>
			assertRegistered(["pie-a--version-1-0-0", "pie-b--version-2-0-0"]),
		).not.toThrow();
	});

	test("throws ElementAssertionError with expected, missing, and currently-registered tags", () => {
		const registry = installScriptedCustomElements();
		registry.define("pie-a--version-1-0-0", createConstructorFor("pie-a"));
		registry.define(
			"pie-unrelated--version-9-9-9",
			createConstructorFor("pie-unrelated"),
		);

		let error: ElementAssertionError | undefined;
		try {
			assertRegistered([
				"pie-a--version-1-0-0",
				"pie-b--version-2-0-0",
				"pie-c--version-3-0-0",
			]);
		} catch (err) {
			error = err as ElementAssertionError;
		}

		expect(error).toBeInstanceOf(ElementAssertionError);
		expect(error?.expectedTags).toEqual([
			"pie-a--version-1-0-0",
			"pie-b--version-2-0-0",
			"pie-c--version-3-0-0",
		]);
		expect(error?.missingTags).toEqual([
			"pie-b--version-2-0-0",
			"pie-c--version-3-0-0",
		]);
		expect(error?.currentlyRegisteredTags).toContain("pie-a--version-1-0-0");
		expect(error?.currentlyRegisteredTags).toContain(
			"pie-unrelated--version-9-9-9",
		);
		expect(error?.message).toContain("missing");
		expect(error?.message).toContain("pie-b--version-2-0-0");
		expect(error?.message).toContain("pie-c--version-3-0-0");
	});

	test("empty tag list is a no-op", () => {
		expect(() => assertRegistered([])).not.toThrow();
	});
});

// ─── IIFE adapter — per-failure-mode contract ────────────────────────────────

describe("IIFE adapter — contract", () => {
	test("rejects when whenDefined times out for any tag", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
		});

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			// Simulate a successful bundle fetch that injects window.pie but
			// never calls customElements.define.
			(g.window as { pie?: unknown }).pie = {
				default: {
					"@pie-element/never": {
						Element: createNonConstructor(), // can't be defined
					},
				},
			};
		});

		await expect(
			ensureRegistered(
				{ "pie-never--version-1-0-0": "@pie-element/never@1.0.0" },
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
				},
			),
		).rejects.toBeInstanceOf(ElementLoaderError);
	});

	test("rejects when an element class is not a valid custom element constructor", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
		});

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			(g.window as { pie?: unknown }).pie = {
				default: {
					"@pie-element/bad": {
						Element: createNonConstructor(),
					},
				},
			};
		});

		let error: ElementLoaderError | undefined;
		try {
			await ensureRegistered(
				{ "pie-bad--version-1-0-0": "@pie-element/bad@1.0.0" },
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
				},
			);
		} catch (err) {
			error = err as ElementLoaderError;
		}

		expect(error).toBeInstanceOf(ElementLoaderError);
		const reason = error?.reasons.get("pie-bad--version-1-0-0");
		// Either the adapter reports "not-a-constructor" directly, or the
		// primitive falls back to "timeout" after whenDefined never resolves.
		// Both are acceptable — the critical assertion is that this does not
		// silently fulfill.
		expect(reason).toBeTruthy();
		if (reason?.kind === "not-a-constructor") {
			expect(reason.tag).toBe("pie-bad--version-1-0-0");
		}
	});

	test("rejects when requested package is missing from the loaded IIFE bundle", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
		});

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			(g.window as { pie?: unknown }).pie = {
				default: {
					// Requested package absent — only an unrelated one is present.
					"@pie-element/unrelated": {
						Element: createConstructorFor("unrelated"),
					},
				},
			};
		});

		await expect(
			ensureRegistered(
				{ "pie-missing--version-1-0-0": "@pie-element/missing@1.0.0" },
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
				},
			),
		).rejects.toBeInstanceOf(ElementLoaderError);
	});

	test("editor IIFE bundles register the requested config tag exactly", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.editor,
			needsControllers: true,
		});

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			(g.window as { pie?: unknown }).pie = {
				default: {
					"@pie-element/editor": {
						Configure: createConstructorFor("pie-editor-config"),
					},
				},
			};
		});

		const requestedTag = "pie-editor--version-1-0-0-config";
		await ensureRegistered(
			{ [requestedTag]: "@pie-element/editor@1.0.0" },
			{
				backend,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 25,
			},
		);

		expect(g.customElements?.get(requestedTag)).toBeDefined();
		expect(
			g.customElements?.get("pie-editor--version-1-0-0-config-config"),
		).toBeUndefined();
	});

	test("concurrent IIFE loads of the same bundle share one fetch AND both callers observe correct registration", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
		});

		let fetchCount = 0;
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			fetchCount++;
			await gate;
			(g.window as { pie?: unknown }).pie = {
				default: {
					"@pie-element/multiple-choice": {
						Element: createConstructorFor("pie-mc--version-11-0-1"),
					},
				},
			};
		});

		const elements = {
			"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
		};

		const p1 = ensureRegistered(elements, {
			backend,
			doc: createMockDocument(),
			whenDefinedTimeoutMs: 100,
		});
		const p2 = ensureRegistered(elements, {
			backend,
			doc: createMockDocument(),
			whenDefinedTimeoutMs: 100,
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		release();
		await Promise.all([p1, p2]);

		expect(fetchCount).toBe(1);
		expect(g.customElements?.get("pie-mc--version-11-0-1")).toBeDefined();
	});
});

// ─── ESM adapter — per-failure-mode contract ─────────────────────────────────

describe("ESM adapter — contract", () => {
	test("url mode imports browser ESM files directly from jsDelivr without +esm transforms", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		const imported: string[] = [];
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			return {
				default: createConstructorFor("pie-mc--version-13-2-0"),
				Element: createConstructorFor("pie-mc--version-13-2-0"),
			};
		});

		await backend.load(
			{
				"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
			},
			{
				doc: createMockDocument(),
			},
		);

		expect(imported).toEqual([
			"https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/delivery/index.js",
			"https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/controller/index.js",
		]);
		expect(imported.some((specifier) => specifier.includes("+esm"))).toBe(
			false,
		);
	});

	test("import-map mode maps PIE specifiers to browser ESM files without +esm transforms", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			moduleResolution: "import-map",
			view: "delivery",
		});

		const injectedMaps: string[] = [];
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.observeImportMapInjection((mapJson) => {
			injectedMaps.push(mapJson);
		});
		seams.replaceImporter(async () => ({
			default: createConstructorFor("pie-mc--version-13-2-0"),
			Element: createConstructorFor("pie-mc--version-13-2-0"),
		}));

		await ensureRegistered(
			{
				"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
			},
			{
				backend,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 25,
			},
		);

		const imports = JSON.parse(injectedMaps[0] ?? "{}").imports;
		expect(imports["@pie-element/multiple-choice"]).toBe(
			"https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/delivery/index.js",
		);
		expect(imports["@pie-element/multiple-choice/controller"]).toBe(
			"https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/controller/index.js",
		);
		expect(imports["@pie-element/multiple-choice"]).not.toContain("+esm");
		expect(imports["@pie-element/multiple-choice/controller"]).not.toContain(
			"+esm",
		);
	});

	test("url mode injects shared React dependency imports from package metadata", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		const injectedMaps: string[] = [];
		const imported: string[] = [];
		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (packageVersion: string) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.observeImportMapInjection((mapJson) => {
			injectedMaps.push(mapJson);
		});
		seams.replacePackageMetadataLoader(async (packageVersion) => {
			expect(packageVersion).toBe("@pie-element/multiple-choice@13.2.0");
			return {
				pie: {
					browserSharedDependencies: {
						react: "18.2.0",
						"react-dom": "18.2.0",
					},
				},
			};
		});
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			return {
				default: createConstructorFor("pie-mc--version-13-2-0"),
				Element: createConstructorFor("pie-mc--version-13-2-0"),
			};
		});

		await backend.load(
			{
				"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
			},
			{
				doc: createMockDocument(),
			},
		);

		const imports = JSON.parse(injectedMaps[0] ?? "{}").imports;
		expect(imports.react).toBe(
			"https://cdn.jsdelivr.net/npm/react@18.2.0/+esm",
		);
		expect(imports["react/jsx-runtime"]).toBe(
			"https://cdn.jsdelivr.net/npm/react@18.2.0/jsx-runtime/+esm",
		);
		expect(imports["react-dom"]).toBe(
			"https://cdn.jsdelivr.net/npm/react-dom@18.2.0/+esm",
		);
		expect(imports["react-dom/client"]).toBe(
			"https://cdn.jsdelivr.net/npm/react-dom@18.2.0/client/+esm",
		);
		expect(imported).toEqual([
			"https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/delivery/index.js",
			"https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/controller/index.js",
		]);
	});

	test("esm.sh provider loads PIE artifacts from raw esm.sh and shared dependencies from esm.sh", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://esm.sh",
			cdnProvider: "esm.sh",
			view: "delivery",
		});

		const injectedMaps: string[] = [];
		const imported: string[] = [];
		let metadataUrl = "";
		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (
							packageVersion: string,
							packageJsonUrl: string,
						) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.observeImportMapInjection((mapJson) => {
			injectedMaps.push(mapJson);
		});
		seams.replacePackageMetadataLoader(
			async (_packageVersion, packageJsonUrl) => {
				metadataUrl = packageJsonUrl;
				return {
					pie: {
						browserSharedDependencies: {
							react: "18.2.0",
							"react-dom": "18.2.0",
						},
					},
				};
			},
		);
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			return {
				default: createConstructorFor("pie-mc--version-13-2-0"),
				Element: createConstructorFor("pie-mc--version-13-2-0"),
			};
		});

		await backend.load(
			{
				"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
			},
			{
				doc: createMockDocument(),
			},
		);

		const imports = JSON.parse(injectedMaps[0] ?? "{}").imports;
		expect(metadataUrl).toBe(
			"https://raw.esm.sh/@pie-element/multiple-choice@13.2.0/package.json",
		);
		expect(imports.react).toBe("https://esm.sh/react@18.2.0");
		expect(imports["react/jsx-runtime"]).toBe(
			"https://esm.sh/react@18.2.0/jsx-runtime",
		);
		expect(imports["react-dom"]).toBe("https://esm.sh/react-dom@18.2.0");
		expect(imports["react-dom/client"]).toBe(
			"https://esm.sh/react-dom@18.2.0/client",
		);
		expect(imported).toEqual([
			"https://raw.esm.sh/@pie-element/multiple-choice@13.2.0/dist/browser/delivery/index.js",
			"https://raw.esm.sh/@pie-element/multiple-choice@13.2.0/dist/browser/controller/index.js",
		]);
	});

	test("custom provider name uses jsDelivr-compatible URL layout", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.pie.example/esm",
			cdnProvider: "pie-proxy",
			view: "delivery",
		});

		const injectedMaps: string[] = [];
		const imported: string[] = [];
		let metadataUrl = "";
		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (
							packageVersion: string,
							packageJsonUrl: string,
						) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.observeImportMapInjection((mapJson) => {
			injectedMaps.push(mapJson);
		});
		seams.replacePackageMetadataLoader(
			async (_packageVersion, packageJsonUrl) => {
				metadataUrl = packageJsonUrl;
				return {
					pie: {
						browserSharedDependencies: {
							react: "18.2.0",
							"react-dom": "18.2.0",
						},
					},
				};
			},
		);
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			return {
				default: createConstructorFor("pie-mc--version-13-2-0"),
				Element: createConstructorFor("pie-mc--version-13-2-0"),
			};
		});

		await backend.load(
			{
				"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
			},
			{
				doc: createMockDocument(),
			},
		);

		const imports = JSON.parse(injectedMaps[0] ?? "{}").imports;
		expect(metadataUrl).toBe(
			"https://cdn.pie.example/esm/@pie-element/multiple-choice@13.2.0/package.json",
		);
		expect(imports.react).toBe("https://cdn.pie.example/esm/react@18.2.0/+esm");
		expect(imported).toEqual([
			"https://cdn.pie.example/esm/@pie-element/multiple-choice@13.2.0/dist/browser/delivery/index.js",
			"https://cdn.pie.example/esm/@pie-element/multiple-choice@13.2.0/dist/browser/controller/index.js",
		]);
	});

	test("custom provider object controls package and dependency URL routes", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.pie.example",
			cdnProvider: {
				name: "pie-proxy",
				packageJsonUrl: (packageVersion) =>
					`https://cdn.pie.example/esm/${packageVersion}/package.json`,
				browserViewUrl: (packageVersion, view) =>
					`https://cdn.pie.example/esm/${packageVersion}/dist/browser/${view}/index.js`,
				browserControllerUrl: (packageVersion) =>
					`https://cdn.pie.example/esm/${packageVersion}/dist/browser/controller/index.js`,
				sharedDependencyUrl: (dependencyName, version, subpath) => {
					const suffix = subpath ? `/${subpath}` : "";
					return `https://cdn.pie.example/npm/${dependencyName}@${version}${suffix}`;
				},
			},
			view: "delivery",
		});

		const injectedMaps: string[] = [];
		const imported: string[] = [];
		let metadataUrl = "";
		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (
							packageVersion: string,
							packageJsonUrl: string,
						) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.observeImportMapInjection((mapJson) => {
			injectedMaps.push(mapJson);
		});
		seams.replacePackageMetadataLoader(
			async (_packageVersion, packageJsonUrl) => {
				metadataUrl = packageJsonUrl;
				return {
					pie: {
						browserSharedDependencies: {
							react: "18.2.0",
							"react-dom": "18.2.0",
						},
					},
				};
			},
		);
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			return {
				default: createConstructorFor("pie-mc--version-13-2-0"),
				Element: createConstructorFor("pie-mc--version-13-2-0"),
			};
		});

		await backend.load(
			{
				"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
			},
			{
				doc: createMockDocument(),
			},
		);

		const imports = JSON.parse(injectedMaps[0] ?? "{}").imports;
		expect(metadataUrl).toBe(
			"https://cdn.pie.example/esm/@pie-element/multiple-choice@13.2.0/package.json",
		);
		expect(imports.react).toBe("https://cdn.pie.example/npm/react@18.2.0");
		expect(imports["react/jsx-runtime"]).toBe(
			"https://cdn.pie.example/npm/react@18.2.0/jsx-runtime",
		);
		expect(imported).toEqual([
			"https://cdn.pie.example/esm/@pie-element/multiple-choice@13.2.0/dist/browser/delivery/index.js",
			"https://cdn.pie.example/esm/@pie-element/multiple-choice@13.2.0/dist/browser/controller/index.js",
		]);
	});

	test("url mode requires official browserSharedDependencies metadata", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (packageVersion: string) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.replacePackageMetadataLoader(async () => ({
			peerDependencies: {
				react: "^18.0.0",
				"react-dom": "^18.0.0",
			},
		}));

		await expect(
			backend.load(
				{
					"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
				},
				{
					doc: createMockDocument(),
				},
			),
		).rejects.toThrow(/browserSharedDependencies/);
	});

	test("url mode rejects packages whose metadata does not expose browser ESM exports", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (packageVersion: string) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.replacePackageMetadataLoader(async () => ({
			exports: {
				".": "./dist/index.js",
				"./controller": "./dist/controller/index.js",
				"./runtime-support": "./dist/runtime-support.js",
			},
			pie: {
				browserSharedDependencies: {
					react: "18.2.0",
					"react-dom": "18.2.0",
				},
			},
		}));

		await expect(
			backend.load(
				{
					"pie-math-inline--version-12-1-0": "@pie-element/math-inline@12.1.0",
				},
				{
					doc: createMockDocument(),
				},
			),
		).rejects.toThrow(/does not publish browser ESM export/);
	});

	test("url mode resolves same-major React conflicts to the higher version with warnings and instrumentation", async () => {
		const events: Array<{ name: string; attributes: Record<string, unknown> }> =
			[];
		const provider = {
			providerId: "test",
			providerName: "Test Provider",
			async initialize() {},
			trackError() {},
			trackEvent(name: string, attributes: Record<string, unknown>) {
				events.push({ name, attributes });
			},
			destroy() {},
			isReady() {
				return true;
			},
		};
		const warnings: string[] = [];
		const originalWarn = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map(String).join(" "));
		};

		try {
			const backend = createEsmBackend({
				kind: "esm",
				cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
				view: "delivery",
				trackPageActions: true,
				instrumentationProvider: provider,
			});

			const injectedMaps: string[] = [];
			const seams = (
				backend as unknown as {
					__seams: EsmBackendTestSeams & {
						replacePackageMetadataLoader(
							fn: (packageVersion: string) => Promise<unknown>,
						): void;
					};
				}
			).__seams;
			seams.observeImportMapInjection((mapJson) => {
				injectedMaps.push(mapJson);
			});
			seams.replacePackageMetadataLoader(async (packageVersion) => ({
				pie: {
					browserSharedDependencies: {
						react: packageVersion.includes("choice") ? "18.2.0" : "18.3.1",
						"react-dom": packageVersion.includes("choice")
							? "18.2.0"
							: "18.3.1",
					},
				},
			}));
			seams.replaceImporter(async () => ({
				default: createConstructorFor("pie-element"),
				Element: createConstructorFor("pie-element"),
			}));

			await backend.load(
				{
					"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
					"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
				},
				{
					doc: createMockDocument(),
				},
			);

			const imports = JSON.parse(injectedMaps[0] ?? "{}").imports;
			expect(imports.react).toBe(
				"https://cdn.jsdelivr.net/npm/react@18.3.1/+esm",
			);
			expect(imports["react-dom"]).toBe(
				"https://cdn.jsdelivr.net/npm/react-dom@18.3.1/+esm",
			);
			expect(warnings.some((warning) => warning.includes("react"))).toBe(true);
			expect(
				events.some(
					(event) => event.name === "pie-esm-shared-dependency-conflict",
				),
			).toBe(true);
		} finally {
			console.warn = originalWarn;
		}
	});

	test("url mode rejects later shared dependency upgrades after the singleton is selected", async () => {
		const errors: Error[] = [];
		const provider = {
			providerId: "test",
			providerName: "Test Provider",
			async initialize() {},
			trackError(error: Error) {
				errors.push(error);
			},
			trackEvent() {},
			destroy() {},
			isReady() {
				return true;
			},
		};
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
			trackPageActions: true,
			instrumentationProvider: provider,
		});

		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (packageVersion: string) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.replacePackageMetadataLoader(async (packageVersion) => ({
			pie: {
				browserSharedDependencies: {
					react: packageVersion.includes("choice") ? "18.2.0" : "18.3.1",
					"react-dom": packageVersion.includes("choice") ? "18.2.0" : "18.3.1",
				},
			},
		}));
		seams.replaceImporter(async () => ({
			default: createConstructorFor("pie-element"),
			Element: createConstructorFor("pie-element"),
		}));

		await backend.load(
			{ "pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0" },
			{
				doc: createMockDocument(),
			},
		);

		await expect(
			backend.load(
				{
					"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
				},
				{
					doc: createMockDocument(),
				},
			),
		).rejects.toThrow(/cannot be upgraded/);
		expect(
			errors.some((error) => error.message.includes("cannot be upgraded")),
		).toBe(true);
	});

	test("config-object ESM backend preserves shared dependency locks across sequential loads", async () => {
		const backendConfig = {
			kind: "esm" as const,
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		};
		const backend = createEsmBackend(backendConfig);
		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (packageVersion: string) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.replacePackageMetadataLoader(async (packageVersion) => ({
			pie: {
				browserSharedDependencies: {
					react: packageVersion.includes("choice") ? "18.2.0" : "18.3.1",
					"react-dom": packageVersion.includes("choice") ? "18.2.0" : "18.3.1",
				},
			},
		}));
		seams.replaceImporter(async () => ({
			default: createConstructorFor("pie-element"),
			Element: createConstructorFor("pie-element"),
		}));
		elementLoaderTesting.replaceResolvedBackendForTesting(
			backendConfig,
			backend,
		);

		try {
			await ensureRegistered(
				{ "pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0" },
				{
					backend: backendConfig,
					doc: createMockDocument(),
				},
			);

			let error: ElementLoaderError | undefined;
			try {
				await ensureRegistered(
					{
						"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
					},
					{
						backend: backendConfig,
						doc: createMockDocument(),
						whenDefinedTimeoutMs: 25,
					},
				);
			} catch (err) {
				error = err as ElementLoaderError;
			}
			expect(error).toBeInstanceOf(ElementLoaderError);
			const reason = error?.reasons.get("pie-passage--version-3-2-4");
			expect(reason?.kind).toBe("backend-rejected");
			if (reason?.kind === "backend-rejected") {
				expect(reason.cause).toContain("cannot be upgraded");
			}
		} finally {
			elementLoaderTesting.restoreResolvedBackendsForTesting();
		}
	});

	test("url mode validates same package name at different versions", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});
		const seenMetadata: string[] = [];
		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (packageVersion: string) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.replacePackageMetadataLoader(async (packageVersion) => {
			seenMetadata.push(packageVersion);
			return {
				pie: {
					browserSharedDependencies: {
						react: "18.2.0",
						"react-dom": "18.2.0",
					},
				},
			};
		});
		seams.replaceImporter(async () => ({
			default: createConstructorFor("pie-element"),
			Element: createConstructorFor("pie-element"),
		}));

		await backend.load(
			{ "pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0" },
			{ doc: createMockDocument() },
		);
		await backend.load(
			{ "pie-mc--version-13-3-0": "@pie-element/multiple-choice@13.3.0" },
			{ doc: createMockDocument() },
		);

		expect(seenMetadata).toEqual([
			"@pie-element/multiple-choice@13.2.0",
			"@pie-element/multiple-choice@13.3.0",
		]);
	});

	test("url mode rejects conflicting shared React dependency versions", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		const seams = (
			backend as unknown as {
				__seams: EsmBackendTestSeams & {
					replacePackageMetadataLoader(
						fn: (packageVersion: string) => Promise<unknown>,
					): void;
				};
			}
		).__seams;
		seams.replacePackageMetadataLoader(async (packageVersion) => ({
			pie: {
				browserSharedDependencies: {
					react: packageVersion.includes("choice") ? "18.2.0" : "19.0.0",
					"react-dom": "18.2.0",
				},
			},
		}));

		await expect(
			backend.load(
				{
					"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
					"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
				},
				{
					doc: createMockDocument(),
				},
			),
		).rejects.toThrow(/Conflicting shared browser dependency react/);
	});

	test("whenDefined wait is bounded — never hangs when a module fails to register its tag", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.replaceImporter(async () => ({
			default: createNonConstructor(),
			Element: createNonConstructor(),
		}));

		const startedAt = Date.now();
		await expect(
			ensureRegistered(
				{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 40,
				},
			),
		).rejects.toBeInstanceOf(ElementLoaderError);
		const elapsed = Date.now() - startedAt;
		// Generous ceiling; asserting finite rather than hanging forever.
		expect(elapsed).toBeLessThan(1000);
	});

	test("rejects when the imported module's element export is not a valid constructor", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.replaceImporter(async () => ({
			default: createNonConstructor(),
			Element: createNonConstructor(),
		}));

		let error: ElementLoaderError | undefined;
		try {
			await ensureRegistered(
				{
					"pie-bad--version-1-0-0": "@pie-element/bad@1.0.0",
				},
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
				},
			);
		} catch (err) {
			error = err as ElementLoaderError;
		}

		expect(error).toBeInstanceOf(ElementLoaderError);
		const reason: RegistrationFailureReason | undefined = error?.reasons.get(
			"pie-bad--version-1-0-0",
		);
		expect(reason).toBeTruthy();
		// Accept either "not-a-constructor" from the adapter or "timeout" from
		// the primitive's verification pass. The critical assertion is that
		// the promise rejected.
		expect([
			"not-a-constructor",
			"timeout",
			"module-load-failed",
			"backend-rejected",
		]).toContain(reason?.kind);
	});

	test("import-map mode: a second load() call with new elements extends the map (does not silently assume prior map covers)", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			moduleResolution: "import-map",
			view: "delivery",
		});

		const injectedMaps: string[] = [];
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.observeImportMapInjection((mapJson) => {
			injectedMaps.push(mapJson);
		});
		seams.replaceImporter(async (specifier) => {
			// Return a valid constructor keyed by specifier so each load
			// visibly registers its own tag.
			const ctorTag = specifier.includes("passage")
				? "pie-passage--version-3-2-4"
				: "pie-mc--version-11-0-1";
			return {
				default: createConstructorFor(ctorTag),
				Element: createConstructorFor(ctorTag),
			};
		});

		const doc = createMockDocument();

		await ensureRegistered(
			{
				"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
			},
			{
				backend,
				doc,
				whenDefinedTimeoutMs: 200,
			},
		);

		await ensureRegistered(
			{
				"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
			},
			{
				backend,
				doc,
				whenDefinedTimeoutMs: 200,
			},
		);

		// Either the second call re-injected (2 maps) OR the first map was
		// built large enough and the second call verified additions
		// explicitly. What we reject is: first map, second call silently
		// resolves without the new package entry present anywhere.
		const lastMap = injectedMaps[injectedMaps.length - 1] ?? "";
		const coveredInSomeMap = injectedMaps.some((m) =>
			m.includes("@pie-element/passage"),
		);
		expect(coveredInSomeMap).toBe(true);
		expect(lastMap).toBeTruthy();
	});

	test("backend.load() is bounded by loadTimeoutMs — never hangs on a never-resolving import()", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		// Install an importer that never resolves — the production failure
		// mode this commit closes (frozen CDN / network freeze).
		seams.replaceImporter(
			() => new Promise<Record<string, unknown>>(() => undefined),
		);

		const startedAt = Date.now();
		let error: ElementLoaderError | undefined;
		try {
			await ensureRegistered(
				{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
					loadTimeoutMs: 50,
				},
			);
		} catch (err) {
			error = err as ElementLoaderError;
		}
		const elapsed = Date.now() - startedAt;

		expect(error).toBeInstanceOf(ElementLoaderError);
		expect(elapsed).toBeLessThan(1000);
		const reason = error?.reasons.get("pie-mc--version-11-0-1");
		expect(reason?.kind).toBe("timeout");
		if (reason?.kind === "timeout") {
			expect(reason.tag).toBe("pie-mc--version-11-0-1");
			expect(reason.timeoutMs).toBe(50);
		}
	});

	test("ESM: empty element map resolves immediately without fetching or injecting anything", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			moduleResolution: "import-map",
			view: "delivery",
		});

		let importerCalls = 0;
		let injectionCalls = 0;
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.replaceImporter(async () => {
			importerCalls++;
			return { default: createNonConstructor() };
		});
		seams.observeImportMapInjection(() => {
			injectionCalls++;
		});

		await ensureRegistered(
			{},
			{
				backend,
				doc: createMockDocument(),
			},
		);

		expect(importerCalls).toBe(0);
		expect(injectionCalls).toBe(0);
	});
});

// ─── IIFE adapter — bundle-retry lifecycle ───────────────────────────────────

describe("IIFE adapter — bundle-retry lifecycle", () => {
	test("retry-then-succeed: emits retrying… completed; primitive resolves", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
			bundleRetry: { retryDelayMs: 5, timeoutMs: 500 },
			onBundleRetryStatus: (status) => statuses.push(status),
		});

		const statuses: Array<{
			state: string;
			attempt: number;
			url: string;
		}> = [];

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		let attempts = 0;
		seams.replaceLoadBundleScript(async () => {
			attempts++;
			if (attempts < 3) {
				throw new Error(`transient bundle build (attempt ${attempts})`);
			}
			(g.window as { pie?: unknown }).pie = {
				default: {
					"@pie-element/multiple-choice": {
						Element: createConstructorFor("pie-mc--version-11-0-1"),
					},
				},
			};
		});

		await ensureRegistered(
			{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
			{
				backend,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 200,
			},
		);

		expect(attempts).toBe(3);
		const states = statuses.map((s) => s.state);
		expect(
			states.filter((s) => s === "retrying").length,
		).toBeGreaterThanOrEqual(2);
		expect(states[states.length - 1]).toBe("completed");
		expect(statuses.every((s) => s.url.length > 0)).toBe(true);
		expect(statuses.every((s) => s.attempt >= 1)).toBe(true);
	});

	test("retry-then-timeout: emits retrying…* timeout; primitive rejects with ElementLoaderError", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
			bundleRetry: { retryDelayMs: 10, timeoutMs: 40 },
			onBundleRetryStatus: (status) => statuses.push(status),
		});

		const statuses: Array<{
			state: string;
			attempt: number;
			reason?: string;
		}> = [];

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			throw new Error("never resolves");
		});

		let error: ElementLoaderError | undefined;
		try {
			await ensureRegistered(
				{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
					loadTimeoutMs: 500,
				},
			);
		} catch (err) {
			error = err as ElementLoaderError;
		}

		expect(error).toBeInstanceOf(ElementLoaderError);
		const states = statuses.map((s) => s.state);
		expect(states[states.length - 1]).toBe("timeout");
		expect(states.includes("retrying")).toBe(true);
		expect(states.includes("completed")).toBe(false);
		const lastStatus = statuses[statuses.length - 1];
		expect(lastStatus?.reason).toBeDefined();
		const reason = error?.reasons.get("pie-mc--version-11-0-1");
		expect(reason).toBeTruthy();
	});

	test("status sequence is monotonic: retrying* → (completed | timeout); never both, never out of order", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
			bundleRetry: { retryDelayMs: 5, timeoutMs: 500 },
			onBundleRetryStatus: (status) => statuses.push(status),
		});

		const statuses: Array<{ state: string; attempt: number }> = [];

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		let attempts = 0;
		seams.replaceLoadBundleScript(async () => {
			attempts++;
			if (attempts < 2) {
				throw new Error("first attempt fails");
			}
			(g.window as { pie?: unknown }).pie = {
				default: {
					"@pie-element/multiple-choice": {
						Element: createConstructorFor("pie-mc--version-11-0-1"),
					},
				},
			};
		});

		await ensureRegistered(
			{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
			{
				backend,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 200,
			},
		);

		const terminalIndex = statuses.findIndex(
			(s) => s.state === "completed" || s.state === "timeout",
		);
		expect(terminalIndex).toBe(statuses.length - 1);
		for (let i = 0; i < terminalIndex; i++) {
			expect(statuses[i]?.state).toBe("retrying");
		}
		let lastAttempt = 0;
		for (const s of statuses) {
			expect(s.attempt).toBeGreaterThanOrEqual(lastAttempt);
			lastAttempt = s.attempt;
		}
	});

	test("instrumentation emission: trackPageActions + ready provider receives retry / success events", async () => {
		const events: Array<{
			name: string;
			attributes: Record<string, unknown>;
		}> = [];

		const provider = {
			providerId: "test",
			providerName: "Test Provider",
			async initialize() {},
			trackError() {},
			trackEvent(name: string, attributes: Record<string, unknown>) {
				events.push({ name, attributes });
			},
			destroy() {},
			isReady() {
				return true;
			},
		};

		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
			bundleRetry: { retryDelayMs: 5, timeoutMs: 500 },
			trackPageActions: true,
			instrumentationProvider: provider,
		});

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		let attempts = 0;
		seams.replaceLoadBundleScript(async () => {
			attempts++;
			if (attempts < 2) {
				throw new Error("transient");
			}
			(g.window as { pie?: unknown }).pie = {
				default: {
					"@pie-element/multiple-choice": {
						Element: createConstructorFor("pie-mc--version-11-0-1"),
					},
				},
			};
		});

		await ensureRegistered(
			{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
			{
				backend,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 200,
			},
		);

		const eventNames = events.map((e) => e.name);
		expect(eventNames).toContain("pie-iife-bundle-retry");
		expect(eventNames).toContain("pie-iife-bundle-retry-success");
		const retryEvent = events.find((e) => e.name === "pie-iife-bundle-retry");
		expect(retryEvent?.attributes.url).toBeDefined();
		expect(retryEvent?.attributes.attempt).toBeGreaterThanOrEqual(1);
		expect(retryEvent?.attributes.timeoutMs).toBeDefined();
	});

	test("instrumentation emission on timeout: trackPageActions + ready provider receives retry-timeout + tracked error", async () => {
		const events: Array<{ name: string; attrs: Record<string, unknown> }> = [];
		const errors: Array<{
			message: string;
			attrs: Record<string, unknown>;
		}> = [];

		const provider = {
			providerId: "test",
			providerName: "Test Provider",
			async initialize() {},
			trackError(error: Error, attrs: Record<string, unknown>) {
				errors.push({ message: error.message, attrs });
			},
			trackEvent(name: string, attrs: Record<string, unknown>) {
				events.push({ name, attrs });
			},
			destroy() {},
			isReady() {
				return true;
			},
		};

		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
			bundleRetry: { retryDelayMs: 5, timeoutMs: 30 },
			trackPageActions: true,
			instrumentationProvider: provider,
		});

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			throw new Error("permanent");
		});

		await expect(
			ensureRegistered(
				{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
					loadTimeoutMs: 500,
				},
			),
		).rejects.toBeInstanceOf(ElementLoaderError);

		expect(events.map((e) => e.name)).toContain(
			"pie-iife-bundle-retry-timeout",
		);
		expect(errors.length).toBeGreaterThanOrEqual(1);
		expect(errors[0]?.attrs.component).toBe("iife-adapter");
		expect(errors[0]?.attrs.errorType).toBe("IifeBundleRetryError");
	});

	test("instrumentation suppressed when provider not ready", async () => {
		const events: string[] = [];

		const provider = {
			providerId: "test",
			providerName: "Test Provider",
			async initialize() {},
			trackError() {},
			trackEvent(name: string) {
				events.push(name);
			},
			destroy() {},
			isReady() {
				return false; // not ready — emission must be suppressed
			},
		};

		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
			bundleRetry: { retryDelayMs: 5, timeoutMs: 500 },
			trackPageActions: true,
			instrumentationProvider: provider,
		});

		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		let attempts = 0;
		seams.replaceLoadBundleScript(async () => {
			attempts++;
			if (attempts < 2) {
				throw new Error("transient");
			}
			(g.window as { pie?: unknown }).pie = {
				default: {
					"@pie-element/multiple-choice": {
						Element: createConstructorFor("pie-mc--version-11-0-1"),
					},
				},
			};
		});

		await ensureRegistered(
			{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
			{
				backend,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 200,
			},
		);

		expect(events).toEqual([]);
	});
});

// ─── ESM adapter — assertImportMapSupported error path ───────────────────────

describe("ESM adapter — assertImportMapSupported", () => {
	test("rejects with actionable message when HTMLScriptElement.supports('importmap') is false", async () => {
		// Override the global to report no import-map support, then run an
		// ESM load with import-map module resolution. The adapter must
		// surface an actionable error pointing the host at moduleResolution
		// or at switching strategy.
		g.HTMLScriptElement = class {
			static supports() {
				return false;
			}
		} as unknown as GlobalWithDom["HTMLScriptElement"];

		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			moduleResolution: "import-map",
			view: "delivery",
		});

		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		let importerCalls = 0;
		seams.replaceImporter(async () => {
			importerCalls++;
			return { default: createNonConstructor() };
		});

		let error: ElementLoaderError | undefined;
		try {
			await ensureRegistered(
				{ "pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1" },
				{
					backend,
					doc: createMockDocument(),
					whenDefinedTimeoutMs: 25,
				},
			);
		} catch (err) {
			error = err as ElementLoaderError;
		}

		expect(error).toBeInstanceOf(ElementLoaderError);
		const reason = error?.reasons.get("pie-mc--version-11-0-1");
		expect(reason).toBeTruthy();
		expect(reason?.kind).toBe("backend-rejected");
		if (reason?.kind === "backend-rejected") {
			expect(reason.cause).toMatch(/import map/i);
			expect(reason.cause).toMatch(/moduleResolution|iife|preloaded/);
		}
		// Importer never runs — assertion fires before any module resolution.
		expect(importerCalls).toBe(0);
	});
});

// ─── Cross-backend empty-config parity ───────────────────────────────────────

describe("empty-config parity across backends", () => {
	test("IIFE empty config resolves immediately", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
			needsControllers: true,
		});

		let bundleScriptCalls = 0;
		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			bundleScriptCalls++;
		});

		await ensureRegistered(
			{},
			{
				backend,
				doc: createMockDocument(),
			},
		);

		expect(bundleScriptCalls).toBe(0);
	});

	test("ESM empty config resolves immediately", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "delivery",
		});

		let importerCalls = 0;
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.replaceImporter(async () => {
			importerCalls++;
			return {};
		});

		await ensureRegistered(
			{},
			{
				backend,
				doc: createMockDocument(),
			},
		);

		expect(importerCalls).toBe(0);
	});
});
