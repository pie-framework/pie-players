import { describe, expect, test } from "bun:test";
import {
	UNIVERSAL_SUPPORTS_PRESET,
	createUniversalPersonalNeedsProfile,
} from "../src/universal-supports";

describe("universal supports preset", () => {
	test("carries the packaged set's universal feature ids", () => {
		// Pinned as data. This list was previously recomputed on every import from
		// the registry, which is what let registry membership decide eligibility
		// tier; a diff here should be a deliberate program decision, not a
		// side-effect of registering something.
		expect([...UNIVERSAL_SUPPORTS_PRESET]).toEqual([
			"angleMeasurement",
			"annotation",
			"annotations",
			"answerEliminator",
			"answerMasking",
			"basicCalculator",
			"calculator",
			"chemistryReference",
			"choiceMasking",
			"colorContrast",
			"coordinatePlane",
			"customColors",
			"elementReference",
			"graph",
			"graphingCalculator",
			"graphingTool",
			"highContrast",
			"highContrastDisplay",
			"highlighter",
			"highlighting",
			"invertColors",
			"lineReader",
			"measurement",
			"periodicTable",
			"protractor",
			"readAloud",
			"readingGuide",
			"readingMask",
			"readingRuler",
			"ruler",
			"scientificCalculator",
			"speechOutput",
			"strikethrough",
			"textHighlight",
			"textToSpeech",
			"theme",
			"trackingGuide",
			"tts",
		]);
	});

	test("grants no content-dependent accommodation", () => {
		// A capability needing an authored resource must not arrive through a
		// wholesale grant. `signLanguage` is the one shipped today; step 3 of
		// PIE-886 replaces this id check with an assertion against every
		// registration declaring `requiresAuthoredContent`.
		expect(UNIVERSAL_SUPPORTS_PRESET).not.toContain("signLanguage");
	});

	test("is sorted and free of duplicates", () => {
		const ids = [...UNIVERSAL_SUPPORTS_PRESET];
		expect(ids).toEqual([...ids].sort());
		expect(new Set(ids).size).toBe(ids.length);
	});

	test("builds a profile granting the preset", () => {
		const profile = createUniversalPersonalNeedsProfile();
		expect(profile.supports).toEqual([...UNIVERSAL_SUPPORTS_PRESET]);
		expect(profile.prohibitedSupports).toEqual([]);
		expect(profile.activateAtInit).toEqual([]);
	});

	test("returns a fresh profile per call", () => {
		// A profile flows into policy inputs hosts mutate, so a shared reference
		// would let one host's edit reach another's.
		const first = createUniversalPersonalNeedsProfile();
		first.supports.push("hostSpecificSupport");
		expect(createUniversalPersonalNeedsProfile().supports).toEqual([
			...UNIVERSAL_SUPPORTS_PRESET,
		]);
	});
});
