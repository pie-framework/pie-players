/**
 * What reaches paper, given an item's catalogs and a learner's profile.
 *
 * The cases that matter are the four the two halves produce — granted with a
 * card, granted without one, a card without a grant, and neither — plus the
 * exception that makes an authored-presentation alternate print with no profile
 * supplied at all. That last one is the reason print resolves unconditionally
 * rather than only when a host passes accessibility config.
 *
 * Uses `@happy-dom/global-registrator` for `document`, following the convention
 * in `tests/markup-processor.test.ts`: the capabilities build their regions with
 * `document.createElement`.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
	AccessibilityCatalog,
	PersonalNeedsProfile,
} from "@pie-players/pie-players-shared/types";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

// Imported after registration so the module graph sees a DOM, matching how the
// player itself is loaded into a document.
const { ALTERNATES_CLASS, mountItemAlternates } = await import(
	"../src/accessibility-alternates.js"
);

const TRANSCRIPT_TEXT = "The word is look. Pick the correct spelling.";

const transcriptCatalog = (visibility?: string): AccessibilityCatalog[] =>
	[
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
	] as AccessibilityCatalog[];

/** An item whose audio-bearing model carries a transcript card, as the transform emits it. */
const itemWithTranscript = (visibility?: string) => ({
	markup: '<mc-populated-blank id="q1"></mc-populated-blank>',
	elements: { "mc-populated-blank": "@pie-element/mc-populated-blank@1.0.0" },
	models: [
		{
			id: "q1",
			element: "mc-populated-blank",
			accessibilityCatalogs: transcriptCatalog(visibility),
		},
	],
});

const itemWithoutCatalogs = () => ({
	markup: '<mc-populated-blank id="q1"></mc-populated-blank>',
	elements: { "mc-populated-blank": "@pie-element/mc-populated-blank@1.0.0" },
	models: [{ id: "q1", element: "mc-populated-blank" }],
});

const grants = (...supports: string[]): PersonalNeedsProfile => ({
	supports,
	prohibitedSupports: [],
	activateAtInit: [],
});

const printInto = (
	item: ReturnType<typeof itemWithoutCatalogs>,
	personalNeedsProfile?: PersonalNeedsProfile,
) => {
	const anchor = document.createElement("div");
	anchor.className = ALTERNATES_CLASS;
	const mounted = mountItemAlternates({
		anchor,
		item: item as never,
		accessibility: personalNeedsProfile ? { personalNeedsProfile } : undefined,
	});
	return { anchor, mounted };
};

describe("mountItemAlternates", () => {
	test("prints a granted transcript inline", () => {
		const { anchor } = printInto(itemWithTranscript(), grants("transcript"));

		expect(anchor.textContent).toContain(TRANSCRIPT_TEXT);
	});

	test("prints nothing when the profile does not grant the support", () => {
		const { anchor } = printInto(itemWithTranscript(), grants());

		expect(anchor.children.length).toBe(0);
	});

	test("prints nothing when a granted support has no authored card", () => {
		const { anchor } = printInto(itemWithoutCatalogs(), grants("transcript"));

		expect(anchor.children.length).toBe(0);
	});

	test("prints an authored-presentation alternate with no profile at all", () => {
		const { anchor } = printInto(itemWithTranscript("always"));

		expect(anchor.textContent).toContain(TRANSCRIPT_TEXT);
	});

	test("prints nothing for an accommodation card with no profile at all", () => {
		const { anchor } = printInto(itemWithTranscript());

		expect(anchor.children.length).toBe(0);
	});

	test("carries the capability's accessible name onto the page, once", () => {
		const { anchor } = printInto(itemWithTranscript(), grants("transcript"));

		const label = anchor.querySelector(`.${ALTERNATES_CLASS}__label`);
		expect(label?.textContent).toBe("Transcript");
		const region = anchor.querySelector("[aria-labelledby]");
		expect(region?.getAttribute("aria-labelledby")).toBe(label?.id);
		// The name is on the page, so it must not also be a second name in the
		// accessibility tree.
		expect(region?.hasAttribute("aria-label")).toBe(false);
	});

	test("reads catalogs carried by the item as well as by a model", () => {
		const item = {
			...itemWithoutCatalogs(),
			accessibilityCatalogs: transcriptCatalog(),
		};
		const { anchor } = printInto(item as never, grants("transcript"));

		expect(anchor.textContent).toContain(TRANSCRIPT_TEXT);
	});

	test("a district block outranks the learner's profile", () => {
		const anchor = document.createElement("div");
		anchor.className = ALTERNATES_CLASS;
		mountItemAlternates({
			anchor,
			item: itemWithTranscript() as never,
			accessibility: {
				personalNeedsProfile: grants("transcript"),
				settings: { districtPolicy: { blockedTools: ["transcript"] } },
			},
		});

		expect(anchor.children.length).toBe(0);
	});

	test("destroy leaves the anchor as it found it", () => {
		const { anchor, mounted } = printInto(
			itemWithTranscript(),
			grants("transcript"),
		);
		expect(anchor.children.length).toBeGreaterThan(0);

		mounted.destroy();

		expect(anchor.children.length).toBe(0);
	});
});
