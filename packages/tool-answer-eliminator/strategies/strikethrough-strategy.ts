import type { EliminationStrategy } from "./elimination-strategy";

/**
 * Strikethrough strategy using CSS Custom Highlight API
 *
 * Modern approach: Zero DOM mutation, uses browser-native highlighting
 * Accessibility: Best for screen readers (text remains in DOM unchanged)
 * WCAG Compliance: Maintains info structure (1.3.1), no layout shift (2.4.3)
 */
export class StrikethroughStrategy implements EliminationStrategy {
	readonly name = "strikethrough";

	private highlights = new Map<string, Highlight>();
	private ranges = new Map<string, Range>();

	initialize(): void {
		// Check browser support
		if (!this.isSupported()) {
			console.warn("CSS Custom Highlight API not supported, using fallback");
			return;
		}

		// Inject CSS for highlight styling
		this.injectCSS();
	}

	destroy(): void {
		this.clearAll();
		this.removeCSS();
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
		CSS.highlights.set(`answer-eliminated-${choiceId}`, highlight);

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
		CSS.highlights.delete(`answer-eliminated-${choiceId}`);

		// Remove CSS for this specific highlight
		this.removeHighlightCSS(choiceId);

		// Remove from internal tracking
		const range = this.ranges.get(choiceId);
		if (range) {
			this.removeAriaAttributes(range);
		}

		this.highlights.delete(choiceId);
		this.ranges.delete(choiceId);
	}

	isEliminated(choiceId: string): boolean {
		return this.highlights.has(choiceId);
	}

	clearAll(): void {
		// Remove all highlights
		for (const choiceId of this.highlights.keys()) {
			this.remove(choiceId);
		}
	}

	getEliminatedIds(): string[] {
		return Array.from(this.highlights.keys());
	}

	private isSupported(): boolean {
		return typeof CSS !== "undefined" && "highlights" in CSS;
	}

	private injectCSS(): void {
		const styleId = "answer-eliminator-strikethrough-styles";

		// Don't inject if already exists
		if (document.getElementById(styleId)) return;

		const style = document.createElement("style");
		style.id = styleId;
		// CSS Custom Highlight API: Each registered highlight gets its own ::highlight() selector
		// Since we register highlights with names like 'answer-eliminated-{choiceId}',
		// we need to inject CSS for each one dynamically, OR use a shared attribute approach.
		// For performance, we inject a base style and add choice-specific styles dynamically.
		style.textContent = `
      /* Fallback for browsers without CSS Highlight API */
      .answer-eliminated-fallback {
        text-decoration: line-through;
        text-decoration-thickness: 2px;
        text-decoration-color: var(--pie-incorrect, #ff9800);
        opacity: 0.6;
      }

      /* Screen reader only text */
      .sr-announcement {
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }
    `;

		document.head.appendChild(style);
	}

	private injectHighlightCSS(choiceId: string): void {
		const styleId = `answer-eliminator-highlight-${choiceId}`;
		if (document.getElementById(styleId)) return;

		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
      ::highlight(answer-eliminated-${choiceId}) {
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
			.getElementById(`answer-eliminator-highlight-${choiceId}`)
			?.remove();
	}

	private removeCSS(): void {
		const style = document.getElementById(
			"answer-eliminator-strikethrough-styles",
		);
		style?.remove();
	}

	private addAriaAttributes(range: Range): void {
		// Find the choice container element
		const container = this.findChoiceContainer(range);
		if (!container) return;

		container.setAttribute("data-eliminated", "true");
		container.setAttribute("aria-disabled", "true");

		// Add screen reader announcement
		const label = container.querySelector(".label");
		if (label && !label.querySelector(".sr-announcement")) {
			const announcement = document.createElement("span");
			announcement.className = "sr-announcement";
			announcement.textContent = " (eliminated)";
			label.appendChild(announcement);
		}
	}

	private removeAriaAttributes(range: Range): void {
		const container = this.findChoiceContainer(range);
		if (!container) return;

		container.removeAttribute("data-eliminated");
		container.removeAttribute("aria-disabled");

		// Remove screen reader announcement
		const announcement = container.querySelector(".sr-announcement");
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
				element.classList?.contains("choice-input") ||
				element.classList?.contains("corespring-checkbox") ||
				element.classList?.contains("corespring-radio-button")
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

		container.classList.add("answer-eliminated-fallback");
		container.setAttribute("data-eliminated", "true");
		container.setAttribute("data-eliminated-id", choiceId);
		this.addAriaAttributes(range);
	}

	private removeFallback(choiceId: string): void {
		const container = document.querySelector(
			`[data-eliminated-id="${choiceId}"]`,
		);
		if (!container) return;

		container.classList.remove("answer-eliminated-fallback");
		container.removeAttribute("data-eliminated");
		container.removeAttribute("data-eliminated-id");

		// Create fake range for aria removal
		const range = document.createRange();
		range.selectNodeContents(container);
		this.removeAriaAttributes(range);
	}
}
