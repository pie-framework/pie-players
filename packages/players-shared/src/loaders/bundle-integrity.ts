/**
 * Subresource Integrity for the code the loaders run: an IIFE bundle, and the
 * ESM element, controller and shared-dependency modules and the package.json
 * files they read.
 *
 * The browser enforces the hash: the IIFE adapter sets it on the bundle's
 * `<script>`, the ESM adapter writes it into the import map and passes it to
 * `fetch`. A failed check looks like any other failed load, so after a load
 * with a hash fails the adapter fetches the URL once more and digests it,
 * which separates a bundle whose bytes changed from one that is missing or
 * still building. Delivery stays on `<script src>` and `import()`: running
 * the fetched bytes from a `blob:` URL would make every host admit `blob:` in
 * `script-src`, and would break bundles that resolve their chunks from
 * `document.currentScript`.
 */

import type { InstrumentationProvider } from "../instrumentation/types.js";

/**
 * SRI metadata (`sha384-<base64>`) by the absolute URL it covers, the shape
 * of an import map's `integrity` section.
 */
export type IntegrityMap = Readonly<Record<string, string>>;

/**
 * Why a check refused a URL: its bytes hash to another value, no hash was
 * supplied where `requireIntegrity` demands one, or the supplied value is not
 * SRI metadata a browser would enforce.
 */
export type BundleIntegrityCause = "mismatch" | "missing" | "malformed";

/** The detail of `pie-bundle-integrity-failed`. */
export type BundleIntegrityFailure = {
	/** The bundle, module or package.json URL the check covered. */
	url: string;
	cause: BundleIntegrityCause;
	/** The metadata the host supplied; absent on `missing`. */
	expected?: string;
	/** The served bytes' digest in the algorithm `expected` names; on `mismatch` only. */
	actual?: string;
};

/** Dispatched on `window` each time a loader refuses code its hash does not cover. */
export const BUNDLE_INTEGRITY_FAILED_EVENT = "pie-bundle-integrity-failed";

export class BundleIntegrityError extends Error {
	override readonly name = "BundleIntegrityError";

	constructor(readonly failure: BundleIntegrityFailure) {
		super(describeBundleIntegrityFailure(failure));
	}
}

export function describeBundleIntegrityFailure(
	failure: BundleIntegrityFailure,
): string {
	switch (failure.cause) {
		case "mismatch":
			return `${failure.url} does not match its integrity ${failure.expected}; the served bytes hash to ${failure.actual}`;
		case "missing":
			return `${failure.url} has no integrity hash, and requireIntegrity refuses it`;
		case "malformed":
			return `${failure.url} has integrity "${failure.expected}", which is not sha256, sha384 or sha512 SRI metadata`;
	}
}

type HashAlgorithm = "sha256" | "sha384" | "sha512";

const SUBTLE_ALGORITHMS: Record<HashAlgorithm, string> = {
	sha256: "SHA-256",
	sha384: "SHA-384",
	sha512: "SHA-512",
};

/** Unpadded base64 length of each digest. */
const DIGEST_LENGTHS: Record<HashAlgorithm, number> = {
	sha256: 43,
	sha384: 64,
	sha512: 86,
};

const ALGORITHM_STRENGTH: readonly HashAlgorithm[] = [
	"sha512",
	"sha384",
	"sha256",
];

const HASH_TOKEN = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})(?:\?\S*)?$/;

type HashToken = { algorithm: HashAlgorithm; digest: string };

function parseHashTokens(metadata: string): HashToken[] {
	const tokens: HashToken[] = [];
	for (const token of metadata.trim().split(/\s+/)) {
		const match = HASH_TOKEN.exec(token);
		if (!match) continue;
		const algorithm = match[1] as HashAlgorithm;
		if (match[2].replace(/=+$/, "").length !== DIGEST_LENGTHS[algorithm]) {
			continue;
		}
		tokens.push({ algorithm, digest: match[2] });
	}
	return tokens;
}

/**
 * Whether a browser would enforce `metadata`. It skips every token it cannot
 * parse, and metadata with no token left passes any bytes, so a typo would
 * otherwise turn the check off without a trace.
 */
export function isEnforceableIntegrity(metadata: unknown): metadata is string {
	return typeof metadata === "string" && parseHashTokens(metadata).length > 0;
}

/** An `IntegrityMap` keyed by normalized URL. */
export type IntegrityIndex = ReadonlyMap<string, string>;

export function normalizeIntegrityUrl(url: string, base?: string): string {
	try {
		return new URL(url, base).href;
	} catch {
		return url;
	}
}

export function indexIntegrity(
	map: IntegrityMap | undefined,
	base?: string,
): IntegrityIndex {
	const index = new Map<string, string>();
	if (!map || typeof map !== "object") return index;
	for (const [url, metadata] of Object.entries(map)) {
		const key = normalizeIntegrityUrl(url, base);
		if (!index.has(key)) index.set(key, String(metadata));
	}
	return index;
}

export type IntegrityLookup =
	| { status: "found"; integrity: string }
	| { status: "malformed"; integrity: string }
	| { status: "missing" };

/** The entry for the first of `urls` the index holds. */
export function lookupIntegrity(
	index: IntegrityIndex,
	urls: readonly string[],
): IntegrityLookup {
	for (const url of urls) {
		const integrity = index.get(normalizeIntegrityUrl(url));
		if (integrity === undefined) continue;
		return isEnforceableIntegrity(integrity)
			? { status: "found", integrity }
			: { status: "malformed", integrity };
	}
	return { status: "missing" };
}

/**
 * The failure a lookup amounts to before anything is requested: a malformed
 * hash always, a missing one when `requireIntegrity` is set.
 */
export function integrityRefusal(
	lookup: IntegrityLookup,
	url: string,
	requireIntegrity: boolean,
): BundleIntegrityFailure | undefined {
	if (lookup.status === "malformed") {
		return { url, cause: "malformed", expected: lookup.integrity };
	}
	if (lookup.status === "missing" && requireIntegrity) {
		return { url, cause: "missing" };
	}
	return undefined;
}

export type IntegrityDiagnosis =
	| { verdict: "mismatch"; actual: string }
	| { verdict: "match" }
	| { verdict: "unavailable"; reason: string };

type DiagnosisScope = {
	fetch?: (input: string, init?: RequestInit) => Promise<Response>;
	crypto?: { subtle?: SubtleCrypto };
};

/**
 * Fetch `url` and digest it, after a load that carried `expected` failed. The
 * request uses the HTTP cache, so it normally hashes the bytes the browser
 * refused. `unavailable` when the URL does not answer 2xx (a bundle still
 * building), or the page cannot fetch it or has no SubtleCrypto (an insecure
 * context, or a `connect-src` that leaves the host out).
 */
export async function diagnoseIntegrity(
	url: string,
	expected: string,
	scope: DiagnosisScope | null | undefined = globalThis as DiagnosisScope,
): Promise<IntegrityDiagnosis> {
	const tokens = parseHashTokens(expected);
	const algorithm = ALGORITHM_STRENGTH.find((candidate) =>
		tokens.some((token) => token.algorithm === candidate),
	);
	if (!algorithm) return { verdict: "unavailable", reason: "no hash to compare" };
	const fetchImpl = scope?.fetch ?? (globalThis as DiagnosisScope).fetch;
	const subtle =
		scope?.crypto?.subtle ?? (globalThis as DiagnosisScope).crypto?.subtle;
	if (typeof fetchImpl !== "function" || !subtle) {
		return { verdict: "unavailable", reason: "fetch or SubtleCrypto missing" };
	}
	let bytes: ArrayBuffer;
	try {
		const response = await fetchImpl(url, {
			mode: "cors",
			credentials: "omit",
		});
		if (!response.ok) {
			return { verdict: "unavailable", reason: `HTTP ${response.status}` };
		}
		bytes = await response.arrayBuffer();
	} catch (error) {
		return {
			verdict: "unavailable",
			reason: error instanceof Error ? error.message : String(error),
		};
	}
	const digest = base64(
		await subtle.digest(SUBTLE_ALGORITHMS[algorithm], bytes),
	);
	const matches = tokens.some(
		(token) =>
			token.algorithm === algorithm &&
			token.digest.replace(/=+$/, "") === digest.replace(/=+$/, ""),
	);
	return matches
		? { verdict: "match" }
		: { verdict: "mismatch", actual: `${algorithm}-${digest}` };
}

function base64(buffer: ArrayBuffer): string {
	let binary = "";
	for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/**
 * Dispatch `pie-bundle-integrity-failed` on `target` and record it with the
 * provider: a `trackEvent` for the count, a `trackError` for the alert.
 */
export function reportBundleIntegrityFailure(
	failure: BundleIntegrityFailure,
	options: {
		target?: EventTarget | null;
		provider?: InstrumentationProvider;
		component: string;
	},
): void {
	try {
		options.target?.dispatchEvent(
			new CustomEvent<BundleIntegrityFailure>(BUNDLE_INTEGRITY_FAILED_EVENT, {
				detail: { ...failure },
			}),
		);
	} catch {
		// A listener's error, or no CustomEvent: reporting must not change the load.
	}
	const provider = options.provider;
	if (!provider) return;
	const attributes = {
		url: failure.url,
		cause: failure.cause,
		component: options.component,
		...(failure.expected !== undefined ? { expected: failure.expected } : {}),
		...(failure.actual !== undefined ? { actual: failure.actual } : {}),
	};
	try {
		provider.trackEvent(BUNDLE_INTEGRITY_FAILED_EVENT, attributes);
	} catch {
		// Swallow: instrumentation must never break loading.
	}
	try {
		provider.trackError(new BundleIntegrityError(failure), {
			...attributes,
			errorType: "BundleIntegrityError",
		});
	} catch {
		// Swallow: instrumentation must never break loading.
	}
}

/**
 * Dispatched on `window` once per URL a loader runs without a hash although
 * the host supplied `integrity`.
 */
export const BUNDLE_INTEGRITY_UNCHECKED_EVENT = "pie-bundle-integrity-unchecked";

/** The detail of `pie-bundle-integrity-unchecked`. */
export type BundleIntegrityUnchecked = {
	/** The bundle, module or package.json URL that loads without a check. */
	url: string;
};

const NO_TARGET = {};
const uncheckedUrls = new WeakMap<object, Set<string>>();

/**
 * Report code that loads without a hash where the host supplied hashes: an
 * entry keyed by another URL, or a bundle with no recorded hash. Once per URL
 * and window, as a console warning, the event and a `trackEvent`. The load
 * goes ahead; refusing it is `requireIntegrity`'s.
 */
export function reportBundleIntegrityUnchecked(
	url: string,
	options: {
		target?: EventTarget | null;
		provider?: InstrumentationProvider;
		component: string;
	},
): void {
	const key = options.target ?? NO_TARGET;
	let seen = uncheckedUrls.get(key);
	if (!seen) {
		seen = new Set();
		uncheckedUrls.set(key, seen);
	}
	if (seen.has(url)) return;
	seen.add(url);
	if (typeof console !== "undefined" && console.warn) {
		console.warn(
			`[${options.component}] ${url} loads without an integrity check: integrity has no entry for it`,
		);
	}
	try {
		options.target?.dispatchEvent(
			new CustomEvent<BundleIntegrityUnchecked>(
				BUNDLE_INTEGRITY_UNCHECKED_EVENT,
				{ detail: { url } },
			),
		);
	} catch {
		// A listener's error, or no CustomEvent: reporting must not change the load.
	}
	try {
		options.provider?.trackEvent(BUNDLE_INTEGRITY_UNCHECKED_EVENT, {
			url,
			component: options.component,
		});
	} catch {
		// Swallow: instrumentation must never break loading.
	}
}

/** The window a document's loads report on. */
export function integrityEventTarget(doc: Document): EventTarget | null {
	const view = (doc as { defaultView?: unknown }).defaultView;
	if (view && typeof (view as EventTarget).dispatchEvent === "function") {
		return view as EventTarget;
	}
	const win = (globalThis as { window?: unknown }).window;
	return win && typeof (win as EventTarget).dispatchEvent === "function"
		? (win as EventTarget)
		: null;
}
