import { describe, expect, test } from "bun:test";

import type {
	CatalogCard,
	SignLanguageCardPayload,
} from "@pie-players/pie-players-shared/types";

import { AccessibilityCatalogResolver } from "../src/services/AccessibilityCatalogResolver";
import {
	AMERICAN_SIGN_LANGUAGE,
	applyMediaFragment,
	describeSignLanguage,
	matchesRequestedSignLanguage,
	resolveSignLanguageMedia,
	SIGN_LANGUAGE_CATALOG_TYPE,
} from "../src/services/sign-language-cards";

function payload(
	overrides: Partial<SignLanguageCardPayload> = {},
): SignLanguageCardPayload {
	return {
		signLang: AMERICAN_SIGN_LANGUAGE,
		media: {
			version: 1,
			id: "media-1",
			kind: "video",
			sources: [{ src: "https://cdn.example.com/asl.mp4", type: "video/mp4" }],
		},
		...overrides,
	};
}

// A signing card carries no `content`: the payload is the content, and mirroring
// the primary source into a string would be a second copy of the same fact.
function card(overrides: Partial<CatalogCard> = {}): CatalogCard {
	return {
		catalog: SIGN_LANGUAGE_CATALOG_TYPE,
		language: AMERICAN_SIGN_LANGUAGE,
		payload: payload(),
		...overrides,
	};
}

describe("sign-language card payload validation", () => {
	test("resolves a single-source card", () => {
		const media = resolveSignLanguageMedia(card());
		expect(media?.signLang).toBe("ase");
		expect(media?.sources).toEqual([
			{ src: "https://cdn.example.com/asl.mp4", type: "video/mp4" },
		]);
	});

	test("resolves a multi-source card in authored order", () => {
		const media = resolveSignLanguageMedia(
			card({
				payload: payload({
					media: {
						version: 1,
						id: "media-1",
						kind: "video",
						sources: [
							{ src: "https://cdn.example.com/asl.webm", type: "video/webm" },
							{ src: "https://cdn.example.com/asl.mp4", type: "video/mp4" },
						],
					},
				}),
			}),
		);
		expect(media?.sources.map((source) => source.src)).toEqual([
			"https://cdn.example.com/asl.webm",
			"https://cdn.example.com/asl.mp4",
		]);
	});

	test("carries poster and label through", () => {
		const media = resolveSignLanguageMedia(
			card({
				payload: payload({
					media: {
						version: 1,
						id: "media-1",
						kind: "video",
						sources: [{ src: "https://cdn.example.com/asl.mp4" }],
						poster: "https://cdn.example.com/asl.jpg",
						label: "Signed prompt",
					},
				}),
			}),
		);
		expect(media?.poster).toBe("https://cdn.example.com/asl.jpg");
		expect(media?.label).toBe("Signed prompt");
	});

	test("resolves a fragment range and drops an end at or before the start", () => {
		expect(
			resolveSignLanguageMedia(
				card({
					payload: payload({ fragment: { startSeconds: 4, endSeconds: 9 } }),
				}),
			)?.fragment,
		).toEqual({ startSeconds: 4, endSeconds: 9 });
		expect(
			resolveSignLanguageMedia(
				card({
					payload: payload({ fragment: { startSeconds: 9, endSeconds: 9 } }),
				}),
			)?.fragment,
		).toEqual({ startSeconds: 9 });
	});

	test("treats a payload with no usable source as absent", () => {
		// A malformed payload must never degrade to an empty player or to text.
		expect(
			resolveSignLanguageMedia(
				card({
					payload: payload({
						media: { version: 1, id: "m", kind: "video", sources: [] },
					}),
				}),
			),
		).toBeNull();
		expect(
			resolveSignLanguageMedia(
				card({
					payload: { signLang: "ase", media: undefined as never },
				}),
			),
		).toBeNull();
	});

	test("drops sources whose scheme a media element cannot fetch", () => {
		const media = resolveSignLanguageMedia(
			card({
				payload: payload({
					media: {
						version: 1,
						id: "m",
						kind: "video",
						sources: [
							{ src: "javascript:alert(1)" },
							{ src: "/local/asl.mp4" },
						],
					},
				}),
			}),
		);
		expect(media?.sources).toEqual([{ src: "/local/asl.mp4" }]);
	});

	test("ignores a card that carries a bare URL instead of a payload", () => {
		// Signing media is structured, full stop. A string where the payload
		// belongs is a malformed card, not a shorthand — accepting it would mean a
		// second code path and a second source of truth for the same URL.
		expect(
			resolveSignLanguageMedia({
				language: "ase",
				content: "https://cdn.example.com/bare.mp4",
			}),
		).toBeNull();
	});

	test("falls back to the card language when the payload omits signLang", () => {
		const media = resolveSignLanguageMedia(
			card({ language: "bfi", payload: payload({ signLang: "  " }) }),
		);
		expect(media?.signLang).toBe("bfi");
	});

	test("does not honour the withdrawn `signLanguage` key", () => {
		// `pie-elements-ng` (PIE-879) and the `pie-api-aws` importer (PIE-881) briefly
		// wrote the payload under `signLanguage`, and this function accepted both
		// names. Both producers now emit `payload` and the alias is gone: one fact
		// under two names is what let a card render on the resolution path and read
		// as absent on the enumeration path, which is a worse failure than a card
		// that plainly does not resolve. A card left over from that spelling must
		// therefore resolve to nothing rather than half-work.
		const legacy = {
			language: "ase",
			signLanguage: payload(),
		} as unknown as CatalogCard;
		expect(resolveSignLanguageMedia(legacy)).toBeNull();
	});

	test("leaves a card unlabelled when neither payload nor card names a language", () => {
		const media = resolveSignLanguageMedia({
			payload: payload({ signLang: "" }),
		});
		expect(media?.signLang).toBeUndefined();
		expect(media?.sources).toHaveLength(1);
	});
});

describe("sign language matching", () => {
	test("never substitutes a different sign language", () => {
		const bsl = resolveSignLanguageMedia(
			card({ language: "bfi", payload: payload({ signLang: "bfi" }) }),
		);
		expect(bsl).not.toBeNull();
		expect(matchesRequestedSignLanguage(bsl!, "ase")).toBe(false);
		expect(matchesRequestedSignLanguage(bsl!, "bfi")).toBe(true);
	});

	test("accepts an unlabelled card rather than guessing it is the wrong language", () => {
		// A card that asserts no language cannot be shown to be a mismatch, and
		// authored content is more often right than not — so it is accepted while a
		// card that positively claims another language is refused.
		const unlabelled = resolveSignLanguageMedia({
			payload: payload({ signLang: "" }),
		});
		expect(matchesRequestedSignLanguage(unlabelled!, "ase")).toBe(true);
	});
});

describe("sign language naming", () => {
	test("names the language rather than saying video", () => {
		expect(describeSignLanguage("ase")).toBe("American Sign Language");
		expect(describeSignLanguage("bfi")).toBe("British Sign Language");
		expect(describeSignLanguage("eng-US")).toBe("Signed English");
	});

	test("labels an unknown code instead of guessing", () => {
		expect(describeSignLanguage("zzz")).toBe("Sign language (zzz)");
		expect(describeSignLanguage(undefined)).toBe("Sign language");
	});
});

describe("media fragments", () => {
	test("appends a fragment range as a Media Fragments URI", () => {
		expect(
			applyMediaFragment("https://cdn.example.com/asl.mp4", {
				startSeconds: 3,
				endSeconds: 8,
			}),
		).toBe("https://cdn.example.com/asl.mp4#t=3,8");
		expect(
			applyMediaFragment("https://cdn.example.com/asl.mp4", {
				startSeconds: 3,
			}),
		).toBe("https://cdn.example.com/asl.mp4#t=3");
	});

	test("leaves an authored fragment alone", () => {
		expect(
			applyMediaFragment("https://cdn.example.com/asl.mp4#t=1,2", {
				startSeconds: 9,
			}),
		).toBe("https://cdn.example.com/asl.mp4#t=1,2");
	});

	test("is a no-op without a fragment", () => {
		expect(applyMediaFragment("https://cdn.example.com/asl.mp4")).toBe(
			"https://cdn.example.com/asl.mp4",
		);
	});
});

describe("resolver payload passthrough", () => {
	test("one catalog identifier serves spoken and sign-language readers independently", () => {
		// `data-catalog-idref` is one canonical attribute with two readers, so a
		// node docking both must resolve each type without disturbing the other.
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "prompt-1",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content: "<speak>Hi</speak>",
					},
					card(),
				],
			},
		]);

		const spoken = resolver.getAlternative("prompt-1", {
			type: "spoken",
			language: "en-US",
		});
		expect(spoken?.content).toContain("<speak>");
		expect(spoken?.payload).toBeUndefined();

		const signed = resolver.getAlternative("prompt-1", {
			type: SIGN_LANGUAGE_CATALOG_TYPE,
			language: "ase",
		});
		expect(signed?.source).toBe("assessment");
		// The signing card has no string form at all, so the two readers cannot
		// pick up each other's content even by accident.
		expect(signed?.content).toBeUndefined();
		expect(resolveSignLanguageMedia(signed)?.sources[0].src).toBe(
			"https://cdn.example.com/asl.mp4",
		);
	});

	test("getAllAlternatives reports the payload", () => {
		const resolver = new AccessibilityCatalogResolver();
		resolver.addItemCatalogs([{ identifier: "prompt-1", cards: [card()] }]);
		const alternatives = resolver.getAllAlternatives("prompt-1");
		expect(alternatives).toHaveLength(1);
		expect(alternatives[0].payload).toEqual(payload());
	});

	test("getAllAlternatives describes a card exactly as getAlternative does", () => {
		// The two paths answer different questions about the same card — "what
		// alternates exist" and "give me this one" — and a consumer will act on both.
		// They are pinned to each other because they were once written separately and
		// drifted: only resolution knew about the `signLanguage` alias, so an
		// imported card rendered its video and was reported as carrying no payload by
		// anything asking whether the item had a signed alternate.
		const resolver = new AccessibilityCatalogResolver();
		resolver.addItemCatalogs([{ identifier: "prompt-1", cards: [card()] }]);

		const [enumerated] = resolver.getAllAlternatives("prompt-1");
		expect(enumerated).toEqual(
			resolver.getAlternative("prompt-1", {
				type: SIGN_LANGUAGE_CATALOG_TYPE,
				language: AMERICAN_SIGN_LANGUAGE,
			}),
		);
		expect(
			resolver.hasAlternativeType("prompt-1", SIGN_LANGUAGE_CATALOG_TYPE),
		).toBe(true);
	});

	test("getAllAlternatives reports a scoped registration, which is the runtime's path", () => {
		// The section player registers catalogs scoped to an owner, so an enumeration
		// that only walked the item and assessment maps would under-report every card
		// the real runtime holds.
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs({ ownerKind: "itemModel", itemId: "item-1" }, [
			{ identifier: "prompt-1", cards: [card()] },
		]);

		const [enumerated] = resolver.getAllAlternatives("prompt-1");
		expect(enumerated.source).toBe("item");
		expect(resolveSignLanguageMedia(enumerated)?.sources[0].src).toBe(
			"https://cdn.example.com/asl.mp4",
		);
	});

	test("getAllAlternatives reports one entry per type and language", () => {
		// Only the card resolution would pick is enumerable: reporting a shadowed
		// duplicate as an available alternate promises content no lookup returns.
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "prompt-1",
				cards: [card({ payload: payload({ signLang: "bfi" }) })],
			},
		]);
		resolver.addItemCatalogs([
			{
				identifier: "prompt-1",
				// Two `ase` cards in one catalog: only the first is reachable by any
				// lookup, so only the first is enumerable.
				cards: [card(), card(), card({ language: "bfi" })],
			},
		]);

		const alternatives = resolver.getAllAlternatives("prompt-1");
		expect(
			alternatives.map((alternative) => [
				alternative.language,
				alternative.source,
			]),
		).toEqual([
			[AMERICAN_SIGN_LANGUAGE, "item"],
			["bfi", "item"],
		]);
	});
});
