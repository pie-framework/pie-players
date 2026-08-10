/**
 * Named preset of the PNP support ids the packaged tool set treats as universal
 * features — data, not a derivation.
 *
 * This list was previously computed at import time by unioning every registered
 * tool's `pnpSupportIds`, which made registry membership decide eligibility tier
 * and had to be corrected by a compile-time exclusion list no host could extend.
 * The ids below are that computation's output, frozen: adopt it, extend it, or
 * replace it alongside the district and test-administration configuration, the
 * same way any other policy input is chosen.
 *
 * Two properties this list must keep:
 *
 *   1. **Universal features only.** An accommodation belongs here only if the
 *      program has decided it is universal — which is a decision about the
 *      program, not about the capability. TTS sits here because the packaged set
 *      treats it as a universal feature; it is a documented accommodation in
 *      other programs.
 *   2. **No content-dependent capability.** A capability declaring
 *      `requiresAuthoredContent` needs an authored resource to have anything to
 *      show, so granting it wholesale grants an accommodation to learners who
 *      have no documented need for it. `tests/universal-supports.test.ts`
 *      enforces this against the registrations rather than against a name list.
 */

import type { PersonalNeedsProfile } from "@pie-players/pie-players-shared/types";

export const UNIVERSAL_SUPPORTS_PRESET: readonly string[] = Object.freeze([
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

/**
 * Build a profile granting {@link UNIVERSAL_SUPPORTS_PRESET}.
 *
 * A fresh array per call: a profile flows into policy inputs that hosts mutate,
 * and handing out a shared reference would let one host's edit reach another's.
 */
export function createUniversalPersonalNeedsProfile(): PersonalNeedsProfile {
	return {
		supports: [...UNIVERSAL_SUPPORTS_PRESET],
		prohibitedSupports: [],
		activateAtInit: [],
	};
}
