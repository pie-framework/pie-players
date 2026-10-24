/**
 * Strategy interface for visual elimination styles
 * Uses CSS Custom Highlight API for zero DOM mutation
 */
export interface EliminationStrategy {
	/** Strategy name */
	readonly name: string;

	/**
	 * Apply elimination visual to a choice
	 * @param choiceId - Unique identifier for this choice
	 * @param range - DOM Range covering the choice content
	 */
	apply(choiceId: string, range: Range): void;

	/**
	 * Remove elimination visual from a choice
	 * @param choiceId - Unique identifier for this choice
	 */
	remove(choiceId: string): void;

	/**
	 * Check if a choice is currently eliminated
	 * @param choiceId - Unique identifier for this choice
	 */
	isEliminated(choiceId: string): boolean;

	/**
	 * Clear all eliminations
	 */
	clearAll(): void;

	/**
	 * Get all eliminated choice IDs
	 */
	getEliminatedIds(): string[];

	/**
	 * Initialize strategy (inject CSS, etc.)
	 */
	initialize(): void;

	/**
	 * Cleanup strategy (remove CSS, etc.)
	 */
	destroy(): void;

	/**
	 * Set the interface-language text and stamp for what the strategy adds for
	 * assistive technology, relabelling what it has already added.
	 */
	setChrome?(chrome: EliminationChrome): void;
}

/** Interface-locale chrome a strategy announces with. */
export interface EliminationChrome {
	/** Announced after an eliminated choice's label. */
	eliminatedText: string;
	/** Stamps the interface `lang` and `dir` on an element the strategy adds. */
	stamp(element: Element): void;
}
