import { AdapterRegistry } from "./adapters/adapter-registry.js";
import type { ChoiceAdapter } from "./adapters/choice-adapter.js";
import type { EliminationStrategy } from "./strategies/elimination-strategy.js";
import { MaskStrategy } from "./strategies/mask-strategy.js";
import { StrikethroughStrategy } from "./strategies/strikethrough-strategy.js";

/**
 * Where eliminations persist: the toolkit's element tool state store, keyed per
 * PIE element.
 */
export interface EliminatorStateStore {
	getState(globalElementId: string, toolId: string): unknown;
	setState(globalElementId: string, toolId: string, state: unknown): void;
}

/**
 * Store key per PIE element, by the element's model id (which is also its DOM
 * id). A choice persists under the key of the nearest ancestor listed here.
 */
export type ElementStateKeys = Readonly<Record<string, string>>;

interface TrackedChoice {
	choiceId: string;
	/** The owning element's model id, or an anonymous token when it is not keyed. */
	group: string;
	strategyKey: string;
	element: HTMLElement;
	adapter: ChoiceAdapter;
	button: HTMLButtonElement | null;
}

const STATE_TOOL_ID = "answerEliminator";

/**
 * Core engine for answer eliminator tool
 * Coordinates adapters, strategies, and state management
 *
 * Choice ids are only unique within one PIE element (two multiple-choice
 * elements both have a choice "a"), so every choice is tracked under its owning
 * element.
 */
export class AnswerEliminatorCore {
	private static readonly TOGGLE_CLASS = "pie-answer-eliminator-toggle";
	private static readonly TOGGLE_ACTIVE_CLASS =
		"pie-answer-eliminator-toggle--active";
	private registry: AdapterRegistry;
	private strategy: EliminationStrategy;
	// Keyed by `trackingKey(group, choiceId)`.
	private choices = new Map<string, TrackedChoice>();
	private eliminated = new Set<string>();
	// Strategy ids end up in CSS highlight names and attribute values, so they
	// are opaque tokens that stay stable for this core's lifetime.
	private strategyKeys = new Map<string, string>();
	private anonymousGroups = new WeakMap<Element, string>();
	private nextToken = 0;
	private buttonAlignment: "left" | "right" | "inline" = "right";
	private shouldRestoreState: boolean = true;
	// Whether the question-level feature is currently on. When off, the
	// eliminate controls are hidden for choices that are NOT struck through,
	// while struck choices keep their strikethrough and a visible button so the
	// student can still undo them.
	private active: boolean = true;

	// Live selection tracking (see `attachSelectionListener`): `change` is the
	// fast path, the observer catches controlled widgets' later commits.
	private questionRoot: HTMLElement | null = null;
	private selectionChangeHandler: (() => void) | null = null;
	private selectionObserver: MutationObserver | null = null;
	private selectionRefreshFrame: number | null = null;

	private store: EliminatorStateStore | null = null;
	private elementStateKeys: ElementStateKeys = {};

	constructor(
		strategyType: "strikethrough" | "mask" = "strikethrough",
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
		this.active = true;

		// Start from a clean slate: the previous question's strikes and
		// disabled inputs must not outlive its choices.
		const previous = new Set(this.eliminated);
		this.restoreAllSelectable();
		this.strategy.clearAll();
		this.eliminated.clear();
		this.cleanupButtons();

		const choicesWithAdapters =
			this.registry.findAllChoicesWithAdapters(questionRoot);
		for (const { choice, adapter } of choicesWithAdapters) {
			this.initializeChoice(choice, adapter, questionRoot);
		}

		// Keyed elements restore from the store; anything else keeps what this
		// core held before the re-initialization.
		const persisted = this.readPersistedEliminations();
		for (const [key, tracked] of this.choices) {
			const restore = persisted.has(tracked.group)
				? persisted.get(tracked.group)?.has(tracked.choiceId)
				: previous.has(key);
			if (restore) this.applyElimination(key, tracked);
		}

		// React to live selection changes so a selected choice's button is
		// hidden (and a deselected choice's button restored) without needing a
		// full re-initialization.
		this.attachSelectionListener(questionRoot);
	}

	private trackingKey(group: string, choiceId: string): string {
		return `${group}\u0000${choiceId}`;
	}

	/**
	 * The PIE element a choice belongs to: the nearest keyed ancestor, else the
	 * nearest custom element, which gets an anonymous token.
	 */
	private resolveGroup(choice: HTMLElement, questionRoot: HTMLElement): string {
		let fallback: Element | null = null;
		for (
			let node: Element | null = choice.parentElement;
			node !== null;
			node = node === questionRoot ? null : node.parentElement
		) {
			if (node.id && Object.hasOwn(this.elementStateKeys, node.id)) {
				return node.id;
			}
			if (fallback === null && node.localName.includes("-")) fallback = node;
		}
		const owner = fallback ?? questionRoot;
		let token = this.anonymousGroups.get(owner);
		if (!token) {
			token = `\u0000anonymous-${this.nextToken++}`;
			this.anonymousGroups.set(owner, token);
		}
		return token;
	}

	private strategyKeyFor(key: string): string {
		let strategyKey = this.strategyKeys.get(key);
		if (!strategyKey) {
			strategyKey = `choice-${this.nextToken++}`;
			this.strategyKeys.set(key, strategyKey);
		}
		return strategyKey;
	}

	private initializeChoice(
		choice: HTMLElement,
		adapter: ChoiceAdapter,
		questionRoot: HTMLElement,
	): void {
		const choiceId = adapter.getChoiceId(choice);
		const group = this.resolveGroup(choice, questionRoot);
		const key = this.trackingKey(group, choiceId);
		const tracked: TrackedChoice = {
			choiceId,
			group,
			strategyKey: this.strategyKeyFor(key),
			element: choice,
			adapter,
			button: null,
		};
		this.choices.set(key, tracked);

		const button = this.createToggleButton(key, tracked);
		tracked.button = button;

		// Apply the initial visibility rule (hidden if selected, or if the
		// feature is off and this choice isn't struck). Kept in sync afterwards
		// via the question-root `change` listener and toggle actions.
		this.updateButtonVisibility(key);

		const container = adapter.getButtonContainer(choice);
		if (container) {
			container.style.position = "relative";
			container.appendChild(button);
		}
	}

	private createToggleButton(
		key: string,
		tracked: TrackedChoice,
	): HTMLButtonElement {
		const choiceLabel = tracked.adapter.getChoiceLabel(tracked.element);

		const button = document.createElement("button");
		button.type = "button";
		button.className = AnswerEliminatorCore.TOGGLE_CLASS;
		button.setAttribute("aria-label", `Toggle elimination for ${choiceLabel}`);
		button.setAttribute("aria-pressed", "false");
		button.setAttribute("data-choice-id", tracked.choiceId);
		// The glyph is decoration: the button is named by its aria-label, and an
		// exposed glyph is spoken by read-aloud after every choice.
		const glyph = document.createElement("span");
		glyph.setAttribute("aria-hidden", "true");
		glyph.textContent = "⊗";
		button.appendChild(glyph);

		this.applyButtonAlignment(button);

		// Remember the visible `display` value chosen by the alignment (e.g.
		// "inline-flex" for inline mode) so hide/show toggling can restore it
		// instead of clobbering it with the CSS default.
		button.dataset.pieShownDisplay = button.style.display;

		button.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleElimination(key);
		});

		return button;
	}

	private toggleElimination(key: string): void {
		const tracked = this.choices.get(key);
		if (!tracked) return;

		if (this.eliminated.has(key)) {
			this.restoreChoice(key);
		} else {
			if (!tracked.adapter.canEliminate(tracked.element)) {
				console.warn(
					"Cannot eliminate this choice (already selected or in evaluate mode)",
				);
				return;
			}
			if (!this.applyElimination(key, tracked)) {
				console.error("Failed to create range for choice");
				return;
			}
		}

		this.saveState(tracked.group);
	}

	/**
	 * Strike a choice through and make it non-selectable. Returns false when
	 * no range could be built for it.
	 */
	private applyElimination(key: string, tracked: TrackedChoice): boolean {
		// Never strike a currently-selected choice.
		if (tracked.adapter.isSelected?.(tracked.element)) return false;
		const range = tracked.adapter.createChoiceRange(tracked.element);
		if (!range) return false;

		this.strategy.apply(tracked.strategyKey, range);
		this.eliminated.add(key);

		// A student must not be able to select an answer they have struck
		// through.
		tracked.adapter.setSelectable?.(tracked.element, false);

		if (tracked.button) {
			tracked.button.classList.add(AnswerEliminatorCore.TOGGLE_ACTIVE_CLASS);
			tracked.button.setAttribute("aria-pressed", "true");
		}

		// A struck choice always keeps a visible button (even when the feature
		// is toggled off) so it can be undone.
		this.updateButtonVisibility(key);
		return true;
	}

	private restoreChoice(key: string): void {
		const tracked = this.choices.get(key);
		this.eliminated.delete(key);
		if (!tracked) return;

		this.strategy.remove(tracked.strategyKey);

		// Re-enable selection now that the choice is no longer struck through.
		tracked.adapter.setSelectable?.(tracked.element, true);

		if (tracked.button) {
			tracked.button.classList.remove(AnswerEliminatorCore.TOGGLE_ACTIVE_CLASS);
			tracked.button.setAttribute("aria-pressed", "false");
		}

		// No longer struck: re-apply the visibility rule (hidden when the
		// feature is off, or when the choice is selected).
		this.updateButtonVisibility(key);
	}

	/**
	 * Reset all eliminations for the current question
	 */
	resetAll(): void {
		if (this.eliminated.size === 0) return;
		const groups = new Set<string>();
		for (const key of Array.from(this.eliminated)) {
			const group = this.choices.get(key)?.group;
			if (group !== undefined) groups.add(group);
			this.restoreChoice(key);
		}
		for (const group of groups) this.saveState(group);
	}

	/**
	 * Get count of eliminated choices for the current question
	 */
	getEliminatedCount(): number {
		return this.eliminated.size;
	}

	/**
	 * Persist eliminations in the toolkit's element tool state store.
	 * @param store The element tool state store
	 * @param elementStateKeys Store key per PIE element, by model id
	 */
	setStoreIntegration(
		store: EliminatorStateStore | null,
		elementStateKeys: ElementStateKeys,
	): void {
		this.store = store;
		this.elementStateKeys = elementStateKeys;
	}

	/**
	 * Save one element's eliminations to the store
	 */
	private saveState(group: string): void {
		if (!this.store || !Object.hasOwn(this.elementStateKeys, group)) return;

		const eliminatedChoices: string[] = [];
		for (const key of this.eliminated) {
			const tracked = this.choices.get(key);
			if (tracked?.group === group) eliminatedChoices.push(tracked.choiceId);
		}
		this.store.setState(this.elementStateKeys[group], STATE_TOOL_ID, {
			eliminatedChoices,
		});
	}

	/**
	 * Eliminated choice ids per keyed element present in this question, read
	 * from the store. Empty when restoration is off or there is no store.
	 */
	private readPersistedEliminations(): Map<string, Set<string>> {
		const persisted = new Map<string, Set<string>>();
		if (!this.store || !this.shouldRestoreState) return persisted;
		for (const { group } of this.choices.values()) {
			if (persisted.has(group) || !Object.hasOwn(this.elementStateKeys, group))
				continue;
			try {
				const state = this.store.getState(
					this.elementStateKeys[group],
					STATE_TOOL_ID,
				) as { eliminatedChoices?: unknown } | undefined | null;
				const ids = Array.isArray(state?.eliminatedChoices)
					? state.eliminatedChoices.filter(
							(id): id is string => typeof id === "string",
						)
					: [];
				persisted.set(group, new Set(ids));
			} catch (error) {
				console.error("Failed to restore eliminator state:", error);
			}
		}
		return persisted;
	}

	/**
	 * Re-enable selection for every currently-tracked struck choice.
	 * Must run before the tracked choices are cleared, otherwise the inputs
	 * would be left disabled after the tool is turned off.
	 */
	private restoreAllSelectable(): void {
		for (const key of this.eliminated) {
			const tracked = this.choices.get(key);
			tracked?.adapter.setSelectable?.(tracked.element, true);
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
	private shouldHideButton(key: string, tracked: TrackedChoice): boolean {
		if (this.eliminated.has(key)) return false;
		if (!this.active) return true;
		return tracked.adapter.isSelected?.(tracked.element) ?? false;
	}

	/**
	 * Re-apply the visibility rule to a single choice's button.
	 */
	private updateButtonVisibility(key: string): void {
		const tracked = this.choices.get(key);
		if (!tracked?.button) return;
		this.setButtonHidden(tracked.button, this.shouldHideButton(key, tracked));
	}

	/**
	 * Re-evaluate button visibility for every tracked choice. Driven by live
	 * selection changes and by toggling the feature on/off.
	 */
	private refreshSelectionState(): void {
		for (const key of this.choices.keys()) {
			this.updateButtonVisibility(key);
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
				const ownButtons = new Set<Node>();
				for (const { button } of this.choices.values()) {
					if (button) ownButtons.add(button);
				}
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

	private cleanupButtons(): void {
		this.detachSelectionListener();

		for (const { button } of this.choices.values()) {
			button?.remove();
		}
		this.choices.clear();
	}

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
	 * Enable state restoration from the element tool state store
	 */
	enableStateRestoration(): void {
		this.shouldRestoreState = true;
	}

	/**
	 * Disable state restoration from the element tool state store
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
		this.eliminated.clear();
		this.cleanupButtons();
		this.strategy.destroy();
	}
}
