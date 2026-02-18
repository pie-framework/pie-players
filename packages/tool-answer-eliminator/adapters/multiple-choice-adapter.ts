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

	canHandle(element: HTMLElement): boolean {
		return (
			element.tagName.toLowerCase() === "multiple-choice" ||
			element.classList.contains("multiple-choice")
		);
	}

	findChoices(root: HTMLElement): HTMLElement[] {
		// Find by PIE's corespring classes
		return Array.from(
			root.querySelectorAll<HTMLElement>(
				".corespring-checkbox, .corespring-radio-button",
			),
		);
	}

	createChoiceRange(choice: HTMLElement): Range | null {
		// Create range covering the label content
		// Try multiple possible selectors for the label
		const labelElement =
			choice.querySelector(".label") ||
			choice.querySelector("label") ||
			choice.querySelector('[class*="label"]') ||
			choice.querySelector("span");

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
		const label = choice.querySelector(".label");
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
		if (choice.closest(".multiple-choice")?.querySelector(".feedback-tick"))
			return false;

		return true;
	}

	getButtonContainer(choice: HTMLElement): HTMLElement | null {
		// Return the choice-input container
		return choice;
	}

	private generateFallbackId(choice: HTMLElement): string {
		// Generate stable ID based on choice position
		const parent = choice.closest(".multiple-choice");
		const choices = parent?.querySelectorAll(".choice-input") || [];
		const index = Array.from(choices).indexOf(choice);
		return `choice-${index}`;
	}
}
