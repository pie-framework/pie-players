/** What a strategy paints: one choice's content, inside its container. */
export interface EliminationTarget {
	/** Covers the content's nodes, for the CSS Custom Highlight API. */
	range: Range;
	/** Holds the content and the toggle; a strategy may overlay marks here. */
	container: HTMLElement;
	/** What is struck through, crossed out or masked. */
	content: Element;
}

/**
 * How an eliminated choice is painted. The core owns the eliminated state and
 * its announcement (see `eliminated-state.ts`); a strategy only paints, and
 * paints nothing that reaches the toggle.
 */
export interface EliminationStrategy {
	readonly name: string;

	/** Paints the choice eliminated. `choiceId` is an opaque, CSS-safe token. */
	apply(choiceId: string, target: EliminationTarget): void;

	remove(choiceId: string): void;

	isEliminated(choiceId: string): boolean;

	/** Repositions the marks after the content may have moved or reflowed. */
	relayout?(): void;

	clearAll(): void;

	getEliminatedIds(): string[];

	initialize(): void;

	destroy(): void;
}
