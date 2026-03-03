import type { ChoiceAdapter } from "./choice-adapter.js";

/**
 * Adapter for PIE multiple-choice elements
 *
 * Works with both single-select (radio) and multiple-select (checkbox) modes
 * Detects PIE's corespring-checkbox and corespring-radio-button classes
 */
export class MultipleChoiceAdapter implements ChoiceAdapter {
	readonly elementType = "multiple-choice";
	readonly priority = 100;
	private static readonly CHOICE_HOOK_ATTR =
		"data-pie-answer-eliminator-choice";
	private static readonly LABEL_HOOK_ATTR = "data-pie-answer-eliminator-label";
	private static readonly ROOT_HOOK_ATTR = "data-pie-answer-eliminator-root";
	private static readonly FEEDBACK_HOOK_ATTR =
		"data-pie-answer-eliminator-feedback-tick";
	private static readonly CHOICE_SELECTOR =
		`[${MultipleChoiceAdapter.CHOICE_HOOK_ATTR}="true"], .corespring-checkbox, .corespring-radio-button`;

	canHandle(element: HTMLElement): boolean {
		return (
			element.tagName.toLowerCase() === "multiple-choice" ||
			element.classList.contains("multiple-choice")
		);
	}

	findChoices(root: HTMLElement): HTMLElement[] {
		root.setAttribute(MultipleChoiceAdapter.ROOT_HOOK_ATTR, "true");
		const choices = Array.from(
			root.querySelectorAll<HTMLElement>(MultipleChoiceAdapter.CHOICE_SELECTOR),
		);
		for (const choice of choices) {
			this.annotateChoice(choice);
		}
		this.annotateFeedbackTicks(root);
		return choices;
	}

	createChoiceRange(choice: HTMLElement): Range | null {
		// Create range covering the label content
		// Try multiple possible selectors for the label
		const labelElement = this.resolveLabelElement(choice);

		if (!labelElement) {
			return null;
		}

		const range = document.createRange();
		range.selectNodeContents(labelElement);
		return range;
	}

	getChoiceId(choice: HTMLElement): string {
		// Get value from input element
		const input = choice.querySelector(
			'input[type="checkbox"], input[type="radio"]',
		);
		return (
			input?.getAttribute("value") ||
			input?.id ||
			this.generateFallbackId(choice)
		);
	}

	getChoiceLabel(choice: HTMLElement): string {
		const label = this.resolveLabelElement(choice);
		return label?.textContent?.trim() || "Unlabeled choice";
	}

	canEliminate(choice: HTMLElement): boolean {
		const input = choice.querySelector(
			'input[type="checkbox"], input[type="radio"]',
		);
		if (!input) return false;

		// Can't eliminate if:
		// 1. Already selected (checked)
		if (input.getAttribute("aria-checked") === "true") return false;

		// 2. Disabled
		if ((input as HTMLInputElement).disabled) return false;

		// 3. In evaluate/view mode (has feedback tick)
		const root =
			choice.closest(`[${MultipleChoiceAdapter.ROOT_HOOK_ATTR}="true"]`) ||
			choice.closest("multiple-choice");
		if (
			root?.querySelector(
				`[${MultipleChoiceAdapter.FEEDBACK_HOOK_ATTR}="true"]`,
			)
		)
			return false;

		return true;
	}

	getButtonContainer(choice: HTMLElement): HTMLElement | null {
		// Return the choice-input container
		return choice;
	}

	private generateFallbackId(choice: HTMLElement): string {
		// Generate stable ID based on choice position
		const parent =
			choice.closest(`[${MultipleChoiceAdapter.ROOT_HOOK_ATTR}="true"]`) ||
			choice.closest("multiple-choice");
		const choices =
			parent?.querySelectorAll(
				`[${MultipleChoiceAdapter.CHOICE_HOOK_ATTR}="true"]`,
			) || [];
		const index = Array.from(choices).indexOf(choice);
		return `choice-${index}`;
	}

	private annotateChoice(choice: HTMLElement): void {
		choice.setAttribute(MultipleChoiceAdapter.CHOICE_HOOK_ATTR, "true");
		const label = this.resolveLabelElement(choice);
		if (label) {
			label.setAttribute(MultipleChoiceAdapter.LABEL_HOOK_ATTR, "true");
		}
	}

	private resolveLabelElement(choice: HTMLElement): HTMLElement | null {
		return (
			choice.querySelector<HTMLElement>(
				`[${MultipleChoiceAdapter.LABEL_HOOK_ATTR}="true"]`,
			) ||
			choice.querySelector<HTMLElement>("label") ||
			choice.querySelector<HTMLElement>("span")
		);
	}

	private annotateFeedbackTicks(root: HTMLElement): void {
		for (const feedbackTick of root.querySelectorAll<HTMLElement>(
			".feedback-tick",
		)) {
			feedbackTick.setAttribute(
				MultipleChoiceAdapter.FEEDBACK_HOOK_ATTR,
				"true",
			);
		}
	}
}
