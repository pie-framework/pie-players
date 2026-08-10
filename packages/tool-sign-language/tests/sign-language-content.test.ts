/**
 * Content discovery and strict sign-language matching.
 *
 * Assertions are unchanged from when this lived in section-player as
 * `card-media-region.test.ts`: extracting signing into its own package is a move,
 * not a behaviour change, and PIE-880 is in testing against this behaviour.
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
	collectSignLanguageCatalogRefs,
	resolveRequestedSignLanguage,
	resolveSignLanguageAlternate,
	resolveSignLanguageContent,
	SIGN_LANGUAGE_FEATURE_ID,
} from "../src/sign-language-content.js";

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

describe("resolveRequestedSignLanguage", () => {
	test("reads the sign language from policy parameters", () => {
		expect(resolveRequestedSignLanguage({ signLang: " bfi " })).toBe("bfi");
	});

	test("is undefined when parameters carry no usable code", () => {
		expect(resolveRequestedSignLanguage(undefined)).toBeUndefined();
		expect(resolveRequestedSignLanguage({})).toBeUndefined();
		expect(resolveRequestedSignLanguage({ signLang: "  " })).toBeUndefined();
		expect(resolveRequestedSignLanguage({ signLang: 7 })).toBeUndefined();
		expect(resolveRequestedSignLanguage("bfi")).toBeUndefined();
	});
});

describe("resolveSignLanguageContent", () => {
	// The one call the host makes. It hands over an item, a resolver and an owner
	// scope, and learns only whether there is something to render — no catalog
	// type, card shape or sign-language code crosses the boundary.
	function contentFor(args: {
		item: ItemEntity | null;
		catalogs?: AccessibilityCatalog[];
		parameters?: unknown;
		withResolver?: boolean;
	}) {
		let resolver: AccessibilityCatalogResolver | null = null;
		if (args.withResolver !== false) {
			resolver = new AccessibilityCatalogResolver();
			resolver.registerCatalogs(OWNER, args.catalogs ?? []);
		}
		return resolveSignLanguageContent({
			featureId: SIGN_LANGUAGE_FEATURE_ID,
			parameters: args.parameters,
			catalogResolver: resolver,
			ownerContext: OWNER,
			item: args.item,
		});
	}

	test("resolves the alternate an eligible learner should see", () => {
		const resolved = contentFor({
			item: item({
				accessibilityCatalogs: [signCatalog("c1", "ase", "asl.mp4")],
			}),
			catalogs: [signCatalog("c1", "ase", "asl.mp4")],
		});
		expect(resolved?.catalogId).toBe("c1");
		expect(resolved?.sources[0].src).toBe("asl.mp4");
	});

	test("honours the requested sign language from policy parameters", () => {
		// A BSL entitlement must not be served an ASL recording.
		expect(
			contentFor({
				item: item({
					accessibilityCatalogs: [signCatalog("c1", "ase", "asl.mp4")],
				}),
				catalogs: [signCatalog("c1", "ase", "asl.mp4")],
				parameters: { signLang: "bfi" },
			}),
		).toBeNull();
	});

	test("is absent when the item carries no signing, with no resolver, or with no item", () => {
		expect(contentFor({ item: item() })).toBeNull();
		expect(
			contentFor({
				item: item({
					accessibilityCatalogs: [signCatalog("c1", "ase", "asl.mp4")],
				}),
				withResolver: false,
			}),
		).toBeNull();
		expect(contentFor({ item: null })).toBeNull();
	});
});
