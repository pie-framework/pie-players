import type { ChoiceAdapter } from "./choice-adapter.js";

/**
 * Adapter for PIE multiple-choice elements
 *
 * Works with both single-select (radio) and multiple-select (checkbox) modes
 * Detects PIE's corespring-checkbox and corespring-radio-button classes
 */
export class MultipleChoiceAdapter implements ChoiceAdapter {
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
	private static readonly INPUT_SELECTOR =
		'input[type="checkbox"], input[type="radio"]';
	// Marks an input the eliminator disabled, apart from one the element did.
	private static readonly BLOCK_ATTR = "data-pie-answer-eliminator-blocked";

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

	getChoiceContent(choice: HTMLElement): HTMLElement | null {
		return this.resolveLabelElement(choice);
	}

	/**
	 * The row that holds the control and the label, so the toggle ends it
	 * instead of landing under the rationale and feedback; the choice itself
	 * when the label is its direct child.
	 */
	getChoiceContainer(choice: HTMLElement): HTMLElement {
		const content = this.resolveLabelElement(choice);
		let row: HTMLElement | null = content;
		while (row && row.parentElement !== choice) row = row.parentElement;
		return row && row !== content && row.localName !== "label" ? row : choice;
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

	/**
	 * The prompt text alone: the label also holds the displayed key and its
	 * screen-reader copy, which would name the choice "AA. …".
	 */
	getChoiceLabel(choice: HTMLElement): string {
		const label =
			choice.querySelector<HTMLElement>(".prompt-label") ??
			this.resolveLabelElement(choice);
		return label?.textContent?.trim() || "";
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

		// 2. Read-only, as outside gather mode
		if (this.isReadOnly(choice)) return false;

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

	/**
	 * Blocks or lifts the eliminator's block on the choice's input. Every write
	 * is skipped when it would change nothing, so the core can block a struck
	 * choice again after each re-render without feeding its own observer. A
	 * read-only element keeps a lifted input disabled, as it renders it.
	 */
	setSelectable(choice: HTMLElement, selectable: boolean): void {
		const input = choice.querySelector<HTMLInputElement>(
			MultipleChoiceAdapter.INPUT_SELECTOR,
		);
		if (!input) return;

		const blocked = input.hasAttribute(MultipleChoiceAdapter.BLOCK_ATTR);
		if (selectable) {
			// Not blocked here: an input the element rendered afresh is its own.
			if (!blocked) return;
			// Read while the mark is on, which keeps this input out of the count.
			const readOnly = this.isReadOnly(choice);
			input.removeAttribute(MultipleChoiceAdapter.BLOCK_ATTR);
			input.removeAttribute("aria-disabled");
			if (readOnly) return;
		} else if (!blocked) {
			input.setAttribute(MultipleChoiceAdapter.BLOCK_ATTR, "");
		}

		// Native `disabled` makes the control non-selectable and grays it out;
		// aria-disabled keeps the state exposed to assistive tech.
		if (input.disabled !== !selectable) input.disabled = !selectable;
		if (!selectable && input.getAttribute("aria-disabled") !== "true") {
			input.setAttribute("aria-disabled", "true");
		}

		// If the input lives inside a Material-UI control, mirror MUI's own
		// disabled styling by toggling `Mui-disabled` on the button root.
		const muiButton = input.closest<HTMLElement>(
			MultipleChoiceAdapter.MUI_BUTTON_SELECTOR,
		);
		const muiDisabled = MultipleChoiceAdapter.MUI_DISABLED_CLASS;
		if (muiButton && muiButton.classList.contains(muiDisabled) === selectable) {
			muiButton.classList.toggle(muiDisabled, !selectable);
		}
	}

	/**
	 * Whether the element holds its choices read-only. Multiple choice disables
	 * every input together outside gather mode, so one input disabled other
	 * than by the eliminator is enough. The scope is the element, or the EBSR
	 * part: the choice's nearest custom-element ancestor.
	 */
	private isReadOnly(choice: HTMLElement): boolean {
		let scope: HTMLElement = choice;
		for (let node = choice.parentElement; node; node = node.parentElement) {
			if (node.localName.includes("-")) {
				scope = node;
				break;
			}
		}
		return Array.from(
			scope.querySelectorAll<HTMLInputElement>(
				MultipleChoiceAdapter.INPUT_SELECTOR,
			),
		).some(
			(input) =>
				input.disabled && !input.hasAttribute(MultipleChoiceAdapter.BLOCK_ATTR),
		);
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

	/**
	 * The label text: Material-UI's label span, which leaves out the radio or
	 * checkbox its `<label>` wraps. Markup without it falls back to the label.
	 */
	private resolveLabelElement(choice: HTMLElement): HTMLElement | null {
		return (
			choice.querySelector<HTMLElement>(
				`[${MultipleChoiceAdapter.LABEL_HOOK_ATTR}="true"]`,
			) ||
			choice.querySelector<HTMLElement>(".MuiFormControlLabel-label") ||
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
