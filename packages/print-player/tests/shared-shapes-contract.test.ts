import type { ToolRegistration } from "@pie-players/pie-assessment-toolkit/tools/registration";
import type {
	ElementPackagePolicy,
	EsmCdnProvider,
	EsmCdnProviderOption,
} from "@pie-players/pie-players-shared/loaders";
import type { ItemMarkupSanitizer } from "@pie-players/pie-players-shared/security";
import type {
	AccessibilityCatalog,
	AssessmentSettings,
	ItemSettings,
	PersonalNeedsProfile,
} from "@pie-players/pie-players-shared/types";
import { expect, test } from "bun:test";

import type {
	PrintAccessibilityCatalog,
	PrintAssessmentSettings,
	PrintElementPackagePolicy,
	PrintEsmCdnProvider,
	PrintEsmCdnProviderOption,
	PrintItemSettings,
	PrintMarkupSanitizer,
	PrintPersonalNeedsProfile,
	PrintToolRegistration,
} from "../src/shared-shapes.js";

// Compile-time: every value a host holds in the real type is accepted where the
// print player names the structural one. `typecheck` fails if either drifts.
const hostValuesAreAccepted = {
	catalog: (value: AccessibilityCatalog): PrintAccessibilityCatalog => value,
	profile: (value: PersonalNeedsProfile): PrintPersonalNeedsProfile => value,
	settings: (value: AssessmentSettings): PrintAssessmentSettings => value,
	itemSettings: (value: ItemSettings): PrintItemSettings => value,
	registration: (value: ToolRegistration): PrintToolRegistration => value,
	policy: (value: ElementPackagePolicy): PrintElementPackagePolicy => value,
	provider: (value: EsmCdnProvider): PrintEsmCdnProvider => value,
	providerOption: (value: EsmCdnProviderOption): PrintEsmCdnProviderOption =>
		value,
	sanitizer: (value: ItemMarkupSanitizer): PrintMarkupSanitizer => value,
};

// Compile-time: these are restated exactly, so the player hands them to the real
// code without a cast.
const restatedExactly = {
	policy: (value: PrintElementPackagePolicy): ElementPackagePolicy => value,
	provider: (value: PrintEsmCdnProvider): EsmCdnProvider => value,
	providerOption: (value: PrintEsmCdnProviderOption): EsmCdnProviderOption =>
		value,
	sanitizer: (value: PrintMarkupSanitizer): ItemMarkupSanitizer => value,
};

test("print-player's structural shapes accept the toolkit's and players-shared's", () => {
	expect(Object.keys(hostValuesAreAccepted)).toHaveLength(9);
	expect(Object.keys(restatedExactly)).toHaveLength(4);
});
