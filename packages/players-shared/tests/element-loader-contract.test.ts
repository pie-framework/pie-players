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
 * Every test here corresponds to a real failure mode in the legacy
 * IifePieLoader / EsmPieLoader families where the load promise resolved
 * while tags were not actually registered. The primitive is expected to
 * catch each of these through a combination of adapter-level rejections
 * and a post-load `customElements.whenDefined` verification pass.
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
	};
};

const g = globalThis as GlobalWithDom;

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

	g.customElements = {
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
	};

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

	test(
		"resolves iff every requested tag is in customElements after the backend returns",
		async () => {
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
		},
	);

	test(
		"rejects with ElementLoaderError when the backend resolves but a tag was never registered",
		async () => {
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
		},
	);

	test(
		"partial-success rejection carries {unregisteredTags, reasons} for every missing tag",
		async () => {
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
		},
	);

	test(
		"whenDefined timeout is always a rejection, never silently swallowed",
		async () => {
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
		},
	);

	test(
		"concurrent identical requests share one backend call (dedup)",
		async () => {
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
		},
	);

	test(
		"concurrent different requests are NOT deduplicated against each other",
		async () => {
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
		},
	);

	test(
		"dedup cache clears after rejection so a subsequent retry re-invokes the backend",
		async () => {
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
		},
	);
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

	test(
		"throws ElementAssertionError with expected, missing, and currently-registered tags",
		() => {
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
			expect(error?.currentlyRegisteredTags).toContain(
				"pie-a--version-1-0-0",
			);
			expect(error?.currentlyRegisteredTags).toContain(
				"pie-unrelated--version-9-9-9",
			);
			expect(error?.message).toContain("missing");
			expect(error?.message).toContain("pie-b--version-2-0-0");
			expect(error?.message).toContain("pie-c--version-3-0-0");
		},
	);

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

	test(
		"rejects when an element class is not a valid custom element constructor",
		async () => {
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
		},
	);

	test(
		"rejects when requested package is missing from the loaded IIFE bundle",
		async () => {
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
		},
	);

	test(
		"concurrent IIFE loads of the same bundle share one fetch AND both callers observe correct registration",
		async () => {
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
		},
	);
});

// ─── ESM adapter — per-failure-mode contract ─────────────────────────────────

describe("ESM adapter — contract", () => {
	test(
		"whenDefined wait is bounded — never hangs when a module fails to register its tag",
		async () => {
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
		},
	);

	test(
		"rejects when the imported module's element export is not a valid constructor",
		async () => {
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
		},
	);

	test(
		"import-map mode: a second load() call with new elements extends the map (does not silently assume prior map covers)",
		async () => {
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
		},
	);

	test(
		"ESM: empty element map resolves immediately without fetching or injecting anything",
		async () => {
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
		},
	);
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
