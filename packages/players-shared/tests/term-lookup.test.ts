import { describe, expect, test } from "bun:test";

import {
	createEndpointTermLookup,
	isLookupableTerm,
	normalizeTerm,
	NOT_A_TERM_REASON,
	readTermLookupPayload,
	TermLookupSession,
	termPanelStatusMessage,
	type TermLookupResult,
	type TermPanelState,
} from "../src/tools/term-lookup.js";

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

/** The smallest item shape a reader can produce, for the payload tests. */
function toWord(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

describe("normalizing a term", () => {
	test("trailing sentence punctuation goes", () => {
		// A learner double-clicking the last word of a sentence selects "reason." —
		// sending the full stop misses an entry that exists.
		expect(normalizeTerm("reason.")).toBe("reason");
		expect(normalizeTerm("“photosynthesis”")).toBe("photosynthesis");
		expect(normalizeTerm("(evidence),")).toBe("evidence");
	});

	test("internal hyphens and apostrophes stay, because they are part of the entry", () => {
		expect(normalizeTerm("mother-in-law")).toBe("mother-in-law");
		expect(normalizeTerm("don't")).toBe("don't");
	});

	test("a selection spanning a line break collapses to one space", () => {
		expect(normalizeTerm("carbon\n  dioxide")).toBe("carbon dioxide");
		expect(normalizeTerm("  spaced   out  ")).toBe("spaced out");
	});

	test("non-Latin scripts survive, since the tools are offered in four locales", () => {
		expect(normalizeTerm("  光合成。 ")).toBe("光合成");
		expect(normalizeTerm("«التمثيل»")).toBe("التمثيل");
	});

	test("punctuation-only input normalizes to nothing", () => {
		expect(normalizeTerm("!!!")).toBe("");
		expect(normalizeTerm("   ")).toBe("");
	});
});

describe("deciding what is worth sending", () => {
	test("a word or short phrase is", () => {
		for (const term of ["reason", "carbon dioxide", "mother in law"]) {
			expect(isLookupableTerm(term)).toBe(true);
		}
	});

	test("a selected sentence is not", () => {
		// The request would miss, and a learner who selected a paragraph by accident
		// gets told to narrow it rather than watching a spinner.
		expect(
			isLookupableTerm("the process by which plants convert light into sugar"),
		).toBe(false);
	});

	test("an empty term is not", () => {
		expect(isLookupableTerm("")).toBe(false);
	});

	test("a single absurdly long token is not", () => {
		expect(isLookupableTerm("a".repeat(81))).toBe(false);
	});
});

describe("reading a host payload", () => {
	test("the first key that holds an array wins, so a tool can accept more than one spelling", () => {
		for (const key of ["pictures", "images"]) {
			const result = readTermLookupPayload(
				{ [key]: ["apple"] },
				{
					serviceLabel: "picture dictionary",
					keys: ["pictures", "images"],
					toItem: toWord,
				},
			);
			expect(result).toEqual({ status: "ok", items: ["apple"] });
		}
	});

	test("an item the reader rejects is dropped, not fatal to the rest", () => {
		const result = readTermLookupPayload(
			{ entries: ["  ", "reason"] },
			{
				serviceLabel: "dictionary",
				keys: ["entries"],
				toItem: toWord,
			},
		);
		expect(result).toEqual({ status: "ok", items: ["reason"] });
	});

	test("no usable items is empty, which is not an error", () => {
		const result = readTermLookupPayload(
			{ entries: ["  "] },
			{
				serviceLabel: "dictionary",
				keys: ["entries"],
				toItem: toWord,
			},
		);
		expect(result).toEqual({ status: "empty" });
	});

	test("unknown extra fields are ignored so a host can extend its payload", () => {
		const result = readTermLookupPayload(
			{ entries: ["reason"], totalCount: 99 },
			{ serviceLabel: "dictionary", keys: ["entries"], toItem: toWord },
		);
		expect(result.status).toBe("ok");
	});

	test("an unreadable payload is an error, which is not empty, and names the service", () => {
		// The distinction is the whole point: "no entry for your word" and "the service
		// did not answer" need different words in front of a learner.
		const args = {
			serviceLabel: "dictionary",
			keys: ["entries"],
			toItem: toWord,
		} as const;
		expect(readTermLookupPayload(null, args)).toEqual({
			status: "error",
			reason: "The dictionary returned no data.",
		});
		expect(readTermLookupPayload("nope", args).status).toBe("error");
		expect(readTermLookupPayload({}, args)).toEqual({
			status: "error",
			reason: "The dictionary response was unreadable.",
		});
		expect(
			readTermLookupPayload({ entries: "not-an-array" }, args).status,
		).toBe("error");
	});
});

describe("the endpoint lookup", () => {
	function wordLookup(args: {
		fetchImpl: typeof fetch;
		headers?: () => Record<string, string>;
		credentials?: RequestCredentials;
	}) {
		return createEndpointTermLookup<string>({
			endpoint: "/lookup",
			serviceLabel: "dictionary",
			readResponse: (payload): TermLookupResult<string> =>
				readTermLookupPayload(payload, {
					serviceLabel: "dictionary",
					keys: ["entries"],
					toItem: toWord,
				}),
			...args,
		});
	}

	test("posts the request and reads the response", async () => {
		let seen: { url: string; init: RequestInit } | null = null;
		const lookup = wordLookup({
			fetchImpl: (async (url: string, init: RequestInit) => {
				seen = { url, init };
				return jsonResponse({ entries: ["reason"] });
			}) as unknown as typeof fetch,
		});

		const result = await lookup({ keyword: "reason", language: "es", max: 6 });

		expect(result).toEqual({ status: "ok", items: ["reason"] });
		expect(seen?.url).toBe("/lookup");
		expect(seen?.init.method).toBe("POST");
		expect(JSON.parse(String(seen?.init.body))).toEqual({
			keyword: "reason",
			language: "es",
			max: 6,
		});
	});

	test("host headers are merged over the defaults", async () => {
		let headers: Record<string, string> = {};
		const lookup = wordLookup({
			headers: () => ({ authorization: "Bearer t" }),
			fetchImpl: (async (_url: string, init: RequestInit) => {
				headers = init.headers as Record<string, string>;
				return jsonResponse({ entries: [] });
			}) as unknown as typeof fetch,
		});

		await lookup({ keyword: "x" });

		expect(headers.authorization).toBe("Bearer t");
		expect(headers["content-type"]).toBe("application/json");
	});

	test("the session cookie rides along by default", async () => {
		// A host is expected to put its lookup route behind the same session boundary as
		// the assessment. Omitting credentials would 401 every such route and make a
		// working configuration depend on a step a host would reasonably not think of.
		let init: RequestInit | null = null;
		const lookup = wordLookup({
			fetchImpl: (async (_url: string, got: RequestInit) => {
				init = got;
				return jsonResponse({ entries: [] });
			}) as unknown as typeof fetch,
		});

		await lookup({ keyword: "x" });

		expect(init?.credentials).toBe("same-origin");
	});

	test("a host that wants no ambient credentials can say so", async () => {
		let init: RequestInit | null = null;
		const lookup = wordLookup({
			credentials: "omit",
			fetchImpl: (async (_url: string, got: RequestInit) => {
				init = got;
				return jsonResponse({ entries: [] });
			}) as unknown as typeof fetch,
		});

		await lookup({ keyword: "x" });

		expect(init?.credentials).toBe("omit");
	});

	test("a failing status is an error naming the service and the status", async () => {
		const lookup = wordLookup({
			fetchImpl: (async () => jsonResponse({}, 503)) as unknown as typeof fetch,
		});
		expect(await lookup({ keyword: "x" })).toEqual({
			status: "error",
			reason: "The dictionary is unavailable (503).",
		});
	});

	test("a header fetcher that throws is an authorization error, not a crash", async () => {
		const lookup = wordLookup({
			headers: () => {
				throw new Error("no token");
			},
			fetchImpl: (async () =>
				jsonResponse({ entries: [] })) as unknown as typeof fetch,
		});
		expect(await lookup({ keyword: "x" })).toEqual({
			status: "error",
			reason: "The dictionary could not be authorized.",
		});
	});

	test("a network failure is an error the learner can read", async () => {
		const lookup = wordLookup({
			fetchImpl: (async () => {
				throw new TypeError("Failed to fetch");
			}) as unknown as typeof fetch,
		});
		expect(await lookup({ keyword: "x" })).toEqual({
			status: "error",
			reason: "The dictionary could not be reached.",
		});
	});

	test("an aborted lookup is not reported as a failure", async () => {
		// Abort means a newer lookup superseded this one. Surfacing it would flash an
		// error every time the learner searches twice quickly.
		const lookup = wordLookup({
			fetchImpl: (async () => {
				throw new DOMException("Aborted", "AbortError");
			}) as unknown as typeof fetch,
		});
		expect(await lookup({ keyword: "x" })).toEqual({ status: "empty" });
	});
});

describe("the lookup session", () => {
	function harness(
		resolver: (() => ReturnType<typeof makeResolver> | null) | null,
		max = 6,
	) {
		const states: TermPanelState<string>[] = [];
		const session = new TermLookupSession<string>({
			resolver: resolver ?? (() => null),
			max,
			onState: (next) => states.push(next),
		});
		return { session, states };
	}

	function makeResolver(
		result: TermLookupResult<string>,
		onCall?: (request: { keyword: string; max?: number }) => void,
	) {
		return async (request: {
			keyword: string;
			language?: string;
			max?: number;
		}): Promise<TermLookupResult<string>> => {
			onCall?.(request);
			return result;
		};
	}

	test("with no resolver the panel reports itself unconfigured rather than failing silently", async () => {
		const { session, states } = harness(null);
		await session.run("reason");
		expect(states).toEqual([{ kind: "unconfigured" }]);
	});

	test("a term that is not a headword is refused before a request is spent", async () => {
		let calls = 0;
		const { session, states } = harness(() =>
			makeResolver({ status: "empty" }, () => {
				calls += 1;
			}),
		);
		await session.run("the process by which plants convert light into sugar");
		expect(calls).toBe(0);
		expect(states).toEqual([
			{
				kind: "error",
				term: "the process by which plants convert light into sugar",
				reason: NOT_A_TERM_REASON,
			},
		]);
	});

	test("a lookup announces searching, then its result", async () => {
		const { session, states } = harness(() =>
			makeResolver({ status: "ok", items: ["reason"] }),
		);
		await session.run("reason.");
		expect(states).toEqual([
			{ kind: "searching", term: "reason" },
			{ kind: "results", term: "reason", items: ["reason"] },
		]);
	});

	test("the normalised term is what gets sent and what is remembered", async () => {
		let sent = "";
		const { session } = harness(() =>
			makeResolver({ status: "empty" }, (request) => {
				sent = request.keyword;
			}),
		);
		await session.run("  reason.  ");
		expect(sent).toBe("reason");
		expect(session.searchedFor).toBe("reason");
	});

	test("the configured max is sent, so a host cannot be asked for an unbounded page", async () => {
		let seenMax: number | undefined;
		const { session } = harness(
			() =>
				makeResolver({ status: "empty" }, (request) => {
					seenMax = request.max;
				}),
			4,
		);
		await session.run("apple");
		expect(seenMax).toBe(4);
	});

	test("a superseded lookup does not overwrite the newer one's state", async () => {
		// The learner searched twice quickly. The first answer arriving late must not
		// replace what the second one already put on screen.
		const states: TermPanelState<string>[] = [];
		let release: ((result: TermLookupResult<string>) => void) | null = null;
		const session = new TermLookupSession<string>({
			resolver: () => (request) =>
				request.keyword === "slow"
					? new Promise<TermLookupResult<string>>((resolve) => {
							release = resolve;
						})
					: Promise.resolve({ status: "ok", items: ["fast"] }),
			max: 6,
			onState: (next) => states.push(next),
		});

		const slow = session.run("slow");
		await session.run("fast");
		release?.({ status: "ok", items: ["slow"] });
		await slow;

		expect(states.at(-1)).toEqual({
			kind: "results",
			term: "fast",
			items: ["fast"],
		});
	});

	test("an idle panel with no resolver becomes unconfigured, and configuring it clears that", () => {
		let resolver: ReturnType<typeof makeResolver> | null = null;
		const states: TermPanelState<string>[] = [];
		const session = new TermLookupSession<string>({
			resolver: () => resolver,
			max: 6,
			onState: (next) => states.push(next),
		});

		session.syncConfigured({ kind: "idle" });
		expect(states).toEqual([{ kind: "unconfigured" }]);

		resolver = makeResolver({ status: "empty" });
		session.syncConfigured({ kind: "unconfigured" });
		expect(states.at(-1)).toEqual({ kind: "idle" });
	});

	test("a resolver arriving mid-lookup does not discard results the learner is reading", () => {
		// Only idle and unconfigured swap. A host setting `endpoint` again while entries
		// are on screen must not wipe them.
		const { session, states } = harness(() =>
			makeResolver({ status: "empty" }),
		);
		session.syncConfigured({ kind: "results", term: "reason", items: ["a"] });
		expect(states).toEqual([]);
	});
});

// A handed-in term arrives through a params seam that is reapplied on every sync, so
// the panel cannot tell a re-render from a fresh ask by looking at the term.
describe("a term handed in from outside", () => {
	function harness() {
		const keywords: string[] = [];
		const session = new TermLookupSession<string>({
			resolver:
				() =>
				async (request): Promise<TermLookupResult<string>> => {
					keywords.push(request.keyword);
					return { status: "ok", items: [request.keyword] };
				},
			max: 6,
			onState: () => {},
		});
		return { session, keywords };
	}

	test("runs once for a request, however many times it is reapplied", async () => {
		const { session, keywords } = harness();
		expect(
			session.syncRequestedTerm({
				term: "reason",
				requestId: 1,
				visible: true,
			}),
		).toBe(true);
		expect(
			session.syncRequestedTerm({
				term: "reason",
				requestId: 1,
				visible: true,
			}),
		).toBe(false);
		await Promise.resolve();
		expect(keywords).toEqual(["reason"]);
	});

	// The defect this replaces: keyed on the last search, every reopen re-issued the
	// stale selection and threw away what the learner had typed since.
	test("reopening the panel does not re-issue the request that opened it", async () => {
		const { session, keywords } = harness();
		session.syncRequestedTerm({ term: "reason", requestId: 1, visible: true });
		await Promise.resolve();
		await session.run("chloroplast");
		session.syncRequestedTerm({ term: "reason", requestId: 1, visible: false });
		session.syncRequestedTerm({ term: "reason", requestId: 1, visible: true });
		await Promise.resolve();

		expect(keywords).toEqual(["reason", "chloroplast"]);
	});

	// The other half, and why the term alone cannot be the key: a learner who looked
	// up one word by hand and then selects an earlier word again is asking for it.
	test("the same word asked for again runs again", async () => {
		const { session, keywords } = harness();
		session.syncRequestedTerm({ term: "reason", requestId: 1, visible: true });
		await Promise.resolve();
		await session.run("chloroplast");
		expect(
			session.syncRequestedTerm({
				term: "reason",
				requestId: 2,
				visible: true,
			}),
		).toBe(true);
		await Promise.resolve();

		expect(keywords).toEqual(["reason", "chloroplast", "reason"]);
	});

	test("a closed panel spends no request", async () => {
		const { session, keywords } = harness();
		expect(
			session.syncRequestedTerm({
				term: "reason",
				requestId: 1,
				visible: false,
			}),
		).toBe(false);
		await Promise.resolve();
		expect(keywords).toEqual([]);
	});

	test("an empty term is not a request", () => {
		const { session, keywords } = harness();
		expect(
			session.syncRequestedTerm({ term: "   ", requestId: 1, visible: true }),
		).toBe(false);
		expect(keywords).toEqual([]);
	});

	// A host assigning `term` with no id gets the term as the identity — the best
	// available, and enough to keep a re-render from re-issuing.
	test("with no id the term is the identity", async () => {
		const { session, keywords } = harness();
		expect(session.syncRequestedTerm({ term: "reason", visible: true })).toBe(
			true,
		);
		expect(session.syncRequestedTerm({ term: "reason", visible: true })).toBe(
			false,
		);
		expect(
			session.syncRequestedTerm({ term: "chloroplast", visible: true }),
		).toBe(true);
		await Promise.resolve();
		expect(keywords).toEqual(["reason", "chloroplast"]);
	});

	test("the term is normalized before it is compared or sent", async () => {
		const { session, keywords } = harness();
		session.syncRequestedTerm({ term: "  reason.  ", visible: true });
		expect(session.syncRequestedTerm({ term: "reason", visible: true })).toBe(
			false,
		);
		await Promise.resolve();
		expect(keywords).toEqual(["reason"]);
	});
});

describe("the panel status message", () => {
	const labels = {
		countLabel: (count: number) =>
			`${count} ${count === 1 ? "entry" : "entries"}`,
		emptyLabel: (term: string) => `No dictionary entry for ${term}`,
	};

	test("searching and results announce, singular and plural", () => {
		expect(
			termPanelStatusMessage({ kind: "searching", term: "reason" }, labels),
		).toBe("Looking up reason");
		expect(
			termPanelStatusMessage(
				{ kind: "results", term: "reason", items: ["a"] },
				labels,
			),
		).toBe("1 entry for reason");
		expect(
			termPanelStatusMessage(
				{ kind: "results", term: "reason", items: ["a", "b"] },
				labels,
			),
		).toBe("2 entries for reason");
	});

	test("empty announces, because nothing else tells the learner the request finished", () => {
		expect(
			termPanelStatusMessage({ kind: "empty", term: "xyzzy" }, labels),
		).toBe("No dictionary entry for xyzzy");
	});

	test("states already rendered as visible text stay silent, so nothing is announced twice", () => {
		expect(termPanelStatusMessage({ kind: "idle" }, labels)).toBe("");
		expect(termPanelStatusMessage({ kind: "unconfigured" }, labels)).toBe("");
		expect(
			termPanelStatusMessage(
				{ kind: "error", term: "x", reason: "boom" },
				labels,
			),
		).toBe("");
	});
});
