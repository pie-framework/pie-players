import type { PersonalNeedsProfile } from "@pie-players/pie-players-shared/types";
import { createDefaultToolRegistry } from "./createDefaultToolRegistry.js";

function computeDefaultSupports(): string[] {
	const registry = createDefaultToolRegistry();
	const supports = new Set<string>();

	for (const tool of registry.getAllTools()) {
		for (const supportId of tool.pnpSupportIds || []) {
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
