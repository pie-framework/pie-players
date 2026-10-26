import type { ToolSelectionAction } from "@pie-players/pie-assessment-toolkit/tools/registration";

/** Inputs shared by the component and its native element declaration. */
export interface AnnotationToolbarProps {
	enabled?: boolean;
	/**
	 * Actions on the current selection, supplied by whoever mounts this gateway.
	 *
	 * This strip does not know what they do — it renders the buttons and hands each
	 * one the selection. Pairing an action to a capability is the composer's job,
	 * which is what keeps a highlighter from naming a dictionary and lets a host
	 * contribute an action for a capability PIE does not ship.
	 */
	selectionActions?: ToolSelectionAction[] | null;
}
