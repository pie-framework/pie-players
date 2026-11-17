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

	clearAll(): void;

	getEliminatedIds(): string[];

	initialize(): void;

	destroy(): void;
}

/**
 * The resolved strike colour. A host's `--pie-answer-eliminator-strike-color`
 * folds into the scheme's `--pie-incorrect` by `--pie-fixed-hue-collapse`, so a
 * colour scheme replaces it and a Base Theme keeps it exactly.
 */
export const STRIKE_PAINT =
	"color-mix(in srgb, var(--pie-incorrect, #ff9800) var(--pie-fixed-hue-collapse, 0%), var(--pie-answer-eliminator-strike-color, var(--pie-incorrect, #ff9800)))";

/**
 * Whether the page renders in forced colours, where Chromium paints every
 * custom highlight as a selection, so struck text would read as selected.
 */
export function forcedColorsActive(): boolean {
	return (
		typeof matchMedia === "function" &&
		matchMedia("(forced-colors: active)").matches
	);
}
