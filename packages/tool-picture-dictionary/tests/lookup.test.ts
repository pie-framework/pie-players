/**
 * What is this tool's own: which picture URLs are safe to render, reading a picture out
 * of a host payload, and the service name the learner sees in an error.
 *
 * Term normalisation, the headword guard, request sequencing, the POST client and the
 * panel state machine are shared with the word dictionary and tested once in
 * `packages/players-shared/tests/term-lookup.test.ts`.
 */

import { describe, expect, test } from "bun:test";

import {
	createEndpointLookup,
	isRenderablePictureUrl,
	readPictureResponse,
} from "../lookup.js";

describe("deciding what is safe to put in src", () => {
	test("https, protocol-relative and same-origin paths render", () => {
		// Signed, short-lived URLs from object storage are the expected shape.
		expect(isRenderablePictureUrl("https://example.test/a.png?sig=x")).toBe(
			true,
		);
		expect(isRenderablePictureUrl("//example.test/a.png")).toBe(true);
		expect(isRenderablePictureUrl("/api/pictures/a.png")).toBe(true);
	});

	test("plain http is refused, because it is mixed content wherever it matters", () => {
		// Every real deployment is https, so the browser blocks the request and the
		// learner gets a broken image where the definition should be.
		expect(isRenderablePictureUrl("http://cdn.example.test/a.png")).toBe(false);
		expect(isRenderablePictureUrl("HtTp://cdn.example.test/a.png")).toBe(false);
	});

	test("javascript: and data: are refused", () => {
		// Host data still lands in an attribute the browser acts on, and a symbol
		// service has no reason to return either.
		expect(isRenderablePictureUrl("javascript:alert(1)")).toBe(false);
		expect(isRenderablePictureUrl("data:image/svg+xml,<svg/>")).toBe(false);
		expect(isRenderablePictureUrl("JaVaScRiPt:alert(1)")).toBe(false);
	});

	test("a bare relative path with no leading slash is refused", () => {
		expect(isRenderablePictureUrl("pictures/a.png")).toBe(false);
	});

	// A leading slash is not proof of same-origin: a backslash is a path separator for
	// special schemes and a tab is stripped outright, so both of these resolve to
	// another host. They land on https either way, so nothing here defeats the
	// mixed-content guard — but same-origin is what the function claims to check.
	test("a path that resolves to another origin is refused", () => {
		expect(isRenderablePictureUrl("/\\evil.example/a.png")).toBe(false);
		expect(isRenderablePictureUrl("/\\\\evil.example/a.png")).toBe(false);
		expect(isRenderablePictureUrl("/\t/evil.example/a.png")).toBe(false);
	});

	test("ordinary paths still render, including the awkward ones", () => {
		expect(isRenderablePictureUrl("/api/pictures/a b.png")).toBe(true);
		expect(isRenderablePictureUrl("/api/pictures/a.png?q=1&r=2")).toBe(true);
		expect(isRenderablePictureUrl("/api/pictures/../a.png")).toBe(true);
	});

	test("empty is refused", () => {
		expect(isRenderablePictureUrl("   ")).toBe(false);
	});
});

describe("reading a host response", () => {
	test("pictures come through, under either payload key", () => {
		for (const key of ["pictures", "images"]) {
			const result = readPictureResponse({
				[key]: [{ url: "/a.png", caption: "An apple", width: 120, height: 90 }],
			});
			expect(result).toEqual({
				status: "ok",
				items: [{ url: "/a.png", caption: "An apple", width: 120, height: 90 }],
			});
		}
	});

	// A picture service that names the URL `image` and returns one signed object-storage
	// URL per entry. Read under both names, such a response needs no host resolver; read
	// under `url` alone, every lookup against it comes back "no picture" — a wrong answer
	// rather than a visible failure.
	test("a payload naming the url `image` is read as it stands", () => {
		const result = readPictureResponse({
			images: [
				{
					image:
						"https://pictures.example.test/apple.png?X-Amz-Signature=abc",
				},
				{ image: "https://pictures.example.test/b.png" },
			],
		});
		expect(result).toEqual({
			status: "ok",
			items: [
				{
					url: "https://pictures.example.test/apple.png?X-Amz-Signature=abc",
					caption: undefined,
					width: undefined,
					height: undefined,
				},
				{
					url: "https://pictures.example.test/b.png",
					caption: undefined,
					width: undefined,
					height: undefined,
				},
			],
		});
	});

	test("url wins when a payload carries both names", () => {
		const result = readPictureResponse({
			pictures: [{ url: "/chosen.png", image: "/ignored.png" }],
		});
		expect(result.status === "ok" && result.items[0].url).toBe("/chosen.png");
	});

	// An empty `url` is a field the host left blank, not a preference for nothing.
	test("a blank url falls through to the alias rather than dropping the picture", () => {
		const result = readPictureResponse({
			pictures: [{ url: "   ", image: "/from-alias.png" }],
		});
		expect(result.status === "ok" && result.items[0].url).toBe("/from-alias.png");
	});

	test("an unsafe url under the image alias is dropped too", () => {
		expect(
			readPictureResponse({ images: [{ image: "javascript:alert(1)" }] }),
		).toEqual({ status: "empty" });
	});

	test("a picture with an unsafe url is dropped rather than rendered", () => {
		const result = readPictureResponse({
			pictures: [
				{ url: "javascript:alert(1)", caption: "bad" },
				{ url: "http://cdn.example.test/blocked.png" },
				{ url: "/good.png" },
			],
		});
		expect(result).toEqual({
			status: "ok",
			items: [
				{
					url: "/good.png",
					caption: undefined,
					width: undefined,
					height: undefined,
				},
			],
		});
	});

	test("a blank caption becomes absent, so alt falls back to the keyword", () => {
		const result = readPictureResponse({
			pictures: [{ url: "/a.png", caption: "   " }],
		});
		expect(result.status === "ok" && result.items[0].caption).toBeUndefined();
	});

	test("no pictures is empty, which is not an error", () => {
		expect(readPictureResponse({ pictures: [] })).toEqual({ status: "empty" });
	});

	test("only unsafe pictures is empty rather than a broken grid", () => {
		expect(
			readPictureResponse({ pictures: [{ url: "data:image/png;base64,AAA" }] }),
		).toEqual({ status: "empty" });
	});

	test("an unreadable payload is an error naming this service", () => {
		expect(readPictureResponse(null)).toEqual({
			status: "error",
			reason: "The picture dictionary returned no data.",
		});
		expect(readPictureResponse({ pictures: "no" })).toEqual({
			status: "error",
			reason: "The picture dictionary response was unreadable.",
		});
	});
});

describe("the endpoint lookup", () => {
	test("posts keyword, language and max, on the assessment's own session", async () => {
		let body: unknown = null;
		let init: RequestInit | null = null;
		const lookup = createEndpointLookup({
			endpoint: "/pictures",
			fetchImpl: (async (_url: string, got: RequestInit) => {
				init = got;
				body = JSON.parse(String(got.body));
				return new Response(JSON.stringify({ pictures: [{ url: "/a.png" }] }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}) as unknown as typeof fetch,
		});

		const result = await lookup({ keyword: "apple", language: "es", max: 4 });

		expect(result.status).toBe("ok");
		expect(body).toEqual({ keyword: "apple", language: "es", max: 4 });
		expect(init?.credentials).toBe("same-origin");
	});

	test("a failing status names the picture dictionary, not the shared machinery", async () => {
		const lookup = createEndpointLookup({
			endpoint: "/pictures",
			fetchImpl: (async () =>
				new Response("{}", { status: 502 })) as unknown as typeof fetch,
		});
		expect(await lookup({ keyword: "x" })).toEqual({
			status: "error",
			reason: "The picture dictionary is unavailable (502).",
		});
	});
});
