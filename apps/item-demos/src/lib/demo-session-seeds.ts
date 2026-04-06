/**
 * Central place for non-empty initial item sessions when a demo cannot start from
 * an empty `data: []` container. Demo content modules must not define sessions.
 *
 * Keys: `DemoInfo.id`. Omit a demo id to use the default empty session from ItemController.
 */
const seeds: Record<string, unknown> = {
	// Add entries here only if iife delivery smoke fails without a seed.
};

export function getDemoSessionSeed(demoId: string | undefined): unknown | undefined {
	if (!demoId) return undefined;
	return seeds[demoId];
}
