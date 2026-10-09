import { describe, expect, test } from "bun:test";
import {
	createEmptyPersonalNeedsProfile,
	createPackagedToolRegistry,
	createUniversalPersonalNeedsProfile,
} from "../src/packaged-capability-composition.js";

const universalSupports = () => createUniversalPersonalNeedsProfile().supports;

describe("universal personal-needs profile", () => {
	test("grants the packaged set's universal tool ids", () => {
		// Pinned as data. This list was previously recomputed on every import from
		// the registry, which is what let registry membership decide eligibility
		// tier; a diff here should be a deliberate program decision, not a
		// side-effect of registering something.
		expect(universalSupports()).toEqual([
			"annotationToolbar",
			"answerEliminator",
			"calculator",
			"graph",
			"lineReader",
			"periodicTable",
			"protractor",
			"ruler",
			"textToSpeech",
			"theme",
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
			universalSupports().filter((id) =>
				contentDependent.includes(id),
			),
		).toEqual([]);
	});

	test("a packaged content-dependent capability works without a grant", () => {
		// The preset check above can only see what the packaged registry holds, so
		// this is the other half: a content-dependent capability shipped by default
		// must not need preset membership to do anything, or the way to make it work
		// becomes granting an accommodation wholesale.
		//
		// `resolvesWithoutGrant` is what makes that safe. It says the capability can
		// answer from its authored content alone — content authored as presentation,
		// which no profile grants and none revokes — so its useful half reaches every
		// deployment while its accommodation half stays policy-gated. A packaged
		// capability that cannot say that belongs in its own opt-in package, as
		// signing does.
		const registry = createPackagedToolRegistry();
		const contentDependent = registry.getContentDependentSupportIds();
		const withoutPresentationHalf = contentDependent.filter(
			(id) => !registry.get(id)?.resolvesWithoutGrant,
		);
		expect(withoutPresentationHalf).toEqual([]);
	});

	test("is sorted and free of duplicates", () => {
		const ids = universalSupports();
		expect(ids).toEqual([...ids].sort());
		expect(new Set(ids).size).toBe(ids.length);
	});

	test("prohibits nothing", () => {
		expect(createUniversalPersonalNeedsProfile().prohibitedSupports).toEqual([]);
	});

	test("returns a fresh profile per call", () => {
		// A profile flows into policy inputs hosts mutate, so a shared reference
		// would let one host's edit reach another's.
		const first = createUniversalPersonalNeedsProfile();
		first.supports.push("hostSpecificSupport");
		expect(universalSupports()).not.toContain("hostSpecificSupport");
	});
});

describe("empty personal-needs profile", () => {
	test("grants and prohibits nothing", () => {
		const profile = createEmptyPersonalNeedsProfile();
		expect(profile.supports).toEqual([]);
		expect(profile.prohibitedSupports).toEqual([]);
	});

	test("returns a fresh profile per call", () => {
		const first = createEmptyPersonalNeedsProfile();
		first.supports.push("hostSpecificSupport");
		expect(createEmptyPersonalNeedsProfile().supports).toEqual([]);
	});
});
