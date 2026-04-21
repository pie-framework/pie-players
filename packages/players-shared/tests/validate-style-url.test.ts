import { describe, expect, test } from "bun:test";

import {
	parseAllowedStyleOrigins,
	validateExternalStyleUrl,
} from "../src/security/validate-style-url.js";

const BASE = "https://host.example/page";

describe("validateExternalStyleUrl", () => {
	test("accepts absolute https URLs", () => {
		const result = validateExternalStyleUrl(
			"https://cdn.example/style.css",
			{ baseUrl: BASE },
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.resolvedUrl.origin).toBe("https://cdn.example");
		}
	});

	test("accepts same-origin relative URLs", () => {
		const result = validateExternalStyleUrl("/theme.css", { baseUrl: BASE });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.resolvedUrl.origin).toBe("https://host.example");
			expect(result.resolvedUrl.pathname).toBe("/theme.css");
		}
	});

	test("rejects javascript: URLs", () => {
		const result = validateExternalStyleUrl(
			"javascript:alert(1)",
			{ baseUrl: BASE },
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("disallowed-protocol");
		}
	});

	test("rejects data: URLs", () => {
		const result = validateExternalStyleUrl(
			"data:text/css,body{}",
			{ baseUrl: BASE },
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("disallowed-protocol");
		}
	});

	test("rejects malformed URLs", () => {
		const result = validateExternalStyleUrl("http://", { baseUrl: BASE });
		expect(result.ok).toBe(false);
	});

	test("rejects non-string inputs", () => {
		const result = validateExternalStyleUrl(undefined, { baseUrl: BASE });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("invalid-url");
		}
	});

	test("accepts cross-origin URL when origin is on the allow-list", () => {
		const result = validateExternalStyleUrl(
			"https://cdn.example/style.css",
			{
				baseUrl: BASE,
				allowedOrigins: ["https://cdn.example", "https://other.example"],
			},
		);
		expect(result.ok).toBe(true);
	});

	test("rejects cross-origin URL when not on the allow-list", () => {
		const result = validateExternalStyleUrl(
			"https://evil.example/style.css",
			{
				baseUrl: BASE,
				allowedOrigins: ["https://cdn.example"],
			},
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("disallowed-origin");
		}
	});

	test("empty allow-list skips the origin check", () => {
		const result = validateExternalStyleUrl(
			"https://any.example/style.css",
			{ baseUrl: BASE, allowedOrigins: [] },
		);
		expect(result.ok).toBe(true);
	});
});

describe("parseAllowedStyleOrigins", () => {
	test("splits and trims comma-separated origins", () => {
		expect(
			parseAllowedStyleOrigins(" https://a.example , https://b.example "),
		).toEqual(["https://a.example", "https://b.example"]);
	});

	test("returns an empty array for empty / non-string input", () => {
		expect(parseAllowedStyleOrigins("")).toEqual([]);
		expect(parseAllowedStyleOrigins(undefined)).toEqual([]);
		expect(parseAllowedStyleOrigins(null)).toEqual([]);
		expect(parseAllowedStyleOrigins(42 as unknown)).toEqual([]);
	});
});
