/**
 * Reads one legacy element's choices from its rendered markup. Declaring
 * elements supply their choices themselves; see the README.
 */
export interface ChoiceAdapter {
	/** Find all choice elements within the root */
	findChoices(root: HTMLElement): HTMLElement[];

	/** Create a Range covering the choice content (for CSS Highlight API) */
	createChoiceRange(choice: HTMLElement): Range | null;

	/** Get unique identifier for this choice (for persistence) */
	getChoiceId(choice: HTMLElement): string;

	/** Get human-readable label (for screen readers) */
	getChoiceLabel(choice: HTMLElement): string;

	/** Whether the student has selected the choice (radio/checkbox checked). */
	isSelected(choice: HTMLElement): boolean;

	/**
	 * Check if choice can be eliminated
	 * (not already selected, not in evaluate mode, etc.)
	 */
	canEliminate(choice: HTMLElement): boolean;

	/**
	 * Enable or disable the student's ability to select this choice.
	 * A struck-through choice is made non-selectable (grayed out) so a
	 * student cannot pick an answer they have eliminated.
	 */
	setSelectable(choice: HTMLElement, selectable: boolean): void;
}
