import { afterEach, describe, expect, test } from "bun:test";
import { defaultLoadResolution, defaultResolve } from "../src/element-resolver";

const TRAVERSAL_SPEC =
	"@pie-element/multiple-choice@1.0.0/../../../gh/owner/repo@main";

describe("defaultResolve", () => {
	test("resolves print modules to browser ESM artifacts", async () => {
		const resolution = await defaultResolve(
			"multiple-choice",
			"@pie-element/multiple-choice@13.2.0",
		);

		expect(resolution).toMatchObject({
			tagName: "multiple-choice",
			pkg: "@pie-element/multiple-choice@13.2.0",
			url: "https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/print/index.js",
			module: true,
			loader: "browser-esm",
		});
	});

	test("resolves against the configured ESM CDN", async () => {
		const mirror = await defaultResolve(
			"multiple-choice",
			"@pie-element/multiple-choice@13.2.0",
			{ esmCdnUrl: "https://mirror.test/esm/" },
		);
		const esmSh = await defaultResolve(
			"multiple-choice",
			"@pie-element/multiple-choice@13.2.0",
			{ esmCdnUrl: "https://esm.sh", esmCdnProvider: "esm.sh" },
		);

		expect(mirror).toMatchObject({
			url: "https://mirror.test/esm/@pie-element/multiple-choice@13.2.0/dist/browser/print/index.js",
			cdnBaseUrl: "https://mirror.test/esm",
		});
		expect(mirror.cdnProvider).toBeUndefined();
		expect(esmSh).toMatchObject({
			url: "https://raw.esm.sh/@pie-element/multiple-choice@13.2.0/dist/browser/print/index.js",
			cdnBaseUrl: "https://esm.sh",
			cdnProvider: "esm.sh",
		});
	});

	test("builds no CDN URL for a spec that is not a scoped package spec", async () => {
		const resolution = await defaultResolve("multiple-choice", TRAVERSAL_SPEC);

		expect(resolution).toMatchObject({
			tagName: "multiple-choice",
			pkg: TRAVERSAL_SPEC,
			url: "",
			loader: "browser-esm",
		});
	});
});

describe("defaultLoadResolution", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("fails an invalid spec before any request, without quoting it", async () => {
		const requested: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			requested.push(String(input));
			return new Response(null, { status: 200 });
		}) as typeof fetch;
		const spec = '@pie-element/multiple-choice@<img src=x onerror="alert(1)">';
		const resolution = {
			...(await defaultResolve("multiple-choice", spec)),
			printTagName: "multiple-choice-print-1",
		};

		const result = await defaultLoadResolution(resolution);

		expect(result).toEqual({
			success: false,
			pkg: resolution,
			message: "Invalid element package spec",
		});
		expect(requested).toEqual([]);
	});
});
