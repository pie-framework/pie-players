/**
 * The section player hands each item card its assessment item ref's policy
 * settings, which the card's `pie-item-scope` registers under the item's
 * canonical id. A host composing `pie-item-scope` around its own item player
 * sets the same property, so both paths must reach the same decisions.
 */
import { describe, expect, mock, spyOn, test } from "bun:test";
import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
import type {
	AssessmentSection,
	ItemEntity,
	ItemSettings,
} from "@pie-players/pie-players-shared/types";
import { SectionController } from "../src/controllers/SectionController";

// Same reason as `section-player-view-state.test.ts`: the module graph reaches
// the item-player custom-element bundle, which needs a DOM to define itself.
mock.module("@pie-players/pie-item-player", () => ({
	ensureItemPlayerMathRenderingReady: async () => undefined,
}));

const { getCanonicalItemId, getItemSettings } = await import(
	"../src/components/shared/section-player-view-state"
);

const RESTRICTS: ItemSettings = { restrictedTools: ["calculator"] };
const REQUIRES: ItemSettings = { requiredTools: ["calculator"] };

function makeItem(id: string): ItemEntity {
	return {
		id,
		name: id,
		config: { elements: {}, models: [], markup: "<div></div>" },
	} as unknown as ItemEntity;
}

async function compositionOf(section: AssessmentSection) {
	const controller = new SectionController();
	await controller.initialize({
		section,
		sectionId: "s1",
		assessmentId: "a1",
		view: ["candidate"],
	});
	return controller.getCompositionModel();
}

const section = {
	identifier: "s1",
	assessmentItemRefs: [
		{ identifier: "q1", item: makeItem("shared"), settings: RESTRICTS },
		// The same item id again: the section renders it under a unique id.
		{ identifier: "q2", item: makeItem("shared"), settings: REQUIRES },
		{ identifier: "q3", item: makeItem("plain") },
		// No identifier: the rendered id is canonical.
		{ item: makeItem("anonymous"), settings: RESTRICTS },
	],
	rubricBlocks: [],
} as unknown as AssessmentSection;

function coordinator() {
	return new ToolkitCoordinator({
		assessmentId: "a1",
		lazyInit: true,
		tools: { placement: { section: [], item: ["calculator", "lineReader"] } },
	});
}

const itemToolbarIds = (coord: ToolkitCoordinator, canonicalItemId: string) =>
	coord
		.decideToolPolicy({
			level: "item",
			scope: { level: "item", scopeId: canonicalItemId, canonicalItemId },
		})
		.visibleTools.map((entry) => `${entry.toolId}${entry.required ? "!" : ""}`);

describe("section item settings", () => {
	test("each card gets its own item ref's settings, matched by the item it renders", async () => {
		const compositionModel = await compositionOf(section);
		const cards = compositionModel.items.map((item) => [
			getCanonicalItemId({ compositionModel, item }),
			getItemSettings({ compositionModel, item }),
		]);

		expect(cards).toEqual([
			["q1", RESTRICTS],
			["q2", REQUIRES],
			["q3", null],
			[compositionModel.items[3]?.id as string, RESTRICTS],
		]);
	});

	test("the section's cards and a host's own item scopes reach the same item-toolbar decisions", async () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const compositionModel = await compositionOf(section);
			// The section player: each card's scope registers what the pane gave it.
			const fromSection = coordinator();
			for (const item of compositionModel.items) {
				const settings = getItemSettings({ compositionModel, item });
				if (settings) {
					fromSection.registerItemSettings(
						getCanonicalItemId({ compositionModel, item }),
						settings,
					);
				}
			}
			// A host composing `pie-item-scope` with the same settings.
			const fromHost = coordinator();
			fromHost.registerItemSettings("q1", RESTRICTS);
			fromHost.registerItemSettings("q2", REQUIRES);

			for (const id of ["q1", "q2", "q3"]) {
				expect(itemToolbarIds(fromSection, id)).toEqual(itemToolbarIds(fromHost, id));
			}
			expect(itemToolbarIds(fromSection, "q1")).toEqual(["lineReader"]);
			expect(itemToolbarIds(fromSection, "q2")).toEqual(["calculator!", "lineReader"]);
			expect(itemToolbarIds(fromSection, "q3")).toEqual(["calculator", "lineReader"]);
		} finally {
			warn.mockRestore();
		}
	});
});
