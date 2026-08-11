import type { EliminationStrategy } from "./elimination-strategy.js";

/**
 * Strikethrough strategy using CSS Custom Highlight API
 *
 * Modern approach: Zero DOM mutation, uses browser-native highlighting
 * Accessibility: Best for screen readers (text remains in DOM unchanged)
 * WCAG Compliance: Maintains info structure (1.3.1), no layout shift (2.4.3)
 */
export class StrikethroughStrategy implements EliminationStrategy {
	private static readonly HIGHLIGHT_STYLE_PREFIX =
		"pie-answer-eliminator-highlight-";
	private static readonly HIGHLIGHT_NAME_PREFIX = "pie-answer-eliminated-";
	private static readonly FALLBACK_CLASS =
		"pie-answer-eliminator-eliminated-fallback";
	private static readonly SR_CLASS = "pie-answer-eliminator-sr-announcement";
	private static readonly CHOICE_HOOK_ATTR =
		"data-pie-answer-eliminator-choice";
	private static readonly LABEL_HOOK_ATTR = "data-pie-answer-eliminator-label";
	private static readonly ELIMINATED_ATTR = "data-pie-answer-eliminated";
	private static readonly ELIMINATED_ID_ATTR = "data-pie-answer-eliminated-id";
	private static readonly IMAGE_WRAPPER_CLASS =
		"pie-answer-eliminator-image-strike";
	private static readonly IMAGE_WRAPPER_ATTR =
		"data-pie-answer-eliminator-image-strike";
	private static readonly IMAGE_OVERLAY_CLASS =
		"pie-answer-eliminator-image-strike-overlay";
	private static readonly IMAGE_LINE_CLASS =
		"pie-answer-eliminator-image-strike-line";
	private static readonly IMAGE_CASING_CLASS =
		"pie-answer-eliminator-image-strike-casing";
	private static readonly MATH_STRIKE_CLASS =
		"pie-answer-eliminator-math-strike";
	private static readonly MATH_STRIKE_LINE_CLASS =
		"pie-answer-eliminator-math-strike--line";
	private static readonly MATH_STRIKE_CROSS_CLASS =
		"pie-answer-eliminator-math-strike--cross";
	private static readonly MATH_STRIKE_ATTR =
		"data-pie-answer-eliminator-math-strike";
	// MathJax names its CHTML boxes after the MathML they render. A horizontal
	// strike is ambiguous exactly where the expression draws horizontal rules of
	// its own — fraction bars and table rules — so those two get crossed out
	// instead. Radicals and stacked limits keep the line: their bars sit at the
	// top or the strike simply crosses the base, neither of which reads as part of
	// the notation.
	private static readonly MATH_STACKED_SELECTOR = "mjx-mfrac, mjx-mtable";
	// The box MathJax gives the rendered expression. It matters which one is
	// measured and painted: for inline math the `mjx-container` is `display:
	// inline`, so its rect is the surrounding line box (a constant ~1.16x font
	// size) while the expression itself overflows it — a fraction sticks out 3px
	// above and 8px below. `mjx-math` is the inline-block that actually bounds the
	// glyphs.
	private static readonly MATH_BOX_SELECTOR = "mjx-math";
	// MathJax's rendered box, for both its CHTML and SVG output. Deliberately not
	// `math`: natively rendered MathML keeps real text nodes in `mi`/`mn`/`mo`, so
	// the highlight already strikes every token there (verified in Chromium), and
	// adding a second line over the same expression only doubles up.
	private static readonly MATH_SELECTOR = "mjx-container";
	private static readonly SVG_NS = "http://www.w3.org/2000/svg";
	// Displays that make the image a block-level box; an inline-block wrapper
	// around one of those would change how the choice lays out.
	private static readonly BLOCK_DISPLAYS = new Set([
		"block",
		"flex",
		"grid",
		"table",
		"flow-root",
		"list-item",
	]);

	readonly name = "strikethrough";

	private highlights = new Map<string, Highlight>();
	private ranges = new Map<string, Range>();
	private fallbackContainers = new Map<string, HTMLElement>();
	private imageWrappers = new Map<string, HTMLElement[]>();
	private mathTargets = new Map<string, HTMLElement[]>();

	initialize(): void {
		// Check browser support
		if (!this.isSupported()) {
			console.warn("CSS Custom Highlight API not supported, using fallback");
		}
	}

	destroy(): void {
		this.clearAll();
	}

	apply(choiceId: string, range: Range): void {
		if (this.isSupported()) {
			// Inject CSS for this specific highlight
			this.injectHighlightCSS(choiceId);

			// Create highlight for this range
			const highlight = new Highlight(range);

			// Register in CSS.highlights with unique name
			CSS.highlights.set(
				`${StrikethroughStrategy.HIGHLIGHT_NAME_PREFIX}${choiceId}`,
				highlight,
			);

			// Track internally
			this.highlights.set(choiceId, highlight);
			this.ranges.set(choiceId, range);

			// Add ARIA attributes to the choice element for screen readers
			this.addAriaAttributes(range);
		} else {
			this.applyFallback(choiceId, range);
		}

		// Text decoration cannot reach replaced content, so an image-only choice
		// would otherwise look untouched: overlay each image with a diagonal X.
		this.strikeImages(choiceId, range);

		// Rendered math is not text either (see `strikeMath`), so it needs its
		// own line-through.
		this.strikeMath(choiceId, range);
	}

	remove(choiceId: string): void {
		this.unstrikeImages(choiceId);
		this.unstrikeMath(choiceId);

		if (!this.isSupported()) {
			this.removeFallback(choiceId);
			return;
		}

		// Remove from CSS.highlights
		CSS.highlights.delete(
			`${StrikethroughStrategy.HIGHLIGHT_NAME_PREFIX}${choiceId}`,
		);

		// Remove CSS for this specific highlight
		this.removeHighlightCSS(choiceId);

		// Remove from internal tracking
		const range = this.ranges.get(choiceId);
		if (range) {
			this.removeAriaAttributes(range);
		}

		this.highlights.delete(choiceId);
		this.ranges.delete(choiceId);
		this.fallbackContainers.delete(choiceId);
	}

	isEliminated(choiceId: string): boolean {
		return this.highlights.has(choiceId);
	}

	clearAll(): void {
		// Snapshot first: `remove()` mutates every map it is tracked in, and a
		// choice can be tracked only in the fallback/image maps.
		const choiceIds = new Set([
			...this.highlights.keys(),
			...this.fallbackContainers.keys(),
			...this.imageWrappers.keys(),
			...this.mathTargets.keys(),
		]);
		for (const choiceId of choiceIds) {
			this.remove(choiceId);
		}
		this.fallbackContainers.clear();
		this.imageWrappers.clear();
		this.mathTargets.clear();
	}

	getEliminatedIds(): string[] {
		return Array.from(this.highlights.keys());
	}

	private isSupported(): boolean {
		return typeof CSS !== "undefined" && "highlights" in CSS;
	}

	private injectHighlightCSS(choiceId: string): void {
		const styleId = `${StrikethroughStrategy.HIGHLIGHT_STYLE_PREFIX}${choiceId}`;
		if (document.getElementById(styleId)) return;

		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
      ::highlight(pie-answer-eliminated-${choiceId}) {
        text-decoration: line-through;
        text-decoration-thickness: 2px;
        text-decoration-color: var(--pie-answer-eliminator-strike-color, var(--pie-incorrect, #ff9800));
        opacity: 0.6;
      }
    `;
		document.head.appendChild(style);
	}

	private removeHighlightCSS(choiceId: string): void {
		document
			.getElementById(
				`${StrikethroughStrategy.HIGHLIGHT_STYLE_PREFIX}${choiceId}`,
			)
			?.remove();
	}

	private addAriaAttributes(range: Range): void {
		// Find the choice container element
		const container = this.findChoiceContainer(range);
		if (!container) return;

		container.setAttribute(StrikethroughStrategy.ELIMINATED_ATTR, "true");
		container.setAttribute("aria-disabled", "true");

		// Add screen reader announcement
		const label = this.resolveLabelElement(container);
		if (label && !label.querySelector(`.${StrikethroughStrategy.SR_CLASS}`)) {
			const announcement = document.createElement("span");
			announcement.className = StrikethroughStrategy.SR_CLASS;
			announcement.textContent = " (eliminated)";
			label.appendChild(announcement);
		}
	}

	private removeAriaAttributes(range: Range): void {
		const container = this.findChoiceContainer(range);
		if (!container) return;

		container.removeAttribute(StrikethroughStrategy.ELIMINATED_ATTR);
		container.removeAttribute("aria-disabled");

		// Remove screen reader announcement
		const announcement = container.querySelector(
			`.${StrikethroughStrategy.SR_CLASS}`,
		);
		announcement?.remove();
	}

	private findChoiceContainer(range: Range): HTMLElement | null {
		// Walk up from range start to find the choice container
		let element: HTMLElement | null = range.startContainer as HTMLElement;

		// If startContainer is a text node, get its parent
		if (element.nodeType === Node.TEXT_NODE) {
			element = element.parentElement;
		}

		while (element && element !== document.body) {
			if (
				element.getAttribute(StrikethroughStrategy.CHOICE_HOOK_ATTR) === "true"
			) {
				return element;
			}
			element = element.parentElement;
		}

		return null;
	}

	// Fallback for browsers without CSS Highlight API
	private applyFallback(choiceId: string, range: Range): void {
		const container = this.findChoiceContainer(range);
		if (!container) return;

		container.classList.add(StrikethroughStrategy.FALLBACK_CLASS);
		container.setAttribute(StrikethroughStrategy.ELIMINATED_ATTR, "true");
		container.setAttribute(StrikethroughStrategy.ELIMINATED_ID_ATTR, choiceId);
		this.fallbackContainers.set(choiceId, container);
		this.addAriaAttributes(range);
	}

	private removeFallback(choiceId: string): void {
		const container = this.fallbackContainers.get(choiceId);
		if (!container) return;

		container.classList.remove(StrikethroughStrategy.FALLBACK_CLASS);
		container.removeAttribute(StrikethroughStrategy.ELIMINATED_ATTR);
		container.removeAttribute(StrikethroughStrategy.ELIMINATED_ID_ATTR);

		// Create fake range for aria removal
		const range = document.createRange();
		range.selectNodeContents(container);
		this.removeAriaAttributes(range);
		this.fallbackContainers.delete(choiceId);
	}

	/**
	 * Overlay every image in the eliminated choice with a diagonal X, drawn in
	 * the same strike colour as the text line-through.
	 *
	 * Images are replaced elements: `line-through` (and `::highlight()`) never
	 * paints on them, and they cannot carry a pseudo-element, so each image is
	 * wrapped in a positioned span that hosts an absolutely-positioned overlay.
	 * Wrapping keeps the overlay glued to the image through any later reflow —
	 * responsive resizing, late image `load`, zoom — with no observers.
	 */
	private strikeImages(choiceId: string, range: Range): void {
		const scope = this.resolveImageScope(range);
		if (!scope) return;

		const wrappers: HTMLElement[] = [];
		for (const image of Array.from(scope.querySelectorAll("img"))) {
			const wrapper = this.wrapImage(image);
			if (wrapper) wrappers.push(wrapper);
		}

		if (wrappers.length > 0) {
			this.imageWrappers.set(choiceId, wrappers);
		}
	}

	private unstrikeImages(choiceId: string): void {
		const wrappers = this.imageWrappers.get(choiceId);
		if (!wrappers) return;

		for (const wrapper of wrappers) {
			this.unwrapImage(wrapper);
		}

		this.imageWrappers.delete(choiceId);
	}

	/**
	 * Give MathJax-rendered math the same line-through the choice's text gets.
	 *
	 * `::highlight()` cannot reach it: MathJax's CHTML output draws every visible
	 * glyph as an `mjx-c` element with empty `textContent`, the character coming
	 * from `::before` generated content — which is part of no Range. (Its only
	 * real text is the `mjx-assistive-mml` copy of the source MathML, clipped to
	 * 1px for assistive tech, so the highlight paints it invisibly.) Its SVG
	 * output has no text at all. A math-only choice therefore looked identical to
	 * an un-eliminated one.
	 *
	 * Unlike an image, the rendered math box is a normal element that can carry a
	 * pseudo-element, so this only adds a class and lets CSS paint it — no
	 * wrapper, nothing restructured, and MathJax's own layout left alone.
	 *
	 * A single row of symbols gets the line-through the prose gets. An expression
	 * that draws horizontal rules of its own gets diagonals instead: a line
	 * centred on a fraction lands on the math axis, which is exactly where the
	 * fraction bar already sits, so it reads as a recoloured bar rather than as an
	 * elimination.
	 */
	private strikeMath(choiceId: string, range: Range): void {
		const scope = this.resolveImageScope(range);
		if (!scope) return;

		const targets: HTMLElement[] = [];
		for (const container of scope.querySelectorAll<HTMLElement>(
			StrikethroughStrategy.MATH_SELECTOR,
		)) {
			const box =
				container.querySelector<HTMLElement>(
					StrikethroughStrategy.MATH_BOX_SELECTOR,
				) ?? container;
			const stacked = Boolean(
				box.querySelector(StrikethroughStrategy.MATH_STACKED_SELECTOR),
			);

			box.classList.add(
				StrikethroughStrategy.MATH_STRIKE_CLASS,
				stacked
					? StrikethroughStrategy.MATH_STRIKE_CROSS_CLASS
					: StrikethroughStrategy.MATH_STRIKE_LINE_CLASS,
			);
			box.setAttribute(
				StrikethroughStrategy.MATH_STRIKE_ATTR,
				stacked ? "cross" : "line",
			);
			targets.push(box);
		}

		if (targets.length > 0) {
			this.mathTargets.set(choiceId, targets);
		}
	}

	private unstrikeMath(choiceId: string): void {
		const targets = this.mathTargets.get(choiceId);
		if (!targets) return;

		for (const target of targets) {
			target.classList.remove(
				StrikethroughStrategy.MATH_STRIKE_CLASS,
				StrikethroughStrategy.MATH_STRIKE_LINE_CLASS,
				StrikethroughStrategy.MATH_STRIKE_CROSS_CLASS,
			);
			target.removeAttribute(StrikethroughStrategy.MATH_STRIKE_ATTR);
		}

		this.mathTargets.delete(choiceId);
	}

	/**
	 * The element whose images belong to this elimination. Adapters build the
	 * range over the choice's own content (label or choice node), so its common
	 * ancestor is the right scope; the choice container is the fallback.
	 */
	private resolveImageScope(range: Range): HTMLElement | null {
		const node = range.commonAncestorContainer;
		const element =
			node.nodeType === Node.TEXT_NODE
				? node.parentElement
				: (node as HTMLElement);
		return element ?? this.findChoiceContainer(range);
	}

	private wrapImage(image: HTMLImageElement): HTMLElement | null {
		const parent = image.parentElement;
		if (!parent) return null;

		// Already struck (e.g. state restore re-applying over live DOM): reuse
		// the existing wrapper so it stays tracked and is undone once.
		if (
			parent.classList.contains(StrikethroughStrategy.IMAGE_WRAPPER_CLASS) ||
			parent.hasAttribute(StrikethroughStrategy.IMAGE_WRAPPER_ATTR)
		) {
			return parent;
		}

		const wrapper = document.createElement("span");
		wrapper.className = StrikethroughStrategy.IMAGE_WRAPPER_CLASS;
		wrapper.setAttribute(StrikethroughStrategy.IMAGE_WRAPPER_ATTR, "true");

		// Preserve the image's box model so wrapping never shifts the layout, and
		// keep the wrapper hugging the image so the X never overhangs it.
		if (this.fillsParentWidth(image, parent)) {
			// Fluid (e.g. percentage-width) image: it already spans the parent, and
			// a shrink-to-fit wrapper would collapse it to its intrinsic size.
			wrapper.style.display = "block";
		} else if (
			StrikethroughStrategy.BLOCK_DISPLAYS.has(getComputedStyle(image).display)
		) {
			// Block-level image: keep it on its own line, but only as wide as the
			// image itself rather than the full width a block wrapper would take.
			wrapper.style.display = "block";
			wrapper.style.width = "fit-content";
		}

		parent.insertBefore(wrapper, image);
		wrapper.appendChild(image);
		wrapper.appendChild(this.createImageStrikeOverlay());

		return wrapper;
	}

	private fillsParentWidth(
		image: HTMLImageElement,
		parent: HTMLElement,
	): boolean {
		const imageWidth = image.getBoundingClientRect().width;
		const parentWidth = parent.clientWidth;
		if (imageWidth === 0 || parentWidth === 0) return false;
		// Sub-pixel rounding: treat "within 1px of the parent" as filling it.
		return imageWidth >= parentWidth - 1;
	}

	private unwrapImage(wrapper: HTMLElement): void {
		wrapper
			.querySelector(`.${StrikethroughStrategy.IMAGE_OVERLAY_CLASS}`)
			?.remove();

		const parent = wrapper.parentElement;
		if (!parent) return;

		// Restore the original DOM shape: move the image (and anything else the
		// wrapper picked up) back out, then drop the wrapper.
		while (wrapper.firstChild) {
			parent.insertBefore(wrapper.firstChild, wrapper);
		}
		wrapper.remove();
	}

	/**
	 * Corner-to-corner X sized to the wrapper. `preserveAspectRatio="none"`
	 * stretches the 100x100 viewBox onto any aspect ratio, and
	 * `vector-effect="non-scaling-stroke"` keeps both lines an even screen-space
	 * thickness under that non-uniform scale. The wider casing line under each
	 * red line keeps the X visible over dark or red imagery (WCAG 1.4.11).
	 */
	private createImageStrikeOverlay(): SVGSVGElement {
		const svg = document.createElementNS(
			StrikethroughStrategy.SVG_NS,
			"svg",
		) as SVGSVGElement;
		svg.setAttribute("class", StrikethroughStrategy.IMAGE_OVERLAY_CLASS);
		svg.setAttribute("viewBox", "0 0 100 100");
		svg.setAttribute("preserveAspectRatio", "none");
		// Decorative: the eliminated state is already announced on the label.
		svg.setAttribute("aria-hidden", "true");
		svg.setAttribute("focusable", "false");

		const diagonals = [
			// upper left -> lower right
			{ x1: "0", y1: "0", x2: "100", y2: "100" },
			// lower left -> upper right
			{ x1: "0", y1: "100", x2: "100", y2: "0" },
		];

		// Casings first so the red lines paint unbroken on top of both of them.
		for (const className of [
			StrikethroughStrategy.IMAGE_CASING_CLASS,
			StrikethroughStrategy.IMAGE_LINE_CLASS,
		]) {
			for (const { x1, y1, x2, y2 } of diagonals) {
				const line = document.createElementNS(
					StrikethroughStrategy.SVG_NS,
					"line",
				);
				line.setAttribute("class", className);
				line.setAttribute("x1", x1);
				line.setAttribute("y1", y1);
				line.setAttribute("x2", x2);
				line.setAttribute("y2", y2);
				line.setAttribute("vector-effect", "non-scaling-stroke");
				svg.appendChild(line);
			}
		}

		return svg;
	}

	private resolveLabelElement(container: HTMLElement): HTMLElement | null {
		return (
			container.querySelector<HTMLElement>(
				`[${StrikethroughStrategy.LABEL_HOOK_ATTR}="true"]`,
			) || container.querySelector<HTMLElement>("label")
		);
	}
}
