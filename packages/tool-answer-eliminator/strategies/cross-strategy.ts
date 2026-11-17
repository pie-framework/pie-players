import type {
	EliminationStrategy,
	EliminationTarget,
} from "./elimination-strategy.js";
import { createStrikeMark, type StrikeMarkShape } from "./strike-mark.js";

const MARK_CLASSES = {
	mark: "pie-answer-eliminator-cross",
	line: "pie-answer-eliminator-cross-line",
	casing: "pie-answer-eliminator-cross-casing",
};
/** Wipes a mark in from the inline start, once, when the choice is crossed. */
const WIPE_CLASS = "pie-answer-eliminator-cross--wipe";

interface Crossed {
	target: EliminationTarget;
	shape: StrikeMarkShape | null;
	marks: SVGSVGElement[];
	/** The container's inline `position` before the marks positioned it. */
	restorePosition: string | null;
	observer: ResizeObserver | null;
}

interface Measured {
	shape: StrikeMarkShape;
	boxes: DOMRect[];
}

/**
 * Crosses the content out with SVG marks in its container, outside the content
 * so the dim does not reach them: an X corner to corner over block content,
 * and a line through each line box of inline content, such as a token that
 * wraps in running text, where one box would cover text that is not the
 * choice's. The marks follow the content's layout through a ResizeObserver.
 */
export class CrossStrategy implements EliminationStrategy {
	readonly name = "cross";

	private crossed = new Map<string, Crossed>();

	initialize(): void {}

	destroy(): void {
		this.clearAll();
	}

	apply(choiceId: string, target: EliminationTarget): void {
		this.remove(choiceId);
		const { container, content } = target;
		// The marks are positioned against the container.
		const restorePosition =
			getComputedStyle(container).position === "static"
				? container.style.position
				: null;
		if (restorePosition !== null) container.style.position = "relative";

		const crossed: Crossed = {
			target,
			shape: null,
			marks: [],
			restorePosition,
			observer: null,
		};
		this.crossed.set(choiceId, crossed);
		render(crossed, true);

		if (typeof ResizeObserver === "function") {
			crossed.observer = new ResizeObserver(() => render(crossed, false));
			crossed.observer.observe(container);
			// An inline box reports no size; its container's covers its reflow.
			if (getComputedStyle(content).display !== "inline") {
				crossed.observer.observe(content);
			}
		}
	}

	remove(choiceId: string): void {
		const crossed = this.crossed.get(choiceId);
		if (!crossed) return;
		this.crossed.delete(choiceId);
		crossed.observer?.disconnect();
		for (const mark of crossed.marks) mark.remove();
		if (crossed.restorePosition !== null) {
			crossed.target.container.style.position = crossed.restorePosition;
		}
	}

	isEliminated(choiceId: string): boolean {
		return this.crossed.has(choiceId);
	}

	clearAll(): void {
		for (const choiceId of this.getEliminatedIds()) this.remove(choiceId);
	}

	getEliminatedIds(): string[] {
		return Array.from(this.crossed.keys());
	}
}

function measure({ content, range }: EliminationTarget): Measured {
	const display = getComputedStyle(content).display;
	const drawn = (rect: DOMRect) => rect.width > 0 && rect.height > 0;
	if (display === "inline") {
		return {
			shape: "line",
			boxes: Array.from(content.getClientRects()).filter(drawn),
		};
	}
	// `display: contents` generates no box of its own; its children's span it.
	const box =
		display === "contents"
			? range.getBoundingClientRect?.()
			: content.getBoundingClientRect();
	return { shape: "cross", boxes: box && drawn(box) ? [box] : [] };
}

/**
 * Lays one mark over each measured box. Marks are reused while their number
 * and shape hold, so a reflow moves them without replaying the wipe.
 */
function render(crossed: Crossed, wipe: boolean): void {
	const { container, content } = crossed.target;
	if (!container.isConnected) return;
	const { shape, boxes } = measure(crossed.target);

	if (shape !== crossed.shape || boxes.length !== crossed.marks.length) {
		for (const mark of crossed.marks) mark.remove();
		crossed.marks = boxes.map(() => {
			const mark = createStrikeMark(shape, MARK_CLASSES);
			mark.setAttribute("data-pie-answer-eliminator-cross", shape);
			mark.setAttribute(
				"dir",
				getComputedStyle(content).direction === "rtl" ? "rtl" : "ltr",
			);
			if (wipe) mark.classList.add(WIPE_CLASS);
			container.appendChild(mark);
			return mark;
		});
		crossed.shape = shape;
	}

	const frame = containerFrame(container);
	boxes.forEach((box, index) => {
		const { style } = crossed.marks[index];
		style.left = `${(box.left - frame.left) * frame.scaleX + frame.offsetX}px`;
		style.top = `${(box.top - frame.top) * frame.scaleY + frame.offsetY}px`;
		style.width = `${box.width * frame.scaleX}px`;
		style.height = `${box.height * frame.scaleY}px`;
	});
}

/**
 * Maps viewport coordinates onto the container's padding box, where an
 * absolutely positioned child's `left: 0` sits. The scale undoes any transform
 * on an ancestor; the offsets undo the border and the scroll position.
 */
function containerFrame(container: HTMLElement) {
	const rect = container.getBoundingClientRect();
	// An inline container's absolute children start from its first line box.
	const origin =
		getComputedStyle(container).display === "inline"
			? (container.getClientRects()[0] ?? rect)
			: rect;
	return {
		left: origin.left,
		top: origin.top,
		scaleX: rect.width > 0 ? container.offsetWidth / rect.width : 1,
		scaleY: rect.height > 0 ? container.offsetHeight / rect.height : 1,
		offsetX: container.scrollLeft - container.clientLeft,
		offsetY: container.scrollTop - container.clientTop,
	};
}
