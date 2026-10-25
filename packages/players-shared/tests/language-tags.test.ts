import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import {
	findBestLanguageMatch,
	languageTagLookupSequence,
	languageTagScript,
	languageTagScriptLookupSequence,
	languageTagScriptsMatch,
	languageTagsEqual,
	negotiateContentLanguage,
	normalizeLanguageTag,
	toLanguageTag,
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

describe("toLanguageTag", () => {
	it("rewrites POSIX separators and keeps the authored case", () => {
		expect(toLanguageTag("es_ES")).toBe("es-ES");
		expect(toLanguageTag(" es-ES ")).toBe("es-ES");
	});

	it("treats nullish and blank input as no declared language", () => {
		expect(toLanguageTag(undefined)).toBe("");
		expect(toLanguageTag(null)).toBe("");
		expect(toLanguageTag("   ")).toBe("");
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

	it("reaches the language and likely script before the bare language", () => {
		expect(findBestLanguageMatch("zh-TW", ["zh", "zh-Hant"])).toBe("zh-Hant");
		expect(findBestLanguageMatch("sr-ME", ["sr", "sr-Latn"])).toBe("sr-Latn");
	});

	it("passes a bare-language catalog by when its likely script differs", () => {
		expect(findBestLanguageMatch("zh-TW", ["en-US", "zh"])).toBeUndefined();
		expect(findBestLanguageMatch("zh-Hant", ["zh"])).toBeUndefined();
		expect(findBestLanguageMatch("sr-Latn-RS", ["sr"])).toBeUndefined();
		expect(findBestLanguageMatch("zh-SG", ["zh"])).toBe("zh");
		expect(findBestLanguageMatch("sr-Cyrl", ["sr"])).toBe("sr");
	});

	it("accepts an exact match whatever its script data", () => {
		expect(findBestLanguageMatch("zh", ["zh"])).toBe("zh");
		expect(findBestLanguageMatch("es_es", ["es-ES"])).toBe("es-ES");
	});
});

describe("languageTagScript", () => {
	it("reads an explicit script, then the CLDR likely script", () => {
		expect(languageTagScript("sr-Latn")).toBe("latn");
		expect(languageTagScript("zh-TW")).toBe("hant");
		expect(languageTagScript("zh")).toBe("hans");
		expect(languageTagScript("ar_SA")).toBe("arab");
	});

	it("has no script for a blank or unparseable tag", () => {
		expect(languageTagScript("")).toBeUndefined();
		expect(languageTagScript("not a tag!")).toBeUndefined();
	});
});

describe("languageTagScriptsMatch", () => {
	it("passes when either side has no script data", () => {
		expect(languageTagScriptsMatch("zh-TW", "not a tag!")).toBe(true);
		expect(languageTagScriptsMatch("zh-TW", "zh")).toBe(false);
	});

	it("passes every tag when the runtime has no Intl.Locale", () => {
		const intl = Intl as { Locale?: typeof Intl.Locale };
		const { Locale } = intl;
		delete intl.Locale;
		try {
			expect(languageTagScriptsMatch("zh-HK", "zh-CN")).toBe(true);
			expect(findBestLanguageMatch("zh-HK", ["zh"])).toBe("zh");
		} finally {
			intl.Locale = Locale;
		}
	});
});

describe("content-language negotiation conformance", () => {
	interface Fixtures {
		scriptLookupSequence: { tag: string; expected: string[] }[];
		negotiate: {
			requested: string[];
			available: string[];
			defaultLanguage?: string;
			fallback?: "default" | "none";
			expected: { language: string; substitution?: "fallback" } | null;
		}[];
	}
	const fixtures: Fixtures = JSON.parse(
		readFileSync(new URL("./content-language-fixtures.json", import.meta.url), "utf8"),
	);

	for (const { tag, expected } of fixtures.scriptLookupSequence) {
		it(`script lookup sequence for ${tag}`, () => {
			expect(languageTagScriptLookupSequence(tag)).toEqual(expected);
		});
	}

	for (const { requested, available, defaultLanguage, fallback, expected } of fixtures.negotiate) {
		it(`negotiates [${requested.join(", ")}] over [${available.join(", ")}]${fallback ? ` with fallback ${fallback}` : ""}`, () => {
			expect(
				negotiateContentLanguage(requested, available, { defaultLanguage, fallback }) ?? null,
			).toEqual(expected);
		});
	}
});
