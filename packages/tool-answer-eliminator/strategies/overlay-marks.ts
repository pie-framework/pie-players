import { TOGGLE_CLASS } from "../choice-toggle.js";
import type { EliminationTarget } from "./elimination-strategy.js";
import {
	createStrikeMark,
	type StrikeMarkClasses,
	type StrikeMarkShape,
} from "./strike-mark.js";

/** A box in viewport coordinates, as `getBoundingClientRect` returns one. */
export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** One mark to lay over a measured box. */
export interface Mark {
	shape: StrikeMarkShape;
	classes: StrikeMarkClasses;
	box: Box;
}

export interface OverlayOptions {
	/** Where the marks go over the choice's content, measured on each layout. */
	measure(target: EliminationTarget): Mark[];
	/** Set on each mark to its shape, for hosts and tests. */
	shapeAttribute: string;
	/** Added to marks created as the choice is eliminated, never on a relayout. */
	enterClass?: string;
}

interface Overlay {
	target: EliminationTarget;
	marks: SVGSVGElement[];
	/** The shape and classes each mark was created with, in order. */
	signature: string;
	/** The container's inline `position` before the marks positioned it. */
	restorePosition: string | null;
	observer: ResizeObserver | null;
}

export const isDrawn = (box: Box): boolean => box.width > 0 && box.height > 0;

/**
 * SVG marks laid over choices' content from their containers, outside the
 * content, so the dim does not reach them, and the content's own markup stays
 * as the element rendered it. The marks follow the content's layout through a
 * ResizeObserver, a late web font, and `relayout`, which the core calls after
 * the element changes its markup. The theme stylesheet paints them in
 * `--pie-answer-eliminator-strike-color`.
 */
export class OverlayMarks {
	private overlays = new Map<string, Overlay>();
	private fonts: FontFaceSet | null = null;
	// A web font that loads late rewraps text without resizing its box.
	private readonly onFontsLoaded = () => this.relayout();

	constructor(private readonly options: OverlayOptions) {}

	apply(choiceId: string, target: EliminationTarget): void {
		this.remove(choiceId);
		this.listenForFonts();
		const { container, content } = target;
		// The marks are positioned against the container.
		const restorePosition =
			getComputedStyle(container).position === "static"
				? container.style.position
				: null;
		if (restorePosition !== null) container.style.position = "relative";

		const overlay: Overlay = {
			target,
			marks: [],
			signature: "",
			restorePosition,
			observer: null,
		};
		this.overlays.set(choiceId, overlay);
		this.render(overlay, true);

		if (typeof ResizeObserver === "function") {
			overlay.observer = new ResizeObserver(() => this.render(overlay, false));
			// An inline box reports no size, so the nearest box that does covers
			// its reflow.
			for (const box of new Set([sizedBox(container), sizedBox(content)])) {
				if (box) overlay.observer.observe(box);
			}
		}
	}

	remove(choiceId: string): void {
		const overlay = this.overlays.get(choiceId);
		if (!overlay) return;
		this.overlays.delete(choiceId);
		overlay.observer?.disconnect();
		for (const mark of overlay.marks) mark.remove();
		if (overlay.restorePosition !== null) {
			overlay.target.container.style.position = overlay.restorePosition;
		}
		if (this.overlays.size === 0) this.stopListeningForFonts();
	}

	relayout(): void {
		for (const overlay of this.overlays.values()) this.render(overlay, false);
	}

	has(choiceId: string): boolean {
		return this.overlays.has(choiceId);
	}

	ids(): string[] {
		return Array.from(this.overlays.keys());
	}

	clearAll(): void {
		for (const choiceId of this.ids()) this.remove(choiceId);
	}

	private listenForFonts(): void {
		if (this.fonts || typeof document === "undefined") return;
		const fonts = document.fonts;
		if (typeof fonts?.addEventListener !== "function") return;
		fonts.addEventListener("loadingdone", this.onFontsLoaded);
		this.fonts = fonts;
	}

	private stopListeningForFonts(): void {
		this.fonts?.removeEventListener("loadingdone", this.onFontsLoaded);
		this.fonts = null;
	}

	/**
	 * Lays one mark over each measured box. Marks are reused while their
	 * shapes and classes hold, so a reflow only moves them.
	 */
	private render(overlay: Overlay, entering: boolean): void {
		const { container, content } = overlay.target;
		if (!container.isConnected) return;
		const marks = this.options.measure(overlay.target);
		const signature = marks
			.map(({ shape, classes }) => `${shape}:${classes.mark}:${classes.line}`)
			.join(" ");

		if (signature !== overlay.signature) {
			for (const mark of overlay.marks) mark.remove();
			const direction =
				getComputedStyle(content).direction === "rtl" ? "rtl" : "ltr";
			// Ahead of the toggle, which stays the container's last child.
			const toggle = container.querySelector(`:scope > .${TOGGLE_CLASS}`);
			overlay.marks = marks.map(({ shape, classes }) => {
				const mark = createStrikeMark(shape, classes);
				// Layout, not paint, so set here: the marks keep out of the flow and
				// the pointer's way under any stylesheet, including an older theme.
				mark.style.position = "absolute";
				mark.style.overflow = "visible";
				mark.style.pointerEvents = "none";
				mark.setAttribute(this.options.shapeAttribute, shape);
				mark.setAttribute("dir", direction);
				if (entering && this.options.enterClass) {
					mark.classList.add(this.options.enterClass);
				}
				container.insertBefore(mark, toggle);
				return mark;
			});
			overlay.signature = signature;
		}

		const frame = containerFrame(container);
		marks.forEach(({ box }, index) => {
			setStyle(
				overlay.marks[index],
				`${(box.left - frame.left) * frame.scaleX + frame.offsetX}px`,
				`${(box.top - frame.top) * frame.scaleY + frame.offsetY}px`,
				`${box.width * frame.scaleX}px`,
				`${box.height * frame.scaleY}px`,
			);
		});
	}
}

/** The element, or its nearest ancestor, that lays out as a box of its own. */
function sizedBox(element: Element): Element | null {
	for (let current: Element | null = element; current; current = current.parentElement) {
		const { display } = getComputedStyle(current);
		if (display !== "inline" && display !== "contents") return current;
	}
	return null;
}

function setStyle(
	mark: SVGSVGElement,
	left: string,
	top: string,
	width: string,
	height: string,
): void {
	const { style } = mark;
	if (style.left !== left) style.left = left;
	if (style.top !== top) style.top = top;
	if (style.width !== width) style.width = width;
	if (style.height !== height) style.height = height;
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
