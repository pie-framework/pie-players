import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import * as esbuild from "esbuild";
import { roundTripItems } from "./fixtures/round-trip-items.js";

/**
 * A summary computed in Node equals the one computed in the browser for the same config, so a backend can precompute what a row would compute itself. Both sides run the built
 * `./summarize` entry. Requires `bun run build:e2e:item-list`.
 */

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SUMMARIZE = path.join(PACKAGE_ROOT, "dist/summarize.js");
const FIXTURES = path.join(PACKAGE_ROOT, "tests/e2e/fixtures/round-trip-items.ts");
const ROLES = ["instructor", "student"] as const;

test.beforeAll(() => {
	if (!existsSync(SUMMARIZE)) {
		throw new Error(
			`[round-trip.spec] ${SUMMARIZE} does not exist. Run "bun run build:e2e:item-list" first.`,
		);
	}
});

test("Node and browser summaries are equal for the fixture items", async ({ page }) => {
	const { summarizeItem } = (await import(SUMMARIZE)) as typeof import("../../src/summarize.js");
	const inNode = await Promise.all(
		ROLES.flatMap((role) =>
			roundTripItems.map((item) => summarizeItem(item, { role })),
		),
	);

	const bundle = await esbuild.build({
		stdin: {
			contents: `
				import { summarizeItem } from ${JSON.stringify(SUMMARIZE)};
				import { roundTripItems } from ${JSON.stringify(FIXTURES)};
				window.summarizeFixtures = (roles) => Promise.all(
					roles.flatMap((role) =>
						roundTripItems.map((item) => summarizeItem(item, { role })),
					),
				);
			`,
			resolveDir: PACKAGE_ROOT,
			loader: "ts",
		},
		bundle: true,
		platform: "browser",
		format: "iife",
		target: "es2020",
		write: false,
	});
	await page.setContent("<!doctype html><html><body></body></html>");
	await page.addScriptTag({ content: bundle.outputFiles[0].text });
	const inBrowser = await page.evaluate(
		(roles) =>
			(window as unknown as { summarizeFixtures: (roles: string[]) => Promise<unknown> }).summarizeFixtures(
				roles,
			),
		[...ROLES],
	);

	expect(inBrowser).toEqual(inNode);
	// The fixtures reach every rung, so equality is not two empty lists agreeing.
	expect(new Set(inNode.flatMap((summary) => summary.entries.map((entry) => entry.source)))).toEqual(
		new Set(["summary", "prompt", "label"]),
	);
});

test("the built entry converts a summary's TeX to MathML in Node", async () => {
	const { convertSummaryMath, isItemSummary } = (await import(
		SUMMARIZE
	)) as typeof import("../../src/summarize.js");
	const converted = await convertSummaryMath({
		schema: 1,
		stem: "<p>Given \\(x^2\\)</p>",
		entries: [
			{
				id: "1",
				pkg: "@pie-element/multiple-choice",
				source: "summary",
				label: "Multiple Choice",
				summary: { prompt: "<p>Solve \\(x^2 = 4\\)</p>", answer: "<p>\\(x = 2\\)</p>" },
			},
		],
	});
	const html = [converted.stem, converted.entries[0].summary.prompt, converted.entries[0].summary.answer];
	for (const field of html) {
		expect(field).toContain("<math");
		expect(field).not.toContain("\\(");
	}
	expect(isItemSummary(converted)).toBe(true);
});
