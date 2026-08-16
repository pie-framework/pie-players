import { describe, expect, test } from "bun:test";

import {
	createEndpointLookup,
	isLookupableTerm,
	normalizeTerm,
	readLookupResponse,
} from "../lookup.js";

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

	test("non-Latin scripts survive, since the tool is offered in four locales", () => {
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

describe("reading a host response", () => {
	test("entries with definitions come through", () => {
		const result = readLookupResponse({
			entries: [
				{
					word: "reason",
					pronunciation: "ˈriːzən",
					senses: [
						{ partOfSpeech: "noun", definition: "A cause or explanation." },
					],
				},
			],
		});
		expect(result).toEqual({
			status: "ok",
			entries: [
				{
					word: "reason",
					pronunciation: "ˈriːzən",
					senses: [
						{
							partOfSpeech: "noun",
							definition: "A cause or explanation.",
							example: undefined,
						},
					],
				},
			],
		});
	});

	test("an entry with no usable sense is dropped, not rendered as a bare headword", () => {
		// Showing the word back with no definition tells a learner it exists and
		// nothing they asked for.
		const result = readLookupResponse({
			entries: [{ word: "reason", senses: [{ definition: "   " }] }],
		});
		expect(result).toEqual({ status: "empty" });
	});

	test("unknown extra fields are ignored so a host can extend its payload", () => {
		const result = readLookupResponse({
			entries: [{ word: "x", senses: [{ definition: "d" }], audioUrl: "u" }],
			totalCount: 99,
		});
		expect(result.status).toBe("ok");
	});

	test("no entries is empty, which is not an error", () => {
		expect(readLookupResponse({ entries: [] })).toEqual({ status: "empty" });
	});

	test("an unreadable payload is an error, which is not empty", () => {
		// The distinction is the whole point: "no entry for your word" and "the
		// dictionary did not answer" need different words in front of a learner.
		expect(readLookupResponse(null).status).toBe("error");
		expect(readLookupResponse("nope").status).toBe("error");
		expect(readLookupResponse({}).status).toBe("error");
		expect(readLookupResponse({ entries: "not-an-array" }).status).toBe("error");
	});
});

describe("the endpoint lookup", () => {
	function jsonResponse(body: unknown, status = 200): Response {
		return new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});
	}

	test("posts the request and reads the response", async () => {
		let seen: { url: string; init: RequestInit } | null = null;
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
			fetchImpl: (async (url: string, init: RequestInit) => {
				seen = { url, init };
				return jsonResponse({
					entries: [{ word: "reason", senses: [{ definition: "A cause." }] }],
				});
			}) as unknown as typeof fetch,
		});

		const result = await lookup({ keyword: "reason", max: 6 });

		expect(result.status).toBe("ok");
		expect(seen?.url).toBe("/lookup");
		expect(seen?.init.method).toBe("POST");
		expect(JSON.parse(String(seen?.init.body))).toEqual({
			keyword: "reason",
			max: 6,
		});
	});

	test("host headers are merged over the defaults", async () => {
		let headers: Record<string, string> = {};
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
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

	test("credentials are never sent implicitly", async () => {
		// A host that wants to authorize does it through `headers`, so the decision to
		// attach credentials stays with whoever owns them.
		let init: RequestInit | null = null;
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
			fetchImpl: (async (_url: string, got: RequestInit) => {
				init = got;
				return jsonResponse({ entries: [] });
			}) as unknown as typeof fetch,
		});

		await lookup({ keyword: "x" });

		expect(init?.credentials).toBe("omit");
	});

	test("a failing status is an error naming the status", async () => {
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
			fetchImpl: (async () => jsonResponse({}, 503)) as unknown as typeof fetch,
		});
		const result = await lookup({ keyword: "x" });
		expect(result).toEqual({
			status: "error",
			reason: "The dictionary is unavailable (503).",
		});
	});

	test("a header fetcher that throws is an authorization error, not a crash", async () => {
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
			headers: () => {
				throw new Error("no token");
			},
			fetchImpl: (async () =>
				jsonResponse({ entries: [] })) as unknown as typeof fetch,
		});
		const result = await lookup({ keyword: "x" });
		expect(result.status).toBe("error");
	});

	test("a network failure is an error the learner can read", async () => {
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
			fetchImpl: (async () => {
				throw new TypeError("Failed to fetch");
			}) as unknown as typeof fetch,
		});
		const result = await lookup({ keyword: "x" });
		expect(result).toEqual({
			status: "error",
			reason: "The dictionary could not be reached.",
		});
	});

	test("an aborted lookup is not reported as a failure", async () => {
		// Abort means a newer lookup superseded this one. Surfacing it would flash an
		// error every time the learner searches twice quickly.
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
			fetchImpl: (async () => {
				throw new DOMException("Aborted", "AbortError");
			}) as unknown as typeof fetch,
		});
		const result = await lookup({ keyword: "x" });
		expect(result).toEqual({ status: "empty" });
	});
});
