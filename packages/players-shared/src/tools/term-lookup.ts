/**
 * Term lookup, shared by the dictionary tools.
 *
 * A dictionary and a picture dictionary differ only in what a result carries: one
 * returns definitions, the other pictures. Everything up to that point is the same
 * concern — normalising what a text selection dragged in, deciding whether a term is
 * worth a request, telling "no entry for this word" apart from "the service did not
 * answer", and not letting a superseded lookup overwrite a newer one's state. That is
 * the part worth getting right once and testing without a browser, so it lives here
 * and each tool supplies only its item reader.
 *
 * Nothing here names a capability or a service. PIE ships no dictionary endpoint: the
 * corpus behind one is licensed per programme, so a host supplies either an endpoint
 * or a resolver of its own.
 */

/** What a host's term service is asked for. */
export interface TermLookupRequest {
	/** The term, already normalised by {@link normalizeTerm}. */
	keyword: string;
	/** BCP-47 tag the learner is reading in, when the host declares one. */
	language?: string;
	/** Upper bound on items, so a host cannot be made to return an unbounded page. */
	max?: number;
}

/**
 * A lookup outcome, as a discriminated union.
 *
 * `empty` and `error` are separate states because they need different words in front
 * of a learner: one means the service has no entry for what they selected, the other
 * means it did not answer. Collapsing them tells a learner their word is not real
 * when the network is down.
 */
export type TermLookupResult<TItem> =
	| { status: "ok"; items: TItem[] }
	| { status: "empty" }
	| { status: "error"; reason: string };

export type TermLookup<TItem> = (
	request: TermLookupRequest,
	signal?: AbortSignal,
) => Promise<TermLookupResult<TItem>>;

/** Longest term worth sending. Past this it is prose, not a headword. */
export const MAX_LOOKUP_TERM_LENGTH = 80;

/** Words a term may span. Generous enough for `carbon dioxide` and `mother in law`. */
export const MAX_LOOKUP_TERM_WORDS = 4;

/**
 * Collapse whitespace and strip the punctuation a text selection drags along.
 *
 * A learner double-clicking a word at the end of a sentence selects `"reason."`, and
 * a drag across a line break selects `"photo-\nsynthesis"`. Leading and trailing
 * punctuation goes; internal hyphens and apostrophes stay, because `mother-in-law`
 * and `don't` are the entries.
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
 * A whole sentence is not a lookup, and sending it wastes a request that will miss.
 */
export function isLookupableTerm(term: string): boolean {
	if (!term) return false;
	if (term.length > MAX_LOOKUP_TERM_LENGTH) return false;
	return term.split(" ").length <= MAX_LOOKUP_TERM_WORDS;
}

/**
 * Read a host payload into a result.
 *
 * `keys` are the payload fields to accept the item array under, in order, so a tool
 * can take more than one spelling of the same field. Unknown extra fields are ignored
 * rather than rejected, so a host can extend its payload without this package having
 * to agree first. An item its reader rejects is dropped rather than failing the whole
 * response: one malformed entry should not cost the learner the others.
 */
export function readTermLookupPayload<TItem>(
	payload: unknown,
	args: {
		/** Names the service in messages a learner reads, e.g. `"dictionary"`. */
		serviceLabel: string;
		keys: readonly string[];
		toItem: (value: unknown) => TItem | null;
	},
): TermLookupResult<TItem> {
	if (!payload || typeof payload !== "object") {
		return {
			status: "error",
			reason: `The ${args.serviceLabel} returned no data.`,
		};
	}
	const record = payload as Record<string, unknown>;
	let raw: unknown[] | null = null;
	for (const key of args.keys) {
		if (Array.isArray(record[key])) {
			raw = record[key] as unknown[];
			break;
		}
	}
	if (!raw) {
		return {
			status: "error",
			reason: `The ${args.serviceLabel} response was unreadable.`,
		};
	}
	const items = raw
		.map(args.toItem)
		.filter((item): item is TItem => item !== null);
	return items.length > 0 ? { status: "ok", items } : { status: "empty" };
}

/**
 * A lookup that POSTs to a host endpoint.
 *
 * `credentials: "same-origin"` by default. The endpoint a host names is expected to
 * sit behind the same session boundary as the assessment itself, so the session
 * cookie is exactly what authorises it and requiring a host to wire a token to get
 * its own already-authenticated route to answer is a configuration step it would
 * reasonably forget. Cross-origin requests still send nothing. A host that authorises
 * some other way passes `headers`, and one that wants no ambient credentials at all
 * passes `credentials: "omit"`.
 */
export function createEndpointTermLookup<TItem>(args: {
	endpoint: string;
	/** Names the service in messages a learner reads, e.g. `"dictionary"`. */
	serviceLabel: string;
	/** Reads a host payload into a result; usually {@link readTermLookupPayload}. */
	readResponse: (payload: unknown) => TermLookupResult<TItem>;
	headers?: () => Promise<Record<string, string>> | Record<string, string>;
	credentials?: RequestCredentials;
	fetchImpl?: typeof fetch;
}): TermLookup<TItem> {
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
				reason: `The ${args.serviceLabel} could not be authorized.`,
			};
		}
		try {
			const response = await doFetch(args.endpoint, {
				method: "POST",
				headers,
				credentials: args.credentials ?? "same-origin",
				body: JSON.stringify(request),
				signal,
			});
			if (!response.ok) {
				return {
					status: "error",
					reason: `The ${args.serviceLabel} is unavailable (${response.status}).`,
				};
			}
			return args.readResponse(await response.json());
		} catch (cause) {
			// An aborted request is a newer lookup superseding this one, not a failure
			// the learner should be told about.
			if (cause instanceof DOMException && cause.name === "AbortError") {
				return { status: "empty" };
			}
			return {
				status: "error",
				reason: `The ${args.serviceLabel} could not be reached.`,
			};
		}
	};
}

/** What a term panel is showing. */
export type TermPanelState<TItem> =
	| { kind: "unconfigured" }
	| { kind: "idle" }
	| { kind: "searching"; term: string }
	| { kind: "results"; term: string; items: TItem[] }
	| { kind: "empty"; term: string }
	| { kind: "error"; term: string; reason: string };

/** Shown when the learner sends something that is not a headword. */
export const NOT_A_TERM_REASON = "Look up a single word or short phrase.";

export interface TermLookupSessionOptions<TItem> {
	/**
	 * Read at call time rather than captured, so a resolver that arrives after mount —
	 * a host setting `endpoint` on a live element — is picked up without a remount.
	 */
	resolver: () => TermLookup<TItem> | null;
	max: number;
	language?: () => string | undefined;
	/** Applied on every transition. The component holds the state; this drives it. */
	onState: (state: TermPanelState<TItem>) => void;
}

/**
 * The lookup half of a term panel: request sequencing and state transitions, with no
 * framework reactivity of its own.
 *
 * Deliberately not a rune module. Rune modules in this package are source-only and
 * each consumer has to alias them in its own Vite and TypeScript config; a plain
 * class costs a caller one `$state` field instead, and is unit-testable directly.
 */
export class TermLookupSession<TItem> {
	/** Cancels a lookup the learner has already superseded. */
	#inFlight: AbortController | null = null;
	/** The term the last lookup ran for, so a repeat of it is not re-issued. */
	#searchedFor = "";

	constructor(private readonly options: TermLookupSessionOptions<TItem>) {}

	get searchedFor(): string {
		return this.#searchedFor;
	}

	/**
	 * Reconcile the unconfigured notice with whether a resolver exists.
	 *
	 * A tool with nowhere to look words up says so, rather than offering a field that
	 * silently fails: the host has misconfigured it and the learner needs to know it is
	 * not their typing. Called with the current state because it only ever moves
	 * between `idle` and `unconfigured` — a resolver arriving mid-lookup must not
	 * discard results the learner is reading.
	 */
	syncConfigured(current: TermPanelState<TItem>): void {
		const resolver = this.options.resolver();
		if (!resolver && current.kind === "idle") {
			this.options.onState({ kind: "unconfigured" });
			return;
		}
		if (resolver && current.kind === "unconfigured") {
			this.options.onState({ kind: "idle" });
		}
	}

	async run(raw: string): Promise<void> {
		const resolver = this.options.resolver();
		if (!resolver) {
			this.options.onState({ kind: "unconfigured" });
			return;
		}
		const keyword = normalizeTerm(raw);
		if (!isLookupableTerm(keyword)) {
			this.options.onState({
				kind: "error",
				term: keyword,
				reason: NOT_A_TERM_REASON,
			});
			return;
		}
		this.#inFlight?.abort();
		const controller = new AbortController();
		this.#inFlight = controller;
		this.#searchedFor = keyword;
		this.options.onState({ kind: "searching", term: keyword });
		const result = await resolver(
			{
				keyword,
				language: this.options.language?.() || undefined,
				max: this.options.max,
			},
			controller.signal,
		);
		// A superseded lookup must not overwrite the newer one's state.
		if (controller !== this.#inFlight) return;
		this.#inFlight = null;
		if (result.status === "ok") {
			this.options.onState({ kind: "results", term: keyword, items: result.items });
			return;
		}
		if (result.status === "empty") {
			this.options.onState({ kind: "empty", term: keyword });
			return;
		}
		this.options.onState({
			kind: "error",
			term: keyword,
			reason: result.reason,
		});
	}
}

/**
 * The panel's live-region text.
 *
 * Only the states a learner is waiting on announce. `idle`, `unconfigured` and
 * `error` are already rendered as visible text in the panel body, and repeating them
 * here would announce the same sentence twice.
 */
export function termPanelStatusMessage<TItem>(
	state: TermPanelState<TItem>,
	labels: {
		/** e.g. `2 entries`, `1 picture`. */
		countLabel: (count: number) => string;
		emptyLabel: (term: string) => string;
	},
): string {
	if (state.kind === "searching") return `Looking up ${state.term}`;
	if (state.kind === "results") {
		return `${labels.countLabel(state.items.length)} for ${state.term}`;
	}
	if (state.kind === "empty") return labels.emptyLabel(state.term);
	return "";
}
