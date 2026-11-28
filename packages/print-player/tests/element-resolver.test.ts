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

	test("carries the host's package policy and hashes to the ESM load", async () => {
		const policy = { requireExactVersions: false };
		const integrity = { "https://cdn.test/a.js": "sha384-x" };
		const resolution = await defaultResolve(
			"multiple-choice",
			"@pie-element/multiple-choice@13.2.0",
			{ elementPackagePolicy: policy, integrity, requireIntegrity: true },
		);

		expect(resolution).toMatchObject({
			elementPackagePolicy: policy,
			integrity,
			requireIntegrity: true,
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

	const globals = globalThis as unknown as Record<string, unknown>;
	const originalDocument = globals.document;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		globals.document = originalDocument;
	});

	async function loadTaggedSpec(loaderOptions?: Parameters<typeof defaultResolve>[2]) {
		globalThis.fetch = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
		globals.document = {};
		const resolution = {
			...(await defaultResolve(
				"multiple-choice",
				"@pie-element/multiple-choice@latest",
				loaderOptions,
			)),
			printTagName: "multiple-choice-print-2",
		};
		return defaultLoadResolution(resolution);
	}

	test("refuses a spec without an exact version when the host sets no policy", async () => {
		const result = await loadTaggedSpec();

		expect(result.success).toBe(false);
		expect(result.message).toContain("requires an exact version");
	});

	test("loads a tagged spec under a host policy that admits it", async () => {
		const result = await loadTaggedSpec({
			elementPackagePolicy: { requireExactVersions: false },
		});

		// The load gets past the policy and fails later: bun has no custom
		// element registry.
		expect(result.success).toBe(false);
		expect(result.message).not.toContain("requires an exact version");
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
