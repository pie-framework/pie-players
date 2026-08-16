/**
 * Language matching across tag syntaxes, and fallback along the request's own
 * lookup sequence.
 *
 * Matching was strict string equality, so a card the Learnosity transform
 * emitted as POSIX `es_ES` matched no request for BCP-47 `es-ES`. It surfaced
 * only through the final no-language-constraint rung — resolution by accident,
 * and only when nothing else of that type existed. With an English card present
 * the Spanish one became unreachable entirely, which is the shape of defect that
 * passes every test written against one language.
 */
import { describe, expect, test } from "bun:test";
import type {
	AccessibilityCatalog,
	CatalogCard,
} from "@pie-players/pie-players-shared";
import { AccessibilityCatalogResolver } from "../src/services/AccessibilityCatalogResolver";

const spoken = (language: string, content: string): CatalogCard => ({
	catalog: "spoken",
	language,
	content,
});

const catalogWith = (...cards: CatalogCard[]): AccessibilityCatalog[] => [
	{ identifier: "prompt-1", cards },
];

describe("catalog language matching", () => {
	test("a POSIX-tagged card answers a BCP-47 request", () => {
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(spoken("es_ES", "hola")),
		);

		const result = resolver.getAlternative("prompt-1", {
			type: "spoken",
			language: "es-ES",
		});

		expect(result?.content).toBe("hola");
	});

	test("a POSIX-tagged card is reachable even when English is present", () => {
		// The regression case: with useFallback on, the old no-constraint rung could
		// return the English card for a Spanish request.
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(spoken("en-US", "hello"), spoken("es_ES", "hola")),
		);

		const result = resolver.getAlternative("prompt-1", {
			type: "spoken",
			language: "es-ES",
		});

		expect(result?.content).toBe("hola");
	});

	test("a region request falls back to the bare language", () => {
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(spoken("es", "hola")),
		);

		const result = resolver.getAlternative("prompt-1", {
			type: "spoken",
			language: "es-MX",
		});

		expect(result?.content).toBe("hola");
	});

	test("an exact region match beats the bare language", () => {
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(spoken("es", "generic"), spoken("es-MX", "mexican")),
		);

		const result = resolver.getAlternative("prompt-1", {
			type: "spoken",
			language: "es-MX",
		});

		expect(result?.content).toBe("mexican");
	});

	test("a sibling region is not substituted while fallback is off", () => {
		// es-ES is not an acceptable answer to an es-MX request; without fallback
		// there is nothing to return rather than the wrong locale.
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(spoken("es-ES", "peninsular")),
		);

		const result = resolver.getAlternative("prompt-1", {
			type: "spoken",
			language: "es-MX",
			useFallback: false,
		});

		expect(result).toBeNull();
	});

	test("the default language is matched across tag syntaxes", () => {
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(spoken("en_US", "hello")),
			"en-US",
		);

		const result = resolver.getAlternative("prompt-1", { type: "spoken" });

		expect(result?.content).toBe("hello");
	});

	test("enumeration collapses two syntaxes of one language into one alternate", () => {
		// Resolution can only ever return one of these, so reporting two would
		// describe alternates that do not exist.
		const resolver = new AccessibilityCatalogResolver(
			catalogWith(spoken("es_ES", "hola"), spoken("es-ES", "hola again")),
		);

		expect(resolver.getAllAlternatives("prompt-1")).toHaveLength(1);
	});
});
