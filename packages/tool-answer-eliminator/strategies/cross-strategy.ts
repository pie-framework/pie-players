import type {
	EliminationStrategy,
	EliminationTarget,
} from "./elimination-strategy.js";
import { isDrawn, type Mark, OverlayMarks } from "./overlay-marks.js";

const MARK_CLASSES = {
	mark: "pie-answer-eliminator-cross",
	line: "pie-answer-eliminator-cross-line",
	casing: "pie-answer-eliminator-cross-casing",
};

/**
 * An X corner to corner over block content, and a line through each line box
 * of inline content, such as a token that wraps in running text, where one box
 * would cover text that is not the choice's.
 */
function measure({ content, range }: EliminationTarget): Mark[] {
	const display = getComputedStyle(content).display;
	if (display === "inline") {
		return Array.from(content.getClientRects())
			.filter(isDrawn)
			.map((box) => ({ shape: "line", classes: MARK_CLASSES, box }));
	}
	// `display: contents` generates no box of its own; its children's span it.
	const box =
		display === "contents"
			? range.getBoundingClientRect?.()
			: content.getBoundingClientRect();
	return box && isDrawn(box)
		? [{ shape: "cross", classes: MARK_CLASSES, box }]
		: [];
}

/**
 * Crosses the content out with SVG marks in its container, outside the
 * content so the dim does not reach them. Each mark wipes in from the inline
 * start once, as the choice is crossed.
 */
export class CrossStrategy implements EliminationStrategy {
	readonly name = "cross";

	private readonly marks = new OverlayMarks({
		measure,
		shapeAttribute: "data-pie-answer-eliminator-cross",
		enterClass: "pie-answer-eliminator-cross--wipe",
	});

	initialize(): void {}

	destroy(): void {
		this.clearAll();
	}

	apply(choiceId: string, target: EliminationTarget): void {
		this.marks.apply(choiceId, target);
	}

	remove(choiceId: string): void {
		this.marks.remove(choiceId);
	}

	relayout(): void {
		this.marks.relayout();
	}

	isEliminated(choiceId: string): boolean {
		return this.marks.has(choiceId);
	}

	clearAll(): void {
		this.marks.clearAll();
	}

	getEliminatedIds(): string[] {
		return this.marks.ids();
	}
}
