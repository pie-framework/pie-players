/**
 * Content discovery and strict sign-language matching through the owner-bound
 * catalog interface.
 */

import { describe, expect, test } from "bun:test";
import {
	AccessibilityCatalogResolver,
	catalogOwnerContextFor,
	type CatalogOwnerSnapshot,
	type CatalogSourceEntity,
	type ToolContentDependencyContext,
} from "@pie-players/pie-assessment-toolkit";
import type {
	AccessibilityCatalog,
	SignLanguageCardPayload,
} from "@pie-players/pie-players-shared/types";

import {
	resolveRequestedSignLanguage,
	resolveSignLanguageAlternate,
	resolveSignLanguageContent,
	SIGN_LANGUAGE_FEATURE_ID,
} from "../src/sign-language-content.js";

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

function entity(
	overrides: Partial<CatalogSourceEntity> = {},
): CatalogSourceEntity {
	return {
		config: { models: [] },
		...overrides,
	};
}

function ownerSnapshot(
	source: CatalogSourceEntity,
	kind: "item" | "passage" = "item",
): CatalogOwnerSnapshot {
	const resolver = new AccessibilityCatalogResolver();
	const owner = {
		kind,
		itemId: kind === "item" ? "item-1" : "passage-1",
		assessmentId: "assessment-1",
		sectionId: "section-1",
	} as const;
	resolver.registerOwner({ owner, entity: source });
	return resolver.forOwner(catalogOwnerContextFor(owner)).snapshot();
}

describe("resolveSignLanguageAlternate", () => {
	test("resolves the requested sign language", () => {
		const resolved = resolveSignLanguageAlternate({
			catalogs: ownerSnapshot(
				entity({
					accessibilityCatalogs: [signCatalog("c1", "ase", "asl.mp4")],
				}),
			),
			requestedSignLang: "ase",
		});
		expect(resolved?.catalogId).toBe("c1");
		expect(resolved?.sources[0].src).toBe("asl.mp4");
	});

	test("defaults the request to ASL", () => {
		const resolved = resolveSignLanguageAlternate({
			catalogs: ownerSnapshot(
				entity({
					accessibilityCatalogs: [signCatalog("c1", "ase", "asl.mp4")],
				}),
			),
		});
		expect(resolved?.sources[0].src).toBe("asl.mp4");
	});

	test("renders nothing rather than substituting another sign language", () => {
		const resolved = resolveSignLanguageAlternate({
			catalogs: ownerSnapshot(
				entity({
					accessibilityCatalogs: [signCatalog("c1", "bfi", "bsl.mp4")],
				}),
			),
			requestedSignLang: "ase",
		});
		expect(resolved).toBeNull();
	});

	test("accepts an unlabelled card only after looking for an exact match", () => {
		const catalogs = ownerSnapshot(
			entity({
				accessibilityCatalogs: [
					{
						identifier: "c1",
						cards: [
							{
								catalog: "sign-language",
								payload: signPayload("", "unlabelled.mp4"),
							},
							{
								catalog: "sign-language",
								language: "ase",
								payload: signPayload("ase", "asl.mp4"),
							},
						],
					},
				],
			}),
		);
		expect(
			resolveSignLanguageAlternate({
				catalogs,
				requestedSignLang: "ase",
			})?.sources[0].src,
		).toBe("asl.mp4");
		expect(
			resolveSignLanguageAlternate({
				catalogs,
				requestedSignLang: "bfi",
			})?.sources[0].src,
		).toBe("unlabelled.mp4");
	});

	test("ignores a sign-language card that carries only a string", () => {
		expect(
			resolveSignLanguageAlternate({
				catalogs: ownerSnapshot(
					entity({
						accessibilityCatalogs: [
							{
								identifier: "c1",
								cards: [{ catalog: "sign-language", content: "bare.mp4" }],
							},
						],
					}),
				),
				requestedSignLang: "ase",
			}),
		).toBeNull();
	});

	test("picks the matching card when several sign languages are authored", () => {
		const resolved = resolveSignLanguageAlternate({
			catalogs: ownerSnapshot(
				entity({
					accessibilityCatalogs: [
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
					],
				}),
			),
			requestedSignLang: "ase",
		});
		expect(resolved?.sources[0].src).toBe("asl.mp4");
	});

	test("returns null before an owner has registered catalogs", () => {
		const resolver = new AccessibilityCatalogResolver();
		expect(
			resolveSignLanguageAlternate({
				catalogs: resolver
					.forOwner({ ownerKind: "itemModel", itemId: "item-1" })
					.snapshot(),
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
	function contentFor(args: {
		catalogs: CatalogOwnerSnapshot | null;
		parameters?: unknown;
	}): ReturnType<typeof resolveSignLanguageContent> {
		const context: ToolContentDependencyContext = {
			featureId: SIGN_LANGUAGE_FEATURE_ID,
			parameters: args.parameters,
			catalogs: args.catalogs,
			granted: true,
		};
		return resolveSignLanguageContent(context);
	}

	test("resolves item and passage owner snapshots through the same interface", () => {
		for (const kind of ["item", "passage"] as const) {
			const resolved = contentFor({
				catalogs: ownerSnapshot(
					entity({
						accessibilityCatalogs: [signCatalog("c1", "ase", `${kind}.mp4`)],
					}),
					kind,
				),
			});
			expect(resolved?.sources[0].src).toBe(`${kind}.mp4`);
		}
	});

	test("honours the requested sign language from policy parameters", () => {
		expect(
			contentFor({
				catalogs: ownerSnapshot(
					entity({
						accessibilityCatalogs: [signCatalog("c1", "ase", "asl.mp4")],
					}),
				),
				parameters: { signLang: "bfi" },
			}),
		).toBeNull();
	});

	test("is absent when no resolver-backed owner snapshot is available", () => {
		expect(contentFor({ catalogs: null })).toBeNull();
	});
});
