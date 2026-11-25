/**
 * Bundle integrity: the SRI helpers, the IIFE and ESM adapters' use of them
 * through their test seams, and the ESM default element package policy. The
 * browser's own enforcement runs in `tests/e2e/bundle-integrity.spec.ts`.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	BUNDLE_INTEGRITY_FAILED_EVENT,
	BundleIntegrityError,
	type BundleIntegrityFailure,
	diagnoseIntegrity,
	indexIntegrity,
	integrityRefusal,
	isEnforceableIntegrity,
	lookupIntegrity,
	reportBundleIntegrityFailure,
} from "../src/loaders/bundle-integrity.js";
import {
	__testing as elementLoaderTesting,
	AdapterFailure,
	describeRegistrationFailures,
	ElementLoaderError,
	ensureRegistered,
	type RegistrationFailureReason,
} from "../src/loaders/element-loader.js";
import {
	assertElementPackagesAllowed,
	DEFAULT_ESM_ELEMENT_PACKAGE_POLICY,
	ElementPackagePolicyError,
} from "../src/loaders/element-package-policy.js";
import {
	createEsmBackend,
	type EsmBackendConfig,
	type EsmBackendTestSeams,
} from "../src/loaders/esm-adapter.js";
import {
	createIifeBackend,
	type IifeBackendConfig,
	type IifeBackendTestSeams,
} from "../src/loaders/iife-adapter.js";

async function sri(body: string, algorithm = "SHA-384"): Promise<string> {
	const digest = await crypto.subtle.digest(
		algorithm,
		new TextEncoder().encode(body),
	);
	const prefix = algorithm.replace("SHA-", "sha");
	return `${prefix}-${btoa(String.fromCharCode(...new Uint8Array(digest)))}`;
}

function serving(body: string, status = 200) {
	const requests: Array<{ url: string; init?: RequestInit }> = [];
	const fetch = async (url: string, init?: RequestInit) => {
		requests.push({ url, init });
		return new Response(body, { status });
	};
	return { fetch, requests };
}

const SHA384_OF_EMPTY =
	"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb";

describe("integrity metadata", () => {
	test("accepts sha256/384/512 tokens of the right length, options included", () => {
		expect(isEnforceableIntegrity(SHA384_OF_EMPTY)).toBe(true);
		expect(isEnforceableIntegrity(`${SHA384_OF_EMPTY}?ct=application/javascript`)).toBe(true);
		expect(isEnforceableIntegrity(`md5-abc ${SHA384_OF_EMPTY}`)).toBe(true);
	});

	test("refuses metadata a browser would skip", () => {
		expect(isEnforceableIntegrity("sha384-tooShort")).toBe(false);
		expect(isEnforceableIntegrity("md5-1B2M2Y8AsgTpgAmY7PhCfg==")).toBe(false);
		expect(isEnforceableIntegrity(SHA384_OF_EMPTY.replace("sha384", "sha256"))).toBe(false);
		expect(isEnforceableIntegrity("")).toBe(false);
		expect(isEnforceableIntegrity(42)).toBe(false);
	});

	test("looks URLs up normalized, first match wins, and flags malformed entries", () => {
		const index = indexIntegrity({
			"https://Bundles.test/a/../b/player.js": SHA384_OF_EMPTY,
			"https://bundles.test/bad.js": "sha384-nope",
		});
		expect(
			lookupIntegrity(index, ["https://other.test/x.js", "https://bundles.test/b/player.js"]),
		).toEqual({ status: "found", integrity: SHA384_OF_EMPTY });
		expect(lookupIntegrity(index, ["https://bundles.test/bad.js"])).toEqual({
			status: "malformed",
			integrity: "sha384-nope",
		});
		expect(lookupIntegrity(index, ["https://bundles.test/none.js"])).toEqual({
			status: "missing",
		});
	});

	test("refuses malformed always and missing only under requireIntegrity", () => {
		const url = "https://bundles.test/x.js";
		expect(integrityRefusal({ status: "missing" }, url, false)).toBeUndefined();
		expect(integrityRefusal({ status: "missing" }, url, true)).toEqual({
			url,
			cause: "missing",
		});
		expect(
			integrityRefusal({ status: "malformed", integrity: "sha1-x" }, url, false),
		).toEqual({ url, cause: "malformed", expected: "sha1-x" });
		expect(
			integrityRefusal({ status: "found", integrity: SHA384_OF_EMPTY }, url, true),
		).toBeUndefined();
	});
});

describe("diagnoseIntegrity", () => {
	test("reports the served digest when the bytes differ", async () => {
		const server = serving("tampered");
		const diagnosis = await diagnoseIntegrity(
			"https://bundles.test/x.js",
			await sri("original"),
			{ fetch: server.fetch, crypto },
		);
		expect(diagnosis).toEqual({ verdict: "mismatch", actual: await sri("tampered") });
		expect(server.requests[0].init).toMatchObject({ mode: "cors", credentials: "omit" });
	});

	test("matches the strongest algorithm the metadata names", async () => {
		const both = `${await sri("other", "SHA-256")} ${await sri("body", "SHA-512")}`;
		const diagnosis = await diagnoseIntegrity("https://bundles.test/x.js", both, {
			fetch: serving("body").fetch,
			crypto,
		});
		expect(diagnosis).toEqual({ verdict: "match" });
	});

	test("is unavailable for a non-2xx answer or a failed request", async () => {
		const expected = await sri("original");
		expect(
			await diagnoseIntegrity("https://bundles.test/x.js", expected, {
				fetch: serving("", 404).fetch,
				crypto,
			}),
		).toEqual({ verdict: "unavailable", reason: "HTTP 404" });
		expect(
			await diagnoseIntegrity("https://bundles.test/x.js", expected, {
				fetch: async () => {
					throw new TypeError("Failed to fetch");
				},
				crypto,
			}),
		).toEqual({ verdict: "unavailable", reason: "Failed to fetch" });
	});
});

describe("reportBundleIntegrityFailure", () => {
	const failure: BundleIntegrityFailure = {
		url: "https://bundles.test/x.js",
		cause: "mismatch",
		expected: SHA384_OF_EMPTY,
		actual: "sha384-other",
	};

	test("dispatches the event and records an event and an error", () => {
		const target = new EventTarget();
		const details: unknown[] = [];
		target.addEventListener(BUNDLE_INTEGRITY_FAILED_EVENT, (event) =>
			details.push((event as CustomEvent).detail),
		);
		const tracked: Array<[string, unknown, unknown]> = [];
		reportBundleIntegrityFailure(failure, {
			target,
			component: "iife-adapter",
			provider: {
				providerId: "p",
				providerName: "p",
				async initialize() {},
				trackEvent: (name, attributes) => tracked.push(["event", name, attributes]),
				trackError: (error, attributes) => tracked.push(["error", error, attributes]),
				destroy() {},
				isReady: () => true,
			},
		});

		expect(details).toEqual([failure]);
		const attributes = { ...failure, component: "iife-adapter" };
		expect(tracked[0]).toEqual(["event", BUNDLE_INTEGRITY_FAILED_EVENT, attributes]);
		expect(tracked[1][1]).toBeInstanceOf(BundleIntegrityError);
		expect(tracked[1][2]).toEqual({ ...attributes, errorType: "BundleIntegrityError" });
	});

	test("never throws from a provider", () => {
		expect(() =>
			reportBundleIntegrityFailure(failure, {
				target: new EventTarget(),
				component: "esm-adapter",
				provider: {
					providerId: "p",
					providerName: "p",
					async initialize() {},
					trackEvent() {
						throw new Error("event");
					},
					trackError() {
						throw new Error("error");
					},
					destroy() {},
					isReady: () => true,
				},
			}),
		).not.toThrow();
	});
});

// ─── Adapters ────────────────────────────────────────────────────────────────

const g = globalThis as unknown as Record<string, unknown>;
const saved = {
	customElements: g.customElements,
	HTMLElement: g.HTMLElement,
	HTMLScriptElement: g.HTMLScriptElement,
	window: g.window,
};

function installRegistry() {
	const registry = new Map<string, CustomElementConstructor>();
	g.customElements = {
		get: (tag: string) => registry.get(tag),
		define: (tag: string, ctor: CustomElementConstructor) => registry.set(tag, ctor),
		whenDefined: async (tag: string) => registry.get(tag),
	};
}

class FakeElement {}
function elementClass(): CustomElementConstructor {
	return class extends (FakeElement as unknown as typeof HTMLElement) {};
}

type ViewStub = EventTarget & { fetch?: unknown; crypto?: Crypto };

/** A document whose `defaultView` collects integrity events and serves `fetch`. */
function mockDocument(fetch?: unknown) {
	const scripts: Array<{ type?: string; textContent?: string }> = [];
	const view: ViewStub = Object.assign(new EventTarget(), { fetch, crypto });
	const events: BundleIntegrityFailure[] = [];
	view.addEventListener(BUNDLE_INTEGRITY_FAILED_EVENT, (event) =>
		events.push((event as CustomEvent).detail),
	);
	const doc = {
		defaultView: view,
		head: {
			appendChild: (el: { type?: string; textContent?: string; onerror?: () => void }) => {
				scripts.push(el);
				// No bundle loads here: a bundle script fails as an unreachable one would.
				queueMicrotask(() => el.onerror?.());
				return el;
			},
		},
		createElement: () => {
			const attributes = new Map<string, string>();
			return Object.assign(new EventTarget(), {
				getAttribute: (name: string) => attributes.get(name) ?? null,
				setAttribute: (name: string, value: string) => attributes.set(name, value),
			});
		},
		querySelector: () => null,
		querySelectorAll: () => [],
	} as unknown as Document;
	return { doc, events, scripts };
}

function context(doc: Document) {
	return { doc, whenDefinedTimeoutMs: 50 };
}

async function reasonsOf(promise: Promise<unknown>): Promise<RegistrationFailureReason[]> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(AdapterFailure);
		return [...(error as AdapterFailure).reasons.values()];
	}
	throw new Error("expected the load to fail");
}

beforeEach(() => {
	installRegistry();
	g.HTMLElement = FakeElement;
	g.HTMLScriptElement = { supports: (type: string) => type === "importmap" };
	g.window = { customElements: g.customElements };
	elementLoaderTesting.resetDedupState();
});

afterEach(() => {
	elementLoaderTesting.resetDedupState();
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) delete g[key];
		else g[key] = value;
	}
});

const BUNDLE = "https://bundles.test/bundles/abc/player.js";
const IIFE_ELEMENTS = { "pie-passage": "@pie-element/passage@2.10.5" };

function iifeBackend(config: Partial<IifeBackendConfig>) {
	const backend = createIifeBackend({
		kind: "iife",
		bundleHost: "https://bundles.test/bundles/",
		bundleInfo: { url: BUNDLE },
		bundleRetry: { retryDelayMs: 5, timeoutMs: 60 },
		...config,
	});
	const loads: Array<{ url: string; integrity?: string }> = [];
	const seams = (backend as unknown as { __seams: IifeBackendTestSeams }).__seams;
	return { backend, seams, loads };
}

describe("IIFE adapter integrity", () => {
	test("hands the bundle's hash to the script loader, keyed without the elements query", async () => {
		const expected = await sri("bundle");
		const { backend, seams, loads } = iifeBackend({ integrity: { [BUNDLE]: expected } });
		seams.replaceLoadBundleScript(async (url, _doc, integrity) => {
			loads.push({ url, integrity });
			(g.window as { pie?: unknown }).pie = {
				default: { "@pie-element/passage": { Element: elementClass() } },
			};
		});
		await backend.load(IIFE_ELEMENTS, context(mockDocument().doc));
		expect(loads).toEqual([{ url: `${BUNDLE}?elements=pie-passage`, integrity: expected }]);
	});

	test("requireIntegrity refuses a bundle without a hash before loading it", async () => {
		const { backend, seams, loads } = iifeBackend({ requireIntegrity: true });
		seams.replaceLoadBundleScript(async (url) => {
			loads.push({ url });
		});
		const { doc, events } = mockDocument();
		const reasons = await reasonsOf(backend.load(IIFE_ELEMENTS, context(doc)));
		expect(loads).toEqual([]);
		expect(reasons).toEqual([
			{
				kind: "integrity-failed",
				tag: "pie-passage",
				url: `${BUNDLE}?elements=pie-passage`,
				cause: "missing",
			},
		]);
		expect(events).toHaveLength(1);
	});

	test("refuses a malformed hash without requireIntegrity", async () => {
		const { backend, seams, loads } = iifeBackend({ integrity: { [BUNDLE]: "sha384-typo" } });
		seams.replaceLoadBundleScript(async (url) => {
			loads.push({ url });
		});
		const reasons = await reasonsOf(backend.load(IIFE_ELEMENTS, context(mockDocument().doc)));
		expect(loads).toEqual([]);
		expect(reasons[0]).toMatchObject({ kind: "integrity-failed", cause: "malformed" });
	});

	test("a failed load whose bytes do not match ends the retries", async () => {
		const expected = await sri("original");
		const { backend, seams, loads } = iifeBackend({ integrity: { [BUNDLE]: expected } });
		seams.replaceLoadBundleScript(async (url) => {
			loads.push({ url });
			throw new Error("script error");
		});
		const server = serving("tampered");
		const { doc, events } = mockDocument(server.fetch);
		const reasons = await reasonsOf(backend.load(IIFE_ELEMENTS, context(doc)));
		expect(loads).toHaveLength(1);
		const failure: BundleIntegrityFailure = {
			url: `${BUNDLE}?elements=pie-passage`,
			cause: "mismatch",
			expected,
			actual: await sri("tampered"),
		};
		expect(reasons).toEqual([{ kind: "integrity-failed", tag: "pie-passage", ...failure }]);
		expect(events).toEqual([failure]);
		expect(
			describeRegistrationFailures(
				new ElementLoaderError("", new Set(["pie-passage"]), new Map([["pie-passage", reasons[0]]])),
			),
		).toBe(
			`pie-passage (integrity-failed): ${BUNDLE}?elements=pie-passage does not match its integrity ${expected}; the served bytes hash to ${await sri("tampered")}`,
		);
	});

	test("a failed load whose bytes match keeps retrying as a load failure", async () => {
		const expected = await sri("bundle");
		const { backend, seams, loads } = iifeBackend({ integrity: { [BUNDLE]: expected } });
		seams.replaceLoadBundleScript(async (url) => {
			loads.push({ url });
			throw new Error("script error");
		});
		const { doc, events } = mockDocument(serving("bundle").fetch);
		const reasons = await reasonsOf(backend.load(IIFE_ELEMENTS, context(doc)));
		expect(loads.length).toBeGreaterThan(1);
		expect(reasons[0]).toMatchObject({ kind: "bundle-load-failed" });
		expect(events).toEqual([]);
	});
});

const CDN = "https://cdn.jsdelivr.net/npm";
const MC = "@pie-element/multiple-choice@13.2.0";
const MC_TAG = "pie-mc--version-13-2-0";
const MC_PACKAGE_JSON = `${CDN}/${MC}/package.json`;
const MC_DELIVERY = `${CDN}/${MC}/dist/browser/delivery/index.js`;
const MC_AUTHOR = `${CDN}/${MC}/dist/browser/author/index.js`;
const MC_CONTROLLER = `${CDN}/${MC}/dist/browser/controller/index.js`;
const SHARED_METADATA = {
	pie: { browserSharedDependencies: { react: "18.2.0", "react-dom": "18.2.0" } },
};

function esmBackend(config: Partial<EsmBackendConfig>) {
	const backend = createEsmBackend({ kind: "esm", cdnBaseUrl: CDN, view: "delivery", ...config });
	const seams = (backend as unknown as { __seams: EsmBackendTestSeams }).__seams;
	const imported: string[] = [];
	const injectedMaps: Array<Record<string, unknown>> = [];
	const metadataReads: Array<{ url: string; integrity?: string }> = [];
	seams.observeImportMapInjection((json) => injectedMaps.push(JSON.parse(json)));
	seams.replacePackageMetadataLoader(async (_pkg, url, integrity) => {
		metadataReads.push({ url, integrity });
		return SHARED_METADATA as never;
	});
	seams.replaceImporter(async (specifier) => {
		imported.push(specifier);
		return { default: elementClass(), Element: elementClass() };
	});
	return { backend, seams, imported, injectedMaps, metadataReads };
}

describe("ESM adapter integrity", () => {
	test("writes hashes into the injected import map and onto the package.json read", async () => {
		const integrity = {
			[MC_PACKAGE_JSON]: await sri("package.json"),
			[MC_DELIVERY]: await sri("delivery"),
			[MC_CONTROLLER]: await sri("controller"),
		};
		const { backend, injectedMaps, metadataReads } = esmBackend({ integrity });
		await backend.load({ [MC_TAG]: MC }, context(mockDocument().doc));

		expect(metadataReads).toEqual([
			{ url: MC_PACKAGE_JSON, integrity: integrity[MC_PACKAGE_JSON] },
		]);
		expect(injectedMaps[0].integrity).toEqual(integrity);
	});

	test("requireIntegrity refuses a package whose package.json has no hash", async () => {
		const { backend, imported, metadataReads } = esmBackend({ requireIntegrity: true });
		const { doc, events } = mockDocument();
		const reasons = await reasonsOf(backend.load({ [MC_TAG]: MC }, context(doc)));

		expect(metadataReads).toEqual([]);
		expect(imported.filter((specifier) => specifier.startsWith(CDN))).toEqual([]);
		expect(reasons).toEqual([
			{ kind: "integrity-failed", tag: MC_TAG, url: MC_PACKAGE_JSON, cause: "missing" },
		]);
		expect(events).toHaveLength(1);
	});

	test("requireIntegrity refuses a mapped shared dependency without a hash", async () => {
		const { backend, injectedMaps } = esmBackend({
			requireIntegrity: true,
			integrity: { [MC_PACKAGE_JSON]: await sri("package.json") },
		});
		const reasons = await reasonsOf(
			backend.load({ [MC_TAG]: MC }, context(mockDocument().doc)),
		);
		expect(injectedMaps).toEqual([]);
		expect(reasons[0]).toMatchObject({ kind: "integrity-failed", cause: "missing" });
		expect((reasons[0] as { url: string }).url).toContain("react");
	});

	test("a module whose bytes do not match fails its tag without trying the fallback view", async () => {
		const expected = await sri("original");
		const { backend, seams, imported } = esmBackend({
			view: "author",
			integrity: { [MC_AUTHOR]: expected },
		});
		seams.replaceImporter(async (specifier) => {
			imported.push(specifier);
			if (specifier === MC_AUTHOR) throw new TypeError("Failed to fetch module");
			return { default: elementClass(), Element: elementClass() };
		});
		const { doc, events } = mockDocument(serving("tampered").fetch);
		const reasons = await reasonsOf(backend.load({ [MC_TAG]: MC }, context(doc)));

		const failure: BundleIntegrityFailure = {
			url: MC_AUTHOR,
			cause: "mismatch",
			expected,
			actual: await sri("tampered"),
		};
		expect(reasons).toEqual([{ kind: "integrity-failed", tag: MC_TAG, ...failure }]);
		expect(imported).not.toContain(MC_DELIVERY);
		expect(events).toEqual([failure]);
	});
});

describe("ESM default element package policy", () => {
	test("admits any package at an exact version, and no tag or range", () => {
		for (const spec of [MC, "@acme/multiple-choice@13.2.0"]) {
			expect(() =>
				assertElementPackagesAllowed({ [MC_TAG]: spec }, DEFAULT_ESM_ELEMENT_PACKAGE_POLICY),
			).not.toThrow();
		}
		for (const spec of [
			"@pie-element/multiple-choice@^13.2.0",
			"@pie-element/multiple-choice@latest",
			"@pie-element/multiple-choice",
		]) {
			expect(() =>
				assertElementPackagesAllowed({ [MC_TAG]: spec }, DEFAULT_ESM_ELEMENT_PACKAGE_POLICY),
			).toThrow(ElementPackagePolicyError);
		}
	});

	test("a host's allowedPackages limits the scopes", () => {
		const policy = { allowedPackages: ["@pie-element/*"] };
		expect(() => assertElementPackagesAllowed({ [MC_TAG]: MC }, policy)).not.toThrow();
		for (const spec of ["@acme/multiple-choice@13.2.0", "@pie-elementx/multiple-choice@13.2.0"]) {
			expect(() => assertElementPackagesAllowed({ [MC_TAG]: spec }, policy)).toThrow(
				ElementPackagePolicyError,
			);
		}
	});

	test("ensureRegistered applies it to an ESM backend config and not to IIFE", async () => {
		const elements = { "pie-acme": "@acme/thing@^1.0.0" };
		await expect(
			ensureRegistered(elements, {
				backend: { kind: "esm", cdnBaseUrl: CDN },
				doc: mockDocument().doc,
				whenDefinedTimeoutMs: 25,
			}),
		).rejects.toBeInstanceOf(ElementPackagePolicyError);

		const iife = ensureRegistered(elements, {
			backend: {
				kind: "iife",
				bundleHost: "https://bundles.test/bundles/",
				bundleRetry: { retryDelayMs: 5, timeoutMs: 20 },
			},
			doc: mockDocument().doc,
			whenDefinedTimeoutMs: 25,
		});
		await expect(iife).rejects.toBeInstanceOf(ElementLoaderError);
	});

	test("a host policy replaces the default", async () => {
		const { backend } = esmBackend({});
		await ensureRegistered(
			{ [MC_TAG]: "@pie-element/multiple-choice@13.2.0" },
			{
				backend,
				doc: mockDocument().doc,
				whenDefinedTimeoutMs: 25,
				elementPackagePolicy: { allowedPackages: ["@pie-element/multiple-choice"] },
			},
		);
	});
});
