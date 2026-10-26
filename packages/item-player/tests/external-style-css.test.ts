import { describe, expect, test } from "bun:test";
import {
	describeExternalStyleUrl,
	prepareExternalStyleCss,
} from "../src/utils/external-style-css.js";

const options = {
	stylesheetUrl: "https://player.example/styles/item/base.css",
	documentUrl: "https://player.example/item/1",
};

describe("prepareExternalStyleCss", () => {
	test("redacts signed URL details from diagnostics", () => {
		const diagnostic = describeExternalStyleUrl(
			"/styles/item.css?token=private-value#student-fragment",
			options.documentUrl,
		);

		expect(diagnostic).toBe("https://player.example/styles/item.css");
		expect(diagnostic).not.toContain("private-value");
		expect(diagnostic).not.toContain("student-fragment");
	});

	test("rejects @import rules, including escaped identifiers", () => {
		expect(
			prepareExternalStyleCss(
				'@import "https://evil.example/global.css";',
				options,
			),
		).toEqual({
			ok: false,
			message: "Stylesheet @import rules are not allowed.",
		});
		expect(
			prepareExternalStyleCss(
				'@\\69mport "https://evil.example/global.css";',
				options,
			),
		).toEqual({
			ok: false,
			message: "Stylesheet @import rules are not allowed.",
		});
	});

	test("rejects cross-origin url() resources that are not allow-listed", () => {
		const result = prepareExternalStyleCss(
			'.prompt { background: url("https://evil.example/track.png"); }',
			options,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toContain("https://evil.example");
		}
	});

	test("recognizes escaped url() function names", () => {
		const result = prepareExternalStyleCss(
			".prompt { background: \\75rl(https://evil.example/track.png); }",
			options,
		);

		expect(result.ok).toBe(false);
	});

	test("rejects image-set functions whose quoted alternatives bypass url()", () => {
		for (const cssText of [
			'.prompt { background: image-set("https://evil.example/track.png" 1x); }',
			'.prompt { background: IMAGE-SET("https://evil.example/track.png" 1x); }',
			'.prompt { background: \\69mage-set("https://evil.example/track.png" 1x); }',
			'.prompt { background: -webkit-image-set("https://evil.example/track.png" 1x); }',
		]) {
			expect(prepareExternalStyleCss(cssText, options)).toEqual({
				ok: false,
				message: "Stylesheet image-set() functions are not allowed.",
			});
		}
	});

	test("resolves and rewrites relative resources against the stylesheet URL", () => {
		expect(
			prepareExternalStyleCss(
				'.prompt { background: url("../images/prompt.png"); }',
				options,
			),
		).toEqual({
			ok: true,
			cssText:
				'.prompt { background: url("https://player.example/styles/images/prompt.png"); }',
		});
	});

	test("allows and rewrites resources on explicitly allowed origins", () => {
		expect(
			prepareExternalStyleCss(
				"@font-face { src: url(https://cdn.example/font.woff2); }",
				{ ...options, allowedOrigins: ["https://cdn.example"] },
			),
		).toEqual({
			ok: true,
			cssText: '@font-face { src: url("https://cdn.example/font.woff2"); }',
		});
	});
});

test("does not echo non-HTTP stylesheet payloads in diagnostics", () => {
	for (const input of [
		"javascript:private-payload",
		"data:text/css,private-payload",
	]) {
		expect(describeExternalStyleUrl(input, options.documentUrl)).toBe(
			"(invalid stylesheet URL)",
		);
	}
});
