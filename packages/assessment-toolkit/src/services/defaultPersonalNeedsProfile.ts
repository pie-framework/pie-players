import type { PersonalNeedsProfile } from "@pie-players/pie-players-shared/types";

/**
 * An empty personal-needs profile: nothing granted, nothing prohibited, nothing
 * activated at init.
 *
 * The core ships no populated default on purpose. It once derived one from every
 * registered tool's `pnpSupportIds`, which read *registry membership* as
 * *eligibility tier* — registration means "policy-addressable", not "universal,
 * on by default" — so an accommodation-tier capability was granted to every
 * student of every host that supplied no profile. The remedy at the time was a
 * compile-time list of ids to exclude, which a host could not extend for its own
 * accommodation.
 *
 * Which capabilities a deployment grants by default is a property of the
 * program, not of this package: TTS is a universal feature in one program and a
 * documented accommodation in another. That belongs in policy configuration
 * alongside the district and test-administration levels. A named preset of
 * today's universal set ships as data from
 * `@pie-players/pie-default-tool-loaders`, for hosts that want it.
 */
export function createEmptyPersonalNeedsProfile(): PersonalNeedsProfile {
	return {
		supports: [],
		prohibitedSupports: [],
		activateAtInit: [],
	};
}
