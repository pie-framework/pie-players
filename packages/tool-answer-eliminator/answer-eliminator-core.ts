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
import {
	type ChoiceToggle,
	createChoiceToggle,
	ndsToggleAvailable,
} from "./choice-toggle.js";
import {
	clearEliminated,
	type EliminationChrome,
	markEliminated,
	relabelEliminated,
} from "./eliminated-state.js";
import type {
	ElementStateKeys,
	EliminationStrategyName,
} from "./element-props.js";
import { isOwned } from "./owned-nodes.js";
import { CrossStrategy } from "./strategies/cross-strategy.js";
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
	toggle: ChoiceToggle | null;
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
	private strategy: EliminationStrategy;
	// Keyed by `trackingKey(group, choiceId)`.
	private choices = new Map<string, TrackedChoice>();
	private eliminated = new Set<string>();
	// Strategy ids end up in CSS highlight names and attribute values, so they
	// are opaque tokens that stay stable for this core's lifetime.
	private strategyKeys = new Map<string, string>();
	private nextStrategyToken = 0;
	// Anonymous group tokens, local to this core.
	private anonymousGroups = new WeakMap<Element, string>();
	private nextToken = 0;
	// Whether the toggles render as the NDS icon button (`ndsIcons`).
	private ndsIcons = false;
	// The interface locale, for the toggles' labels and the eliminated
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
	// Whether the element added or removed markup of its own since the last
	// refresh, which may have brought new choices.
	private structureChanged = false;
	// The choice whose toggle has focus, kept when the toggle is removed with
	// its choice so a retrack can hand focus to the replacement.
	private focusedKey: string | null = null;

	private store: EliminatorStateStore | null = null;
	private elementStateKeys: ElementStateKeys = {};
	// Model ids of the elements whose choices take a toggle; null for every one.
	private elementIds: ReadonlySet<string> | null = null;

	constructor(strategyType: EliminationStrategyName = "strikethrough") {
		this.strategy = createStrategy(strategyType);
		this.strategy.initialize();
	}

	/**
	 * Paint eliminations with another strategy. Every elimination is repainted
	 * in place, whether or not the tool is on: the toggles, the blocks and the
	 * store stay as they are, and so does focus.
	 */
	setStrategy(strategyType: EliminationStrategyName): void {
		const next = createStrategy(strategyType);
		if (next.name === this.strategy.name) return;
		this.strategy.destroy();
		this.strategy = next;
		next.initialize();
		for (const key of this.eliminated) {
			const tracked = this.choices.get(key);
			if (tracked) this.paint(tracked);
		}
	}

	/**
	 * Set the interface locale. Existing toggles and announcements are relabelled
	 * in place, so a locale change keeps every elimination.
	 */
	setInterfaceI18n(i18n: EliminatorI18n | null): void {
		this.i18n = i18n ?? resolveInterfaceI18n(null);
		const chrome = this.chrome();
		for (const [key, tracked] of this.choices) {
			if (tracked.toggle) this.labelToggle(tracked.toggle, tracked);
			if (this.eliminated.has(key)) relabelEliminated(tracked.target, chrome);
		}
	}

	/**
	 * Render the toggles as the NDS icon button, or as plain buttons. Existing
	 * toggles are replaced in place, keeping their state and focus. The button
	 * is used only once `<pie-nds-icon-button>` is registered.
	 */
	setNdsIcons(enabled: boolean): void {
		const next = enabled && ndsToggleAvailable();
		if (next === this.ndsIcons) return;
		this.ndsIcons = next;
		for (const [key, tracked] of this.choices) {
			const previous = tracked.toggle;
			if (!previous) continue;
			const focused = previous.element.contains(document.activeElement);
			previous.destroy();
			const toggle = this.createToggle(key, tracked);
			tracked.toggle = toggle;
			this.updateButtonVisibility(key);
			toggle.mount(tracked.target.container);
			if (focused) toggle.focus();
		}
	}

	private chrome(): EliminationChrome {
		return {
			eliminatedText: this.i18n.t("tools.answerEliminator.eliminatedA11y"),
			stamp: (element) => stampInterfaceLocale(element, this.i18n),
		};
	}

	private labelToggle(toggle: ChoiceToggle, tracked: TrackedChoice): void {
		const choice =
			tracked.target.label ||
			this.i18n.t("tools.answerEliminator.unlabeledChoice");
		toggle.setLabel(
			this.i18n.t("tools.answerEliminator.toggleA11y", { choice }),
			(element) => stampInterfaceLocale(element, this.i18n),
		);
	}

	/**
	 * Turn the tool on for a question. Keyed elements restore their eliminations
	 * from the store; anything else keeps what this core held. A choice already
	 * tracked, in the same markup, is left as it is, so turning the tool off and
	 * on again asks no element to re-render. Choices an element renders later
	 * are picked up as they appear.
	 */
	initializeForQuestion(questionRoot: HTMLElement): void {
		this.active = true;
		this.retrack(questionRoot, "store");
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
			strategyKey = `choice-${this.nextStrategyToken++}`;
			this.strategyKeys.set(key, strategyKey);
		}
		return strategyKey;
	}

	private createToggle(key: string, tracked: TrackedChoice): ChoiceToggle {
		const toggle = createChoiceToggle(this.ndsIcons, tracked.choiceId, {
			activate: () => this.toggleElimination(key),
			focus: () => {
				this.focusedKey = key;
			},
			// A browser may blur a focused toggle as it is removed; that toggle is
			// disconnected by the time the microtask runs, and keeps the key.
			blur: () => {
				queueMicrotask(() => {
					if (toggle.element.isConnected && this.focusedKey === key) {
						this.focusedKey = null;
					}
				});
			},
		});
		this.labelToggle(toggle, tracked);
		toggle.setPressed(this.eliminated.has(key));
		return toggle;
	}

	private toggleElimination(key: string): void {
		const tracked = this.choices.get(key);
		if (!tracked) return;

		if (this.eliminated.has(key)) {
			// Where elimination is unavailable, as in evaluate mode, so is restoring.
			if (!tracked.target.canEliminate()) return;
			const focused =
				tracked.toggle?.element.contains(document.activeElement) ?? false;
			this.restoreChoice(key);
			// With the tool off, the restored choice's toggle leaves the layout;
			// focus goes to the choice instead of the page.
			if (focused && !this.active) focusChoice(tracked);
		} else {
			if (!tracked.target.canEliminate()) {
				console.warn(
					"Cannot eliminate this choice (already selected or in evaluate mode)",
				);
				return;
			}
			if (!this.applyElimination(key, tracked)) {
				console.error("Failed to eliminate the choice: its content is detached");
				return;
			}
		}

		this.saveState(tracked.group);
	}

	/**
	 * Strike a choice through and make it non-selectable. Returns false when it
	 * is selected or its content is detached. `block` is false only when the
	 * choice's element already blocks it.
	 */
	private applyElimination(
		key: string,
		tracked: TrackedChoice,
		block = true,
	): boolean {
		// Never strike a currently-selected choice.
		if (tracked.target.isSelected()) return false;
		if (!this.paint(tracked)) return false;
		markEliminated(tracked.target, this.chrome());
		this.eliminated.add(key);

		// A student must not be able to select an answer they have struck
		// through.
		if (block) tracked.target.setEliminated(true);

		tracked.toggle?.setPressed(true);

		// A struck choice always keeps a visible button (even when the feature
		// is toggled off) so it can be undone.
		this.updateButtonVisibility(key);
		return true;
	}

	/** Paints a choice eliminated; false when its content is detached. */
	private paint(tracked: TrackedChoice): boolean {
		const { container, content } = tracked.target;
		if (!content.isConnected) return false;
		const range = document.createRange();
		range.selectNodeContents(content);
		this.strategy.apply(tracked.strategyKey, { range, container, content });
		return true;
	}

	private restoreChoice(key: string): void {
		const tracked = this.choices.get(key);
		this.eliminated.delete(key);
		if (!tracked) return;

		this.strategy.remove(tracked.strategyKey);
		clearEliminated(tracked.target);

		// Re-enable selection now that the choice is no longer struck through.
		tracked.target.setEliminated(false);

		tracked.toggle?.setPressed(false);

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
	 * Eliminated choice ids per keyed element among `groups`, read from the
	 * store. Empty when restoration is off or there is no store.
	 */
	private readPersistedEliminations(
		groups: Iterable<string>,
	): Map<string, Set<string>> {
		const persisted = new Map<string, Set<string>>();
		if (!this.store || !this.shouldRestoreState) return persisted;
		for (const group of groups) {
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
	 * Re-enable selection for every eliminated choice, before `destroy` forgets
	 * them, so no input is left disabled.
	 */
	private restoreAllSelectable(): void {
		for (const key of this.eliminated) {
			const tracked = this.choices.get(key);
			tracked?.target.setEliminated(false);
		}
	}

	/**
	 * Remove every elimination's paint and mark. Selection is restored
	 * separately, by `restoreAllSelectable`.
	 */
	private clearAllEliminations(): void {
		for (const key of this.eliminated) {
			const tracked = this.choices.get(key);
			if (tracked) clearEliminated(tracked.target);
		}
		this.strategy.clearAll();
		this.eliminated.clear();
	}

	/**
	 * The single rule for a choice's toggle:
	 * - A struck-through choice always keeps its toggle (so it can be undone),
	 *   even when the feature is toggled off.
	 * - When the feature is off, a non-struck choice's toggle leaves the layout.
	 * - When the feature is on, a non-struck choice hides its toggle while it
	 *   is selected (a selected answer must not be eliminable), keeping its
	 *   space so the choice does not reflow.
	 * - A non-struck choice that cannot be eliminated otherwise, as in evaluate
	 *   mode or a disabled element, has no toggle to offer, in the layout or the
	 *   tab order. A struck one keeps its toggle there, disabled.
	 */
	private toggleVisibility(
		key: string,
		tracked: TrackedChoice,
	): "shown" | "reserved" | "removed" {
		if (this.eliminated.has(key)) return "shown";
		if (!this.active) return "removed";
		if (tracked.target.isSelected()) return "reserved";
		return tracked.target.canEliminate() ? "shown" : "removed";
	}

	/**
	 * Re-apply the visibility rule to a single choice's toggle.
	 */
	private updateButtonVisibility(key: string): void {
		const tracked = this.choices.get(key);
		if (!tracked?.toggle) return;
		tracked.toggle.setVisibility(this.toggleVisibility(key, tracked));
		tracked.toggle.setEnabled(
			!this.eliminated.has(key) || tracked.target.canEliminate(),
		);
	}

	/**
	 * Re-evaluate button visibility for every tracked choice. Driven by live
	 * selection changes and by toggling the feature on/off. A legacy element
	 * re-rendering its inputs, as on a mode change, lifts their block, so a
	 * struck legacy choice is blocked again; a declaring element holds its own.
	 */
	private refreshSelectionState(): void {
		for (const [key, tracked] of this.choices) {
			if (!tracked.owner && this.eliminated.has(key)) {
				tracked.target.setEliminated(true);
			}
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
	 * Track the choices under the question root again and reconcile their
	 * eliminations, as the tool turns on, as an element replaces a choice's
	 * markup (one rendering from an HTML string does on every change), or as an
	 * element renders choices after the tool turned on.
	 *
	 * A choice in the markup already tracked, from the same element, keeps its
	 * toggle, paint and block as they are. A replaced choice takes a new toggle,
	 * and its elimination carries over by choice id: the element that supplied
	 * it still holds it eliminated and is not asked again, so an element that
	 * re-renders on every `setEliminated` cannot loop; a new element instance,
	 * or a legacy choice, is. A choice no longer supplied is restored in its
	 * element. Focus on a replaced toggle moves to its replacement.
	 *
	 * Keyed elements restore from the store: under `"store"` every one, under
	 * `"new"` only those not tracked before. The rest keep what this core holds.
	 * Nothing is saved: the store records the learner's toggles.
	 */
	private retrack(questionRoot: HTMLElement, restore: "store" | "new"): void {
		const previous = this.choices;
		const held = new Set(this.eliminated);
		const focusedKey = this.focusedKey;
		const focusedToggle =
			focusedKey === null ? null : (previous.get(focusedKey)?.toggle ?? null);

		const next = new Map<string, TrackedChoice>();
		for (const found of findChoiceTargets(questionRoot)) {
			// A tracked detached container sends every mutation to a rescan, which
			// mounts toggles, which mutates: the rescan would never settle.
			if (!found.target.container.isConnected) continue;
			if (!this.isEligible(found, questionRoot)) continue;
			const group = this.resolveGroup(found, questionRoot);
			const key = this.trackingKey(group, found.target.id);
			if (next.has(key)) continue;
			const before = previous.get(key);
			if (before && isSameChoice(before, found)) {
				const relabel = before.target.label !== found.target.label;
				// The latest target: an element's callbacks may close over a render.
				before.target = found.target;
				if (relabel && before.toggle) this.labelToggle(before.toggle, before);
				next.set(key, before);
				continue;
			}
			next.set(key, {
				choiceId: found.target.id,
				group,
				strategyKey: this.strategyKeyFor(key),
				target: found.target,
				owner: found.owner,
				toggle: null,
			});
		}

		const trackedGroups = new Set(
			Array.from(previous.values(), ({ group }) => group),
		);
		const persisted = this.readPersistedEliminations(
			Array.from(next.values(), ({ group }) => group).filter(
				(group) => restore === "store" || !trackedGroups.has(group),
			),
		);
		this.choices = next;

		for (const [key, before] of previous) {
			if (next.get(key) === before) continue;
			before.toggle?.destroy();
			if (!this.eliminated.delete(key)) continue;
			this.strategy.remove(before.strategyKey);
			clearEliminated(before.target);
			if (!next.has(key)) before.target.setEliminated(false);
		}

		for (const [key, tracked] of next) {
			const wanted = persisted.has(tracked.group)
				? persisted.get(tracked.group)?.has(tracked.choiceId) === true
				: held.has(key);
			const before = previous.get(key);
			if (before === tracked) {
				const toggle = tracked.toggle;
				if (toggle && toggle.element.parentElement !== tracked.target.container) {
					toggle.mount(tracked.target.container);
				}
				if (this.eliminated.has(key) === wanted) {
					this.updateButtonVisibility(key);
				} else if (wanted) {
					this.applyElimination(key, tracked);
				} else {
					this.restoreChoice(key);
				}
				continue;
			}
			const toggle = this.createToggle(key, tracked);
			tracked.toggle = toggle;
			this.updateButtonVisibility(key);
			// In flow as the container's last child: the element's own layout
			// decides where it lands.
			toggle.mount(tracked.target.container);
			const ownerHolds =
				held.has(key) && !!before?.owner && before.owner === tracked.owner;
			if (wanted && this.applyElimination(key, tracked, !ownerHolds)) continue;
			if (ownerHolds) tracked.target.setEliminated(false);
		}

		if (focusedKey !== null) {
			const toggle = this.choices.get(focusedKey)?.toggle;
			const active = document.activeElement;
			if (
				toggle &&
				toggle !== focusedToggle &&
				(active === null || active === document.body)
			) {
				toggle.focus();
			}
		}
	}

	/**
	 * Schedule a selection refresh on the next frame. Deliberately does NOT
	 * cancel-and-reschedule: a burst of mutations coalesces into one pending
	 * refresh, and mutations in later frames each get their own refresh, so a
	 * multi-render commit settles instead of being starved by continuous
	 * churn (e.g. ripple animations). A structural change among them first
	 * looks for choices the element has rendered since; the strategy then lays
	 * its marks out again.
	 */
	private scheduleSelectionRefresh(): void {
		if (this.selectionRefreshFrame !== null) return;
		this.selectionRefreshFrame = requestAnimationFrame(() => {
			this.selectionRefreshFrame = null;
			const questionRoot = this.questionRoot;
			if (this.structureChanged && questionRoot) {
				this.structureChanged = false;
				this.retrack(questionRoot, "new");
			}
			this.refreshSelectionState();
			// The element's changes may have moved the struck content.
			this.strategy.relayout?.();
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
	 * by which point the property has settled. Changes to the nodes the
	 * eliminator added are ignored, so the refresh cannot loop.
	 */
	private attachSelectionListener(questionRoot: HTMLElement): void {
		this.detachSelectionListener();
		this.questionRoot = questionRoot;

		this.selectionChangeHandler = () => this.scheduleSelectionRefresh();
		questionRoot.addEventListener("change", this.selectionChangeHandler);

		if (typeof MutationObserver !== "undefined") {
			this.selectionObserver = new MutationObserver((records) => {
				const relevant = records.filter((record) => !isOwned(record.target));
				if (relevant.length === 0) return;
				// Rescanned at once, before paint, so replaced choices never show
				// without their toggles and a focused toggle's successor takes focus.
				if (this.hasDetachedChoice()) {
					this.retrack(questionRoot, "new");
					return;
				}
				if (relevant.some(changesElementStructure)) {
					this.structureChanged = true;
				}
				this.scheduleSelectionRefresh();
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
		this.structureChanged = false;
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

		for (const { toggle } of this.choices.values()) {
			toggle?.destroy();
		}
		this.choices.clear();
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
		this.clearAllEliminations();
		this.cleanupButtons();
		this.strategy.destroy();
	}
}

function createStrategy(type: string): EliminationStrategy {
	switch (type) {
		case "mask":
			return new MaskStrategy();
		case "cross":
			return new CrossStrategy();
		default:
			return new StrikethroughStrategy();
	}
}

/** Whether a found choice is the tracked one, in the same markup. */
function isSameChoice(tracked: TrackedChoice, found: FoundChoice): boolean {
	return (
		tracked.owner === found.owner &&
		tracked.target.container === found.target.container &&
		tracked.target.content === found.target.content
	);
}

/** Whether a record adds or removes a node that is not the eliminator's. */
function changesElementStructure(record: MutationRecord): boolean {
	if (record.type !== "childList") return false;
	for (const nodes of [record.addedNodes, record.removedNodes]) {
		for (const node of nodes) {
			if (!isOwned(node)) return true;
		}
	}
	return false;
}

const FOCUSABLE =
	'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Moves focus to a choice's first focusable control outside its toggle. An
 * element lifting its block on the next render gets one frame, unless focus
 * has gone elsewhere by then.
 */
function focusChoice({ target, toggle }: TrackedChoice): void {
	const focus = (): boolean => {
		const { container } = target;
		const candidates = [
			...(container.matches(FOCUSABLE) ? [container] : []),
			...container.querySelectorAll<HTMLElement>(FOCUSABLE),
		];
		const control = candidates.find(
			(candidate) => !toggle?.element.contains(candidate),
		);
		control?.focus({ preventScroll: true });
		return !!control && document.activeElement === control;
	};
	if (focus()) return;
	requestAnimationFrame(() => {
		const active = document.activeElement;
		if (!active || active === document.body || toggle?.element.contains(active)) {
			focus();
		}
	});
}
