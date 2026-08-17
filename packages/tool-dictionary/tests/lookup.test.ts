/**
 * What is this tool's own: reading a dictionary entry out of a host payload, and the
 * service name the learner sees in an error.
 *
 * Term normalisation, the headword guard, request sequencing, the POST client and the
 * panel state machine are shared with the picture dictionary and tested once in
 * `packages/players-shared/tests/term-lookup.test.ts`.
 */

import { describe, expect, test } from "bun:test";

import { createEndpointLookup, readLookupResponse } from "../lookup.js";

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
			items: [
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

	test("an entry with no headword is dropped", () => {
		expect(
			readLookupResponse({ entries: [{ senses: [{ definition: "A cause." }] }] }),
		).toEqual({ status: "empty" });
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

	test("an unreadable payload is an error naming this service", () => {
		// The distinction is the whole point: "no entry for your word" and "the
		// dictionary did not answer" need different words in front of a learner.
		expect(readLookupResponse(null)).toEqual({
			status: "error",
			reason: "The dictionary returned no data.",
		});
		expect(readLookupResponse({ entries: "not-an-array" })).toEqual({
			status: "error",
			reason: "The dictionary response was unreadable.",
		});
	});
});

describe("the endpoint lookup", () => {
	test("posts to the host endpoint and reads entries back", async () => {
		let seen: { url: string; init: RequestInit } | null = null;
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
			fetchImpl: (async (url: string, init: RequestInit) => {
				seen = { url, init };
				return new Response(
					JSON.stringify({
						entries: [{ word: "reason", senses: [{ definition: "A cause." }] }],
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}) as unknown as typeof fetch,
		});

		const result = await lookup({ keyword: "reason", max: 6 });

		expect(result.status).toBe("ok");
		expect(seen?.url).toBe("/lookup");
		expect(seen?.init.method).toBe("POST");
		// The host route is expected to sit behind the assessment's own session.
		expect(seen?.init.credentials).toBe("same-origin");
	});

	test("a failing status names the dictionary, not the shared machinery", async () => {
		const lookup = createEndpointLookup({
			endpoint: "/lookup",
			fetchImpl: (async () =>
				new Response("{}", { status: 503 })) as unknown as typeof fetch,
		});
		expect(await lookup({ keyword: "x" })).toEqual({
			status: "error",
			reason: "The dictionary is unavailable (503).",
		});
	});
});
