import {
	resolveInterfaceI18n,
	stampInterfaceLocale,
} from "@pie-players/pie-players-shared/i18n/provider";
import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
import {
	type ChoiceTarget,
	type FoundChoice,
	findChoiceTargets,
} from "./choice-targets.js";
import type { EliminationStrategy } from "./strategies/elimination-strategy.js";
import { MaskStrategy } from "./strategies/mask-strategy.js";
import { StrikethroughStrategy } from "./strategies/strikethrough-strategy.js";
import type { ElementStateKeys } from "./element-props.js";

/**
 * Where eliminations persist: the toolkit's element tool state store, keyed per
 * PIE element.
 */
export interface EliminatorStateStore {
	getState(globalElementId: string, toolId: string): unknown;
	setState(globalElementId: string, toolId: string, state: unknown): void;
}

/**
 * Where a choice's toggle sits. `start` and `end` are logical: they resolve
 * against the choice's own direction, so they mirror under right-to-left
 * content. `inline` puts the toggle in the flow after the choice.
 */
export type ButtonAlignment = "start" | "end" | "inline";

/**
 * The accepted spellings: `left` and `right` are aliases of `start` and `end`,
 * kept for hosts that set the physical values before they became logical.
 */
export type ButtonAlignmentInput = ButtonAlignment | "left" | "right";

/** Resolve an attribute value to a placement; anything unknown is `inline`. */
export function normalizeButtonAlignment(value: unknown): ButtonAlignment {
	switch (value) {
		case "start":
		case "left":
			return "start";
		case "end":
		case "right":
			return "end";
		default:
			return "inline";
	}
}

/** The interface-locale surface the eliminator's chrome reads. */
export type EliminatorI18n = Pick<
	I18nProvider,
	"t" | "getLocale" | "getDirection"
>;

interface TrackedChoice {
	choiceId: string;
	/** The owning element's model id, or an anonymous token when it is not keyed. */
	group: string;
	strategyKey: string;
	target: ChoiceTarget;
	/** The declaring element that supplied the choice, null for a legacy one. */
	owner: HTMLElement | null;
	button: HTMLButtonElement | null;
}

const STATE_TOOL_ID = "answerEliminator";

/**
 * Core engine for answer eliminator tool
 * Coordinates the choices elements supply, strategies, and state management
 *
 * Choice ids are only unique within one PIE element (two multiple-choice
 * elements both have a choice "a"), so every choice is tracked under its owning
 * element.
 */
export class AnswerEliminatorCore {
	private static readonly TOGGLE_CLASS = "pie-answer-eliminator-toggle";
	private static readonly TOGGLE_ACTIVE_CLASS =
		"pie-answer-eliminator-toggle--active";
	private strategy: EliminationStrategy;
	// Keyed by `trackingKey(group, choiceId)`.
	private choices = new Map<string, TrackedChoice>();
	private eliminated = new Set<string>();
	// Strategy ids end up in CSS highlight names and attribute values, so they
	// are opaque tokens that stay stable for this core's lifetime.
	private strategyKeys = new Map<string, string>();
	private anonymousGroups = new WeakMap<Element, string>();
	private nextToken = 0;
	private buttonAlignment: ButtonAlignment = "inline";
	// The interface locale, for the toggles' labels and the strategy's
	// announcement: both are chrome, so they speak the interface language.
	private i18n: EliminatorI18n = resolveInterfaceI18n(null);
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
	// The choice whose toggle has focus, kept when the toggle is removed with
	// its choice so the rescan can hand focus to the replacement.
	private focusedKey: string | null = null;

	private store: EliminatorStateStore | null = null;
	private elementStateKeys: ElementStateKeys = {};
	// Model ids of the elements whose choices take a toggle; null for every one.
	private elementIds: ReadonlySet<string> | null = null;

	constructor(
		strategyType: "strikethrough" | "mask" = "strikethrough",
		buttonAlignment: ButtonAlignmentInput = "inline",
	) {
		this.strategy = this.createStrategy(strategyType);
		this.strategy.initialize();
		this.applyStrategyChrome();
		this.buttonAlignment = normalizeButtonAlignment(buttonAlignment);
	}

	/**
	 * Set the interface locale. Existing toggles and announcements are relabelled
	 * in place, so a locale change keeps every elimination.
	 */
	setInterfaceI18n(i18n: EliminatorI18n | null): void {
		this.i18n = i18n ?? resolveInterfaceI18n(null);
		for (const tracked of this.choices.values()) {
			if (tracked.button) this.labelToggle(tracked.button, tracked);
		}
		this.applyStrategyChrome();
	}

	private applyStrategyChrome(): void {
		this.strategy.setChrome?.({
			eliminatedText: this.i18n.t("tools.answerEliminator.eliminatedA11y"),
			stamp: (element) => stampInterfaceLocale(element, this.i18n),
		});
	}

	private labelToggle(button: HTMLButtonElement, tracked: TrackedChoice): void {
		const choice =
			tracked.target.label ||
			this.i18n.t("tools.answerEliminator.unlabeledChoice");
		button.setAttribute(
			"aria-label",
			this.i18n.t("tools.answerEliminator.toggleA11y", { choice }),
		);
		stampInterfaceLocale(button, this.i18n);
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

		for (const found of findChoiceTargets(questionRoot)) {
			this.initializeChoice(found, questionRoot);
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
	 * The PIE element a choice belongs to: the nearest keyed element from the
	 * one that supplied it, or from the choice's parent for a legacy choice, else
	 * the supplying element or the nearest custom element, which gets an
	 * anonymous token.
	 */
	private resolveGroup(
		{ target, owner }: FoundChoice,
		questionRoot: HTMLElement,
	): string {
		let fallback: Element | null = owner;
		for (
			let node: Element | null = owner ?? target.container.parentElement;
			node !== null;
			node = node === questionRoot ? null : node.parentElement
		) {
			if (node.id && Object.hasOwn(this.elementStateKeys, node.id)) {
				return node.id;
			}
			if (fallback === null && node.localName.includes("-")) fallback = node;
		}
		const anonymous = fallback ?? questionRoot;
		let token = this.anonymousGroups.get(anonymous);
		if (!token) {
			token = `\u0000anonymous-${this.nextToken++}`;
			this.anonymousGroups.set(anonymous, token);
		}
		return token;
	}

	/** Whether a choice belongs to an element listed in `elementIds`. */
	private isEligible(
		{ target, owner }: FoundChoice,
		questionRoot: HTMLElement,
	): boolean {
		const elementIds = this.elementIds;
		if (elementIds === null) return true;
		for (
			let node: Element | null = owner ?? target.container;
			node !== null;
			node = node === questionRoot ? null : node.parentElement
		) {
			if (node.id && elementIds.has(node.id)) return true;
		}
		return false;
	}

	private strategyKeyFor(key: string): string {
		let strategyKey = this.strategyKeys.get(key);
		if (!strategyKey) {
			strategyKey = `choice-${this.nextToken++}`;
			this.strategyKeys.set(key, strategyKey);
		}
		return strategyKey;
	}

	private initializeChoice(found: FoundChoice, questionRoot: HTMLElement): void {
		if (!this.isEligible(found, questionRoot)) return;
		const { target, owner } = found;
		const choiceId = target.id;
		const group = this.resolveGroup(found, questionRoot);
		const key = this.trackingKey(group, choiceId);
		const tracked: TrackedChoice = {
			choiceId,
			group,
			strategyKey: this.strategyKeyFor(key),
			target,
			owner,
			button: null,
		};
		this.choices.set(key, tracked);

		const button = this.createToggleButton(
			key,
			tracked,
			this.alignmentFor(target.container),
		);
		tracked.button = button;

		// Apply the initial visibility rule (hidden if selected, or if the
		// feature is off and this choice isn't struck). Kept in sync afterwards
		// via the question-root `change` listener and toggle actions.
		this.updateButtonVisibility(key);

		target.container.style.position = "relative";
		target.container.appendChild(button);
	}

	/**
	 * A choice laid out inline, such as a token in running text, takes the toggle
	 * in the line: an absolute toggle would cover the choice's own text.
	 */
	private alignmentFor(container: HTMLElement): ButtonAlignment {
		if (this.buttonAlignment === "inline") return "inline";
		return getComputedStyle(container).display === "inline"
			? "inline"
			: this.buttonAlignment;
	}

	private createToggleButton(
		key: string,
		tracked: TrackedChoice,
		alignment: ButtonAlignment,
	): HTMLButtonElement {
		const button = document.createElement("button");
		button.type = "button";
		button.className = AnswerEliminatorCore.TOGGLE_CLASS;
		this.labelToggle(button, tracked);
		button.setAttribute("aria-pressed", "false");
		button.setAttribute("data-choice-id", tracked.choiceId);
		// The glyph is decoration: the button is named by its aria-label, and an
		// exposed glyph is spoken by read-aloud after every choice.
		const glyph = document.createElement("span");
		glyph.setAttribute("aria-hidden", "true");
		glyph.textContent = "⊗";
		button.appendChild(glyph);

		this.applyButtonAlignment(button, alignment, tracked.target.container);

		// Remember the visible `display` value chosen by the alignment (e.g.
		// "inline-flex" for inline mode) so hide/show toggling can restore it
		// instead of clobbering it with the CSS default.
		button.dataset.pieShownDisplay = button.style.display;

		button.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleElimination(key);
		});
		button.addEventListener("focus", () => {
			this.focusedKey = key;
		});
		// A browser may blur a focused toggle as it is removed; that toggle is
		// disconnected by the time the microtask runs, and keeps the key.
		button.addEventListener("blur", () => {
			queueMicrotask(() => {
				if (button.isConnected && this.focusedKey === key) {
					this.focusedKey = null;
				}
			});
		});

		return button;
	}

	private toggleElimination(key: string): void {
		const tracked = this.choices.get(key);
		if (!tracked) return;

		if (this.eliminated.has(key)) {
			this.restoreChoice(key);
		} else {
			if (!tracked.target.canEliminate()) {
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
	 * no range could be built for it. `block` is false only when the choice's
	 * element already blocks it.
	 */
	private applyElimination(
		key: string,
		tracked: TrackedChoice,
		block = true,
	): boolean {
		// Never strike a currently-selected choice.
		if (tracked.target.isSelected()) return false;
		const range = tracked.target.createRange();
		if (!range) return false;

		this.strategy.apply(tracked.strategyKey, range);
		this.eliminated.add(key);

		// A student must not be able to select an answer they have struck
		// through.
		if (block) tracked.target.setEliminated(true);

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
		tracked.target.setEliminated(false);

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
	 * Limit toggles to the choices of these PIE elements, by model id; `null`
	 * gives every element's choices one. Takes effect at the next
	 * initialization.
	 */
	setElementIds(elementIds: readonly string[] | null): void {
		this.elementIds = elementIds ? new Set(elementIds) : null;
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
			tracked?.target.setEliminated(false);
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
		return tracked.target.isSelected();
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

	private hasDetachedChoice(): boolean {
		for (const { target } of this.choices.values()) {
			if (!target.container.isConnected) return true;
		}
		return false;
	}

	/**
	 * Track the choices again after an element replaced their markup, as one
	 * rendering from an HTML string does on every change. Eliminations carry
	 * over by choice id. The element that supplied a choice still holds it
	 * eliminated and is not asked again, so an element that re-renders on every
	 * `setEliminated` cannot loop; a new element instance, or a legacy choice,
	 * is. A choice no longer supplied is restored in its element. Nothing is
	 * saved: the store records the learner's toggles.
	 */
	private rescan(): void {
		const questionRoot = this.questionRoot;
		if (!questionRoot) return;

		const refocus =
			this.focusedKey !== null &&
			!this.choices.get(this.focusedKey)?.button?.isConnected &&
			(document.activeElement === null ||
				document.activeElement === document.body)
				? this.focusedKey
				: null;
		const previous = this.choices;
		const eliminated = new Set(this.eliminated);

		this.strategy.clearAll();
		this.eliminated.clear();
		for (const { button } of previous.values()) button?.remove();
		this.choices = new Map();

		for (const found of findChoiceTargets(questionRoot)) {
			this.initializeChoice(found, questionRoot);
		}

		for (const key of eliminated) {
			const before = previous.get(key);
			const tracked = this.choices.get(key);
			const held = !!before?.owner && tracked?.owner === before.owner;
			if (tracked && this.applyElimination(key, tracked, !held)) continue;
			(tracked ?? before)?.target.setEliminated(false);
		}

		if (refocus) {
			this.choices.get(refocus)?.button?.focus({ preventScroll: true });
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
				if (!relevant) return;
				// Rescanned at once, before paint, so replaced choices never show
				// without their toggles and a focused toggle's successor takes focus.
				if (this.hasDetachedChoice()) this.rescan();
				else this.scheduleSelectionRefresh();
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
		this.focusedKey = null;

		for (const { button } of this.choices.values()) {
			button?.remove();
		}
		this.choices.clear();
	}

	private applyButtonAlignment(
		button: HTMLButtonElement,
		alignment: ButtonAlignment,
		container: HTMLElement,
	): void {
		switch (alignment) {
			case "start":
			case "end": {
				// Resolved to a physical side from the choice's own direction: the
				// toggle carries the interface `dir`, which need not match the
				// content it sits beside.
				const rtl = getComputedStyle(container).direction === "rtl";
				const side = (alignment === "end") === rtl ? "left" : "right";
				Object.assign(button.style, {
					position: "absolute",
					[side]: "8px",
					top: "50%",
					transform: "translateY(-50%)",
				});
				break;
			}

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
