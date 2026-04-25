/**
 * ElementLoader primitive — the one place where "these tags are registered
 * with customElements" is decided.
 *
 * Owns the truthful promise contract end-to-end:
 *
 *     ensureRegistered(elements, options) resolves iff every requested tag
 *     is in `customElements` at the moment of resolution. On partial
 *     success it rejects with an `ElementLoaderError` carrying the set of
 *     unregistered tags and a per-tag `RegistrationFailureReason` map.
 *
 * The primitive delegates the actual fetch/register work to a backend
 * adapter (IIFE or ESM) but always verifies the outcome via
 * `customElements.whenDefined`. An adapter cannot silently under-register
 * — the primitive will catch it and surface a timeout reason.
 *
 * See packages/players-shared/tests/element-loader-contract.test.ts for
 * the executable specification of every failure mode this primitive is
 * required to catch.
 */

import { DEFAULT_IIFE_BUNDLE_RETRY_CONFIG } from "../loader-config.js";
import type { ElementMap } from "./ElementLoader.js";
import {
	AdapterFailure,
	type BackendContext,
	type ElementLoaderBackend,
	type ElementTag,
	type RegistrationFailureReason,
} from "./element-loader-types.js";
import {
	createEsmBackend,
	type EsmBackendConfig,
} from "./esm-adapter.js";
import {
	createIifeBackend,
	type IifeBackendConfig,
} from "./iife-adapter.js";

export type {
	BackendContext,
	ElementLoaderBackend,
	ElementMap,
	ElementTag,
	RegistrationFailureReason,
} from "./element-loader-types.js";
export { AdapterFailure } from "./element-loader-types.js";
export type { IifeBackendConfig } from "./iife-adapter.js";
export type { EsmBackendConfig } from "./esm-adapter.js";

/**
 * Aggregate error thrown by `ensureRegistered` when one or more requested
 * tags were not registered by the time verification timed out.
 */
export class ElementLoaderError extends Error {
	override readonly name = "ElementLoaderError";
	readonly unregisteredTags: Set<ElementTag>;
	readonly reasons: Map<ElementTag, RegistrationFailureReason>;

	constructor(
		message: string,
		unregisteredTags: Set<ElementTag>,
		reasons: Map<ElementTag, RegistrationFailureReason>,
	) {
		super(message);
		this.unregisteredTags = unregisteredTags;
		this.reasons = reasons;
	}
}

/**
 * Thrown by `assertRegistered` when any requested tag is missing from
 * `customElements`. Carries enough detail for the host to diagnose what
 * pre-registration step was skipped.
 */
export class ElementAssertionError extends Error {
	override readonly name = "ElementAssertionError";
	readonly expectedTags: readonly ElementTag[];
	readonly missingTags: readonly ElementTag[];
	readonly currentlyRegisteredTags: readonly ElementTag[];

	constructor(
		expected: ElementTag[],
		missing: ElementTag[],
		currentlyRegistered: ElementTag[],
	) {
		super(
			buildAssertionMessage(expected, missing, currentlyRegistered),
		);
		this.expectedTags = expected;
		this.missingTags = missing;
		this.currentlyRegisteredTags = currentlyRegistered;
	}
}

function buildAssertionMessage(
	expected: ElementTag[],
	missing: ElementTag[],
	registered: ElementTag[],
): string {
	const expectedStr = expected.join(", ");
	const missingStr = missing.join(", ");
	const registeredStr = registered.length
		? registered.join(", ")
		: "(none enumerable)";
	return (
		`ElementLoader.assertRegistered: expected [${expectedStr}], ` +
		`missing [${missingStr}]. customElements contains: [${registeredStr}].`
	);
}

export type BackendOption =
	| IifeBackendConfig
	| EsmBackendConfig
	| ElementLoaderBackend;

export type EnsureRegisteredOptions = {
	backend: BackendOption;
	doc?: Document;
	whenDefinedTimeoutMs?: number;
	/**
	 * Outer cumulative deadline for the backend's `load()` call.
	 *
	 * Closes the "promise never settles" seam for adapters whose underlying
	 * fetch can stall indefinitely (e.g. ESM `import()` against a frozen
	 * CDN). When the deadline elapses, the primitive synthesizes an
	 * `AdapterFailure` with `kind: "timeout"` reasons for every requested
	 * tag — surfacing as a normal `ElementLoaderError` to the caller.
	 *
	 * Defaults to `DEFAULT_IIFE_BUNDLE_RETRY_CONFIG.timeoutMs` so
	 * adapter-internal retry windows (IIFE bundle-build polling) fit
	 * inside the same overall budget.
	 */
	loadTimeoutMs?: number;
};

const DEFAULT_WHEN_DEFINED_TIMEOUT_MS = 5000;
const DEFAULT_LOAD_TIMEOUT_MS = DEFAULT_IIFE_BUNDLE_RETRY_CONFIG.timeoutMs;

// Module-scoped in-flight cache. Key: backend signature + sorted elements.
// Keeps concurrent identical requests collapsed to one backend call.
const inFlightRequests = new Map<string, Promise<void>>();

/**
 * Resolve iff every tag in `elements` is registered with `customElements`.
 * Reject with `ElementLoaderError` otherwise.
 *
 * The primitive is the sole authority on registration state:
 * - Empty element map resolves immediately (no backend call).
 * - Already-registered tags resolve immediately (no backend call).
 * - Concurrent identical requests share one backend call.
 * - After the adapter's `load` settles, a post-load verification pass
 *   (bounded `customElements.whenDefined`) checks every tag. Any missing
 *   tag becomes a rejection.
 */
export async function ensureRegistered(
	elements: ElementMap,
	options: EnsureRegisteredOptions,
): Promise<void> {
	if (!elements || Object.keys(elements).length === 0) return;

	const tags = Object.keys(elements);
	const timeoutMs =
		options.whenDefinedTimeoutMs ?? DEFAULT_WHEN_DEFINED_TIMEOUT_MS;
	const loadTimeoutMs = options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;

	// Fast path: everything already registered. Skip backend and dedup
	// bookkeeping entirely.
	if (allAlreadyRegistered(tags)) return;

	const dedupKey = buildDedupKey(options.backend, elements);
	const existing = inFlightRequests.get(dedupKey);
	if (existing) return existing;

	const backend = resolveBackend(options.backend);
	const doc = resolveDoc(options.doc);

	const promise = runEnsureRegistered(
		elements,
		tags,
		backend,
		{ doc, whenDefinedTimeoutMs: timeoutMs },
		timeoutMs,
		loadTimeoutMs,
	);

	inFlightRequests.set(dedupKey, promise);
	try {
		await promise;
	} finally {
		if (inFlightRequests.get(dedupKey) === promise) {
			inFlightRequests.delete(dedupKey);
		}
	}
}

async function runEnsureRegistered(
	elements: ElementMap,
	tags: ElementTag[],
	backend: ElementLoaderBackend,
	context: BackendContext,
	timeoutMs: number,
	loadTimeoutMs: number,
): Promise<void> {
	let adapterError: Error | undefined;
	try {
		await raceWithLoadTimeout(
			backend.load(elements, context),
			tags,
			loadTimeoutMs,
		);
	} catch (err) {
		adapterError = err instanceof Error ? err : new Error(String(err));
	}

	const verification = await Promise.all(
		tags.map(async (tag) => {
			if (isRegistered(tag)) return { tag, ok: true as const };
			try {
				await whenDefinedWithTimeout(tag, timeoutMs);
				return { tag, ok: true as const };
			} catch {
				return { tag, ok: false as const };
			}
		}),
	);

	const unregistered = new Set<ElementTag>();
	const reasons = new Map<ElementTag, RegistrationFailureReason>();
	for (const v of verification) {
		if (v.ok) continue;
		unregistered.add(v.tag);
		const adapterReason = extractAdapterReason(adapterError, v.tag);
		reasons.set(
			v.tag,
			adapterReason ?? { kind: "timeout", tag: v.tag, timeoutMs },
		);
	}

	if (unregistered.size > 0) {
		throw new ElementLoaderError(
			`Element registration failed; missing tags: ${[...unregistered].join(", ")}`,
			unregistered,
			reasons,
		);
	}
}

/**
 * Race the backend's `load()` against a cumulative deadline.
 *
 * On timeout, synthesize an `AdapterFailure` whose `reasons` map carries
 * a `kind: "timeout"` entry per requested tag. The verification pass in
 * `runEnsureRegistered` will then produce a normal `ElementLoaderError`
 * with structured per-tag reasons — same surface shape as any other
 * adapter rejection.
 */
async function raceWithLoadTimeout(
	loadPromise: Promise<void>,
	tags: ElementTag[],
	loadTimeoutMs: number,
): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			loadPromise,
			new Promise<void>((_, reject) => {
				timer = setTimeout(() => {
					const reasons = new Map<ElementTag, RegistrationFailureReason>();
					for (const tag of tags) {
						reasons.set(tag, {
							kind: "timeout",
							tag,
							timeoutMs: loadTimeoutMs,
						});
					}
					reject(new AdapterFailure(reasons));
				}, loadTimeoutMs);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

/**
 * Synchronously assert that every tag is already in `customElements`.
 * Throws `ElementAssertionError` with diagnostic detail otherwise.
 *
 * Used by hosts that opt into the "preloaded" strategy — they pre-register
 * elements out-of-band and want a loud failure if anything is missing.
 */
export function assertRegistered(tags: ElementTag[]): void {
	if (!tags || tags.length === 0) return;
	const missing = tags.filter((tag) => !isRegistered(tag));
	if (missing.length === 0) return;
	throw new ElementAssertionError(tags, missing, snapshotRegisteredTags());
}

// ─── Internals ───────────────────────────────────────────────────────────────

function resolveBackend(backend: BackendOption): ElementLoaderBackend {
	if (isDirectBackend(backend)) return backend;
	if ("kind" in backend) {
		if (backend.kind === "iife") return createIifeBackend(backend);
		if (backend.kind === "esm") return createEsmBackend(backend);
	}
	throw new Error("ElementLoader: invalid backend option");
}

function isDirectBackend(backend: BackendOption): backend is ElementLoaderBackend {
	return (
		typeof (backend as { load?: unknown }).load === "function" &&
		!("kind" in backend)
	);
}

function resolveDoc(doc: Document | undefined): Document {
	if (doc) return doc;
	if (typeof document !== "undefined") return document;
	throw new Error(
		"ElementLoader: no Document available; pass options.doc explicitly",
	);
}

function buildDedupKey(backend: BackendOption, elements: ElementMap): string {
	const backendKey = backendKeyOf(backend);
	const entries = Object.entries(elements).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	return `${backendKey}|${JSON.stringify(entries)}`;
}

const backendIds = new WeakMap<ElementLoaderBackend, string>();
let nextBackendId = 0;

function backendKeyOf(backend: BackendOption): string {
	if (isDirectBackend(backend)) {
		let id = backendIds.get(backend);
		if (!id) {
			id = `b${++nextBackendId}`;
			backendIds.set(backend, id);
		}
		return `backend#${id}`;
	}
	if ("kind" in backend) {
		if (backend.kind === "iife") {
			return [
				"iife",
				backend.bundleHost,
				backend.bundleType ?? "",
				backend.needsControllers ?? true,
			].join("|");
		}
		if (backend.kind === "esm") {
			return [
				"esm",
				backend.cdnBaseUrl,
				backend.moduleResolution ?? "url",
				backend.view ?? "delivery",
				backend.loadControllers ?? true,
			].join("|");
		}
	}
	return "unknown";
}

function allAlreadyRegistered(tags: ElementTag[]): boolean {
	return tags.every((tag) => isRegistered(tag));
}

function isRegistered(tag: ElementTag): boolean {
	if (typeof customElements === "undefined") return false;
	return customElements.get(tag) !== undefined;
}

async function whenDefinedWithTimeout(
	tag: ElementTag,
	timeoutMs: number,
): Promise<void> {
	if (typeof customElements === "undefined") {
		throw new Error(`no customElements to await ${tag}`);
	}
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			customElements.whenDefined(tag).then(() => undefined),
			new Promise<void>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error(`Timeout waiting for ${tag}`)),
					timeoutMs,
				);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

function snapshotRegisteredTags(): ElementTag[] {
	if (typeof customElements === "undefined") return [];
	// Standard `CustomElementRegistry` does not expose iteration. Tests install
	// a scripted registry with a `__pieSnapshot` extension to make diagnostic
	// messages assertable. Production falls through to an empty list —
	// still strictly better than today's "missing tags: X" error which leaks
	// no registry state at all.
	const reg = customElements as unknown as {
		__pieSnapshot?: () => ElementTag[];
	};
	if (typeof reg.__pieSnapshot === "function") {
		try {
			return reg.__pieSnapshot();
		} catch {
			return [];
		}
	}
	return [];
}

function extractAdapterReason(
	err: Error | undefined,
	tag: ElementTag,
): RegistrationFailureReason | undefined {
	if (!err) return undefined;
	if (err instanceof AdapterFailure) return err.reasons.get(tag);
	return { kind: "backend-rejected", tag, cause: err.message };
}

// ─── Test-only helpers ───────────────────────────────────────────────────────

/**
 * Internal helpers for test harnesses. Not part of the public runtime API;
 * production code should never reach for these.
 *
 * @internal
 */
export const __testing = {
	resetDedupState(): void {
		inFlightRequests.clear();
	},
	inFlightCount(): number {
		return inFlightRequests.size;
	},
};
