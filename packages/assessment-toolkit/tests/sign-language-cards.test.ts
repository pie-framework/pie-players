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
		kind: "sign-language",
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

function card(overrides: Partial<CatalogCard> = {}): CatalogCard {
	return {
		catalog: SIGN_LANGUAGE_CATALOG_TYPE,
		language: AMERICAN_SIGN_LANGUAGE,
		content: "https://cdn.example.com/asl.mp4",
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
					content: "",
					payload: payload({
						media: { version: 1, id: "m", kind: "video", sources: [] },
					}),
				}),
			),
		).toBeNull();
		expect(
			resolveSignLanguageMedia(
				card({
					content: "",
					payload: {
						kind: "sign-language",
						signLang: "ase",
						media: undefined as never,
					},
				}),
			),
		).toBeNull();
	});

	test("drops sources whose scheme a media element cannot fetch", () => {
		const media = resolveSignLanguageMedia(
			card({
				content: "",
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

	test("supports the legacy bare-URL form with no payload", () => {
		const media = resolveSignLanguageMedia({
			language: "ase",
			content: "https://cdn.example.com/legacy.mp4",
		});
		expect(media?.sources).toEqual([
			{ src: "https://cdn.example.com/legacy.mp4" },
		]);
		expect(media?.signLang).toBe("ase");
	});

	test("falls back to the card language when the payload omits signLang", () => {
		const media = resolveSignLanguageMedia(
			card({ language: "bfi", payload: payload({ signLang: "  " }) }),
		);
		expect(media?.signLang).toBe("bfi");
	});

	test("an importer-shaped card still resolves through its bare-URL content", () => {
		// The `pie-api-aws` Learnosity transform currently emits the media block
		// under a `signLanguage` key rather than `payload`, so this contract does
		// not see it as a typed payload. It still renders, because the importer
		// also fills `content` with the primary source URL — but the type, label
		// and any second source are lost. Pinned as a fact, not blessed as a
		// second vocabulary: the two names need reconciling in PIE-879 / PIE-881.
		const media = resolveSignLanguageMedia({
			language: "ase",
			content: "https://cdn.example.com/imported.mp4",
			...({
				signLanguage: {
					signLang: "ase",
					media: {
						version: 1,
						id: "m",
						kind: "video",
						sources: [
							{
								src: "https://cdn.example.com/imported.mp4",
								type: "video/mp4",
							},
						],
						label: "American Sign Language translation",
					},
				},
			} as Record<string, unknown>),
		});
		expect(media?.sources).toEqual([
			{ src: "https://cdn.example.com/imported.mp4" },
		]);
		expect(media?.signLang).toBe("ase");
		expect(media?.label).toBeUndefined();
	});

	test("leaves an unlabelled legacy card unlabelled", () => {
		const media = resolveSignLanguageMedia({
			content: "https://cdn.example.com/legacy.mp4",
		});
		expect(media?.signLang).toBeUndefined();
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

	test("accepts an unlabelled card rather than making legacy content dead", () => {
		const unlabelled = resolveSignLanguageMedia({
			content: "https://cdn.example.com/legacy.mp4",
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
});
