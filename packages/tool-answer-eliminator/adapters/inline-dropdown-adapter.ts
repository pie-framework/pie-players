import type { ChoiceAdapter } from "./choice-adapter.js";

/**
 * Adapter for PIE inline-dropdown elements
 *
 * Works with dropdown menu items (role="option")
 */
export class InlineDropdownAdapter implements ChoiceAdapter {
	readonly elementType = "inline-dropdown";
	readonly priority = 90;

	canHandle(element: HTMLElement): boolean {
		return (
			element.tagName.toLowerCase() === "inline-dropdown" ||
			element.querySelector('[role="combobox"]') !== null
		);
	}

	findChoices(root: HTMLElement): HTMLElement[] {
		// Find dropdown menu items
		return Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'));
	}

	createChoiceRange(choice: HTMLElement): Range | null {
		const range = document.createRange();
		range.selectNodeContents(choice);
		return range;
	}

	getChoiceId(choice: HTMLElement): string {
		return choice.id || choice.getAttribute("data-value") || "";
	}

	getChoiceLabel(choice: HTMLElement): string {
		return choice.textContent?.trim() || "Unlabeled option";
	}

	canEliminate(choice: HTMLElement): boolean {
		// Can't eliminate if already selected
		return choice.getAttribute("aria-selected") !== "true";
	}

	getButtonContainer(choice: HTMLElement): HTMLElement | null {
		return choice;
	}
}
