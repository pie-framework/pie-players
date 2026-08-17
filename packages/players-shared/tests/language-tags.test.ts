import { describe, expect, it } from "bun:test";
import {
	findBestLanguageMatch,
	languageTagLookupSequence,
	languageTagsEqual,
	normalizeLanguageTag,
} from "../src/i18n/language-tags.js";

describe("normalizeLanguageTag", () => {
	it("unifies POSIX and BCP-47 separators", () => {
		expect(normalizeLanguageTag("es_ES")).toBe("es-es");
		expect(normalizeLanguageTag("es-ES")).toBe("es-es");
	});

	it("strips POSIX charset and modifier suffixes", () => {
		expect(normalizeLanguageTag("es_ES.UTF-8")).toBe("es-es");
		expect(normalizeLanguageTag("es_ES@euro")).toBe("es-es");
	});

	it("treats nullish and blank input as no declared language", () => {
		expect(normalizeLanguageTag(undefined)).toBe("");
		expect(normalizeLanguageTag(null)).toBe("");
		expect(normalizeLanguageTag("   ")).toBe("");
	});
});

describe("languageTagsEqual", () => {
	it("matches across separator style and case", () => {
		expect(languageTagsEqual("es_ES", "es-ES")).toBe(true);
		expect(languageTagsEqual("EN-us", "en-US")).toBe(true);
	});

	it("does not match different regions", () => {
		expect(languageTagsEqual("en-US", "en-GB")).toBe(false);
	});

	it("does not match two absent languages", () => {
		expect(languageTagsEqual(undefined, undefined)).toBe(false);
		expect(languageTagsEqual("", "")).toBe(false);
	});
});

describe("languageTagLookupSequence", () => {
	it("orders from most to least specific", () => {
		expect(languageTagLookupSequence("es-MX")).toEqual(["es-mx", "es"]);
		expect(languageTagLookupSequence("zh-Hant-TW")).toEqual([
			"zh-hant-tw",
			"zh-hant",
			"zh",
		]);
	});

	it("keeps a single-subtag tag as one step", () => {
		expect(languageTagLookupSequence("en")).toEqual(["en"]);
	});

	it("normalizes POSIX input before truncating", () => {
		expect(languageTagLookupSequence("es_419")).toEqual(["es-419", "es"]);
	});

	it("never stops on a dangling singleton subtag", () => {
		// RFC 4647 §3.4: a truncation ending in a singleton is skipped, so `de-de-u`
		// never appears.
		expect(languageTagLookupSequence("de-DE-u-co")).not.toContain("de-de-u");
		expect(languageTagLookupSequence("de-DE-u-co")).toContain("de-de");
	});

	it("returns nothing for an absent tag", () => {
		expect(languageTagLookupSequence(undefined)).toEqual([]);
	});
});

describe("findBestLanguageMatch", () => {
	it("prefers a more specific candidate over a less specific one", () => {
		expect(findBestLanguageMatch("es-MX", ["es", "es-MX"])).toBe("es-MX");
	});

	it("falls back along the request's own lookup sequence", () => {
		expect(findBestLanguageMatch("es-MX", ["en-US", "es"])).toBe("es");
	});

	it("does not substitute a sibling region", () => {
		// This is the case that matters for accommodations: answering an es-MX
		// request with es-ES content is a different locale, not a fallback.
		expect(findBestLanguageMatch("es-MX", ["en-US", "es_ES"])).toBeUndefined();
	});

	it("matches a POSIX-tagged candidate for a BCP-47 request", () => {
		// The Learnosity transform emits POSIX; requests arrive as BCP-47.
		expect(findBestLanguageMatch("es-ES", ["es_ES"])).toBe("es_ES");
	});

	it("returns the candidate as authored, not normalized", () => {
		expect(findBestLanguageMatch("EN-us", ["en_US"])).toBe("en_US");
	});
});
