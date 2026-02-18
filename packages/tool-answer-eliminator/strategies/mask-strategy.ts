import type { EliminationStrategy } from "./elimination-strategy.js";

/**
 * Mask strategy using CSS Custom Highlight API
 * Partially hides/grays eliminated choices
 */
export class MaskStrategy implements EliminationStrategy {
	readonly name = "mask";

	private highlights = new Map<string, Highlight>();
	private ranges = new Map<string, Range>();

	initialize(): void {
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

		const highlight = new Highlight(range);
		CSS.highlights.set(`answer-masked-${choiceId}`, highlight);

		this.highlights.set(choiceId, highlight);
		this.ranges.set(choiceId, range);

		this.addAriaAttributes(range);
	}

	remove(choiceId: string): void {
		if (!this.isSupported()) {
			this.removeFallback(choiceId);
			return;
		}

		CSS.highlights.delete(`answer-masked-${choiceId}`);

		// Remove CSS for this specific highlight
		this.removeHighlightCSS(choiceId);

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
		const styleId = "answer-eliminator-mask-styles";
		if (document.getElementById(styleId)) return;

		const style = document.createElement("style");
		style.id = styleId;
		// CSS Custom Highlight API: Each registered highlight gets its own ::highlight() selector
		// We inject choice-specific styles dynamically in injectHighlightCSS()
		style.textContent = `
      /* Fallback */
      .answer-masked-fallback {
        opacity: 0.2;
        filter: blur(2px);
      }
    `;

		document.head.appendChild(style);
	}

	private injectHighlightCSS(choiceId: string): void {
		const styleId = `answer-eliminator-mask-highlight-${choiceId}`;
		if (document.getElementById(styleId)) return;

		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
      ::highlight(answer-masked-${choiceId}) {
        opacity: 0.2;
        filter: blur(2px);
      }
    `;
		document.head.appendChild(style);
	}

	private removeHighlightCSS(choiceId: string): void {
		document
			.getElementById(`answer-eliminator-mask-highlight-${choiceId}`)
			?.remove();
	}

	private removeCSS(): void {
		document.getElementById("answer-eliminator-mask-styles")?.remove();
	}

	private addAriaAttributes(range: Range): void {
		const container = this.findChoiceContainer(range);
		if (!container) return;

		container.setAttribute("data-eliminated", "true");
		container.setAttribute("aria-hidden", "true");
	}

	private removeAriaAttributes(range: Range): void {
		const container = this.findChoiceContainer(range);
		if (!container) return;

		container.removeAttribute("data-eliminated");
		container.removeAttribute("aria-hidden");
	}

	private findChoiceContainer(range: Range): HTMLElement | null {
		let element: HTMLElement | null = range.startContainer as HTMLElement;

		// If startContainer is a text node, get its parent
		if (element.nodeType === Node.TEXT_NODE) {
			element = element.parentElement;
		}

		while (element && element !== document.body) {
			if (element.classList?.contains("choice-input")) {
				return element;
			}
			element = element.parentElement;
		}

		return null;
	}

	private applyFallback(choiceId: string, range: Range): void {
		const container = this.findChoiceContainer(range);
		if (!container) return;

		container.classList.add("answer-masked-fallback");
		container.setAttribute("data-eliminated", "true");
		container.setAttribute("data-eliminated-id", choiceId);
		this.addAriaAttributes(range);
	}

	private removeFallback(choiceId: string): void {
		const container = document.querySelector(
			`[data-eliminated-id="${choiceId}"]`,
		);
		if (!container) return;

		container.classList.remove("answer-masked-fallback");
		container.removeAttribute("data-eliminated");
		container.removeAttribute("data-eliminated-id");

		const range = document.createRange();
		range.selectNodeContents(container);
		this.removeAriaAttributes(range);
	}
}
