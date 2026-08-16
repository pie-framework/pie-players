/**
 * Keyword lookup for the picture dictionary.
 *
 * Request and response shaping live here so the parts worth testing without a
 * browser — normalising a selected word, rejecting a payload that would render a
 * broken image, telling "no picture for this word" apart from "the service failed" —
 * are unit tested.
 *
 * The request carries `keyword`, `language` and `max`, matching the shape a
 * picture-dictionary service is expected to accept. PIE ships no endpoint: the
 * symbol corpus behind a picture dictionary is licensed, so a host supplies both the
 * endpoint and the credentials for it.
 */

export interface PictureLookupRequest {
	/** The term, already normalised by {@link normalizeKeyword}. */
	keyword: string;
	/** BCP-47 tag, so a service can return the right locale's symbol set. */
	language?: string;
	/** Upper bound on pictures, so a host cannot be made to return an unbounded page. */
	max?: number;
}

export interface PictureResult {
	/** Absolute or same-origin URL. Signed, short-lived URLs are expected and fine. */
	url: string;
	/**
	 * What the picture shows.
	 *
	 * Becomes the image's `alt`. For this tool the picture *is* the definition, so it
	 * is never decorative and never gets an empty `alt`; without a caption the
	 * keyword stands in.
	 */
	caption?: string;
	width?: number;
	height?: number;
}

export type PictureLookupResult =
	| { status: "ok"; pictures: PictureResult[] }
	| { status: "empty" }
	| { status: "error"; reason: string };

export type PictureLookup = (
	request: PictureLookupRequest,
	signal?: AbortSignal,
) => Promise<PictureLookupResult>;

/** Pictures a single lookup may render. A symbol set rarely has more than a few. */
export const DEFAULT_MAX_PICTURES = 4;

/**
 * Collapse whitespace and strip the punctuation a text selection drags along.
 *
 * Internal hyphens and apostrophes stay: `mother-in-law` and `don't` are entries.
 */
export function normalizeKeyword(raw: string): string {
	return raw
		.replace(/\s+/gu, " ")
		.trim()
		.replace(/^[^\p{L}\p{N}]+/u, "")
		.replace(/[^\p{L}\p{N}]+$/u, "");
}

/** Whether a normalised keyword is worth sending. A selected sentence is not. */
export function isLookupableKeyword(keyword: string): boolean {
	if (!keyword) return false;
	if (keyword.length > 80) return false;
	return keyword.split(" ").length <= 4;
}

/**
 * Whether a URL is safe to put in `src`.
 *
 * `javascript:` and `data:` are rejected. A dictionary response is host data rather
 * than authored content, but it still reaches an attribute the browser executes for
 * some schemes, and a symbol service has no reason to return either.
 */
export function isRenderablePictureUrl(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (/^(?:https?:)?\/\//iu.test(trimmed)) return true;
	// Same-origin paths only; anything else with a scheme is refused.
	return trimmed.startsWith("/") && !trimmed.startsWith("//");
}

function toPicture(value: unknown): PictureResult | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const url = typeof record.url === "string" ? record.url.trim() : "";
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
	if (!payload || typeof payload !== "object") {
		return { status: "error", reason: "The picture dictionary returned no data." };
	}
	const record = payload as Record<string, unknown>;
	const raw = Array.isArray(record.pictures)
		? record.pictures
		: Array.isArray(record.images)
			? record.images
			: null;
	if (!raw) {
		return {
			status: "error",
			reason: "The picture dictionary response was unreadable.",
		};
	}
	const pictures = raw
		.map(toPicture)
		.filter((picture): picture is PictureResult => picture !== null);
	return pictures.length > 0 ? { status: "ok", pictures } : { status: "empty" };
}

/**
 * A lookup that POSTs to a host endpoint.
 *
 * `credentials: "omit"`: a host needing a token supplies `headers`, keeping the
 * decision to send credentials with whoever owns them.
 */
export function createEndpointLookup(args: {
	endpoint: string;
	headers?: () => Promise<Record<string, string>> | Record<string, string>;
	fetchImpl?: typeof fetch;
}): PictureLookup {
	const doFetch = args.fetchImpl ?? globalThis.fetch;
	return async (request, signal) => {
		if (typeof doFetch !== "function") {
			return { status: "error", reason: "No fetch implementation is available." };
		}
		let headers: Record<string, string> = {
			"content-type": "application/json",
		};
		try {
			const extra = await args.headers?.();
			if (extra) headers = { ...headers, ...extra };
		} catch {
			return {
				status: "error",
				reason: "The picture dictionary could not be authorized.",
			};
		}
		try {
			const response = await doFetch(args.endpoint, {
				method: "POST",
				headers,
				credentials: "omit",
				body: JSON.stringify(request),
				signal,
			});
			if (!response.ok) {
				return {
					status: "error",
					reason: `The picture dictionary is unavailable (${response.status}).`,
				};
			}
			return readPictureResponse(await response.json());
		} catch (cause) {
			// Abort means a newer lookup superseded this one.
			if (cause instanceof DOMException && cause.name === "AbortError") {
				return { status: "empty" };
			}
			return {
				status: "error",
				reason: "The picture dictionary could not be reached.",
			};
		}
	};
}
