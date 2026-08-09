/**
 * Per-item catalog media: content discovery, strict sign-language matching, and
 * region sizing.
 *
 * The rendering half lives in `SectionItemCard.svelte`; everything decidable
 * without a DOM is here.
 */

import { describe, expect, test } from "bun:test";

import {
	AccessibilityCatalogResolver,
	type CatalogOwnerContext,
} from "@pie-players/pie-assessment-toolkit";
import type {
	AccessibilityCatalog,
	ItemEntity,
	SignLanguageCardPayload,
} from "@pie-players/pie-players-shared/types";

import {
	clampMediaRegionPercent,
	collectSignLanguageCatalogRefs,
	MEDIA_REGION_DEFAULT_PERCENT,
	MEDIA_REGION_MAX_PERCENT,
	MEDIA_REGION_MIN_PERCENT,
	mediaRegionPercentFromDrag,
	resolveSignLanguageAlternate,
} from "../src/components/shared/section-item-media.js";

const OWNER: CatalogOwnerContext = {
	ownerKind: "itemModel",
	assessmentId: "a1",
	sectionId: "s1",
	itemId: "i1",
	canonicalItemId: "i1",
};

function signPayload(signLang: string, src: string): SignLanguageCardPayload {
	return {
		signLang,
		media: { version: 1, id: src, kind: "video", sources: [{ src }] },
	};
}

function signCatalog(
	identifier: string,
	signLang: string,
	src: string,
): AccessibilityCatalog {
	return {
		identifier,
		cards: [
			{
				catalog: "sign-language",
				language: signLang,
				payload: signPayload(signLang, src),
			},
		],
	};
}

function item(overrides: Partial<ItemEntity> = {}): ItemEntity {
	return {
		id: "i1",
		config: { markup: "", elements: {}, models: [] },
		...overrides,
	} as ItemEntity;
}

describe("collectSignLanguageCatalogRefs", () => {
	test("finds item-root, extracted, and model-owned catalogs", () => {
		const refs = collectSignLanguageCatalogRefs(
			item({
				accessibilityCatalogs: [signCatalog("root", "ase", "root.mp4")],
				config: {
					markup: "",
					elements: {},
					extractedCatalogs: [signCatalog("extracted", "ase", "x.mp4")],
					models: [
						{
							id: "q1",
							element: "pie-multiple-choice",
							accessibilityCatalogs: [signCatalog("model", "ase", "m.mp4")],
						},
					],
				},
			}),
		);
		expect(refs).toEqual([
			{ catalogId: "root" },
			{ catalogId: "extracted" },
			{ catalogId: "model", modelId: "q1" },
		]);
	});

	test("ignores catalogs with no sign-language card", () => {
		expect(
			collectSignLanguageCatalogRefs(
				item({
					accessibilityCatalogs: [
						{
							identifier: "spoken-only",
							cards: [
								{ catalog: "spoken", language: "en-US", content: "<speak/>" },
							],
						},
					],
				}),
			),
		).toEqual([]);
	});

	test("returns nothing for an item with no catalogs", () => {
		expect(collectSignLanguageCatalogRefs(item())).toEqual([]);
		expect(collectSignLanguageCatalogRefs(null)).toEqual([]);
	});
});

describe("resolveSignLanguageAlternate", () => {
	function resolverWith(catalogs: AccessibilityCatalog[]) {
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs(OWNER, catalogs);
		return resolver;
	}

	test("resolves the requested sign language", () => {
		const resolved = resolveSignLanguageAlternate({
			resolver: resolverWith([signCatalog("c1", "ase", "asl.mp4")]),
			refs: [{ catalogId: "c1" }],
			ownerContext: OWNER,
			requestedSignLang: "ase",
		});
		expect(resolved?.catalogId).toBe("c1");
		expect(resolved?.sources[0].src).toBe("asl.mp4");
	});

	test("defaults the request to ASL", () => {
		const resolved = resolveSignLanguageAlternate({
			resolver: resolverWith([signCatalog("c1", "ase", "asl.mp4")]),
			refs: [{ catalogId: "c1" }],
			ownerContext: OWNER,
		});
		expect(resolved?.sources[0].src).toBe("asl.mp4");
	});

	test("renders nothing rather than substituting another sign language", () => {
		// The resolver's last fallback rung matches any card of the requested type
		// regardless of language. Handing an ASL learner a BSL recording is worse
		// than handing them nothing, so that rung must not be taken here.
		const resolved = resolveSignLanguageAlternate({
			resolver: resolverWith([signCatalog("c1", "bfi", "bsl.mp4")]),
			refs: [{ catalogId: "c1" }],
			ownerContext: OWNER,
			requestedSignLang: "ase",
		});
		expect(resolved).toBeNull();
	});

	test("accepts a card that asserts no sign language", () => {
		const resolved = resolveSignLanguageAlternate({
			resolver: resolverWith([
				{
					identifier: "c1",
					cards: [
						{
							catalog: "sign-language",
							payload: signPayload("", "unlabelled.mp4"),
						},
					],
				},
			]),
			refs: [{ catalogId: "c1" }],
			ownerContext: OWNER,
			requestedSignLang: "ase",
		});
		expect(resolved?.sources).toEqual([{ src: "unlabelled.mp4" }]);
	});

	test("ignores a sign-language card that carries only a string", () => {
		expect(
			resolveSignLanguageAlternate({
				resolver: resolverWith([
					{
						identifier: "c1",
						cards: [{ catalog: "sign-language", content: "bare.mp4" }],
					},
				]),
				refs: [{ catalogId: "c1" }],
				ownerContext: OWNER,
				requestedSignLang: "ase",
			}),
		).toBeNull();
	});

	test("picks the matching card when several sign languages are authored", () => {
		const resolved = resolveSignLanguageAlternate({
			resolver: resolverWith([
				{
					identifier: "c1",
					cards: [
						{
							catalog: "sign-language",
							language: "bfi",
							payload: signPayload("bfi", "bsl.mp4"),
						},
						{
							catalog: "sign-language",
							language: "ase",
							payload: signPayload("ase", "asl.mp4"),
						},
					],
				},
			]),
			refs: [{ catalogId: "c1" }],
			ownerContext: OWNER,
			requestedSignLang: "ase",
		});
		expect(resolved?.sources[0].src).toBe("asl.mp4");
	});

	test("resolves a model-scoped catalog through the model owner context", () => {
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs({ ...OWNER, modelId: "q1" }, [
			signCatalog("c1", "ase", "choice.mp4"),
		]);
		const resolved = resolveSignLanguageAlternate({
			resolver,
			refs: [{ catalogId: "c1", modelId: "q1" }],
			ownerContext: OWNER,
			requestedSignLang: "ase",
		});
		expect(resolved?.sources[0].src).toBe("choice.mp4");
	});

	test("returns null when the catalog is not registered yet", () => {
		expect(
			resolveSignLanguageAlternate({
				resolver: new AccessibilityCatalogResolver(),
				refs: [{ catalogId: "c1" }],
				ownerContext: OWNER,
			}),
		).toBeNull();
	});
});

describe("media region sizing", () => {
	test("clamps to the region bounds", () => {
		expect(clampMediaRegionPercent(5)).toBe(MEDIA_REGION_MIN_PERCENT);
		expect(clampMediaRegionPercent(95)).toBe(MEDIA_REGION_MAX_PERCENT);
		expect(clampMediaRegionPercent(40)).toBe(40);
		expect(clampMediaRegionPercent(Number.NaN)).toBe(
			MEDIA_REGION_DEFAULT_PERCENT,
		);
	});

	test("converts a drag relative to the container, so the same drag means the same thing", () => {
		// Dragging left grows the region, which sits on the right.
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: -100,
				containerWidthPx: 1000,
			}),
		).toBe(44);
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: -50,
				containerWidthPx: 500,
			}),
		).toBe(44);
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: 100,
				containerWidthPx: 1000,
			}),
		).toBe(24);
	});

	test("clamps a drag past the bounds and survives a zero-width container", () => {
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: -900,
				containerWidthPx: 1000,
			}),
		).toBe(MEDIA_REGION_MAX_PERCENT);
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: -100,
				containerWidthPx: 0,
			}),
		).toBe(34);
	});
});
