import type { ChoiceAdapter } from "./choice-adapter.js";
import { MultipleChoiceAdapter } from "./multiple-choice-adapter.js";

const EBSR_MULTIPLE_CHOICE_TAG = "ebsr-multiple-choice";
const EBSR_MULTIPLE_CHOICE_VERSIONED_PREFIX = `${EBSR_MULTIPLE_CHOICE_TAG}--version-`;

const isEbsrMultipleChoiceElement = (element: Element | null): boolean => {
	if (!(element instanceof HTMLElement)) {
		return false;
	}
	const tagName = element.tagName.toLowerCase();
	return (
		tagName === EBSR_MULTIPLE_CHOICE_TAG ||
		tagName.startsWith(EBSR_MULTIPLE_CHOICE_VERSIONED_PREFIX)
	);
};

const findEbsrMultipleChoicePart = (
	root: HTMLElement,
	id: string,
): HTMLElement | null =>
	Array.from(root.querySelectorAll<HTMLElement>(`[id="${id}"]`)).find(
		isEbsrMultipleChoiceElement,
	) ?? null;

const findClosestEbsrMultipleChoicePart = (
	choice: HTMLElement,
): HTMLElement | null => {
	let element: HTMLElement | null = choice.parentElement;
	while (element !== null) {
		if (isEbsrMultipleChoiceElement(element)) {
			return element;
		}
		element = element.parentElement;
	}
	return null;
};

/**
 * Adapter for EBSR (Evidence-Based Selected Response) elements
 *
 * EBSR contains two multiple-choice questions (Part A and Part B),
 * so we delegate to MultipleChoiceAdapter and prefix IDs with part identifier
 */
export class EBSRAdapter implements ChoiceAdapter {
	readonly elementType = "ebsr";
	readonly priority = 110;

	private mcAdapter = new MultipleChoiceAdapter();

	canHandle(element: HTMLElement): boolean {
		return (
			element.tagName.toLowerCase() === "ebsr" ||
			Array.from(element.querySelectorAll<HTMLElement>("*")).some(
				isEbsrMultipleChoiceElement,
			)
		);
	}

	findChoices(root: HTMLElement): HTMLElement[] {
		// EBSR contains private multiple-choice elements, version-scoped in modern bundles.
		// Find choices in both Part A and Part B
		const partA = findEbsrMultipleChoicePart(root, "a");
		const partB = findEbsrMultipleChoicePart(root, "b");

		const choices: HTMLElement[] = [];
		if (partA) choices.push(...this.mcAdapter.findChoices(partA));
		if (partB) choices.push(...this.mcAdapter.findChoices(partB));

		return choices;
	}

	// Delegate all other methods to MultipleChoiceAdapter
	createChoiceRange(choice: HTMLElement): Range | null {
		return this.mcAdapter.createChoiceRange(choice);
	}

	getChoiceId(choice: HTMLElement): string {
		// Prefix with part ID (a or b)
		const part = findClosestEbsrMultipleChoicePart(choice)?.id || "unknown";
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
