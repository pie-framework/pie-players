import { describe, expect, test } from "bun:test";
import { createPackagedToolRegistry } from "../src/packaged-tool-registry";
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
		// wholesale grant: on the vast majority of items it has nothing to show, so
		// granting it universally hands learners an accommodation with no documented
		// need for it and a dead affordance wherever the resource is absent.
		//
		// Read off the registrations rather than compared against a list of ids.
		// The compile-time array this replaced could only ever name capabilities of
		// ours, so a host adding its own accommodation to a registry had no way to
		// keep it out of a preset — the declaration is the thing a host can supply.
		const registry = createPackagedToolRegistry();
		const contentDependent = registry.getContentDependentSupportIds();
		expect(
			[...UNIVERSAL_SUPPORTS_PRESET].filter((id) => contentDependent.includes(id)),
		).toEqual([]);
	});

	test("no packaged registration declares a content dependency", () => {
		// The preset check above can only see what the packaged registry holds, and
		// nothing forces a content-dependent capability into it: signing is a
		// separate opt-in package precisely because it needs an authored card. So
		// this is the other half — a twelfth registration added here with a content
		// dependency would pass the preset check by being invisible to it, and its
		// ids would then need adding to the preset to render at all.
		const registry = createPackagedToolRegistry();
		expect(registry.getContentDependentSupportIds()).toEqual([]);
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
