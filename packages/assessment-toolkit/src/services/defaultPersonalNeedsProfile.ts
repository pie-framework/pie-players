import type { PersonalNeedsProfile } from "@pie-players/pie-players-shared/types";
import { createPackagedToolRegistry } from "./createDefaultToolRegistry.js";

/**
 * PNP support ids that must never enter the computed default profile, however
 * they reach the registry.
 *
 * `computeDefaultSupports()` derives the fallback profile from every registered
 * tool's `pnpSupportIds`, which is right for universal features — a highlighter
 * or a zoom control should be there for every student by default. It is wrong
 * for an **accommodation**: signing requires a documented need (IEP / 504), so
 * granting it to every host that does not supply its own profile would invert
 * the eligibility tier. Registry membership is about being policy-addressable,
 * not about who may enable it.
 *
 * Excluded here rather than by declining to register, so the guarantee holds
 * even if a signing tool is later registered for some other reason.
 */
export const ACCOMMODATION_ONLY_SUPPORT_IDS: readonly string[] = [
	// QTI 3.0 / AfA `signLanguage`. Signed alternates are rendered by
	// section-player's per-item media region, gated on this id.
	"signLanguage",
];

function computeDefaultSupports(): string[] {
	const registry = createPackagedToolRegistry();
	const supports = new Set<string>();
	const excluded = new Set(ACCOMMODATION_ONLY_SUPPORT_IDS);

	for (const tool of registry.getAllTools()) {
		for (const supportId of tool.pnpSupportIds || []) {
			if (excluded.has(supportId)) continue;
			supports.add(supportId);
		}
	}

	return [...supports].sort();
}

const DEFAULT_SUPPORTS = computeDefaultSupports();

export const DEFAULT_PERSONAL_NEEDS_PROFILE: PersonalNeedsProfile = {
	supports: [...DEFAULT_SUPPORTS],
	prohibitedSupports: [],
	activateAtInit: [],
};

export function createDefaultPersonalNeedsProfile(): PersonalNeedsProfile {
	return {
		supports: [...DEFAULT_SUPPORTS],
		prohibitedSupports: [],
		activateAtInit: [],
	};
}
