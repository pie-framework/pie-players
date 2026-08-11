/**
 * Placement defaults this package can hold.
 *
 * Only the empty one. `PACKAGED_TOOL_PLACEMENT` and
 * `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` name capabilities, so they moved to
 * the composition layer (`@pie-players/pie-default-tool-loaders`).
 */
export const DEFAULT_TOOL_PLACEMENT = {
	assessment: [],
	section: [],
	item: [],
	passage: [],
	rubric: [],
	element: [],
} as const;
