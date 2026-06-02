import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { AccessibilityCatalogResolver } from "../src/services/AccessibilityCatalogResolver";
import type { AccessibilityCatalog } from "@pie-players/pie-players-shared/types";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const spokenCatalog = (
	identifier: string,
	content: string,
): AccessibilityCatalog => ({
	identifier,
	cards: [{ catalog: "spoken", language: "en-US", content }],
});

describe("AccessibilityCatalogResolver scoped catalogs", () => {
	test("resolves duplicate local catalog idrefs by owner context", () => {
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs(
			{
				ownerKind: "itemModel",
				itemId: "item-a",
				canonicalItemId: "item-a",
				modelId: "model-a",
			},
			[spokenCatalog("prompt", "Item A prompt")],
		);
		resolver.registerCatalogs(
			{
				ownerKind: "itemModel",
				itemId: "item-b",
				canonicalItemId: "item-b",
				modelId: "model-b",
			},
			[spokenCatalog("prompt", "Item B prompt")],
		);

		expect(
			resolver.getAlternative("prompt", {
				type: "spoken",
				language: "en-US",
				context: {
					ownerKind: "itemModel",
					itemId: "item-a",
					canonicalItemId: "item-a",
					modelId: "model-a",
				},
			})?.content,
		).toBe("Item A prompt");
		expect(
			resolver.getAlternative("prompt", {
				type: "spoken",
				language: "en-US",
				context: {
					ownerKind: "itemModel",
					itemId: "item-b",
					canonicalItemId: "item-b",
					modelId: "model-b",
				},
			})?.content,
		).toBe("Item B prompt");
	});

	test("unregisters one owner without removing another active owner", () => {
		const resolver = new AccessibilityCatalogResolver();
		const unregisterA = resolver.registerCatalogs(
			{
				ownerKind: "itemModel",
				itemId: "item-a",
				canonicalItemId: "item-a",
				modelId: "model-a",
			},
			[spokenCatalog("prompt", "Item A prompt")],
		);
		resolver.registerCatalogs(
			{
				ownerKind: "itemModel",
				itemId: "item-b",
				canonicalItemId: "item-b",
				modelId: "model-b",
			},
			[spokenCatalog("prompt", "Item B prompt")],
		);

		unregisterA();

		expect(
			resolver.getAlternative("prompt", {
				type: "spoken",
				context: {
					ownerKind: "itemModel",
					itemId: "item-a",
					canonicalItemId: "item-a",
					modelId: "model-a",
				},
			}),
		).toBeNull();
		expect(
			resolver.getAlternative("prompt", {
				type: "spoken",
				context: {
					ownerKind: "itemModel",
					itemId: "item-b",
					canonicalItemId: "item-b",
					modelId: "model-b",
				},
			})?.content,
		).toBe("Item B prompt");
	});

	test("merges multiple registrations for the same owner and cleans up only inserted catalogs", () => {
		const resolver = new AccessibilityCatalogResolver();
		const owner = {
			ownerKind: "passage" as const,
			passageId: "passage-1",
		};
		const unregisterFirst = resolver.registerCatalogs(owner, [
			spokenCatalog("direct", "Direct passage speech"),
		]);
		const unregisterSecond = resolver.registerCatalogs(owner, [
			spokenCatalog("extracted", "Extracted passage speech"),
		]);

		expect(
			resolver.getAlternative("direct", { type: "spoken", context: owner })
				?.content,
		).toBe("Direct passage speech");
		expect(
			resolver.getAlternative("extracted", { type: "spoken", context: owner })
				?.content,
		).toBe("Extracted passage speech");

		unregisterSecond();

		expect(
			resolver.getAlternative("direct", { type: "spoken", context: owner })
				?.content,
		).toBe("Direct passage speech");
		expect(
			resolver.getAlternative("extracted", { type: "spoken", context: owner }),
		).toBeNull();

		unregisterFirst();
		expect(
			resolver.getAlternative("direct", { type: "spoken", context: owner }),
		).toBeNull();
	});

	test("resolves an unambiguous model catalog from item owner scope", () => {
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs(
			{
				ownerKind: "itemModel",
				itemId: "item-a",
				canonicalItemId: "item-a",
				modelId: "model-a",
			},
			[spokenCatalog("prompt", "Model A prompt")],
		);

		expect(
			resolver.getAlternative("prompt", {
				type: "spoken",
				context: {
					ownerKind: "itemModel",
					itemId: "item-a",
					canonicalItemId: "item-a",
				},
			})?.content,
		).toBe("Model A prompt");
	});

	test("does not pick an ambiguous catalog from sibling model owners", () => {
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs(
			{
				ownerKind: "itemModel",
				itemId: "item-a",
				canonicalItemId: "item-a",
				modelId: "model-a",
			},
			[spokenCatalog("prompt", "Model A prompt")],
		);
		resolver.registerCatalogs(
			{
				ownerKind: "itemModel",
				itemId: "item-a",
				canonicalItemId: "item-a",
				modelId: "model-b",
			},
			[spokenCatalog("prompt", "Model B prompt")],
		);

		expect(
			resolver.getAlternative("prompt", {
				type: "spoken",
				context: {
					ownerKind: "itemModel",
					itemId: "item-a",
					canonicalItemId: "item-a",
				},
			}),
		).toBeNull();
	});

	test("sanitizes direct spoken catalog SSML during registration", () => {
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs(
			{ ownerKind: "passage", passageId: "passage-1" },
			[
				spokenCatalog(
					"passage",
					'<speak onclick="evil()">Hello <script>alert(1)</script><break time="300ms"/>world</speak>',
				),
			],
		);

		const resolved = resolver.getAlternative("passage", {
			type: "spoken",
			language: "en-US",
			context: { ownerKind: "passage", passageId: "passage-1" },
		});

		expect(resolved?.content).toContain("<speak");
		expect(resolved?.content).toContain("<break");
		expect(resolved?.content).toContain("world");
		expect(resolved?.content.toLowerCase()).not.toContain("onclick");
		expect(resolved?.content.toLowerCase()).not.toContain("<script");
		expect(resolved?.content).not.toContain("alert");
	});

	test("sanitizes direct spoken catalog SSML fragments without a speak root", () => {
		const resolver = new AccessibilityCatalogResolver([
			spokenCatalog(
				"fragment",
				'<emphasis onclick="evil()">important</emphasis><audio src="javascript:alert(1)">fallback</audio>',
			),
		]);

		const resolved = resolver.getAlternative("fragment", { type: "spoken" });

		expect(resolved?.content).toContain("<emphasis");
		expect(resolved?.content).toContain("important");
		expect(resolved?.content).toContain("<audio");
		expect(resolved?.content).not.toMatch(/onclick/i);
		expect(resolved?.content).not.toMatch(/javascript:/i);
		expect(resolved?.content).not.toContain("alert");
	});
});
