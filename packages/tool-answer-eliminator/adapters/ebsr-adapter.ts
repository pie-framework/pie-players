import type { ChoiceAdapter } from "./choice-adapter.js";
import { MultipleChoiceAdapter } from "./multiple-choice-adapter.js";

/**
 * Adapter for EBSR (Evidence-Based Selected Response) elements
 *
 * EBSR contains two multiple-choice questions (Part A and Part B),
 * so we delegate to MultipleChoiceAdapter and prefix IDs with part identifier
 */
export class EBSRAdapter implements ChoiceAdapter {
	readonly elementType = "ebsr";
	readonly priority = 95;

	private mcAdapter = new MultipleChoiceAdapter();

	canHandle(element: HTMLElement): boolean {
		return (
			element.tagName.toLowerCase() === "ebsr" ||
			element.querySelector("ebsr-multiple-choice") !== null
		);
	}

	findChoices(root: HTMLElement): HTMLElement[] {
		// EBSR contains ebsr-multiple-choice elements
		// Find choices in both Part A and Part B
		const partA = root.querySelector('ebsr-multiple-choice[id="a"]');
		const partB = root.querySelector('ebsr-multiple-choice[id="b"]');

		const choices: HTMLElement[] = [];
		if (partA)
			choices.push(...this.mcAdapter.findChoices(partA as HTMLElement));
		if (partB)
			choices.push(...this.mcAdapter.findChoices(partB as HTMLElement));

		return choices;
	}

	// Delegate all other methods to MultipleChoiceAdapter
	createChoiceRange(choice: HTMLElement): Range | null {
		return this.mcAdapter.createChoiceRange(choice);
	}

	getChoiceId(choice: HTMLElement): string {
		// Prefix with part ID (a or b)
		const part = choice.closest("ebsr-multiple-choice")?.id || "unknown";
		const choiceId = this.mcAdapter.getChoiceId(choice);
		return `${part}-${choiceId}`;
	}

	getChoiceLabel(choice: HTMLElement): string {
		return this.mcAdapter.getChoiceLabel(choice);
	}

	canEliminate(choice: HTMLElement): boolean {
		return this.mcAdapter.canEliminate(choice);
	}

	getButtonContainer(choice: HTMLElement): HTMLElement | null {
		return this.mcAdapter.getButtonContainer(choice);
	}
}
