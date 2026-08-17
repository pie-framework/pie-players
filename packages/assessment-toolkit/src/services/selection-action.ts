/**
 * Host-supplied actions on a text selection.
 *
 * The contract between a selection gateway and whoever composes it. The gateway
 * renders the actions it is handed and knows nothing about what they do; the
 * composer knows which capabilities exist and pairs them up. That split is what
 * keeps a gateway from naming a dictionary, and what lets a host contribute an
 * action for a capability PIE does not ship.
 */

/** What the gateway hands an action when the learner activates it. */
export interface ToolSelectionContext {
	/** The selected text, trimmed and whitespace-collapsed by the gateway. */
	text: string;
	/**
	 * The live range, or `null` when the gateway has already lost it.
	 *
	 * An action that only needs the words should use `text`; the range is for an
	 * action that has to know where in the content the words were.
	 */
	range: Range | null;
}

export interface ToolSelectionAction {
	/** Stable id, used as the button's key and its `data-pie-selection-action`. */
	id: string;
	/** Visible and accessible name. */
	label: string;
	/**
	 * Inline SVG markup for the button face.
	 *
	 * Markup rather than an icon name because a gateway has no icon registry, and
	 * the composer already resolves names through the toolkit's own map. Rendered
	 * into the gateway's shadow root and treated as trusted composer-authored
	 * markup, on the same footing as the shell's own action icons — never a place
	 * to put anything that reached the composer from content or a service.
	 */
	iconSvg?: string;
	/** Longer tooltip, when the label alone reads as terse in a strip of icons. */
	tooltip?: string;
	/**
	 * Whether to offer the action at all, asked on each render.
	 *
	 * An action whose target capability is not available answers `false` rather
	 * than being offered and failing: an affordance that does nothing costs a
	 * learner a keystroke and their confidence in the rest of the strip.
	 */
	isAvailable?: () => boolean;
	/** Perform the action. */
	run: (selection: ToolSelectionContext) => void;
}
