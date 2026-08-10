/**
 * Two cards of one type and language on the same node — a reading script and a
 * recording of it.
 *
 * This is APIP's authoring pattern, and QTI 3's migration guidance tells you to
 * keep the script when moving legacy audio into catalogs: it is both the source
 * the recording was generated from and the fallback when the recording cannot
 * play. Before form preference existed, both resolution rungs took the first
 * card matching type and language, so whichever was written second was
 * unreachable and enumeration under-reported it.
 */
import { describe, expect, test } from "bun:test";
import type {
	AccessibilityCatalog,
	CatalogCard,
} from "@pie-players/pie-players-shared";
import { AccessibilityCatalogResolver } from "../src/services/AccessibilityCatalogResolver";

const script = (language = "en-US"): CatalogCard => ({
	catalog: "spoken",
	language,
	content: "<speak>A plant absorbs carbon dioxide.</speak>",
});

const recording = (language = "en-US"): CatalogCard => ({
	catalog: "spoken",
	language,
	payload: {
		media: {
			version: 1,
			id: "prompt-audio",
			kind: "audio",
			sources: [{ src: "/audio/prompt.mp3", type: "audio/mpeg" }],
		},
	} as CatalogCard["payload"],
});

const catalogWith = (...cards: CatalogCard[]): AccessibilityCatalog[] => [
	{ identifier: "prompt-1", cards },
];

describe("script and recording on the same node", () => {
	test("enumerates both rather than collapsing them", () => {
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(script(), recording()),
		);

		const all = resolver.getAllAlternatives("prompt-1");

		expect(all).toHaveLength(2);
		expect(all.filter((entry) => entry.content !== undefined)).toHaveLength(1);
		expect(all.filter((entry) => entry.payload !== undefined)).toHaveLength(1);
	});

	test("still collapses genuine duplicates of the same type, language and form", () => {
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(script(), script()),
		);

		expect(resolver.getAllAlternatives("prompt-1")).toHaveLength(1);
	});

	test("resolves the requested form regardless of card order", () => {
		const recordingFirst = new AccessibilityCatalogResolver(
			catalogWith(recording(), script()),
		);
		const scriptFirst = new AccessibilityCatalogResolver(
			catalogWith(script(), recording()),
		);

		for (const resolver of [recordingFirst, scriptFirst]) {
			expect(
				resolver.getAlternative("prompt-1", {
					type: "spoken",
					language: "en-US",
					form: "content",
				})?.content,
			).toContain("carbon dioxide");
			expect(
				resolver.getAlternative("prompt-1", {
					type: "spoken",
					language: "en-US",
					form: "payload",
				})?.payload,
			).toBeDefined();
		}
	});

	test("falls back to the other form when the preferred one is absent", () => {
		const resolver = new AccessibilityCatalogResolver(catalogWith(script()));

		// A preference, not a filter. A caller that cannot use what it got has to
		// check — which it already must do for a card of an unexpected type.
		const resolved = resolver.getAlternative("prompt-1", {
			type: "spoken",
			language: "en-US",
			form: "payload",
		});
		expect(resolved?.content).toContain("carbon dioxide");
		expect(resolved?.payload).toBeUndefined();
	});

	test("prefers form within a language, never across languages", () => {
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(recording("en-US"), script("es-ES")),
		);

		// Answering a Spanish lookup with English audio would be worse than
		// answering it with Spanish text.
		const resolved = resolver.getAlternative("prompt-1", {
			type: "spoken",
			language: "es-ES",
			form: "payload",
		});
		expect(resolved?.language).toBe("es-ES");
		expect(resolved?.payload).toBeUndefined();
	});

	test("keeps first-match behaviour when no form is requested", () => {
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(recording(), script()),
		);

		expect(
			resolver.getAlternative("prompt-1", {
				type: "spoken",
				language: "en-US",
			})?.payload,
		).toBeDefined();
	});
});
