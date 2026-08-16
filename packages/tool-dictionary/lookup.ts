/**
 * Term lookup for the dictionary tools.
 *
 * The request and response shaping live here rather than in the component so the
 * parts that are easy to get wrong — normalising what the learner typed, deciding
 * whether a payload is usable, telling "no entry for this word" apart from "the
 * service failed" — are unit tested without a browser.
 *
 * PIE ships no endpoint. A host supplies one, because the corpus behind a
 * dictionary is licensed per programme and naming a default here would bake one
 * deployment into the package.
 */

/** What a host's dictionary service is asked for. */
export interface DictionaryLookupRequest {
	/** The term, already normalised by {@link normalizeTerm}. */
	keyword: string;
	/** BCP-47 tag the learner is reading in, when the host declares one. */
	language?: string;
	/** Upper bound on entries, so a host cannot be made to return an unbounded page. */
	max?: number;
}

export interface DictionarySense {
	partOfSpeech?: string;
	definition: string;
	example?: string;
}

export interface DictionaryEntry {
	word: string;
	/** Respelling or IPA, whichever the host's corpus carries. */
	pronunciation?: string;
	senses: DictionarySense[];
}

/**
 * A lookup outcome, as a discriminated union.
 *
 * `empty` and `error` are separate states because they need different words in
 * front of a learner: one means the dictionary has no entry for what they
 * selected, the other means the dictionary did not answer. Collapsing them tells
 * a learner their word is not real when the network is down.
 */
export type DictionaryLookupResult =
	| { status: "ok"; entries: DictionaryEntry[] }
	| { status: "empty" }
	| { status: "error"; reason: string };

export type DictionaryLookup = (
	request: DictionaryLookupRequest,
	signal?: AbortSignal,
) => Promise<DictionaryLookupResult>;

/** Entries a single lookup may render before the tool stops asking for more. */
export const DEFAULT_MAX_ENTRIES = 6;

/**
 * Collapse whitespace and strip the punctuation a text selection drags along.
 *
 * A learner double-clicking a word at the end of a sentence selects `"reason."`,
 * and a drag across a line break selects `"photo-\nsynthesis"`. Leading and
 * trailing punctuation goes; internal hyphens and apostrophes stay, because
 * `mother-in-law` and `don't` are the entries.
 */
export function normalizeTerm(raw: string): string {
	return raw
		.replace(/\s+/gu, " ")
		.trim()
		.replace(/^[^\p{L}\p{N}]+/u, "")
		.replace(/[^\p{L}\p{N}]+$/u, "");
}

/**
 * Whether a normalised term is worth sending.
 *
 * A whole sentence is not a dictionary lookup, and sending it wastes a request
 * that will miss. The word cap is generous enough for `carbon dioxide` and
 * `mother in law` without accepting a selected paragraph.
 */
export function isLookupableTerm(term: string): boolean {
	if (!term) return false;
	if (term.length > 80) return false;
	return term.split(" ").length <= 4;
}

/** Guard for the shape a host's payload has to reach to be rendered. */
function toEntry(value: unknown): DictionaryEntry | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const word = typeof record.word === "string" ? record.word.trim() : "";
	if (!word) return null;
	const rawSenses = Array.isArray(record.senses) ? record.senses : [];
	const senses: DictionarySense[] = [];
	for (const rawSense of rawSenses) {
		if (!rawSense || typeof rawSense !== "object") continue;
		const senseRecord = rawSense as Record<string, unknown>;
		const definition =
			typeof senseRecord.definition === "string"
				? senseRecord.definition.trim()
				: "";
		if (!definition) continue;
		senses.push({
			definition,
			partOfSpeech:
				typeof senseRecord.partOfSpeech === "string"
					? senseRecord.partOfSpeech
					: undefined,
			example:
				typeof senseRecord.example === "string" ? senseRecord.example : undefined,
		});
	}
	// An entry with no definition is not an entry. Rendering the headword alone
	// would tell a learner the word exists and nothing they asked for.
	if (senses.length === 0) return null;
	return {
		word,
		pronunciation:
			typeof record.pronunciation === "string" ? record.pronunciation : undefined,
		senses,
	};
}

/**
 * Read a host response into a result.
 *
 * Unknown extra fields are ignored rather than rejected, so a host can extend its
 * payload without this package having to agree first.
 */
export function readLookupResponse(payload: unknown): DictionaryLookupResult {
	if (!payload || typeof payload !== "object") {
		return { status: "error", reason: "The dictionary returned no data." };
	}
	const record = payload as Record<string, unknown>;
	const rawEntries = Array.isArray(record.entries) ? record.entries : null;
	if (!rawEntries) {
		return { status: "error", reason: "The dictionary response was unreadable." };
	}
	const entries = rawEntries
		.map(toEntry)
		.filter((entry): entry is DictionaryEntry => entry !== null);
	return entries.length > 0 ? { status: "ok", entries } : { status: "empty" };
}

/**
 * A lookup that POSTs to a host endpoint.
 *
 * `credentials: "omit"` and no ambient auth: a host that needs a token supplies
 * `headers` through its own fetcher, keeping the decision to send credentials
 * with the host that owns them.
 */
export function createEndpointLookup(args: {
	endpoint: string;
	headers?: () => Promise<Record<string, string>> | Record<string, string>;
	fetchImpl?: typeof fetch;
}): DictionaryLookup {
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
				reason: "The dictionary could not be authorized.",
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
					reason: `The dictionary is unavailable (${response.status}).`,
				};
			}
			return readLookupResponse(await response.json());
		} catch (cause) {
			// An aborted request is a newer lookup superseding this one, not a failure
			// the learner should be told about.
			if (cause instanceof DOMException && cause.name === "AbortError") {
				return { status: "empty" };
			}
			return { status: "error", reason: "The dictionary could not be reached." };
		}
	};
}
