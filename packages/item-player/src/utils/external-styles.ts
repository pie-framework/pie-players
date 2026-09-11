import { scopeStylesheetCss } from "@pie-players/pie-players-shared";

type ScopedStyleEntry = {
	element: HTMLStyleElement;
	refCount: number;
};

type AcquireScopedStyleOptions = {
	document: Document;
	resolvedUrl: string;
	scopeClass: string;
	signal: AbortSignal;
	sourceUrl: string;
};

const stylesheetRequestsByDocument = new WeakMap<
	Document,
	Map<string, Promise<string>>
>();
const scopedStylesByDocument = new WeakMap<
	Document,
	Map<string, ScopedStyleEntry>
>();

const scopeSeed = Math.random().toString(36).slice(2, 10);
let nextScopeId = 0;

/**
 * Internal selector identity for one player instance. This exists only to
 * scope fetched CSS and is not a host-facing styling contract.
 */
export function createExternalStyleScopeClass(): string {
	nextScopeId += 1;
	return `pie-item-player-style-scope-${scopeSeed}-${nextScopeId.toString(36)}`;
}

function getScopedStyleEntries(
	document: Document,
): Map<string, ScopedStyleEntry> {
	let entries = scopedStylesByDocument.get(document);
	if (!entries) {
		entries = new Map();
		scopedStylesByDocument.set(document, entries);
	}
	return entries;
}

function fetchStylesheetText(
	document: Document,
	resolvedUrl: string,
): Promise<string> {
	let requests = stylesheetRequestsByDocument.get(document);
	if (!requests) {
		requests = new Map();
		stylesheetRequestsByDocument.set(document, requests);
	}
	const cached = requests.get(resolvedUrl);
	if (cached) return cached;

	const request = fetch(resolvedUrl).then((response) => response.text());
	requests.set(resolvedUrl, request);
	const evictSettledRequest = () => {
		if (requests.get(resolvedUrl) === request) {
			requests.delete(resolvedUrl);
			if (requests.size === 0) {
				stylesheetRequestsByDocument.delete(document);
			}
		}
	};
	void request.then(evictSettledRequest, evictSettledRequest);
	return request;
}

/**
 * Acquire one same-origin stylesheet materialization. Network work is shared by
 * resolved URL, while the resulting style node is shared only by URL + scope.
 */
export async function acquireScopedExternalStyle({
	document,
	resolvedUrl,
	scopeClass,
	signal,
	sourceUrl,
}: AcquireScopedStyleOptions): Promise<(() => void) | null> {
	if (signal.aborted) return null;

	const entries = getScopedStyleEntries(document);
	const entryKey = JSON.stringify([resolvedUrl, scopeClass]);
	const existing = entries.get(entryKey);
	if (existing) {
		existing.refCount += 1;
		return createRelease(entries, entryKey, existing);
	}

	const cssText = await fetchStylesheetText(document, resolvedUrl);
	if (signal.aborted) return null;

	// Another consumer may have materialized the same URL + scope while the
	// shared fetch was in flight.
	const materialized = entries.get(entryKey);
	if (materialized) {
		materialized.refCount += 1;
		return createRelease(entries, entryKey, materialized);
	}

	const style = document.createElement("style");
	style.setAttribute("data-pie-style", sourceUrl);
	style.textContent = scopeStylesheetCss(
		cssText,
		`.pie-item-player.${scopeClass}`,
	);
	const entry = { element: style, refCount: 1 };
	entries.set(entryKey, entry);
	document.head.appendChild(style);
	return createRelease(entries, entryKey, entry);
}

function createRelease(
	entries: Map<string, ScopedStyleEntry>,
	entryKey: string,
	entry: ScopedStyleEntry,
): () => void {
	let released = false;
	return () => {
		if (released) return;
		released = true;
		entry.refCount -= 1;
		if (entry.refCount > 0 || entries.get(entryKey) !== entry) return;
		entries.delete(entryKey);
		entry.element.remove();
	};
}

const cssEscapeValue = (document: Document, value: string): string => {
	const cssApi = document.defaultView?.CSS;
	if (typeof cssApi?.escape === "function") {
		return cssApi.escape(value);
	}
	return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
};

/**
 * Cross-origin CSS stays a document-global link because the browser may apply
 * it even when CORS prevents fetching and rewriting it. Keep the existing
 * URL-only, persistent link behavior for this compatibility path.
 */
export function ensureCrossOriginExternalStyle(
	document: Document,
	sourceUrl: string,
	resolvedUrl: string,
): void {
	const escapedUrl = cssEscapeValue(document, sourceUrl);
	if (document.querySelector(`link[data-pie-style-link="${escapedUrl}"]`)) {
		return;
	}
	const link = document.createElement("link");
	link.setAttribute("rel", "stylesheet");
	link.setAttribute("href", resolvedUrl);
	link.setAttribute("data-pie-style-link", sourceUrl);
	document.head.appendChild(link);
}
