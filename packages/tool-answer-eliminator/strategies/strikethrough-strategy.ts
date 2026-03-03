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

	readonly name = "strikethrough";

	private highlights = new Map<string, Highlight>();
	private ranges = new Map<string, Range>();
	private fallbackContainers = new Map<string, HTMLElement>();

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
		if (!this.isSupported()) {
			this.applyFallback(choiceId, range);
			return;
		}

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
	}

	remove(choiceId: string): void {
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
		// Remove all highlights
		for (const choiceId of this.highlights.keys()) {
			this.remove(choiceId);
		}
		this.fallbackContainers.clear();
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
        text-decoration-color: var(--pie-incorrect, #ff9800);
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

	private resolveLabelElement(container: HTMLElement): HTMLElement | null {
		return (
			container.querySelector<HTMLElement>(
				`[${StrikethroughStrategy.LABEL_HOOK_ATTR}="true"]`,
			) || container.querySelector<HTMLElement>("label")
		);
	}
}
