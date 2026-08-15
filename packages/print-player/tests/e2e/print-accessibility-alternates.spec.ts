import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { type Page, expect, test } from "@playwright/test";

/**
 * An accommodation reaching paper through `<pie-print>` itself.
 *
 * `tests/accessibility-alternates.test.ts` covers the resolution — which
 * alternates are in play for an item and a profile. What it cannot cover is the
 * wiring: the element's template owns the block the alternates mount into, and
 * `updated()` decides when to resolve. If that seam is wrong the feature is
 * silently dead, which is the failure mode the audio-accommodations PRD names as
 * the expensive one — a learner entitled to a transcript gets a page without it,
 * and nothing reports anything.
 *
 * Real Chromium rather than happy-dom because the path runs Lit's render and the
 * shared DOMPurify sanitizer, neither of which happy-dom can be trusted with here
 * (see `markup-processor.spec.ts` for the sanitizer's failure under it).
 *
 * The element package is never loaded: `resolve` is stubbed to a URL that does not
 * exist, so the item renders as the missing-element placeholder. That is the point
 * — an alternate is resolved from the item's catalogs and the learner's profile,
 * so it must reach paper whether or not the element behind it loads.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const ENTRY = path.join(PACKAGE_ROOT, "src/pie-print.ts");

let bundledCode: string;

test.beforeAll(async () => {
	const result = await esbuild.build({
		entryPoints: [ENTRY],
		bundle: true,
		platform: "browser",
		format: "iife",
		target: "es2020",
		write: false,
	});

	bundledCode = result.outputFiles[0].text;
});

const TRANSCRIPT_TEXT = "The word is look. Pick the correct spelling.";

const transcriptCards = (visibility?: string) => [
	{
		identifier: "q1-transcript",
		cards: [
			{
				catalog: "transcript",
				language: "en-US",
				content: TRANSCRIPT_TEXT,
				...(visibility ? { visibility } : {}),
			},
		],
	},
];

const itemWithTranscript = (visibility?: string) => ({
	markup: '<mc-populated-blank id="q1"></mc-populated-blank>',
	elements: { "mc-populated-blank": "@pie-element/mc-populated-blank@1.0.0" },
	models: [
		{
			id: "q1",
			element: "mc-populated-blank",
			accessibilityCatalogs: transcriptCards(visibility),
		},
	],
});

/** Mount `<pie-print>`, hand it a config, and return its rendered text. */
async function printItem(
	page: Page,
	config: { item: unknown; accessibility?: unknown },
): Promise<{ text: string; labels: string[] }> {
	await page.setContent("<!doctype html><html><body></body></html>");
	await page.addScriptTag({ content: bundledCode });

	return page.evaluate(async (config) => {
		const player = document.createElement("pie-print") as HTMLElement & {
			config: unknown;
			trustMarkup: boolean;
			resolve: (tagName: string, pkg: string) => Promise<unknown>;
			updateComplete: Promise<unknown>;
		};
		// No print bundle exists for this fake element; the player renders its
		// missing-element placeholder, and the alternate must not depend on it.
		player.resolve = (tagName: string, pkg: string) =>
			Promise.resolve({
				tagName,
				pkg,
				url: "https://cdn.invalid.test/does-not-exist/print/index.js",
				module: true,
			});
		player.trustMarkup = true;
		document.body.appendChild(player);
		player.config = config;

		// Two frames: one for the config setter's resolution promise, one for the
		// render it schedules.
		await player.updateComplete;
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
		await player.updateComplete;

		const block = player.querySelector(".pie-print-alternates");
		return {
			text: block?.textContent ?? "",
			labels: [...(block?.querySelectorAll("[aria-labelledby]") ?? [])].map(
				(node) =>
					block?.querySelector(`#${node.getAttribute("aria-labelledby")}`)
						?.textContent ?? "",
			),
		};
	}, config);
}

test.describe("pie-print accessibility alternates (real browser)", () => {
	test("prints a granted transcript above the item", async ({ page }) => {
		const { text, labels } = await printItem(page, {
			item: itemWithTranscript(),
			accessibility: {
				personalNeedsProfile: {
					supports: ["transcript"],
					prohibitedSupports: [],
					activateAtInit: [],
				},
			},
		});

		expect(text).toContain(TRANSCRIPT_TEXT);
		expect(labels).toEqual(["Transcript"]);
	});

	test("prints an authored-presentation transcript with no profile", async ({
		page,
	}) => {
		const { text } = await printItem(page, {
			item: itemWithTranscript("always"),
		});

		expect(text).toContain(TRANSCRIPT_TEXT);
	});

	test("prints no transcript for a learner without the support", async ({
		page,
	}) => {
		const { text } = await printItem(page, { item: itemWithTranscript() });

		expect(text).toBe("");
	});
});
