import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveEsmPackageFileUrl } from "@pie-players/pie-players-shared/loaders";
import { bundledSummaries, pinnedSummaries } from "../src/summarize.js";
import { summarizers } from "../src/summarizers/index.js";

const cdn = mkdtempSync(path.join(tmpdir(), "pie-item-list-cdn-"));
const loaderOptions = { esmCdnUrl: pathToFileURL(cdn).href };

/** Publishes `source` as the `./browser/summary` module of `spec` on the local CDN. */
function publish(spec: string, source: string): void {
	const file = fileURLToPath(
		resolveEsmPackageFileUrl(loaderOptions, `${spec}/dist/browser/summary/index.js`),
	);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, source);
}

afterAll(() => rmSync(cdn, { recursive: true, force: true }));

describe("bundledSummaries", () => {
	test("finds a summarizer by package name, whatever the version", async () => {
		expect(await bundledSummaries("multiple-choice", "@pie-element/multiple-choice@3.0.0")).toBe(
			summarizers["@pie-element/multiple-choice"],
		);
		expect(await bundledSummaries("x", "@pie-element/multiple-choice")).toBe(
			summarizers["@pie-element/multiple-choice"],
		);
	});

	test("returns null for a package it does not cover", async () => {
		expect(await bundledSummaries("acme-sorter", "@acme/sorter@1.0.0")).toBeNull();
	});
});

describe("pinnedSummaries", () => {
	test("loads the summarizer the pinned version publishes", async () => {
		publish(
			"@pie-element/pinned-a@2.1.0",
			"export const summarize = (model) => ({ prompt: model.prompt });",
		);
		const summarize = await pinnedSummaries(loaderOptions)("pinned-a", "@pie-element/pinned-a@2.1.0");
		expect(summarize?.({ prompt: "<p>Hi</p>" }, { role: "student" })).toEqual({ prompt: "<p>Hi</p>" });
	});

	test("shares one load per URL across resolvers", async () => {
		publish("@pie-element/pinned-b@1.0.0", "export const summarize = () => ({ prompt: 'b' });");
		const first = await pinnedSummaries(loaderOptions)("pinned-b", "@pie-element/pinned-b@1.0.0");
		const second = await pinnedSummaries(loaderOptions)("pinned-b", "@pie-element/pinned-b@1.0.0");
		expect(first).not.toBeNull();
		expect(second).toBe(first);
	});

	describe("after a failed load", () => {
		const realFetch = globalThis.fetch;
		const probes: string[] = [];
		/** Answers the HEAD probe for every URL with `status`, or fails as if offline when it is absent. */
		function cdnAnswers(status?: number): void {
			globalThis.fetch = (async (input: string | URL | Request) => {
				probes.push(String(input));
				if (status === undefined) throw new TypeError("Failed to fetch");
				return new Response(null, { status });
			}) as typeof fetch;
		}
		afterEach(() => {
			globalThis.fetch = realFetch;
			probes.length = 0;
		});

		test("retries a URL the CDN failed to serve, from a fresh URL", async () => {
			cdnAnswers(503);
			const resolve = pinnedSummaries(loaderOptions);
			expect(await resolve("pinned-e", "@pie-element/pinned-e@1.0.0")).toBeNull();
			publish("@pie-element/pinned-e@1.0.0", "export const summarize = () => ({ prompt: 'e' });");
			const summarize = await resolve("pinned-e", "@pie-element/pinned-e@1.0.0");
			expect(summarize?.({}, { role: "student" })).toEqual({ prompt: "e" });
			expect(probes).toHaveLength(1);
			expect(await resolve("pinned-e", "@pie-element/pinned-e@1.0.0")).toBe(summarize);
		});

		test("retries a URL while the CDN is unreachable", async () => {
			cdnAnswers();
			const resolve = pinnedSummaries(loaderOptions);
			expect(await resolve("pinned-f", "@pie-element/pinned-f@1.0.0")).toBeNull();
			expect(await resolve("pinned-f", "@pie-element/pinned-f@1.0.0")).toBeNull();
			expect(probes[1]).toEndWith("?retry=1");
		});

		test("returns null for a version without the module, and keeps it", async () => {
			cdnAnswers(404);
			const resolve = pinnedSummaries(loaderOptions);
			expect(await resolve("pinned-g", "@pie-element/pinned-g@1.0.0")).toBeNull();
			publish("@pie-element/pinned-g@1.0.0", "export const summarize = () => ({ prompt: 'g' });");
			expect(await resolve("pinned-g", "@pie-element/pinned-g@1.0.0")).toBeNull();
			expect(probes).toHaveLength(1);
		});

		test("stops retrying after three transient failures", async () => {
			cdnAnswers(503);
			const resolve = pinnedSummaries(loaderOptions);
			for (let attempt = 0; attempt < 5; attempt += 1) {
				expect(await resolve("pinned-h", "@pie-element/pinned-h@1.0.0")).toBeNull();
			}
			expect(probes).toHaveLength(3);
		});
	});

	test("returns null for a module that exports no summarize function", async () => {
		publish("@pie-element/pinned-d@1.0.0", "export const summarize = 'nope';");
		expect(
			await pinnedSummaries(loaderOptions)("pinned-d", "@pie-element/pinned-d@1.0.0"),
		).toBeNull();
	});

	test("returns null for a spec that names no scoped package", async () => {
		const resolve = pinnedSummaries(loaderOptions);
		expect(await resolve("x", "multiple-choice")).toBeNull();
		expect(await resolve("x", "../../etc@1.0.0")).toBeNull();
	});
});
