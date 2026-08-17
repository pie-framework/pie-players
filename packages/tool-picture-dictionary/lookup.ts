/**
 * Picture lookup for the picture dictionary tool.
 *
 * Only what a picture is, and whether one is safe to render, lives here. Term
 * normalisation, the "is this a headword" guard, request sequencing and the POST client
 * are shared with the word dictionary in
 * `@pie-players/pie-players-shared/tools/term-lookup`.
 *
 * PIE ships no endpoint: the symbol corpus behind a picture dictionary is licensed, so
 * a host supplies both the endpoint and the credentials for it.
 */

import {
	createEndpointTermLookup,
	readTermLookupPayload,
	type TermLookup,
	type TermLookupRequest,
	type TermLookupResult,
} from "@pie-players/pie-players-shared/tools/term-lookup";

/** Names the service in the messages a learner reads. */
const SERVICE_LABEL = "picture dictionary";

export type PictureLookupRequest = TermLookupRequest;

export interface PictureResult {
	/** `https:`, protocol-relative or same-origin URL. Signed, short-lived URLs are fine. */
	url: string;
	/**
	 * What the picture shows.
	 *
	 * Becomes the image's `alt`. For this tool the picture *is* the definition, so it
	 * is never decorative and never gets an empty `alt`; without a caption the keyword
	 * stands in.
	 */
	caption?: string;
	width?: number;
	height?: number;
}

export type PictureLookupResult = TermLookupResult<PictureResult>;

export type PictureLookup = TermLookup<PictureResult>;

/** Pictures a single lookup may render. A symbol set rarely has more than a few. */
export const DEFAULT_MAX_PICTURES = 4;

/**
 * Whether a URL is safe to put in `src`.
 *
 * `https:`, protocol-relative and same-origin paths pass; everything else is refused.
 * `javascript:` and `data:` because a response reaches an attribute the browser
 * executes for some schemes and a symbol service has no reason to return either, and
 * plain `http:` because it is mixed content on every https deployment — the browser
 * blocks it and the learner gets a broken image where the definition should be, which
 * is the outcome this guard exists to prevent.
 *
 * A leading `/` is checked by resolving rather than by prefix: `/\evil.example/x.png`
 * looks like a path and resolves to `https://evil.example/x.png`, because a backslash
 * is a path separator for special schemes and a tab is stripped outright. Both land on
 * https, so neither defeats the mixed-content guard — but "same-origin" is what this
 * function says it means, so it is what it checks.
 */
export function isRenderablePictureUrl(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	// Protocol-relative resolves to the page's scheme, which on any real deployment is
	// https; it is not a way to smuggle http in.
	if (trimmed.startsWith("//")) return true;
	if (/^https:\/\//iu.test(trimmed)) return true;
	if (!trimmed.startsWith("/")) return false;
	return isSameOriginPath(trimmed);
}

/**
 * A base no real deployment can be served from, so a value that escapes the path
 * position is visible as a change of host rather than blending into the real one.
 *
 * Resolved against this rather than the live document because the answer must not
 * depend on which page the panel is embedded in, and the tests run without a DOM.
 */
const PATH_PROBE_BASE = "https://pie-picture-dictionary.invalid";

function isSameOriginPath(value: string): boolean {
	try {
		return new URL(value, PATH_PROBE_BASE).origin === PATH_PROBE_BASE;
	} catch {
		return false;
	}
}

/** A trimmed string, or `""` for anything that is not one. */
function readPictureUrl(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function toPicture(value: unknown): PictureResult | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	// `image` is what PIE's own picture-dictionary service calls the URL: it answers
	// `{ images: [{ image }] }`, one signed object-storage URL per entry. Reading it
	// under both names is what lets that deployed service answer this panel with no
	// host resolver and no change on the server. A usable `url` wins if a payload carries
	// both — an empty one is not a preference, it is an absence, so the alias still gets
	// its turn rather than the picture being dropped over a field the host left blank.
	const url = readPictureUrl(record.url) || readPictureUrl(record.image);
	if (!isRenderablePictureUrl(url)) return null;
	const caption =
		typeof record.caption === "string" && record.caption.trim()
			? record.caption.trim()
			: undefined;
	return {
		url,
		caption,
		width: typeof record.width === "number" ? record.width : undefined,
		height: typeof record.height === "number" ? record.height : undefined,
	};
}

/** Read a host response into a result, ignoring unknown extra fields. */
export function readPictureResponse(payload: unknown): PictureLookupResult {
	return readTermLookupPayload(payload, {
		serviceLabel: SERVICE_LABEL,
		keys: ["pictures", "images"],
		toItem: toPicture,
	});
}

/**
 * A lookup that POSTs to a host endpoint.
 *
 * The session cookie rides along by default, because a host is expected to put its
 * picture route behind the same session boundary as the assessment; `credentials` and
 * `headers` are there for a host that authorises some other way.
 */
export function createEndpointLookup(args: {
	endpoint: string;
	headers?: () => Promise<Record<string, string>> | Record<string, string>;
	credentials?: RequestCredentials;
	fetchImpl?: typeof fetch;
}): PictureLookup {
	return createEndpointTermLookup<PictureResult>({
		...args,
		serviceLabel: SERVICE_LABEL,
		readResponse: readPictureResponse,
	});
}
