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
	AdapterFailure,
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
	mapEsmViewElements,
	resolveEsmRuntimeSupportUrl,
	type EsmBackendConfig,
	type EsmBackendTestSeams,
	type EsmCdnProvider,
} from "../src/loaders/esm-adapter.js";
import { BundleType, Status } from "../src/pie/types.js";
import { writeRegistryEntry } from "../src/pie/registry.js";
import { findPieController } from "../src/pie/scoring.js";
import { registerPreloadedElements } from "../src/loaders/preloaded-registration.js";
import { ElementPackagePolicyError } from "../src/loaders/element-package-policy.js";

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

type ScriptStub = {
	type?: string;
	textContent?: string;
	getAttribute(name: string): string | null;
	setAttribute(name: string, value: string): void;
};

function createScriptStub(
	init: { type?: string; textContent?: string } = {},
): ScriptStub {
	const attributes = new Map<string, string>();
	return {
		...init,
		getAttribute: (name) => attributes.get(name) ?? null,
		setAttribute: (name, value) => {
			attributes.set(name, value);
		},
	};
}

/** A document whose import maps `querySelectorAll` reports, the host's first. */
function createImportMapDocument(
	hostImports: Record<string, string>[] = [],
): Document {
	const maps: ScriptStub[] = hostImports.map((imports) =>
		createScriptStub({
			type: "importmap",
			textContent: JSON.stringify({ imports }),
		}),
	);
	return {
		head: {
			appendChild: (el: unknown) => {
				maps.push(el as ScriptStub);
				return el;
			},
		},
		createElement: () => createScriptStub(),
		querySelector: () => null,
		querySelectorAll: (selector: string) =>
			(selector === 'script[type="importmap"]'
				? maps.filter((script) => script.type === "importmap")
				: []) as unknown as NodeListOf<Element>,
	} as unknown as Document;
}

const REACT_SHARED_SPECIFIERS = [
	"react",
	"react/jsx-runtime",
	"react/jsx-dev-runtime",
	"react-dom",
	"react-dom/client",
];

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

	test("package policy rejects before the already-registered fast path", async () => {
		const registry = installScriptedCustomElements();
		const tagName = "pie-already-there--version-policy-1-0-0";
		registry.define(tagName, createConstructorFor(tagName));

		let backendCalls = 0;
		const fake: ElementLoaderBackend = {
			async load() {
				backendCalls++;
			},
		};

		await expect(
			ensureRegistered(
				{ [tagName]: "attacker-controlled-package@1.0.0" },
				{
					backend: fake,
					doc: createMockDocument(),
					elementPackagePolicy: {
						allowedPackages: ["@pie-element/multiple-choice"],
					},
				},
			),
		).rejects.toBeInstanceOf(ElementPackagePolicyError);
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

	const registerLoaded = (tag: string, spec: string) => {
		g.customElements?.define(tag, createConstructorFor(tag));
		writeRegistryEntry({
			package: spec,
			status: Status.loaded,
			tagName: tag,
			bundleType: BundleType.player,
		});
	};

	const assertionErrorOf = (
		tags: Parameters<typeof assertRegistered>[0],
	): ElementAssertionError | undefined => {
		try {
			assertRegistered(tags);
		} catch (err) {
			return err as ElementAssertionError;
		}
		return undefined;
	};

	test("throws ElementAssertionError with expected, missing, and currently-registered tags", () => {
		registerLoaded("pie-a--version-1-0-0", "@pie-element/a@1.0.0");
		registerLoaded(
			"pie-unrelated--version-9-9-9",
			"@pie-element/unrelated@9.9.9",
		);

		const error = assertionErrorOf([
			"pie-a--version-1-0-0",
			"pie-b--version-2-0-0",
			"pie-c--version-3-0-0",
		]);

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
		expect(error?.currentlyRegisteredTags).toEqual([
			"pie-a--version-1-0-0",
			"pie-unrelated--version-9-9-9",
		]);
		expect(error?.message).toContain("missing");
		expect(error?.message).toContain("pie-b--version-2-0-0");
		expect(error?.message).toContain("pie-c--version-3-0-0");
	});

	test("names the tags a missing tag's package is registered under", () => {
		registerLoaded("pie-b--version-1-9-0", "@pie-element/b@1.9.0");
		registerLoaded(
			"pie-unrelated--version-9-9-9",
			"@pie-element/unrelated@9.9.9",
		);

		const error = assertionErrorOf({
			"pie-b--version-2-0-0": "@pie-element/b@2.0.0",
			"pie-c--version-3-0-0": "@pie-element/c@3.0.0",
		});

		expect(error?.missingTags).toEqual([
			"pie-b--version-2-0-0",
			"pie-c--version-3-0-0",
		]);
		expect(error?.message).toBe(
			"ElementLoader.assertRegistered: missing [pie-b--version-2-0-0, pie-c--version-3-0-0] " +
				"of [pie-b--version-2-0-0, pie-c--version-3-0-0]; " +
				"@pie-element/b is registered as [pie-b--version-1-9-0]; " +
				"nothing is registered for @pie-element/c.",
		);
	});

	test("without packages, names the tags registered under a missing tag's base tag", () => {
		registerLoaded("pie-b--version-1-9-0", "@pie-element/b@1.9.0");
		g.customElements?.define("pie-b", createConstructorFor("pie-b"));

		const error = assertionErrorOf(["pie-b--version-2-0-0", "pie-c"]);

		expect(error?.message).toContain(
			"pie-b is registered as [pie-b--version-1-9-0, pie-b]",
		);
		expect(error?.message).toContain("nothing is registered for pie-c");
	});

	test("empty tag list is a no-op", () => {
		expect(() => assertRegistered([])).not.toThrow();
		expect(() => assertRegistered({})).not.toThrow();
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

	test("rejects multiple specs for one IIFE package instead of aliasing both tags", async () => {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.clientPlayer,
		});
		let bundleLoads = 0;
		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		seams.replaceLoadBundleScript(async () => {
			bundleLoads++;
		});

		const promise = ensureRegistered(
			{
				"pie-mc--version-11-0-1": "@pie-element/multiple-choice@11.0.1",
				"pie-mc--version-12-0-0": "@pie-element/multiple-choice@12.0.0",
			},
			{
				backend,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 25,
			},
		);

		await expect(promise).rejects.toBeInstanceOf(ElementLoaderError);
		await promise.catch((error: ElementLoaderError) => {
			expect(error.unregisteredTags).toEqual(
				new Set(["pie-mc--version-11-0-1", "pie-mc--version-12-0-0"]),
			);
			for (const reason of error.reasons.values()) {
				expect(reason.kind).toBe("backend-rejected");
			}
		});
		expect(bundleLoads).toBe(0);
	});
});

// ─── IIFE adapter — bundle URL encoding ──────────────────────────────────────

describe("IIFE adapter — bundle URL encoding", () => {
	/**
	 * Drive one load and return the URL the adapter asked the bundle loader
	 * for. The loader resolves without publishing `window.pie`, so the load
	 * always fails after the URL is built — which is all these tests read.
	 */
	async function capturedBundleUrl(elements: Record<string, string>) {
		const backend = createIifeBackend({
			kind: "iife",
			bundleHost: "https://example.test/bundles/",
			bundleType: BundleType.player,
		});
		const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
			.__seams;
		let requested = "";
		seams.replaceLoadBundleScript(async (url) => {
			requested = url;
		});

		await backend
			.load(elements, {
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 25,
			})
			.catch(() => undefined);

		return requested;
	}

	test("keeps a scoped spec's `/` and `@` literal in the path", async () => {
		const url = await capturedBundleUrl({
			"pie-mc--version-9-9-1": "@pie-element/multiple-choice@9.9.1",
		});

		expect(url).toBe(
			"https://example.test/bundles/@pie-element/multiple-choice@9.9.1/player.js?elements=pie-mc--version-9-9-1",
		);
	});

	test("joins a multi-element list with a literal `+`", async () => {
		const url = await capturedBundleUrl({
			"pie-mc--version-9-9-1": "@pie-element/multiple-choice@9.9.1",
			"pie-hotspot--version-9-1-0": "@pie-element/hotspot@9.1.0",
		});

		expect(url).toBe(
			"https://example.test/bundles/@pie-element/multiple-choice@9.9.1+@pie-element/hotspot@9.1.0/player.js?elements=pie-hotspot--version-9-1-0%2Cpie-mc--version-9-9-1",
		);
	});

	test("a `#` in a spec no longer truncates the URL at a fragment", async () => {
		const url = await capturedBundleUrl({
			"pie-mc--version-1-0-0": "@pie-element/mc@1.0.0#frag",
		});

		expect(url).toContain("@pie-element/mc@1.0.0%23frag/player.js");
		expect(new URL(url).hash).toBe("");
		expect(new URL(url).searchParams.get("elements")).toBe(
			"pie-mc--version-1-0-0",
		);
	});

	test("a `?` in a spec no longer swallows the real `elements=` parameter", async () => {
		const url = await capturedBundleUrl({
			"pie-mc--version-1-0-0": "@pie-element/mc@1.0.0?elements=evil",
		});

		expect(url).toContain("@pie-element/mc@1.0.0%3Felements%3Devil/player.js");
		expect(new URL(url).searchParams.get("elements")).toBe(
			"pie-mc--version-1-0-0",
		);
	});

	test("a `..` spec segment no longer escapes the bundles route", async () => {
		const url = await capturedBundleUrl({
			"pie-mc--version-1-0-0": "@pie-element/../../evil@1.0.0",
		});

		expect(new URL(url).pathname).toBe(
			"/bundles/@pie-element%2F..%2F..%2Fevil@1.0.0/player.js",
		);
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
				whenDefinedTimeoutMs: 50,
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

	test("author view registers the requested versioned config tag without double suffixing", async () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			view: "author",
		});

		const imported: string[] = [];
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			return {
				default: createConstructorFor("pie-mc--version-13-2-0-config"),
				Configure: createConstructorFor("pie-mc--version-13-2-0-config"),
			};
		});

		await ensureRegistered(
			{
				"pie-mc--version-13-2-0-config": "@pie-element/multiple-choice@13.2.0",
			},
			{
				backend,
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 25,
			},
		);

		expect(imported).toEqual([
			"https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/author/index.js",
			"https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/controller/index.js",
		]);
		expect(
			g.customElements?.get("pie-mc--version-13-2-0-config"),
		).toBeDefined();
		expect(
			g.customElements?.get("pie-mc--version-13-2-0-config-config"),
		).toBeUndefined();
	});

	test("maps requested element tags through generic ESM view configuration", () => {
		const elements = {
			"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
		};

		expect(mapEsmViewElements(elements, "delivery")).toEqual(elements);
		expect(mapEsmViewElements(elements, "author")).toEqual({
			"pie-mc--version-13-2-0-config": "@pie-element/multiple-choice@13.2.0",
		});
		expect(
			mapEsmViewElements(
				{
					"pie-mc--version-1-0-0-config":
						"@pie-element/multiple-choice@1.0.0-config",
				},
				"author",
			),
		).toEqual({
			"pie-mc--version-1-0-0-config-config":
				"@pie-element/multiple-choice@1.0.0-config",
		});
		expect(
			mapEsmViewElements(elements, "rubric", {
				subpath: "/rubric",
				tagSuffix: "-rubric",
			}),
		).toEqual({
			"pie-mc--version-13-2-0-rubric": "@pie-element/multiple-choice@13.2.0",
		});
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

	test("url mode does not require React metadata for browser ESM packages without React deps", async () => {
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
		seams.replacePackageMetadataLoader(async () => ({
			exports: {
				"./browser/delivery": {
					default: "./dist/browser/delivery/index.js",
				},
				"./browser/controller": {
					default: "./dist/browser/controller/index.js",
				},
			},
		}));
		seams.observeImportMapInjection((mapJson) => {
			injectedMaps.push(mapJson);
		});
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			return {
				default: createConstructorFor("simple-cloze--version-0-1-4"),
			};
		});

		await backend.load(
			{
				"simple-cloze--version-0-1-4": "@pie-element/simple-cloze@0.1.4",
			},
			{
				doc: createMockDocument(),
				whenDefinedTimeoutMs: 50,
			},
		);

		expect(injectedMaps).toEqual([]);
		expect(imported).toEqual([
			"https://cdn.jsdelivr.net/npm/@pie-element/simple-cloze@0.1.4/dist/browser/delivery/index.js",
			"https://cdn.jsdelivr.net/npm/@pie-element/simple-cloze@0.1.4/dist/browser/controller/index.js",
		]);
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
		let importerCalls = 0;
		seams.replaceImporter(async () => {
			importerCalls++;
			return {};
		});

		const tag = "pie-math-inline--version-12-1-0";
		const error = await backend
			.load(
				{ [tag]: "@pie-element/math-inline@12.1.0" },
				{ doc: createMockDocument() },
			)
			.then(
				() => undefined,
				(err: unknown) => err as AdapterFailure,
			);

		expect(error).toBeInstanceOf(AdapterFailure);
		const reason = error?.reasons.get(tag);
		expect(reason?.kind).toBe("module-load-failed");
		if (reason?.kind === "module-load-failed") {
			expect(reason.cause).toMatch(
				/does not publish browser ESM export \.\/browser\/delivery/,
			);
		}
		expect(importerCalls).toBe(0);
	});

	test("a package missing the view's browser export fails alone, reported as a missing export", async () => {
		const trackedErrors: Array<Record<string, unknown>> = [];
		const provider = {
			providerId: "test",
			providerName: "Test Provider",
			async initialize() {},
			trackError(_error: Error, attributes: Record<string, unknown>) {
				trackedErrors.push(attributes);
			},
			trackEvent() {},
			destroy() {},
			isReady() {
				return true;
			},
		};
		const logged: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) => {
			logged.push(args.map(String).join(" "));
		};
		try {
			const backend = createEsmBackend({
				kind: "esm",
				cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
				view: "author",
				trackPageActions: true,
				instrumentationProvider: provider,
			});
			const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
				.__seams;
			seams.replacePackageMetadataLoader(async (packageVersion) => ({
				exports: {
					"./browser/delivery": "./dist/browser/delivery/index.js",
					"./browser/controller": "./dist/browser/controller/index.js",
					...(packageVersion.includes("match-list")
						? {}
						: { "./browser/author": "./dist/browser/author/index.js" }),
				},
				pie: {
					browserSharedDependencies: { react: "18.2.0", "react-dom": "18.2.0" },
				},
			}));
			seams.replaceImporter(async (specifier) => ({
				default: createConstructorFor(specifier),
			}));

			let error: ElementLoaderError | undefined;
			try {
				await ensureRegistered(
					{
						"pie-mc--version-13-4-0-config":
							"@pie-element/multiple-choice@13.4.0",
						"pie-match-list--version-7-1-2-config":
							"@pie-element/match-list@7.1.2",
					},
					{ backend, doc: createMockDocument(), whenDefinedTimeoutMs: 25 },
				);
			} catch (err) {
				error = err as ElementLoaderError;
			}

			expect(error).toBeInstanceOf(ElementLoaderError);
			expect([...(error?.unregisteredTags ?? [])]).toEqual([
				"pie-match-list--version-7-1-2-config",
			]);
			const reason = error?.reasons.get("pie-match-list--version-7-1-2-config");
			expect(reason?.kind).toBe("module-load-failed");
			if (reason?.kind === "module-load-failed") {
				expect(reason.cause).toBe(
					"@pie-element/match-list@7.1.2 does not publish browser ESM export ./browser/author; use IIFE/preloaded mode or publish browser ESM artifacts first",
				);
			}
			expect(
				g.customElements?.get("pie-mc--version-13-4-0-config"),
			).toBeDefined();
			expect(logged).toEqual([
				"[pie-esm] @pie-element/match-list@7.1.2 does not publish browser ESM export ./browser/author; use IIFE/preloaded mode or publish browser ESM artifacts first",
			]);
			expect(trackedErrors).toEqual([]);
		} finally {
			console.error = originalError;
		}
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

	test("url mode orders React prereleases by semver precedence", async () => {
		const reactVersion = (packageVersion: string) =>
			packageVersion.includes("choice") ? "18.3.0-next.9" : "18.3.0-next.10";
		const createBackend = () => {
			const backend = createEsmBackend({
				kind: "esm",
				cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
				loadControllers: false,
			});
			const injected: string[] = [];
			const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
				.__seams;
			seams.observeImportMapInjection((json) => {
				injected.push(json);
			});
			seams.replacePackageMetadataLoader(async (packageVersion) => ({
				pie: {
					browserSharedDependencies: {
						react: reactVersion(packageVersion),
						"react-dom": reactVersion(packageVersion),
					},
				},
			}));
			seams.replaceImporter(async (specifier) => ({
				default: createConstructorFor(specifier),
			}));
			return { backend, injected };
		};
		const originalWarn = console.warn;
		console.warn = () => {};
		try {
			const batch = createBackend();
			await batch.backend.load(
				{
					"pie-mc--version-13-2-0": "@pie-element/multiple-choice@13.2.0",
					"pie-passage--version-3-2-4": "@pie-element/passage@3.2.4",
				},
				{ doc: createMockDocument() },
			);
			expect(JSON.parse(batch.injected[0] ?? "{}").imports.react).toBe(
				"https://cdn.jsdelivr.net/npm/react@18.3.0-next.10/+esm",
			);

			const sequential = createBackend();
			await sequential.backend.load(
				{ "pie-mc--version-13-2-1": "@pie-element/multiple-choice@13.2.1" },
				{ doc: createMockDocument() },
			);
			await expect(
				sequential.backend.load(
					{ "pie-passage--version-3-2-5": "@pie-element/passage@3.2.5" },
					{ doc: createMockDocument() },
				),
			).rejects.toThrow(/requires higher version 18\.3\.0-next\.10/);
		} finally {
			console.warn = originalWarn;
		}
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

// ─── PIE_REGISTRY — one writer for every registration path ──────────────────

describe("PIE_REGISTRY entries", () => {
	const registryOf = () =>
		(g.window as { PIE_REGISTRY?: Record<string, any> }).PIE_REGISTRY ?? {};

	test("writeRegistryEntry keeps the first loaded entry of a defined tag and fills only what it lacks", () => {
		const tag = "pie-first--version-1-0-0";
		const First = createConstructorFor(tag);
		g.customElements?.define(tag, First);
		const controller = { model: async (model: unknown) => model } as any;

		const first = writeRegistryEntry({
			package: "@pie-element/first@1.0.0",
			status: Status.loaded,
			tagName: tag,
			element: First,
			bundleType: BundleType.player,
		});
		const filled = writeRegistryEntry({
			package: "@pie-element/first@1.0.0",
			status: Status.loaded,
			tagName: tag,
			element: createConstructorFor(tag),
			controller,
			config: { configured: true },
			bundleType: BundleType.clientPlayer,
		});
		const kept = writeRegistryEntry({
			package: "@pie-element/first@1.0.0",
			status: Status.loaded,
			tagName: tag,
			element: createConstructorFor(tag),
			controller: { model: async () => ({}) } as any,
			bundleType: BundleType.esm,
		});

		expect(first.controller).toBeUndefined();
		expect(filled).toEqual({
			package: "@pie-element/first@1.0.0",
			status: Status.loaded,
			tagName: tag,
			element: First,
			controller,
			config: { configured: true },
			bundleType: BundleType.clientPlayer,
		});
		expect(kept).toBe(filled);
		expect(registryOf()[tag]).toBe(filled);
	});

	test("writeRegistryEntry replaces a loading entry and one whose tag is not defined", () => {
		const loading = writeRegistryEntry({
			package: "@pie-element/loading@1.0.0",
			status: Status.loading,
			tagName: "pie-loading--version-1-0-0",
		});
		const loaded = { ...loading, status: Status.loaded };
		expect(writeRegistryEntry(loaded)).toBe(loaded);

		const replacement = { ...loaded, package: "@pie-element/loading@1.0.1" };
		expect(writeRegistryEntry(replacement)).toBe(replacement);
	});

	test("a player.js IIFE load keeps the controller an earlier client-player.js load recorded", async () => {
		const tag = "pie-kept--version-1-0-0";
		const controller = {
			model: async (model: unknown) => model,
			outcome: async () => ({}),
		};
		const Element = createConstructorFor(tag);
		const bundle = { "@pie-element/kept": { Element, controller } };
		const backends = [
			createIifeBackend({
				kind: "iife",
				bundleHost: "https://example.test/bundles/",
				bundleType: BundleType.clientPlayer,
				needsControllers: true,
			}),
			createIifeBackend({
				kind: "iife",
				bundleHost: "https://example.test/bundles/",
				bundleType: BundleType.player,
				needsControllers: false,
			}),
		];
		for (const backend of backends) {
			const seams = (backend as unknown as { __seams: IifeBackendTestSeams })
				.__seams;
			seams.replaceLoadBundleScript(async () => {
				(g.window as { pie?: unknown }).pie = { default: bundle };
			});
			await backend.load(
				{ [tag]: "@pie-element/kept@1.0.0" },
				{ doc: createMockDocument(), whenDefinedTimeoutMs: 25 },
			);
		}

		expect(registryOf()[tag]?.bundleType).toBe(BundleType.clientPlayer);
		expect(findPieController(tag, BundleType.clientPlayer)).toBe(
			controller as any,
		);
	});

	test("an ESM load records BundleType.esm", async () => {
		const tag = "pie-esm-entry--version-1-0-0";
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			loadControllers: false,
		});
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.replaceImporter(async () => ({ default: createConstructorFor(tag) }));

		await backend.load(
			{ [tag]: "@pie-element/esm-entry@1.0.0" },
			{ doc: createMockDocument() },
		);

		expect(registryOf()[tag]?.bundleType).toBe(BundleType.esm);
	});

	test("an ESM load of a tag already registered keeps that entry and fills its controller", async () => {
		const tag = "pie-mc--version-13-2-0";
		const Preloaded = createConstructorFor(tag);
		registerPreloadedElements([
			{
				tag: "pie-mc",
				package: "@pie-element/multiple-choice",
				version: "13.2.0",
				element: Preloaded,
			},
		]);
		const controller = { model: async (model: unknown) => model };
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
		});
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.replaceImporter(async (specifier) =>
			specifier.includes("/controller/")
				? controller
				: { default: createConstructorFor(tag) },
		);

		await backend.load(
			{ [tag]: "@pie-element/multiple-choice@13.2.0" },
			{ doc: createMockDocument() },
		);

		const entry = registryOf()[tag];
		expect(entry?.element).toBe(Preloaded);
		expect(entry?.controller).toBe(controller);
		expect(entry?.bundleType).toBe(BundleType.esm);
	});
});

// ─── ESM adapter — import maps already in the document ──────────────────────

describe("ESM adapter — existing import maps", () => {
	const reactBackend = () => {
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: "https://cdn.jsdelivr.net/npm",
			loadControllers: false,
		});
		const injected: string[] = [];
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.observeImportMapInjection((json) => {
			injected.push(json);
		});
		seams.replacePackageMetadataLoader(async () => ({
			pie: {
				browserSharedDependencies: { react: "18.2.0", "react-dom": "18.2.0" },
			},
		}));
		seams.replaceImporter(async (specifier) => ({
			default: createConstructorFor(specifier),
		}));
		return { backend, injected };
	};

	test("injects no map when the page's own map already maps every shared specifier", async () => {
		const doc = createImportMapDocument([
			Object.fromEntries(
				REACT_SHARED_SPECIFIERS.map((specifier) => [
					specifier,
					`https://host.test/${specifier}.js`,
				]),
			),
		]);
		const { backend, injected } = reactBackend();

		await backend.load(
			{ "pie-own-map--version-1-0-0": "@pie-element/own-map@1.0.0" },
			{ doc },
		);

		expect(injected).toEqual([]);
		expect(g.customElements?.get("pie-own-map--version-1-0-0")).toBeDefined();
	});

	test("injects only the specifiers the page leaves unmapped", async () => {
		const doc = createImportMapDocument([
			{ react: "https://host.test/react.js" },
		]);
		const { backend, injected } = reactBackend();

		await backend.load(
			{ "pie-partial-map--version-1-0-0": "@pie-element/partial-map@1.0.0" },
			{ doc },
		);

		expect(injected).toHaveLength(1);
		expect(Object.keys(JSON.parse(injected[0]).imports).sort()).toEqual(
			REACT_SHARED_SPECIFIERS.filter(
				(specifier) => specifier !== "react",
			).sort(),
		);
	});

	test("a second player's loader on the page injects no specifier the first mapped", async () => {
		const doc = createImportMapDocument();
		const first = reactBackend();
		const second = reactBackend();

		await first.backend.load(
			{ "pie-first-player--version-1-0-0": "@pie-element/first-player@1.0.0" },
			{ doc },
		);
		await second.backend.load(
			{
				"pie-second-player--version-1-0-0": "@pie-element/second-player@1.0.0",
			},
			{ doc },
		);

		expect(first.injected).toHaveLength(1);
		expect(second.injected).toEqual([]);
	});
});

// ─── ESM adapter — shared editor runtime ─────────────────────────────────────

describe("ESM adapter — shared editor runtime", () => {
	const CDN = "https://cdn.jsdelivr.net/npm";
	const RUNTIME = "@pie-element/shared-editor-runtime";
	const RUNTIME_MODULES = {
		"@tiptap/core": "tiptap-core",
		"@tiptap/pm/state": "tiptap-pm-state",
		"prosemirror-state": "prosemirror-state",
	};
	const VARIANT_VIEWS = {
		delivery: "editor-runtime/delivery",
		author: "editor-runtime/author",
		print: "editor-runtime/print",
		controller: "editor-runtime/controller",
	};
	const MC = "@pie-element/multiple-choice@13.4.0-next.15";
	const MC_TAG = "pie-mc--version-13-4-0-next-15";
	const EBSR = "@pie-element/ebsr@14.2.2-next.20";
	const EBSR_TAG = "pie-ebsr--version-14-2-2-next-20";
	const VENN = "@pie-element/venn-classification@0.1.1-next.11";
	const VENN_TAG = "pie-venn--version-0-1-1-next-11";
	/** Published before elements declared a variant. */
	const PASSAGE = "@pie-element/passage@7.1.2-next.17";
	const PASSAGE_TAG = "pie-passage--version-7-1-2-next-17";

	const url = (packageVersion: string, view: string) =>
		`${CDN}/${packageVersion}/dist/browser/${view}/index.js`;
	const runtimeImports = (version: string, base = CDN) =>
		Object.fromEntries(
			Object.entries(RUNTIME_MODULES).map(([specifier, view]) => [
				specifier,
				`${base}/${RUNTIME}@${version}/dist/browser/${view}/index.js`,
			]),
		);

	const standardExports = {
		"./browser/delivery": "./dist/browser/delivery/index.js",
		"./browser/author": "./dist/browser/author/index.js",
		"./browser/print": "./dist/browser/print/index.js",
		"./browser/controller": "./dist/browser/controller/index.js",
	};
	const react = {
		browserSharedDependencies: { react: "18.2.0", "react-dom": "18.2.0" },
	};
	const declaring = (
		version: string,
		overrides: Record<string, unknown> = {},
	) => ({
		exports: standardExports,
		pie: {
			...react,
			browserEditorRuntime: {
				name: RUNTIME,
				version,
				views: VARIANT_VIEWS,
				...overrides,
			},
		},
	});
	const svelteDeclaring = (version: string, views: Record<string, string>) => ({
		exports: standardExports,
		pie: { browserEditorRuntime: { name: RUNTIME, version, views } },
	});
	const undeclared = { exports: standardExports, pie: react };
	const runtimePackage = (modules: unknown = RUNTIME_MODULES) => ({
		name: RUNTIME,
		exports: { "./package.json": "./package.json" },
		pie: { browserModules: modules },
	});

	let warnings: string[];
	let originalWarn: typeof console.warn;
	beforeEach(() => {
		warnings = [];
		originalWarn = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(String(args[0]));
		};
	});
	afterEach(() => {
		console.warn = originalWarn;
	});

	/**
	 * A backend whose package metadata comes from `packages`: an entry that is
	 * an Error throws, a missing one reads as a failed fetch.
	 */
	function harness(
		packages: Record<string, unknown>,
		options: {
			config?: Partial<EsmBackendConfig>;
			failImport?: (specifier: string) => boolean;
		} = {},
	) {
		const injected: string[] = [];
		const imported: string[] = [];
		const metadataRequests: string[] = [];
		const events: Array<{ name: string; attributes: Record<string, unknown> }> =
			[];
		const backend = createEsmBackend({
			kind: "esm",
			cdnBaseUrl: CDN,
			trackPageActions: true,
			instrumentationProvider: {
				providerId: "test",
				providerName: "Test Provider",
				async initialize() {},
				trackError() {},
				trackEvent(name: string, attributes: Record<string, unknown>) {
					events.push({ name, attributes });
				},
				destroy() {},
				isReady: () => true,
			} as unknown as EsmBackendConfig["instrumentationProvider"],
			...options.config,
		});
		const seams = (backend as unknown as { __seams: EsmBackendTestSeams })
			.__seams;
		seams.observeImportMapInjection((json) => {
			injected.push(json);
		});
		seams.replacePackageMetadataLoader(async (packageVersion, jsonUrl) => {
			metadataRequests.push(jsonUrl);
			const metadata = packages[packageVersion];
			if (metadata instanceof Error) throw metadata;
			return (metadata ?? null) as never;
		});
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			if (options.failImport?.(specifier)) {
				throw new TypeError(
					`Failed to fetch dynamically imported module: ${specifier}`,
				);
			}
			return { default: createConstructorFor(specifier) };
		});
		return { backend, injected, imported, metadataRequests, events };
	}

	const injectedImports = (injected: string[]) =>
		Object.assign(
			{},
			...injected.map((json) => JSON.parse(json).imports as object),
		) as Record<string, string>;
	const mappedRuntimes = (doc: Document) =>
		Array.from(doc.querySelectorAll('script[type="importmap"]'))
			.map((script) => script.getAttribute("data-pie-editor-runtime"))
			.filter(Boolean);
	const runtimeRequests = (requests: string[]) =>
		requests.filter((request) => request.includes(RUNTIME));
	const fallbackWarning = (packageVersion: string, reason: string) =>
		`[pie-esm] ${packageVersion} loads ./browser/* in place of its editor-runtime variant: ${reason}`;

	test("url mode loads declared variants and maps the runtime once for React and Svelte elements", async () => {
		const doc = createImportMapDocument();
		const delivery = harness({
			[MC]: declaring("0.1.1-next.0"),
			[VENN]: svelteDeclaring("0.1.1-next.0", {
				author: "editor-runtime/author",
				delivery: "editor-runtime/delivery",
				controller: "editor-runtime/controller",
			}),
			[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
		});

		await delivery.backend.load({ [MC_TAG]: MC, [VENN_TAG]: VENN }, { doc });

		expect(delivery.imported.sort()).toEqual(
			[
				url(MC, "editor-runtime/delivery"),
				url(MC, "editor-runtime/controller"),
				url(VENN, "editor-runtime/delivery"),
				url(VENN, "editor-runtime/controller"),
			].sort(),
		);
		expect(delivery.injected).toHaveLength(1);
		const imports = injectedImports(delivery.injected);
		expect(Object.keys(imports).sort()).toEqual(
			[...REACT_SHARED_SPECIFIERS, ...Object.keys(RUNTIME_MODULES)].sort(),
		);
		expect(imports).toMatchObject(runtimeImports("0.1.1-next.0"));
		expect(runtimeRequests(delivery.metadataRequests)).toEqual([
			`${CDN}/${RUNTIME}@0.1.1-next.0/package.json`,
		]);
		expect(mappedRuntimes(doc)).toEqual([`${RUNTIME}@0.1.1-next.0`]);
		expect(warnings).toEqual([]);
		expect(g.customElements?.get(MC_TAG)).toBeDefined();
		expect(g.customElements?.get(VENN_TAG)).toBeDefined();

		// Another view's backend on the page serves from the same runtime.
		const author = harness(
			{
				[MC]: declaring("0.1.1-next.0"),
				[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
			},
			{ config: { view: "author" } },
		);
		await author.backend.load({ [`${MC_TAG}-config`]: MC }, { doc });

		expect(author.imported).toEqual([
			url(MC, "editor-runtime/author"),
			url(MC, "editor-runtime/controller"),
		]);
		expect(author.injected).toEqual([]);
		expect(runtimeRequests(author.metadataRequests)).toEqual([]);
		expect(warnings).toEqual([]);
	});

	test("a custom provider addresses the runtime's metadata, modules and every variant", async () => {
		const sharedDependencies: string[] = [];
		const cdnProvider: EsmCdnProvider = {
			name: "local",
			packageJsonUrl: (pv) => `https://meta.test/${pv}`,
			browserViewUrl: (pv, view) => `https://files.test/${pv}/${view}.mjs`,
			browserControllerUrl: (pv) => `https://files.test/${pv}/controller.mjs`,
			sharedDependencyUrl: (dependency, version, subpath) => {
				sharedDependencies.push(dependency);
				return `https://deps.test/${dependency}@${version}${subpath ? `/${subpath}` : ""}`;
			},
		};
		const doc = createImportMapDocument();
		const { backend, injected, imported, metadataRequests } = harness(
			{
				[MC]: declaring("0.1.1-next.0"),
				[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
			},
			{ config: { cdnBaseUrl: "https://ignored.test", cdnProvider } },
		);

		await backend.load({ [MC_TAG]: MC }, { doc });

		expect(runtimeRequests(metadataRequests)).toEqual([
			`https://meta.test/${RUNTIME}@0.1.1-next.0`,
		]);
		const imports = injectedImports(injected);
		for (const [specifier, view] of Object.entries(RUNTIME_MODULES)) {
			expect(imports[specifier]).toBe(
				`https://files.test/${RUNTIME}@0.1.1-next.0/${view}.mjs`,
			);
		}
		expect(new Set(sharedDependencies)).toEqual(
			new Set(["react", "react-dom"]),
		);
		expect(imported).toEqual([
			`https://files.test/${MC}/editor-runtime/delivery.mjs`,
			`https://files.test/${MC}/editor-runtime/controller.mjs`,
		]);
	});

	test("import-map mode keeps ./browser/* and maps no runtime", async () => {
		const doc = createImportMapDocument();
		const { backend, injected, imported, metadataRequests } = harness(
			{
				[MC]: declaring("0.1.1-next.0"),
				[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
			},
			{ config: { moduleResolution: "import-map" } },
		);

		await backend.load({ [MC_TAG]: MC }, { doc });

		expect(imported).toEqual([
			"@pie-element/multiple-choice",
			"@pie-element/multiple-choice/controller",
		]);
		const imports = injectedImports(injected);
		expect(imports["@pie-element/multiple-choice"]).toBe(url(MC, "delivery"));
		for (const specifier of Object.keys(RUNTIME_MODULES)) {
			expect(imports[specifier]).toBeUndefined();
		}
		expect(runtimeRequests(metadataRequests)).toEqual([]);
		expect(mappedRuntimes(doc)).toEqual([]);
	});

	test("a page mixing undeclared and declaring versions loads each its own way", async () => {
		const doc = createImportMapDocument();
		const { backend, imported } = harness({
			[MC]: declaring("0.1.1-next.0"),
			[PASSAGE]: undeclared,
			[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
		});

		await backend.load({ [MC_TAG]: MC, [PASSAGE_TAG]: PASSAGE }, { doc });

		expect(imported.sort()).toEqual(
			[
				url(MC, "editor-runtime/delivery"),
				url(MC, "editor-runtime/controller"),
				url(PASSAGE, "delivery"),
				url(PASSAGE, "controller"),
			].sort(),
		);
		expect(g.customElements?.get(MC_TAG)).toBeDefined();
		expect(g.customElements?.get(PASSAGE_TAG)).toBeDefined();
		expect(warnings).toEqual([]);
	});

	test("a view the variant does not cover loads ./browser/* and maps no runtime", async () => {
		const doc = createImportMapDocument();
		const { backend, imported, injected, metadataRequests } = harness(
			{
				[VENN]: svelteDeclaring("0.1.1-next.0", {
					author: "editor-runtime/author",
					delivery: "editor-runtime/delivery",
					controller: "editor-runtime/controller",
				}),
				[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
			},
			{ config: { view: "print" } },
		);

		await backend.load({ [`${VENN_TAG}-print`]: VENN }, { doc });

		expect(imported).toEqual([url(VENN, "print"), url(VENN, "controller")]);
		expect(injected).toEqual([]);
		expect(runtimeRequests(metadataRequests)).toEqual([]);
		expect(warnings).toEqual([]);
	});

	test("a newer runtime declared after an older one is mapped falls back, through the same backend", async () => {
		const doc = createImportMapDocument();
		const { backend, imported, injected, metadataRequests, events } = harness({
			[MC]: declaring("0.1.1-next.0"),
			[EBSR]: declaring("0.1.1-next.1"),
			[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
			[`${RUNTIME}@0.1.1-next.1`]: runtimePackage(),
		});

		await backend.load({ [MC_TAG]: MC }, { doc });
		await backend.load({ [EBSR_TAG]: EBSR }, { doc });

		expect(imported.filter((specifier) => specifier.includes(EBSR))).toEqual([
			url(EBSR, "delivery"),
			url(EBSR, "controller"),
		]);
		expect(g.customElements?.get(EBSR_TAG)).toBeDefined();
		expect(injected).toHaveLength(1);
		expect(runtimeRequests(metadataRequests)).toEqual([
			`${CDN}/${RUNTIME}@0.1.1-next.0/package.json`,
		]);
		const reason = `the page maps ${RUNTIME}@0.1.1-next.0, which cannot serve ${RUNTIME}@0.1.1-next.1`;
		expect(warnings).toEqual([fallbackWarning(EBSR, reason)]);
		expect(events).toEqual([
			{
				name: "pie-esm-shared-dependency-conflict",
				attributes: {
					dependencyName: RUNTIME,
					existingVersion: "0.1.1-next.0",
					requestedVersion: "0.1.1-next.1",
					packageVersion: EBSR,
					fallback: "./browser/*",
					reason,
				},
			},
		]);
	});

	test("a newer runtime declared after an older one is mapped falls back, through a second backend", async () => {
		const doc = createImportMapDocument();
		const first = harness({
			[MC]: declaring("0.1.1-next.0"),
			[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
		});
		const second = harness(
			{
				[EBSR]: declaring("0.1.1-next.1"),
				[`${RUNTIME}@0.1.1-next.1`]: runtimePackage(),
			},
			{ config: { cdnBaseUrl: "https://cdn.other.test/npm" } },
		);

		await first.backend.load({ [MC_TAG]: MC }, { doc });
		await second.backend.load({ [EBSR_TAG]: EBSR }, { doc });

		expect(second.imported).toEqual([
			`https://cdn.other.test/npm/${EBSR}/dist/browser/delivery/index.js`,
			`https://cdn.other.test/npm/${EBSR}/dist/browser/controller/index.js`,
		]);
		expect(second.injected).toEqual([]);
		expect(runtimeRequests(second.metadataRequests)).toEqual([]);
		expect(mappedRuntimes(doc)).toEqual([`${RUNTIME}@0.1.1-next.0`]);
		expect(warnings).toEqual([
			fallbackWarning(
				EBSR,
				`the page maps ${RUNTIME}@0.1.1-next.0, which cannot serve ${RUNTIME}@0.1.1-next.1`,
			),
		]);
		expect(second.events.map((event) => event.name)).toEqual([
			"pie-esm-shared-dependency-conflict",
		]);
	});

	test("the mapped runtime serves a variant built against a lower compatible version, reported as resolved", async () => {
		const doc = createImportMapDocument();
		const { backend, imported, events } = harness({
			[EBSR]: declaring("0.1.1-next.1"),
			[MC]: declaring("0.1.1-next.0"),
			[`${RUNTIME}@0.1.1-next.1`]: runtimePackage(),
		});

		await backend.load({ [EBSR_TAG]: EBSR }, { doc });
		await backend.load({ [MC_TAG]: MC }, { doc });

		expect(imported.filter((specifier) => specifier.includes(MC))).toEqual([
			url(MC, "editor-runtime/delivery"),
			url(MC, "editor-runtime/controller"),
		]);
		expect(warnings).toEqual([
			`[pie-esm] Shared dependency version conflict resolved for ${RUNTIME}`,
		]);
		expect(events.map((event) => event.attributes)).toEqual([
			{
				dependencyName: RUNTIME,
				existingVersion: "0.1.1-next.1",
				requestedVersion: "0.1.1-next.0",
				resolvedVersion: "0.1.1-next.1",
				packageVersion: MC,
			},
		]);
	});

	test.each([
		["0.1.1-next.0", "0.2.0-next.0", false],
		["0.1.2", "0.1.1-next.3", true],
		["0.1.1-next.10", "0.1.1-next.9", true],
		["0.1.1-next.9", "0.1.1-next.10", false],
		["1.2.0-next.1", "1.2.0", false],
		["1.2.0", "1.0.5", true],
		["1.2.0", "2.0.0", false],
		["2.0.0", "1.9.0", false],
	])(
		"a page mapping runtime %s serves a variant declaring %s: %p",
		async (mapped, declared, served) => {
			const doc = createImportMapDocument();
			const { backend, imported } = harness({
				[MC]: declaring(mapped),
				[EBSR]: declaring(declared),
				[`${RUNTIME}@${mapped}`]: runtimePackage(),
			});

			await backend.load({ [MC_TAG]: MC }, { doc });
			await backend.load({ [EBSR_TAG]: EBSR }, { doc });

			expect(imported.filter((specifier) => specifier.includes(EBSR))[0]).toBe(
				url(EBSR, served ? "editor-runtime/delivery" : "delivery"),
			);
		},
	);

	test("one batch maps the highest declared runtime by semver precedence", async () => {
		const doc = createImportMapDocument();
		const { backend, imported, injected, metadataRequests } = harness({
			[MC]: declaring("0.1.1-next.9"),
			[EBSR]: declaring("0.1.1-next.10"),
			[`${RUNTIME}@0.1.1-next.9`]: runtimePackage(),
			[`${RUNTIME}@0.1.1-next.10`]: runtimePackage(),
		});

		await backend.load({ [MC_TAG]: MC, [EBSR_TAG]: EBSR }, { doc });

		expect(runtimeRequests(metadataRequests)).toEqual([
			`${CDN}/${RUNTIME}@0.1.1-next.10/package.json`,
		]);
		expect(injectedImports(injected)).toMatchObject(
			runtimeImports("0.1.1-next.10"),
		);
		expect(mappedRuntimes(doc)).toEqual([`${RUNTIME}@0.1.1-next.10`]);
		expect(imported).toContain(url(MC, "editor-runtime/delivery"));
		expect(imported).toContain(url(EBSR, "editor-runtime/delivery"));
	});

	test("a page that maps a runtime specifier itself keeps its mapping, and the elements fall back", async () => {
		const hostMapping = {
			"prosemirror-state": "https://host.test/pm-state.js",
		};
		const doc = createImportMapDocument([hostMapping]);
		const { backend, imported, injected } = harness({
			[MC]: declaring("0.1.1-next.0"),
			[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
		});

		await backend.load({ [MC_TAG]: MC }, { doc });

		expect(imported).toEqual([url(MC, "delivery"), url(MC, "controller")]);
		expect(Object.keys(injectedImports(injected)).sort()).toEqual(
			[...REACT_SHARED_SPECIFIERS].sort(),
		);
		expect(mappedRuntimes(doc)).toEqual([]);
		expect(warnings).toEqual([
			fallbackWarning(MC, "the page already maps prosemirror-state"),
		]);
	});

	test.each([
		[
			"fails to load",
			new Error("network down"),
			`the package.json of ${RUNTIME}@0.1.1-next.0 could not be loaded: network down`,
		],
		[
			"is missing",
			undefined,
			`the package.json of ${RUNTIME}@0.1.1-next.0 could not be loaded`,
		],
		[
			"declares no modules",
			{ name: RUNTIME, pie: {} },
			`${RUNTIME}@0.1.1-next.0 declares no valid pie.browserModules`,
		],
		[
			"maps React",
			runtimePackage({ ...RUNTIME_MODULES, "react/jsx-runtime": "react" }),
			`${RUNTIME}@0.1.1-next.0 declares no valid pie.browserModules`,
		],
		[
			"names a path outside its browser build",
			runtimePackage({ "@tiptap/core": "../../../evil" }),
			`${RUNTIME}@0.1.1-next.0 declares no valid pie.browserModules`,
		],
	])(
		"a runtime whose package.json %s falls back and the element loads",
		async (_label, runtimeMetadata, reason) => {
			const doc = createImportMapDocument();
			const { backend, imported, injected } = harness({
				[MC]: declaring("0.1.1-next.0"),
				[`${RUNTIME}@0.1.1-next.0`]: runtimeMetadata,
			});

			await backend.load({ [MC_TAG]: MC }, { doc });

			expect(imported).toEqual([url(MC, "delivery"), url(MC, "controller")]);
			expect(g.customElements?.get(MC_TAG)).toBeDefined();
			expect(Object.keys(injectedImports(injected)).sort()).toEqual(
				[...REACT_SHARED_SPECIFIERS].sort(),
			);
			expect(mappedRuntimes(doc)).toEqual([]);
			expect(warnings).toEqual([fallbackWarning(MC, reason)]);
		},
	);

	test("a variant view that fails to import falls back to ./browser/*", async () => {
		const doc = createImportMapDocument();
		const variant = url(MC, "editor-runtime/delivery");
		const { backend, imported, events } = harness(
			{
				[MC]: declaring("0.1.1-next.0"),
				[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
			},
			{ failImport: (specifier) => specifier === variant },
		);

		await backend.load({ [MC_TAG]: MC }, { doc });

		expect(imported).toEqual([
			variant,
			url(MC, "delivery"),
			url(MC, "controller"),
		]);
		expect(g.customElements?.get(MC_TAG)).toBeDefined();
		expect(warnings).toEqual([
			fallbackWarning(
				MC,
				`its editor-runtime delivery view failed to load: Failed to fetch dynamically imported module: ${variant}`,
			),
		]);
		expect(events[0]?.attributes.fallback).toBe("./browser/*");
	});

	test("a variant controller that fails to import falls back to the ./browser/* controller", async () => {
		const doc = createImportMapDocument();
		const variantController = url(MC, "editor-runtime/controller");
		const { backend, imported } = harness(
			{
				[MC]: declaring("0.1.1-next.0"),
				[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
			},
			{ failImport: (specifier) => specifier === variantController },
		);

		await backend.load({ [MC_TAG]: MC }, { doc });

		expect(imported).toEqual([
			url(MC, "editor-runtime/delivery"),
			variantController,
			url(MC, "controller"),
		]);
		const registry =
			(g.window as { PIE_REGISTRY?: Record<string, any> }).PIE_REGISTRY ?? {};
		expect(registry[MC_TAG]?.controller).toBeDefined();
		expect(warnings).toEqual([
			fallbackWarning(
				MC,
				`its editor-runtime controller failed to load: Failed to fetch dynamically imported module: ${variantController}`,
			),
		]);
	});

	test.each([
		["a version range", { version: "^0.1.1-next.0" }],
		[
			"a path outside the package",
			{ views: { delivery: "../../other/delivery" } },
		],
		["no views", { views: {} }],
		["an invalid package name", { name: "Shared Editor Runtime" }],
	])(
		"a declaration with %s falls back without fetching a runtime",
		async (_label, overrides) => {
			const doc = createImportMapDocument();
			const { backend, imported, metadataRequests } = harness({
				[MC]: declaring("0.1.1-next.0", overrides),
			});

			await backend.load({ [MC_TAG]: MC }, { doc });

			expect(imported).toEqual([url(MC, "delivery"), url(MC, "controller")]);
			expect(runtimeRequests(metadataRequests)).toEqual([]);
			expect(warnings).toEqual([
				fallbackWarning(
					MC,
					"its pie.browserEditorRuntime declaration is invalid",
				),
			]);
		},
	);

	test("a browser without import maps loads ./browser/* for a Svelte element instead of failing", async () => {
		g.HTMLScriptElement = class {
			static supports() {
				return false;
			}
		} as unknown as GlobalWithDom["HTMLScriptElement"];
		const doc = createImportMapDocument();
		const { backend, imported, injected } = harness({
			[VENN]: svelteDeclaring("0.1.1-next.0", {
				delivery: "editor-runtime/delivery",
				controller: "editor-runtime/controller",
			}),
			[`${RUNTIME}@0.1.1-next.0`]: runtimePackage(),
		});

		await backend.load({ [VENN_TAG]: VENN }, { doc });

		expect(imported).toEqual([url(VENN, "delivery"), url(VENN, "controller")]);
		expect(injected).toEqual([]);
		expect(warnings).toEqual([
			fallbackWarning(VENN, "this browser does not support import maps"),
		]);
	});
});

// ─── ESM runtime-support URL ─────────────────────────────────────────────────

describe("resolveEsmRuntimeSupportUrl", () => {
	const spec = "@pie-element/math-inline@12.1.1";
	const customProvider = (
		overrides: Partial<EsmCdnProvider> = {},
	): EsmCdnProvider => ({
		name: "local",
		packageJsonUrl: (pv) => `https://cdn.test/${pv}/package.json`,
		browserViewUrl: (pv, view) =>
			`https://cdn.test/${pv}/dist/browser/${view}/index.js`,
		browserControllerUrl: (pv) =>
			`https://cdn.test/${pv}/dist/browser/controller/index.js`,
		sharedDependencyUrl: (dep, version) => `https://esm.sh/${dep}@${version}`,
		...overrides,
	});

	test("names the published file on jsDelivr and esm.sh", () => {
		expect(
			resolveEsmRuntimeSupportUrl(spec, {
				cdnBaseUrl: "https://cdn.jsdelivr.net/npm/",
			}),
		).toBe(`https://cdn.jsdelivr.net/npm/${spec}/dist/runtime-support.js`);
		expect(
			resolveEsmRuntimeSupportUrl(spec, { cdnBaseUrl: "https://esm.sh" }),
		).toBe(`https://raw.esm.sh/${spec}/dist/runtime-support.js`);
	});

	test("takes a custom provider's runtimeSupportUrl", () => {
		expect(
			resolveEsmRuntimeSupportUrl(spec, {
				cdnBaseUrl: "https://cdn.test",
				cdnProvider: customProvider({
					runtimeSupportUrl: (pv) => `https://meta.test/${pv}.js`,
				}),
			}),
		).toBe(`https://meta.test/${spec}.js`);
	});

	test("derives the file from a custom provider's package root", () => {
		expect(
			resolveEsmRuntimeSupportUrl(spec, {
				cdnBaseUrl: "https://cdn.test",
				cdnProvider: customProvider(),
			}),
		).toBe(`https://cdn.test/${spec}/dist/runtime-support.js`);
		expect(
			resolveEsmRuntimeSupportUrl(spec, {
				cdnBaseUrl: "https://cdn.test",
				cdnProvider: customProvider({
					packageJsonUrl: (pv) => `https://cdn.test/meta?package=${pv}`,
				}),
			}),
		).toBeUndefined();
	});
});
