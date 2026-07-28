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
	// Material-UI radio/checkbox controls gray out via the `Mui-disabled`
	// class on the button root; toggling the native `disabled` alone doesn't
	// restyle them.
	private static readonly MUI_BUTTON_SELECTOR =
		".MuiButtonBase-root, .MuiRadio-root, .MuiCheckbox-root";
	private static readonly MUI_DISABLED_CLASS = "Mui-disabled";

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

	isSelected(choice: HTMLElement): boolean {
		const input = choice.querySelector<HTMLInputElement>(
			'input[type="checkbox"], input[type="radio"]',
		);
		if (!input) return false;

		// Prefer the live `checked` property (works for radio and checkbox);
		// fall back to the aria-checked attribute for custom/ARIA widgets.
		return input.checked || input.getAttribute("aria-checked") === "true";
	}

	canEliminate(choice: HTMLElement): boolean {
		const input = choice.querySelector(
			'input[type="checkbox"], input[type="radio"]',
		);
		if (!input) return false;

		// Can't eliminate if:
		// 1. Already selected (checked)
		if (this.isSelected(choice)) return false;

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

	setSelectable(choice: HTMLElement, selectable: boolean): void {
		const input = choice.querySelector<HTMLInputElement>(
			'input[type="checkbox"], input[type="radio"]',
		);
		if (!input) return;

		// Native `disabled` makes the control non-selectable and grays it out;
		// aria-disabled keeps the state exposed to assistive tech.
		input.disabled = !selectable;
		if (selectable) {
			input.removeAttribute("aria-disabled");
		} else {
			input.setAttribute("aria-disabled", "true");
		}

		// If the input lives inside a Material-UI control, mirror MUI's own
		// disabled styling by toggling `Mui-disabled` on the button root.
		const muiButton = input.closest<HTMLElement>(
			MultipleChoiceAdapter.MUI_BUTTON_SELECTOR,
		);
		if (muiButton) {
			muiButton.classList.toggle(
				MultipleChoiceAdapter.MUI_DISABLED_CLASS,
				!selectable,
			);
		}
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
