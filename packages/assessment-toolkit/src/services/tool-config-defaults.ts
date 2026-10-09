/**
 * Placement defaults this package can hold.
 *
 * Only the empty one. `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` names
 * capabilities, so it lives in the composition layer
 * (`@pie-players/pie-default-tool-loaders`).
 */
export const DEFAULT_TOOL_PLACEMENT = {
	assessment: [],
	section: [],
	item: [],
	passage: [],
	rubric: [],
	element: [],
} as const;
