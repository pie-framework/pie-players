/**
 * Word lookup for the dictionary tool.
 *
 * Only what a dictionary entry is, and how to read one out of a host payload, lives
 * here. Term normalisation, the "is this a headword" guard, request sequencing and the
 * POST client are shared with the picture dictionary in
 * `@pie-players/pie-players-shared/tools/term-lookup` — the two tools differ in what a
 * result carries and in nothing else.
 *
 * PIE ships no endpoint. A host supplies one, because the corpus behind a dictionary
 * is licensed per programme and naming a default here would bake one deployment into
 * the package.
 */

import {
	createEndpointTermLookup,
	readTermLookupPayload,
	type TermLookup,
	type TermLookupRequest,
	type TermLookupResult,
} from "@pie-players/pie-players-shared/tools/term-lookup";

/** Names the service in the messages a learner reads. */
const SERVICE_LABEL = "dictionary";

/** What a host's dictionary service is asked for. */
export type DictionaryLookupRequest = TermLookupRequest;

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

export type DictionaryLookupResult = TermLookupResult<DictionaryEntry>;

export type DictionaryLookup = TermLookup<DictionaryEntry>;

/** Entries a single lookup may render before the tool stops asking for more. */
export const DEFAULT_MAX_ENTRIES = 6;

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
	// An entry with no definition is not an entry. Rendering the headword alone would
	// tell a learner the word exists and nothing they asked for.
	if (senses.length === 0) return null;
	return {
		word,
		pronunciation:
			typeof record.pronunciation === "string" ? record.pronunciation : undefined,
		senses,
	};
}

/** Read a host response into a result, ignoring unknown extra fields. */
export function readLookupResponse(payload: unknown): DictionaryLookupResult {
	return readTermLookupPayload(payload, {
		serviceLabel: SERVICE_LABEL,
		keys: ["entries"],
		toItem: toEntry,
	});
}

/**
 * A lookup that POSTs to a host endpoint.
 *
 * The session cookie rides along by default, because a host is expected to put its
 * dictionary route behind the same session boundary as the assessment; `credentials`
 * and `headers` are there for a host that authorises some other way.
 */
export function createEndpointLookup(args: {
	endpoint: string;
	headers?: () => Promise<Record<string, string>> | Record<string, string>;
	credentials?: RequestCredentials;
	fetchImpl?: typeof fetch;
}): DictionaryLookup {
	return createEndpointTermLookup<DictionaryEntry>({
		...args,
		serviceLabel: SERVICE_LABEL,
		readResponse: readLookupResponse,
	});
}
