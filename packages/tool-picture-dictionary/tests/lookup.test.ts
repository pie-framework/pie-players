import { describe, expect, test } from "bun:test";

import {
	createEndpointLookup,
	isLookupableKeyword,
	isRenderablePictureUrl,
	normalizeKeyword,
	readPictureResponse,
} from "../lookup.js";

describe("normalizing a keyword", () => {
	test("trailing sentence punctuation goes", () => {
		expect(normalizeKeyword("reason.")).toBe("reason");
		expect(normalizeKeyword("“photosynthesis”")).toBe("photosynthesis");
	});

	test("internal hyphens and apostrophes stay", () => {
		expect(normalizeKeyword("mother-in-law")).toBe("mother-in-law");
		expect(normalizeKeyword("don't")).toBe("don't");
	});

	test("a selection spanning a line break collapses to one space", () => {
		expect(normalizeKeyword("carbon\n  dioxide")).toBe("carbon dioxide");
	});

	test("non-Latin scripts survive", () => {
		expect(normalizeKeyword("  光合成。 ")).toBe("光合成");
	});
});

describe("deciding what is worth sending", () => {
	test("a word or short phrase is", () => {
		expect(isLookupableKeyword("apple")).toBe(true);
		expect(isLookupableKeyword("carbon dioxide")).toBe(true);
	});

	test("a selected sentence is not", () => {
		expect(
			isLookupableKeyword("the process by which plants convert light to sugar"),
		).toBe(false);
	});

	test("nothing is not", () => {
		expect(isLookupableKeyword("")).toBe(false);
	});
});

describe("deciding what is safe to put in src", () => {
	test("https, protocol-relative and same-origin paths render", () => {
		// Signed, short-lived URLs from object storage are the expected shape.
		expect(isRenderablePictureUrl("https://example.test/a.png?sig=x")).toBe(true);
		expect(isRenderablePictureUrl("//example.test/a.png")).toBe(true);
		expect(isRenderablePictureUrl("/api/pictures/a.png")).toBe(true);
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
				pictures: [
					{ url: "/a.png", caption: "An apple", width: 120, height: 90 },
				],
			});
		}
	});

	test("a picture with an unsafe url is dropped rather than rendered", () => {
		const result = readPictureResponse({
			pictures: [
				{ url: "javascript:alert(1)", caption: "bad" },
				{ url: "/good.png" },
			],
		});
		expect(result).toEqual({
			status: "ok",
			pictures: [
				{ url: "/good.png", caption: undefined, width: undefined, height: undefined },
			],
		});
	});

	test("a blank caption becomes absent, so alt falls back to the keyword", () => {
		const result = readPictureResponse({
			pictures: [{ url: "/a.png", caption: "   " }],
		});
		expect(result.status === "ok" && result.pictures[0].caption).toBeUndefined();
	});

	test("no pictures is empty, which is not an error", () => {
		expect(readPictureResponse({ pictures: [] })).toEqual({ status: "empty" });
	});

	test("only unsafe pictures is empty rather than a broken grid", () => {
		expect(
			readPictureResponse({ pictures: [{ url: "data:image/png;base64,AAA" }] }),
		).toEqual({ status: "empty" });
	});

	test("an unreadable payload is an error, which is not empty", () => {
		expect(readPictureResponse(null).status).toBe("error");
		expect(readPictureResponse({}).status).toBe("error");
		expect(readPictureResponse({ pictures: "no" }).status).toBe("error");
	});
});

describe("the endpoint lookup", () => {
	function jsonResponse(body: unknown, status = 200): Response {
		return new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json" },
		});
	}

	test("posts keyword, language and max", async () => {
		let body: unknown = null;
		const lookup = createEndpointLookup({
			endpoint: "/pictures",
			fetchImpl: (async (_url: string, init: RequestInit) => {
				body = JSON.parse(String(init.body));
				return jsonResponse({ pictures: [{ url: "/a.png" }] });
			}) as unknown as typeof fetch,
		});

		const result = await lookup({ keyword: "apple", language: "es", max: 4 });

		expect(result.status).toBe("ok");
		expect(body).toEqual({ keyword: "apple", language: "es", max: 4 });
	});

	test("credentials are never sent implicitly", async () => {
		let init: RequestInit | null = null;
		const lookup = createEndpointLookup({
			endpoint: "/pictures",
			fetchImpl: (async (_url: string, got: RequestInit) => {
				init = got;
				return jsonResponse({ pictures: [] });
			}) as unknown as typeof fetch,
		});
		await lookup({ keyword: "x" });
		expect(init?.credentials).toBe("omit");
	});

	test("a failing status is an error naming the status", async () => {
		const lookup = createEndpointLookup({
			endpoint: "/pictures",
			fetchImpl: (async () => jsonResponse({}, 502)) as unknown as typeof fetch,
		});
		expect(await lookup({ keyword: "x" })).toEqual({
			status: "error",
			reason: "The picture dictionary is unavailable (502).",
		});
	});

	test("an aborted lookup is not reported as a failure", async () => {
		const lookup = createEndpointLookup({
			endpoint: "/pictures",
			fetchImpl: (async () => {
				throw new DOMException("Aborted", "AbortError");
			}) as unknown as typeof fetch,
		});
		expect(await lookup({ keyword: "x" })).toEqual({ status: "empty" });
	});
});
