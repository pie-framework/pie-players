import { AdapterRegistry } from "./adapters/adapter-registry.js";
import type { ChoiceAdapter } from "./adapters/choice-adapter.js";
import type { EliminationStrategy } from "./strategies/elimination-strategy.js";
import { MaskStrategy } from "./strategies/mask-strategy.js";
import { StrikethroughStrategy } from "./strategies/strikethrough-strategy.js";

/**
 * Core engine for answer eliminator tool
 * Coordinates adapters, strategies, and state management
 */
export class AnswerEliminatorCore {
	private static readonly TOGGLE_CLASS = "pie-answer-eliminator-toggle";
	private static readonly TOGGLE_ACTIVE_CLASS =
		"pie-answer-eliminator-toggle--active";
	private registry: AdapterRegistry;
	private strategy: EliminationStrategy;
	private eliminatedChoices = new Set<string>(); // Set<choiceId> for current element
	private choiceElements = new Map<string, HTMLElement>(); // choiceId -> element
	private choiceButtons = new Map<string, HTMLButtonElement>(); // choiceId -> button
	private choiceAdapters = new Map<string, ChoiceAdapter>(); // choiceId -> adapter
	private buttonAlignment: "left" | "right" | "inline" = "right";
	private shouldRestoreState: boolean = true; // Whether to restore eliminations from state storage
	// Whether the question-level feature is currently on. When off, the
	// eliminate controls are hidden for choices that are NOT struck through,
	// while struck choices keep their strikethrough and a visible button so the
	// student can still undo them.
	private active: boolean = true;

	// Live selection tracking: choice selection can change without a full
	// re-render, and controlled widgets (e.g. PIE multiple-choice) commit the
	// new `checked`/`aria-checked` on their own render *after* the native
	// `change` event. We therefore observe DOM commits directly so the read is
	// never a render behind, and also listen for `change` as a fast path.
	private questionRoot: HTMLElement | null = null;
	private selectionChangeHandler: (() => void) | null = null;
	private selectionObserver: MutationObserver | null = null;
	private selectionRefreshFrame: number | null = null;

	// Store integration (replaces session/localStorage)
	private storeIntegration: {
		store: any; // ElementToolStateStore
		globalElementId: string; // Composite key: "assessmentId:sectionId:itemId:elementId"
	} | null = null;

	constructor(
		strategyType: "strikethrough" | "mask" | "gray" = "strikethrough",
		buttonAlignment: "left" | "right" | "inline" = "right",
	) {
		this.registry = new AdapterRegistry();
		this.strategy = this.createStrategy(strategyType);
		this.strategy.initialize();
		this.buttonAlignment = buttonAlignment;
	}

	private createStrategy(type: string): EliminationStrategy {
		switch (type) {
			case "mask":
				return new MaskStrategy();
			case "strikethrough":
			default:
				return new StrikethroughStrategy();
		}
	}

	/**
	 * Initialize eliminator for a question
	 */
	initializeForQuestion(questionRoot: HTMLElement): void {
		// Initializing means the feature is on.
		this.active = true;

		// Clean up previous question
		this.cleanupButtons();

		// Find all choices with their adapters
		const choicesWithAdapters =
			this.registry.findAllChoicesWithAdapters(questionRoot);

		// Attach elimination functionality to each choice
		for (const { choice, adapter } of choicesWithAdapters) {
			this.initializeChoice(choice, adapter);
		}

		// Restore eliminated state from store (only if enabled)
		if (this.shouldRestoreState) {
			this.restoreState();
		}

		// React to live selection changes so a selected choice's button is
		// hidden (and a deselected choice's button restored) without needing a
		// full re-initialization.
		this.attachSelectionListener(questionRoot);
	}

	/**
	 * Initialize a single choice
	 */
	private initializeChoice(choice: HTMLElement, adapter: ChoiceAdapter): void {
		const choiceId = adapter.getChoiceId(choice);

		// Track element
		this.choiceElements.set(choiceId, choice);
		this.choiceAdapters.set(choiceId, adapter);

		// Create elimination toggle button
		const button = this.createToggleButton(choice, adapter);
		if (!button) return;

		this.choiceButtons.set(choiceId, button);

		// Apply the initial visibility rule (hidden if selected, or if the
		// feature is off and this choice isn't struck). Kept in sync afterwards
		// via the question-root `change` listener and toggle actions.
		this.setButtonHidden(
			button,
			this.shouldHideButton(choiceId, choice, adapter),
		);

		// Attach button to choice
		const container = adapter.getButtonContainer(choice);
		if (container) {
			// Position button within container
			container.style.position = "relative";
			container.appendChild(button);
		}
	}

	/**
	 * Create elimination toggle button
	 */
	private createToggleButton(
		choice: HTMLElement,
		adapter: ChoiceAdapter,
	): HTMLButtonElement | null {
		const choiceId = adapter.getChoiceId(choice);
		const choiceLabel = adapter.getChoiceLabel(choice);

		const button = document.createElement("button");
		button.type = "button";
		button.className = AnswerEliminatorCore.TOGGLE_CLASS;
		button.setAttribute("aria-label", `Toggle elimination for ${choiceLabel}`);
		button.setAttribute("data-choice-id", choiceId);
		button.textContent = "⊗"; // Cross mark (use textContent instead of innerHTML for better security)

		// Apply positioning based on alignment configuration
		this.applyButtonAlignment(button);

		// Remember the visible `display` value chosen by the alignment (e.g.
		// "inline-flex" for inline mode) so hide/show toggling can restore it
		// instead of clobbering it with the CSS default.
		button.dataset.pieShownDisplay = button.style.display;

		button.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleElimination(choice, adapter);
		});

		return button;
	}

	/**
	 * Toggle elimination for a choice
	 */
	toggleElimination(choice: HTMLElement, adapter: ChoiceAdapter): void {
		const choiceId = adapter.getChoiceId(choice);

		// Check if already eliminated
		const isEliminated = this.strategy.isEliminated(choiceId);

		if (isEliminated) {
			// Restore
			this.restoreChoice(choiceId);
		} else {
			// Eliminate
			if (!adapter.canEliminate(choice)) {
				console.warn(
					"Cannot eliminate this choice (already selected or in evaluate mode)",
				);
				return;
			}

			this.eliminateChoice(choice, adapter);
		}

		// Save state
		this.saveState();
	}

	/**
	 * Eliminate a choice
	 */
	private eliminateChoice(choice: HTMLElement, adapter: ChoiceAdapter): void {
		const choiceId = adapter.getChoiceId(choice);

		// Create range for CSS Highlight API
		const range = adapter.createChoiceRange(choice);
		if (!range) {
			console.error("Failed to create range for choice");
			return;
		}

		// Apply strategy
		this.strategy.apply(choiceId, range);

		// Track in state
		this.eliminatedChoices.add(choiceId);

		// Make the choice non-selectable while eliminated: a student must not
		// be able to select an answer they have struck through.
		adapter.setSelectable?.(choice, false);

		// Update button appearance to show eliminated state
		const button = this.choiceButtons.get(choiceId);
		if (button) {
			button.classList.add(AnswerEliminatorCore.TOGGLE_ACTIVE_CLASS);
			button.setAttribute("aria-pressed", "true");
		}

		// A struck choice always keeps a visible button (even when the feature
		// is toggled off) so it can be undone.
		this.updateButtonVisibility(choiceId);

		// Save to store
		this.saveState();
	}

	/**
	 * Restore a choice
	 */
	private restoreChoice(choiceId: string): void {
		// Remove from strategy
		this.strategy.remove(choiceId);

		// Remove from state
		this.eliminatedChoices.delete(choiceId);

		// Re-enable selection now that the choice is no longer struck through.
		const choice = this.choiceElements.get(choiceId);
		const adapter = this.choiceAdapters.get(choiceId);
		if (choice && adapter) {
			adapter.setSelectable?.(choice, true);
		}

		// Reset button appearance to default state
		const button = this.choiceButtons.get(choiceId);
		if (button) {
			button.classList.remove(AnswerEliminatorCore.TOGGLE_ACTIVE_CLASS);
			button.setAttribute("aria-pressed", "false");
		}

		// No longer struck: re-apply the visibility rule (hidden when the
		// feature is off, or when the choice is selected).
		this.updateButtonVisibility(choiceId);

		// Save to store
		this.saveState();
	}

	/**
	 * Reset all eliminations for current element
	 */
	resetAll(): void {
		if (this.eliminatedChoices.size === 0) return;

		// Restore all choices
		for (const choiceId of Array.from(this.eliminatedChoices)) {
			this.restoreChoice(choiceId);
		}

		// Clear state
		this.eliminatedChoices.clear();
		this.saveState();
	}

	/**
	 * Get count of eliminated choices for current element
	 */
	getEliminatedCount(): number {
		return this.eliminatedChoices.size;
	}

	/**
	 * Set store integration for element-level state
	 * @param store ElementToolStateStore instance
	 * @param globalElementId Composite key: "assessmentId:sectionId:itemId:elementId"
	 */
	setStoreIntegration(store: any, globalElementId: string): void {
		this.storeIntegration = { store, globalElementId };
	}

	/**
	 * Save state to ElementToolStateStore
	 */
	private saveState(): void {
		if (!this.storeIntegration) return;

		const state = {
			eliminatedChoices: Array.from(this.eliminatedChoices),
		};

		this.storeIntegration.store.setState(
			this.storeIntegration.globalElementId,
			"answerEliminator",
			state,
		);
	}

	/**
	 * Restore state from ElementToolStateStore
	 */
	private restoreState(): void {
		if (!this.storeIntegration) return;

		const state = this.storeIntegration.store.getState(
			this.storeIntegration.globalElementId,
			"answerEliminator",
		);

		if (!state || !state.eliminatedChoices) return;

		try {
			const eliminated = state.eliminatedChoices;

			if (!eliminated || eliminated.length === 0) return;

			// Restore eliminated choices for current element
			for (const choiceId of eliminated) {
				const choice = this.choiceElements.get(choiceId);
				if (!choice) continue;

				// Use the adapter captured during initialization
				const adapter = this.choiceAdapters.get(choiceId);
				if (!adapter) continue;

				// Never re-apply an elimination onto a currently-selected
				// choice — a selected answer cannot be struck through.
				if (adapter.isSelected?.(choice)) continue;

				// Re-eliminate without saving (already in state)
				const range = adapter.createChoiceRange(choice);
				if (range) {
					this.strategy.apply(choiceId, range);

					// Track in memory
					this.eliminatedChoices.add(choiceId);

					// Restore the non-selectable state for the struck choice.
					adapter.setSelectable?.(choice, false);

					// Update button appearance to show eliminated state
					const button = this.choiceButtons.get(choiceId);
					if (button) {
						button.classList.add(AnswerEliminatorCore.TOGGLE_ACTIVE_CLASS);
						button.setAttribute("aria-pressed", "true");
					}

					// A struck choice keeps a visible button regardless of the
					// on/off state.
					this.updateButtonVisibility(choiceId);
				}
			}
		} catch (error) {
			console.error("Failed to restore eliminator state:", error);
		}
	}

	/**
	 * Re-enable selection for every currently-tracked struck choice.
	 * Must run before the element/adapter maps are cleared, otherwise the
	 * inputs would be left disabled after the tool is turned off.
	 */
	private restoreAllSelectable(): void {
		for (const choiceId of this.eliminatedChoices) {
			const choice = this.choiceElements.get(choiceId);
			const adapter = this.choiceAdapters.get(choiceId);
			if (choice && adapter) {
				adapter.setSelectable?.(choice, true);
			}
		}
	}

	/**
	 * Show or hide a choice's strikethrough button, preserving the visible
	 * `display` value chosen by the alignment configuration.
	 */
	private setButtonHidden(button: HTMLButtonElement, hidden: boolean): void {
		const next = hidden ? "none" : (button.dataset.pieShownDisplay ?? "");
		// Avoid redundant writes so our own refresh doesn't churn the DOM.
		if (button.style.display !== next) {
			button.style.display = next;
		}
	}

	/**
	 * The single rule for whether a choice's eliminate button should be hidden:
	 * - A struck-through choice always keeps its button (so it can be undone),
	 *   even when the feature is toggled off.
	 * - When the feature is off, a non-struck choice hides its button.
	 * - When the feature is on, a non-struck choice hides its button only while
	 *   it is selected (a selected answer must not be eliminable).
	 */
	private shouldHideButton(
		choiceId: string,
		choice: HTMLElement,
		adapter: ChoiceAdapter,
	): boolean {
		if (this.eliminatedChoices.has(choiceId)) return false;
		if (!this.active) return true;
		return adapter.isSelected?.(choice) ?? false;
	}

	/**
	 * Re-apply the visibility rule to a single choice's button.
	 */
	private updateButtonVisibility(choiceId: string): void {
		const choice = this.choiceElements.get(choiceId);
		const adapter = this.choiceAdapters.get(choiceId);
		const button = this.choiceButtons.get(choiceId);
		if (!choice || !adapter || !button) return;
		this.setButtonHidden(
			button,
			this.shouldHideButton(choiceId, choice, adapter),
		);
	}

	/**
	 * Re-evaluate button visibility for every tracked choice. Driven by live
	 * selection changes and by toggling the feature on/off.
	 */
	private refreshSelectionState(): void {
		for (const [choiceId, choice] of this.choiceElements) {
			const adapter = this.choiceAdapters.get(choiceId);
			const button = this.choiceButtons.get(choiceId);
			if (!adapter || !button) continue;
			this.setButtonHidden(
				button,
				this.shouldHideButton(choiceId, choice, adapter),
			);
		}
	}

	/**
	 * Schedule a selection refresh on the next frame. Deliberately does NOT
	 * cancel-and-reschedule: a burst of mutations coalesces into one pending
	 * refresh, and mutations in later frames each get their own refresh, so a
	 * multi-render commit settles instead of being starved by continuous
	 * churn (e.g. ripple animations).
	 */
	private scheduleSelectionRefresh(): void {
		if (this.selectionRefreshFrame !== null) return;
		this.selectionRefreshFrame = requestAnimationFrame(() => {
			this.selectionRefreshFrame = null;
			this.refreshSelectionState();
		});
	}

	/**
	 * Track live selection changes on the question root so button visibility
	 * follows the selection even when no full re-render occurs.
	 *
	 * Controlled widgets (PIE multiple-choice) update the input's `checked`
	 * *property* on their own render — invisible to a MutationObserver and
	 * later than the native `change` event — so we observe every DOM change
	 * the widget makes (childList + attributes) and re-read on the next frame,
	 * by which point the property has settled. Mutations caused by our own
	 * buttons are ignored so the refresh can't loop.
	 */
	private attachSelectionListener(questionRoot: HTMLElement): void {
		this.detachSelectionListener();
		this.questionRoot = questionRoot;

		this.selectionChangeHandler = () => this.scheduleSelectionRefresh();
		questionRoot.addEventListener("change", this.selectionChangeHandler);

		if (typeof MutationObserver !== "undefined") {
			this.selectionObserver = new MutationObserver((records) => {
				const ownButtons = new Set<Node>(this.choiceButtons.values());
				// Only react to changes that aren't our own button toggling.
				const relevant = records.some(
					(record) => !ownButtons.has(record.target),
				);
				if (relevant) this.scheduleSelectionRefresh();
			});
			this.selectionObserver.observe(questionRoot, {
				subtree: true,
				childList: true,
				attributes: true,
			});
		}
	}

	private detachSelectionListener(): void {
		if (this.selectionRefreshFrame !== null) {
			cancelAnimationFrame(this.selectionRefreshFrame);
			this.selectionRefreshFrame = null;
		}
		if (this.selectionObserver) {
			this.selectionObserver.disconnect();
			this.selectionObserver = null;
		}
		if (this.questionRoot && this.selectionChangeHandler) {
			this.questionRoot.removeEventListener(
				"change",
				this.selectionChangeHandler,
			);
		}
		this.questionRoot = null;
		this.selectionChangeHandler = null;
	}

	/**
	 * Cleanup buttons from previous element
	 */
	private cleanupButtons(): void {
		this.detachSelectionListener();

		for (const button of this.choiceButtons.values()) {
			button.remove();
		}

		this.choiceButtons.clear();
		this.choiceElements.clear();
		this.choiceAdapters.clear();
	}

	/**
	 * Apply button positioning based on alignment configuration
	 */
	private applyButtonAlignment(button: HTMLButtonElement): void {
		switch (this.buttonAlignment) {
			case "right":
				// Right-aligned (industry standard) - after choice text
				Object.assign(button.style, {
					position: "absolute",
					right: "8px",
					top: "50%",
					transform: "translateY(-50%)",
				});
				break;

			case "left":
				// Left-aligned - before choice text
				Object.assign(button.style, {
					position: "absolute",
					left: "8px",
					top: "50%",
					transform: "translateY(-50%)",
				});
				break;

			case "inline":
				// Inline with checkbox - no absolute positioning
				Object.assign(button.style, {
					position: "relative",
					marginLeft: "8px",
					marginRight: "8px",
					display: "inline-flex",
					verticalAlign: "middle",
				});
				break;
		}
	}

	/**
	 * Enable state restoration from localStorage
	 */
	enableStateRestoration(): void {
		this.shouldRestoreState = true;
	}

	/**
	 * Disable state restoration from localStorage
	 */
	disableStateRestoration(): void {
		this.shouldRestoreState = false;
	}

	/**
	 * Turn the feature off at the question level.
	 *
	 * Struck-through choices stay struck: their strikethrough, their disabled
	 * (non-selectable) input, and a visible/usable eliminate button all remain
	 * so the student can still undo them. Only the eliminate buttons for
	 * choices that are NOT struck through are hidden. Nothing is destroyed, so
	 * toggling the feature back on simply re-reveals the hidden buttons.
	 */
	cleanup(): void {
		this.active = false;
		this.refreshSelectionState();
	}

	/**
	 * Destroy and cleanup
	 */
	destroy(): void {
		this.restoreAllSelectable();
		this.cleanupButtons();
		this.strategy.destroy();
	}
}
