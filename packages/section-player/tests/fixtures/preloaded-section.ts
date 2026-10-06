/**
 * A passage, a multiple-choice item and a categorize item, authored at the
 * versions `/preloaded-npm-elements` registers and under the base tags it
 * registers them with. Specs load that page for its registrations, remove its
 * player and mount their own over this section.
 */

import { createRequire } from "node:module";
import { expect, type Page } from "@playwright/test";

export const PRELOADED_BASE_PATH =
	"/preloaded-npm-elements?mode=candidate&layout=splitpane";

const requireFromSectionDemos = createRequire(
	new URL("../../../../apps/section-demos/package.json", import.meta.url),
);

/** Loads the page and waits for its own section to render. */
export async function openPreloadedBase(page: Page): Promise<void> {
	await page.goto(PRELOADED_BASE_PATH, { waitUntil: "networkidle" });
	await expect(
		page.locator("pie-section-player-splitpane").getByRole("radio").first(),
	).toBeVisible({ timeout: 30_000 });
}

/** `name@version` as section-demos installs it. */
export function installedSpec(name: string): string {
	const { version } = requireFromSectionDemos(`${name}/package.json`) as {
		version: string;
	};
	return `${name}@${version}`;
}

/** The tag the players define for `baseTag` at `spec`. */
export function versionedTag(baseTag: string, spec: string): string {
	const version = spec.slice(spec.lastIndexOf("@") + 1);
	return `${baseTag}--version-${version.replace(/[.+]/g, "-")}`;
}

export const MC_SPEC = installedSpec("@pie-element/multiple-choice");
export const CATEGORIZE_SPEC = installedSpec("@pie-element/categorize");
export const PASSAGE_SPEC = installedSpec("@pie-element/passage");

export const REGISTERED_SPECS = {
	"@pie-element/multiple-choice": MC_SPEC,
	"@pie-element/categorize": CATEGORIZE_SPEC,
	"@pie-element/passage": PASSAGE_SPEC,
};

export const MC_TAG = "pie-element-multiple-choice";
export const MC_REF = "fixture-multiple-choice-ref";
export const MC_ELEMENT_ID = "fixture-mc";
export const MC_PROMPT =
	"Which field names the package version an item renders?";
export const CATEGORIZE_PROMPT =
	"Sort each responsibility into the part that owns it.";

export const PRELOADED_SECTION = {
	identifier: "preloaded-fixture",
	title: "Preloaded fixture",
	keepTogether: true,
	rubricBlocks: [
		{
			identifier: "fixture-passage-block",
			view: ["candidate"],
			class: "stimulus",
			passage: {
				id: "fixture-passage",
				name: "Fixture Passage",
				baseId: "fixture-passage",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup:
						'<pie-element-passage id="fixture-passage-element"></pie-element-passage>',
					elements: { "pie-element-passage": PASSAGE_SPEC },
					models: [
						{
							id: "fixture-passage-element",
							element: "pie-element-passage",
							passages: [
								{
									title: "Preloaded elements",
									text: "<p>The host registers each element before the section mounts, and the player loads no element code.</p>",
								},
							],
						},
					],
				},
			},
		},
	],
	assessmentItemRefs: [
		{
			identifier: MC_REF,
			required: true,
			item: {
				id: "fixture-multiple-choice",
				name: "Fixture Multiple Choice",
				baseId: "fixture-multiple-choice",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup: `<${MC_TAG} id="${MC_ELEMENT_ID}"></${MC_TAG}>`,
					elements: { [MC_TAG]: MC_SPEC },
					models: [
						{
							id: MC_ELEMENT_ID,
							element: MC_TAG,
							prompt: MC_PROMPT,
							choiceMode: "radio",
							choices: [
								{
									value: "a",
									label: "<code>config.elements</code>",
									correct: true,
								},
								{
									value: "b",
									label: "<code>assessmentItemRefs.required</code>",
									correct: false,
								},
								{
									value: "c",
									label: "<code>rubricBlocks.view</code>",
									correct: false,
								},
							],
						},
					],
				},
			},
		},
		{
			identifier: "fixture-categorize-ref",
			required: true,
			item: {
				id: "fixture-categorize",
				name: "Fixture Categorize",
				baseId: "fixture-categorize",
				version: { major: 1, minor: 0, patch: 0 },
				config: {
					markup:
						'<pie-element-categorize id="fixture-categorize-element"></pie-element-categorize>',
					elements: { "pie-element-categorize": CATEGORIZE_SPEC },
					models: [
						{
							id: "fixture-categorize-element",
							element: "pie-element-categorize",
							prompt: `<p>${CATEGORIZE_PROMPT}</p>`,
							promptEnabled: true,
							categories: [
								{ id: "host", label: "Host" },
								{ id: "player", label: "Player" },
							],
							categoriesPerRow: 2,
							choicesPosition: "above",
							choices: [
								{
									id: "register",
									content: "Registers the elements",
									categoryCount: 1,
								},
								{
									id: "align",
									content: "Aligns authored versions",
									categoryCount: 1,
								},
							],
							correctResponse: [
								{ category: "host", choices: ["register"] },
								{ category: "player", choices: ["align"] },
							],
							lockChoiceOrder: true,
							maxChoicesPerCategory: 0,
							partialScoring: true,
						},
					],
				},
			},
		},
	],
};
