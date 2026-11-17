import {
	type EliminationStrategy,
	type EliminationTarget,
	forcedColorsActive,
	STRIKE_PAINT,
} from "./elimination-strategy.js";
import { createStrikeMark } from "./strike-mark.js";

const HIGHLIGHT_STYLE_PREFIX = "pie-answer-eliminator-highlight-";
const HIGHLIGHT_NAME_PREFIX = "pie-answer-eliminated-";
const FALLBACK_CLASS = "pie-answer-eliminator-eliminated-fallback";
const IMAGE_WRAPPER_CLASS = "pie-answer-eliminator-image-strike";
const IMAGE_WRAPPER_ATTR = "data-pie-answer-eliminator-image-strike";
const IMAGE_MARK_CLASSES = {
	mark: "pie-answer-eliminator-image-strike-overlay",
	line: "pie-answer-eliminator-image-strike-line",
	casing: "pie-answer-eliminator-image-strike-casing",
};
const MATH_STRIKE_CLASS = "pie-answer-eliminator-math-strike";
const MATH_STRIKE_LINE_CLASS = "pie-answer-eliminator-math-strike--line";
const MATH_STRIKE_CROSS_CLASS = "pie-answer-eliminator-math-strike--cross";
const MATH_STRIKE_ATTR = "data-pie-answer-eliminator-math-strike";
const MATH_MARK_CLASSES = {
	mark: "pie-answer-eliminator-math-strike-overlay",
	line: "pie-answer-eliminator-math-strike-line",
};
// MathJax names its CHTML boxes after the MathML they render. A horizontal
// strike is ambiguous exactly where the expression draws horizontal rules of
// its own — fraction bars and table rules — so those two get crossed out
// instead. Radicals and stacked limits keep the line: their bars sit at the top
// or the strike simply crosses the base, neither of which reads as part of the
// notation.
const MATH_STACKED_SELECTOR = "mjx-mfrac, mjx-mtable";
// The box MathJax gives the rendered expression. For inline math the
// `mjx-container` is `display: inline`, so its rect is the surrounding line box
// while the expression overflows it; `mjx-math` is the inline-block that
// bounds the glyphs.
const MATH_BOX_SELECTOR = "mjx-math";
// MathJax's rendered box, for both its CHTML and SVG output. Not `math`:
// natively rendered MathML keeps real text nodes, which the highlight already
// strikes.
const MATH_SELECTOR = "mjx-container";
// Displays that make the image a block-level box; an inline-block wrapper
// around one of those would change how the choice lays out.
const BLOCK_DISPLAYS = new Set([
	"block",
	"flex",
	"grid",
	"table",
	"flow-root",
	"list-item",
]);

interface StruckMath {
	box: HTMLElement;
	mark: SVGSVGElement | null;
}

interface Painted {
	target: EliminationTarget;
	/** A custom highlight, or a line-through class on the content. */
	text: "highlight" | "class";
	images: HTMLElement[];
	math: StruckMath[];
}

/**
 * Strikes the content's text through, and crosses out the images and rendered
 * math in it, which text decoration cannot reach.
 *
 * Text is struck by a CSS custom highlight where the browser has the API, so
 * its nodes stay as they are; elsewhere, and in forced colours, where Chromium
 * paints a highlight as a selection, a class on the content strikes it.
 */
export class StrikethroughStrategy implements EliminationStrategy {
	readonly name = "strikethrough";

	private painted = new Map<string, Painted>();
	private forcedColors: MediaQueryList | null = null;
	private readonly repaintText = () => {
		for (const [choiceId, painted] of this.painted) {
			this.unstrikeText(choiceId, painted);
			painted.text = this.strikeText(choiceId, painted.target);
		}
	};

	initialize(): void {
		if (typeof matchMedia !== "function") return;
		this.forcedColors = matchMedia("(forced-colors: active)");
		this.forcedColors.addEventListener?.("change", this.repaintText);
	}

	destroy(): void {
		this.clearAll();
		this.forcedColors?.removeEventListener?.("change", this.repaintText);
		this.forcedColors = null;
	}

	apply(choiceId: string, target: EliminationTarget): void {
		this.remove(choiceId);
		this.painted.set(choiceId, {
			target,
			text: this.strikeText(choiceId, target),
			images: strikeImages(target.content),
			math: strikeMath(target.content),
		});
	}

	remove(choiceId: string): void {
		const painted = this.painted.get(choiceId);
		if (!painted) return;
		this.painted.delete(choiceId);
		this.unstrikeText(choiceId, painted);
		for (const wrapper of painted.images) unwrapImage(wrapper);
		for (const struck of painted.math) unstrikeMathBox(struck);
	}

	isEliminated(choiceId: string): boolean {
		return this.painted.has(choiceId);
	}

	clearAll(): void {
		for (const choiceId of this.getEliminatedIds()) this.remove(choiceId);
	}

	getEliminatedIds(): string[] {
		return Array.from(this.painted.keys());
	}

	private canHighlight(): boolean {
		return (
			typeof CSS !== "undefined" &&
			"highlights" in CSS &&
			typeof Highlight === "function" &&
			!forcedColorsActive()
		);
	}

	private strikeText(
		choiceId: string,
		target: EliminationTarget,
	): Painted["text"] {
		if (!this.canHighlight()) {
			target.content.classList.add(FALLBACK_CLASS);
			return "class";
		}
		injectHighlightCSS(choiceId);
		CSS.highlights.set(
			`${HIGHLIGHT_NAME_PREFIX}${choiceId}`,
			new Highlight(target.range),
		);
		return "highlight";
	}

	private unstrikeText(choiceId: string, painted: Painted): void {
		if (painted.text === "class") {
			painted.target.content.classList.remove(FALLBACK_CLASS);
			return;
		}
		CSS.highlights.delete(`${HIGHLIGHT_NAME_PREFIX}${choiceId}`);
		document.getElementById(`${HIGHLIGHT_STYLE_PREFIX}${choiceId}`)?.remove();
	}
}

function injectHighlightCSS(choiceId: string): void {
	const styleId = `${HIGHLIGHT_STYLE_PREFIX}${choiceId}`;
	if (document.getElementById(styleId)) return;
	const style = document.createElement("style");
	style.id = styleId;
	// A highlight honours only colour, background, text-decoration and
	// text-shadow, so the dim comes from the theme's rule on the content.
	style.textContent = `
      ::highlight(${HIGHLIGHT_NAME_PREFIX}${choiceId}) {
        text-decoration: line-through;
        text-decoration-thickness: 2px;
        text-decoration-color: ${STRIKE_PAINT};
      }
    `;
	document.head.appendChild(style);
}

/**
 * Crosses out every image in the content. Images are replaced elements, which
 * neither `line-through` nor `::highlight()` paints and which cannot carry a
 * pseudo-element, so each is wrapped in a positioned span holding the mark.
 * The wrapper keeps the mark on the image through any reflow, with no
 * observers.
 */
function strikeImages(scope: Element): HTMLElement[] {
	const wrappers: HTMLElement[] = [];
	for (const image of scope.querySelectorAll("img")) {
		const wrapper = wrapImage(image);
		if (wrapper) wrappers.push(wrapper);
	}
	return wrappers;
}

function wrapImage(image: HTMLImageElement): HTMLElement | null {
	const parent = image.parentElement;
	if (!parent) return null;

	// Already struck (a state restore re-applying over live DOM): reuse the
	// wrapper so it stays tracked and is undone once.
	if (
		parent.classList.contains(IMAGE_WRAPPER_CLASS) ||
		parent.hasAttribute(IMAGE_WRAPPER_ATTR)
	) {
		return parent;
	}

	const wrapper = document.createElement("span");
	wrapper.className = IMAGE_WRAPPER_CLASS;
	wrapper.setAttribute(IMAGE_WRAPPER_ATTR, "true");

	// Keep the image's box model, so wrapping never shifts the layout, and keep
	// the wrapper hugging the image, so the X never overhangs it.
	if (fillsParentWidth(image, parent)) {
		// A fluid image already spans the parent; a shrink-to-fit wrapper would
		// collapse it to its intrinsic size.
		wrapper.style.display = "block";
	} else if (BLOCK_DISPLAYS.has(getComputedStyle(image).display)) {
		wrapper.style.display = "block";
		wrapper.style.width = "fit-content";
	}

	parent.insertBefore(wrapper, image);
	wrapper.appendChild(image);
	// The casing under each line keeps the X visible over dark or red imagery
	// (WCAG 1.4.11).
	wrapper.appendChild(createStrikeMark("cross", IMAGE_MARK_CLASSES));
	return wrapper;
}

function fillsParentWidth(image: HTMLImageElement, parent: HTMLElement): boolean {
	const imageWidth = image.getBoundingClientRect().width;
	const parentWidth = parent.clientWidth;
	if (imageWidth === 0 || parentWidth === 0) return false;
	// Sub-pixel rounding: within 1px of the parent fills it.
	return imageWidth >= parentWidth - 1;
}

function unwrapImage(wrapper: HTMLElement): void {
	wrapper.querySelector(`.${IMAGE_MARK_CLASSES.mark}`)?.remove();
	const parent = wrapper.parentElement;
	if (!parent) return;
	while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
	wrapper.remove();
}

/**
 * Strikes MathJax-rendered math, which `::highlight()` cannot reach: its CHTML
 * glyphs are `::before` content, part of no Range, and its SVG output has no
 * text at all.
 *
 * A single row of symbols takes the line-through the prose gets, painted by the
 * theme from a class. An expression drawing horizontal rules of its own takes
 * an X: a centred line lands on the math axis, where the fraction bar already
 * sits, and reads as a recoloured bar.
 */
function strikeMath(scope: Element): StruckMath[] {
	const struck: StruckMath[] = [];
	for (const container of scope.querySelectorAll<HTMLElement>(MATH_SELECTOR)) {
		const box =
			container.querySelector<HTMLElement>(MATH_BOX_SELECTOR) ?? container;
		const stacked = Boolean(box.querySelector(MATH_STACKED_SELECTOR));
		box.classList.add(
			MATH_STRIKE_CLASS,
			stacked ? MATH_STRIKE_CROSS_CLASS : MATH_STRIKE_LINE_CLASS,
		);
		box.setAttribute(MATH_STRIKE_ATTR, stacked ? "cross" : "line");
		const mark = stacked ? createStrikeMark("cross", MATH_MARK_CLASSES) : null;
		if (mark) box.appendChild(mark);
		struck.push({ box, mark });
	}
	return struck;
}

function unstrikeMathBox({ box, mark }: StruckMath): void {
	mark?.remove();
	box.classList.remove(
		MATH_STRIKE_CLASS,
		MATH_STRIKE_LINE_CLASS,
		MATH_STRIKE_CROSS_CLASS,
	);
	box.removeAttribute(MATH_STRIKE_ATTR);
}
