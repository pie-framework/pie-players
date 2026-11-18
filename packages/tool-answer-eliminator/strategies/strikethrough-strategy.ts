import { isOwned } from "../owned-nodes.js";
import type {
	EliminationStrategy,
	EliminationTarget,
} from "./elimination-strategy.js";
import { type Box, isDrawn, type Mark, OverlayMarks } from "./overlay-marks.js";

const LINE_CLASSES = {
	mark: "pie-answer-eliminator-strike",
	line: "pie-answer-eliminator-strike-line",
};
// The casing under each line keeps the X visible over dark or red imagery
// (WCAG 1.4.11).
const IMAGE_CLASSES = {
	mark: "pie-answer-eliminator-strike",
	line: "pie-answer-eliminator-image-strike-line",
	casing: "pie-answer-eliminator-image-strike-casing",
};
// MathJax's rendered box, for both its CHTML and SVG output. Its glyphs are
// generated content or SVG paths, so it is struck as one box; the assistive
// MathML inside it is visually hidden. Natively rendered MathML keeps real
// text, which is struck as text.
const MATH_SELECTOR = "mjx-container";
// For inline math the `mjx-container` is `display: inline`, so its rect is the
// surrounding line box while the expression overflows it; `mjx-math` is the
// inline-block that bounds the glyphs.
const MATH_BOX_SELECTOR = "mjx-math";
// MathJax names its CHTML boxes after the MathML they render. A line is
// ambiguous exactly where the expression draws horizontal rules of its own —
// fraction bars and table rules — so those two get crossed out instead.
// Radicals and stacked limits keep the line: their bars sit at the top, or the
// line crosses the base, and neither reads as part of the notation.
const MATH_STACKED_SELECTOR = "mjx-mfrac, mjx-mtable";
// Text that is not struck as text: math is struck as a box, and these hold no
// rendered text of their own.
const UNSTRUCK_TEXT_SELECTOR = `${MATH_SELECTOR}, svg, script, style, template, noscript, select, textarea`;
// Fragments of one line: their boxes sit on the same middle and touch.
const LINE_TOLERANCE = 1;

/**
 * Strikes the content through with SVG marks in its container: a line through
 * each line of text and each single-row expression, and an X over each image
 * and each expression that draws rules of its own. Text decoration and the CSS
 * Highlight API paint inside the content, under its dim; they also reach no
 * image, and no MathJax glyph.
 */
export class StrikethroughStrategy implements EliminationStrategy {
	readonly name = "strikethrough";

	private readonly marks = new OverlayMarks({
		measure,
		shapeAttribute: "data-pie-answer-eliminator-strike",
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

function measure({ content }: EliminationTarget): Mark[] {
	const hidden = new HiddenCheck(content);
	const marks: Mark[] = textLines(content, hidden).map((box) => ({
		shape: "line",
		classes: LINE_CLASSES,
		box,
	}));
	for (const image of within(content, "img")) {
		if (hidden.covers(image)) continue;
		const box = image.getBoundingClientRect();
		if (isDrawn(box)) marks.push({ shape: "cross", classes: IMAGE_CLASSES, box });
	}
	for (const math of within(content, MATH_SELECTOR)) {
		if (hidden.covers(math)) continue;
		const box = (
			math.querySelector(MATH_BOX_SELECTOR) ?? math
		).getBoundingClientRect();
		if (!isDrawn(box)) continue;
		const stacked = Boolean(math.querySelector(MATH_STACKED_SELECTOR));
		marks.push({ shape: stacked ? "cross" : "line", classes: LINE_CLASSES, box });
	}
	return marks;
}

/** The line boxes the content's text renders in. */
function textLines(content: Element, hidden: HiddenCheck): Box[] {
	const lines: Box[] = [];
	const range = document.createRange();
	const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = node.parentElement;
		if (!parent || hidden.covers(parent)) continue;
		const unstruck = parent.closest(UNSTRUCK_TEXT_SELECTOR);
		if (unstruck && (unstruck === content || content.contains(unstruck))) {
			continue;
		}
		range.selectNodeContents(node);
		for (const rect of Array.from(range.getClientRects?.() ?? [])) {
			if (isDrawn(rect)) addFragment(lines, rect);
		}
	}
	return lines;
}

/** Joins a text fragment to the line it continues, or starts a line. */
function addFragment(lines: Box[], fragment: Box): void {
	const middle = fragment.top + fragment.height / 2;
	const line = lines.find(
		(box) =>
			Math.abs(box.top + box.height / 2 - middle) <= LINE_TOLERANCE &&
			fragment.left <= box.left + box.width + LINE_TOLERANCE &&
			box.left <= fragment.left + fragment.width + LINE_TOLERANCE,
	);
	if (!line) {
		lines.push({
			left: fragment.left,
			top: fragment.top,
			width: fragment.width,
			height: fragment.height,
		});
		return;
	}
	const right = Math.max(line.left + line.width, fragment.left + fragment.width);
	const bottom = Math.max(line.top + line.height, fragment.top + fragment.height);
	line.left = Math.min(line.left, fragment.left);
	line.top = Math.min(line.top, fragment.top);
	line.width = right - line.left;
	line.height = bottom - line.top;
}

function within(content: Element, selector: string): Element[] {
	const found = Array.from(content.querySelectorAll(selector));
	return content.matches(selector) ? [content, ...found] : found;
}

/**
 * Whether a node of the content renders invisibly, so a mark over it would
 * strike nothing the learner sees: what the eliminator added, `visibility`
 * hiding, a transparent ancestor, or a visually hidden one, clipped to a pixel
 * the way screen-reader-only text is.
 */
class HiddenCheck {
	private readonly verdicts = new Map<Element, boolean>();

	constructor(private readonly content: Element) {}

	covers(element: Element): boolean {
		if (isOwned(element)) return true;
		const { visibility } = getComputedStyle(element);
		if (visibility === "hidden" || visibility === "collapse") return true;
		return this.clippedOrTransparent(element);
	}

	private clippedOrTransparent(element: Element): boolean {
		const known = this.verdicts.get(element);
		if (known !== undefined) return known;
		const style = getComputedStyle(element);
		let verdict = style.opacity === "0" || clipsAway(element, style);
		const parent = element.parentElement;
		if (!verdict && element !== this.content && parent) {
			verdict = this.clippedOrTransparent(parent);
		}
		this.verdicts.set(element, verdict);
		return verdict;
	}
}

function clipsAway(element: Element, style: CSSStyleDeclaration): boolean {
	const positioned = style.position === "absolute" || style.position === "fixed";
	if (positioned && style.clip && style.clip !== "auto") return true;
	if (style.display === "contents") return false;
	if (style.overflow === "visible" || style.overflow === "") return false;
	const { width, height } = element.getBoundingClientRect();
	return width <= 1 || height <= 1;
}
