import { describe, expect, test } from "bun:test";
import { createPersonalNeedsProfileFromAfa } from "../src/afa-profile.js";

describe("AfA PNP 3.0 adapter", () => {
	test("maps every renamed term to its packaged tool id", () => {
		expect(
			createPersonalNeedsProfileFromAfa({
				"calculator-on-screen": {},
				"answer-masking": {},
				"dictionary-on-screen": {},
			}).supports,
		).toEqual(["answerEliminator", "calculator", "dictionary"]);
	});

	test("resolves spoken by reading type, screen reader by default", () => {
		expect(
			createPersonalNeedsProfileFromAfa({
				spoken: { "reading-type": "computer-read-aloud" },
			}).supports,
		).toEqual(["textToSpeech"]);
		expect(
			createPersonalNeedsProfileFromAfa({
				spoken: { "reading-type": "screen-reader" },
			}).supports,
		).toEqual(["screenReader"]);
		expect(createPersonalNeedsProfileFromAfa({ spoken: {} }).supports).toEqual([
			"screenReader",
		]);
	});

	test("passes other terms through camelCased and skips non-features", () => {
		expect(
			createPersonalNeedsProfileFromAfa({
				"line-reader": { "highlight-color": "#ffff00" },
				transcript: {},
				"sign-language": { language: "ase" },
				"glossary-on-screen": true,
				"spell-checker-on-screen": false,
				"high-contrast": null,
				extensions: { "x-vendor": {} },
				"hazard-avoidance": ["flashing"],
				"language-of-interface": "es",
			}).supports,
		).toEqual(["glossaryOnScreen", "lineReader", "signLanguage", "transcript"]);
	});

	test("sorts each set into its profile field, prohibition winning", () => {
		expect(
			createPersonalNeedsProfileFromAfa({
				spoken: { "reading-type": "computer-read-aloud" },
				"line-reader": {},
				"answer-masking": {},
				"activate-at-initialization-set": { spoken: {}, "line-reader": {} },
				"activate-as-option-set": ["dictionary-on-screen"],
				"prohibit-set": { "line-reader": {}, "calculator-on-screen": {} },
			}),
		).toEqual({
			supports: ["answerEliminator", "dictionary", "textToSpeech"],
			prohibitedSupports: ["calculator", "lineReader"],
			activateAtInit: ["textToSpeech"],
		});
	});

	test("a prohibited spoken withholds read-aloud", () => {
		expect(
			createPersonalNeedsProfileFromAfa({ "prohibit-set": ["spoken"] }),
		).toEqual({ supports: [], prohibitedSupports: ["textToSpeech"] });
	});

	test("carries the settings packaged tools read", () => {
		expect(
			createPersonalNeedsProfileFromAfa({
				spoken: {
					"reading-type": "computer-read-aloud",
					"speech-rate": 270,
					pitch: 0.25,
					volume: 0.8,
				},
				"calculator-on-screen": { "calculator-type": "graphing" },
				"sign-language": { language: "ase" },
			}).toolParameters,
		).toEqual({
			textToSpeech: { rate: 1.5, pitch: 0.5, volume: 0.8 },
			calculator: { type: "graphing" },
			signLanguage: { signLang: "ase" },
		});
	});

	test("omits settings no PIE tool takes", () => {
		expect(
			createPersonalNeedsProfileFromAfa({
				spoken: { "speech-rate": 270 },
				"calculator-on-screen": { "calculator-type": "standard" },
			}),
		).toEqual({ supports: ["calculator", "screenReader"], prohibitedSupports: [] });
	});
});
