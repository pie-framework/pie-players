/**
 * Adapter interface for detecting and working with choice elements
 * from different PIE element types.
 *
 * Adapters enable the answer eliminator to work generically with
 * multiple-choice, EBSR, inline-dropdown, and future choice elements.
 */
export interface ChoiceAdapter {
	/** Element type this adapter handles */
	readonly elementType: string;

	/** Priority (higher = checked first) */
	readonly priority: number;

	/**
	 * Check if this adapter can handle the given element
	 */
	canHandle(element: HTMLElement): boolean;

	/**
	 * Find all choice elements within the root
	 */
	findChoices(root: HTMLElement): HTMLElement[];

	/**
	 * Create a Range covering the choice content (for CSS Highlight API)
	 */
	createChoiceRange(choice: HTMLElement): Range | null;

	/**
	 * Get unique identifier for this choice (for persistence)
	 */
	getChoiceId(choice: HTMLElement): string;

	/**
	 * Get human-readable label (for screen readers)
	 */
	getChoiceLabel(choice: HTMLElement): string;

	/**
	 * Check if choice can be eliminated
	 * (not already selected, not in evaluate mode, etc.)
	 */
	canEliminate(choice: HTMLElement): boolean;

	/**
	 * Get the container element to attach elimination button
	 */
	getButtonContainer(choice: HTMLElement): HTMLElement | null;
}
