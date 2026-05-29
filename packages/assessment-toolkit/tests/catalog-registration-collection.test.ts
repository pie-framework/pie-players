import { describe, expect, test } from "bun:test";

import { collectCatalogRegistrations } from "../src/runtime/catalog-registration";
import type { RuntimeRegistrationDetail } from "../src/runtime/registration-events";

describe("collectCatalogRegistrations", () => {
	test("collects item root, extracted, and model catalogs under item owner scopes", () => {
		const registrations = collectCatalogRegistrations(
			{
				kind: "item",
				itemId: "item-1",
				canonicalItemId: "canonical-1",
				contentKind: "assessment-item",
				element: {} as HTMLElement,
				item: {
					accessibilityCatalogs: [{ identifier: "item-root", cards: [] }],
					config: {
						extractedCatalogs: [{ identifier: "extracted", cards: [] }],
						models: [
							{
								id: "model-1",
								element: "pie-text-entry",
								accessibilityCatalogs: [
									{ identifier: "model-prompt", cards: [] },
								],
							},
						],
					},
				},
			} as RuntimeRegistrationDetail,
			{ assessmentId: "assessment-1", sectionId: "section-1" },
		);

		expect(registrations).toEqual([
			{
				context: {
					ownerKind: "itemModel",
					assessmentId: "assessment-1",
					sectionId: "section-1",
					itemId: "item-1",
					canonicalItemId: "canonical-1",
				},
				catalogs: [{ identifier: "item-root", cards: [] }],
			},
			{
				context: {
					ownerKind: "itemModel",
					assessmentId: "assessment-1",
					sectionId: "section-1",
					itemId: "item-1",
					canonicalItemId: "canonical-1",
				},
				catalogs: [{ identifier: "extracted", cards: [] }],
			},
			{
				context: {
					ownerKind: "itemModel",
					assessmentId: "assessment-1",
					sectionId: "section-1",
					itemId: "item-1",
					canonicalItemId: "canonical-1",
					modelId: "model-1",
				},
				catalogs: [{ identifier: "model-prompt", cards: [] }],
			},
		]);
	});

	test("collects passage catalogs under passage owner scope", () => {
		const registrations = collectCatalogRegistrations(
			{
				kind: "passage",
				itemId: "passage-1",
				canonicalItemId: "passage-1",
				contentKind: "rubric-block-stimulus",
				element: {} as HTMLElement,
				item: {
					accessibilityCatalogs: [{ identifier: "passage", cards: [] }],
					config: {
						extractedCatalogs: [{ identifier: "passage-extracted", cards: [] }],
					},
				},
			} as RuntimeRegistrationDetail,
			{ assessmentId: "assessment-1", sectionId: "section-1" },
		);

		expect(registrations).toEqual([
			{
				context: {
					ownerKind: "passage",
					assessmentId: "assessment-1",
					sectionId: "section-1",
					passageId: "passage-1",
				},
				catalogs: [{ identifier: "passage", cards: [] }],
			},
			{
				context: {
					ownerKind: "passage",
					assessmentId: "assessment-1",
					sectionId: "section-1",
					passageId: "passage-1",
				},
				catalogs: [{ identifier: "passage-extracted", cards: [] }],
			},
		]);
	});
});
