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
	private registry: AdapterRegistry;
	private strategy: EliminationStrategy;
	private eliminatedChoices = new Set<string>(); // Set<choiceId> for current element
	private choiceElements = new Map<string, HTMLElement>(); // choiceId -> element
	private choiceButtons = new Map<string, HTMLButtonElement>(); // choiceId -> button
	private buttonAlignment: "left" | "right" | "inline" = "right";
	private shouldRestoreState: boolean = true; // Whether to restore eliminations from state storage

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
	}

	/**
	 * Initialize a single choice
	 */
	private initializeChoice(choice: HTMLElement, adapter: ChoiceAdapter): void {
		const choiceId = adapter.getChoiceId(choice);

		// Track element
		this.choiceElements.set(choiceId, choice);

		// Create elimination toggle button
		const button = this.createToggleButton(choice, adapter);
		if (!button) return;

		this.choiceButtons.set(choiceId, button);

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
		button.className = "answer-eliminator-toggle";
		button.setAttribute("aria-label", `Toggle elimination for ${choiceLabel}`);
		button.setAttribute("data-choice-id", choiceId);
		button.textContent = "⊗"; // Cross mark (use textContent instead of innerHTML for better security)

		// Apply positioning based on alignment configuration
		this.applyButtonAlignment(button);

		// Common button styling
		Object.assign(button.style, {
			width: "28px",
			height: "28px",
			padding: "0",
			border: "1px solid #ccc",
			borderRadius: "4px",
			background: "white",
			cursor: "pointer",
			fontSize: "18px",
			lineHeight: "1",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			color: "#666",
			transition: "all 0.2s ease",
			zIndex: "10",
		});

		// Add hover effect
		button.addEventListener("mouseenter", () => {
			button.style.background = "#f0f0f0";
			button.style.borderColor = "#999";
			button.style.color = "#333";
		});

		button.addEventListener("mouseleave", () => {
			if (!this.strategy.isEliminated(choiceId)) {
				button.style.background = "white";
				button.style.borderColor = "#ccc";
				button.style.color = "#666";
			}
		});

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

		// Emit state change event
		this.emitStateChange();
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

		// Update button appearance to show eliminated state
		const button = this.choiceButtons.get(choiceId);
		if (button) {
			button.classList.add("active");
			button.setAttribute("aria-pressed", "true");
			// Visual feedback: filled/highlighted when eliminated
			button.style.background = "#ff9800";
			button.style.borderColor = "#ff9800";
			button.style.color = "white";
		}

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

		// Reset button appearance to default state
		const button = this.choiceButtons.get(choiceId);
		if (button) {
			button.classList.remove("active");
			button.setAttribute("aria-pressed", "false");
			// Reset to default styling
			button.style.background = "white";
			button.style.borderColor = "#ccc";
			button.style.color = "#666";
		}

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
		this.emitStateChange();
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

				// Find adapter for this choice
				const adapter = this.findAdapterForChoice(choice);
				if (!adapter) continue;

				// Re-eliminate without saving (already in state)
				const range = adapter.createChoiceRange(choice);
				if (range) {
					this.strategy.apply(choiceId, range);

					// Track in memory
					this.eliminatedChoices.add(choiceId);

					// Update button appearance to show eliminated state
					const button = this.choiceButtons.get(choiceId);
					if (button) {
						button.classList.add("active");
						button.setAttribute("aria-pressed", "true");
						// Apply eliminated styling
						button.style.background = "#ff9800";
						button.style.borderColor = "#ff9800";
						button.style.color = "white";
					}
				}
			}
		} catch (error) {
			console.error("Failed to restore eliminator state:", error);
		}
	}

	/**
	 * Find adapter for a choice element
	 */
	private findAdapterForChoice(choice: HTMLElement): ChoiceAdapter | null {
		// Walk up to find PIE element root
		let element: HTMLElement | null = choice;

		while (element && element !== document.body) {
			const adapter = this.registry.findAdapter(element);
			if (adapter) return adapter;
			element = element.parentElement;
		}

		return null;
	}

	/**
	 * Cleanup buttons from previous element
	 */
	private cleanupButtons(): void {
		for (const button of this.choiceButtons.values()) {
			button.remove();
		}

		this.choiceButtons.clear();
		this.choiceElements.clear();
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
	 * Cleanup when tool is turned off (but don't destroy strategy)
	 * Hides elimination buttons AND clears all visual eliminations
	 * Note: State is preserved in localStorage for when tool is turned back on
	 */
	cleanup(): void {
		// Disable state restoration to prevent restoreState() from re-applying eliminations
		this.disableStateRestoration();

		// Remove all buttons
		this.cleanupButtons();

		// Clear all visual eliminations (strikethroughs)
		// This removes the CSS highlights but keeps localStorage state
		this.strategy.clearAll();
	}

	/**
	 * Emit state change event for UI updates
	 */
	private emitStateChange(): void {
		const event = new CustomEvent("answer-eliminator-state-change", {
			detail: {
				eliminatedCount: this.getEliminatedCount(),
			},
			bubbles: true,
		});
		document.dispatchEvent(event);
	}

	/**
	 * Destroy and cleanup
	 */
	destroy(): void {
		this.cleanupButtons();
		this.strategy.destroy();
	}
}
