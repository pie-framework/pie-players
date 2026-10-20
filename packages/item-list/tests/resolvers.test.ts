import { afterAll, describe, expect, test } from "bun:test";
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

	test("returns null for a version without the module, and keeps it", async () => {
		const resolve = pinnedSummaries(loaderOptions);
		expect(await resolve("pinned-c", "@pie-element/pinned-c@1.0.0")).toBeNull();
		publish("@pie-element/pinned-c@1.0.0", "export const summarize = () => ({ prompt: 'c' });");
		expect(await resolve("pinned-c", "@pie-element/pinned-c@1.0.0")).toBeNull();
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
