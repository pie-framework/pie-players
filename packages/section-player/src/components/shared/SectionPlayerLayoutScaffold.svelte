<script lang="ts">
	import "../section-player-base-element.js";
	import "../section-player-shell-element.js";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import {
		createSectionPlayerCardRenderContextProvider,
		getHostElementFromAnchor,
		type SectionPlayerCardRenderContext,
	} from "./section-player-card-context.js";
	import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
	import { coerceBooleanLike } from "./section-player-props.js";
	import { onDestroy, tick } from "svelte";
	import type {
		SectionPlayerAutoFocusStrategy,
		SectionPlayerFocusPolicy,
	} from "../../policies/types.js";
	import {
		DEFAULT_FOCUS_POLICY,
		resolveAutoFocusStrategy,
	} from "../../policies/index.js";

	let {
		runtime = null as Record<string, unknown> | null,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
		focusPolicy = DEFAULT_FOCUS_POLICY as SectionPlayerFocusPolicy,
		cardRenderContext = null as SectionPlayerCardRenderContext | null,
		onCompositionChanged,
		onSectionReady,
		onFrameworkErrorEvent,
		onSessionChanged,
		onRuntimeOwned,
		onRuntimeInherited,
		onToolkitReady,
	} = $props<{
		runtime?: Record<string, unknown> | null;
		section?: AssessmentSection | null;
		sectionId?: string;
		attemptId?: string;
		showToolbar?: boolean | string | null | undefined;
		toolbarPosition?: string;
		enabledTools?: string;
		toolRegistry?: ToolRegistry | null;
		sectionHostButtons?: ToolbarItem[];
		focusPolicy?: SectionPlayerFocusPolicy;
		cardRenderContext?: SectionPlayerCardRenderContext | null;
		onCompositionChanged?: (event: Event) => void;
		onSectionReady?: (event: Event) => void;
		/**
		 * Internal scaffold-level event-listener for `framework-error` DOM
		 * events. Distinct from the canonical, model-shape
		 * `onFrameworkError` prop on `SectionPlayerLayoutKernel` and the
		 * layout custom elements: the scaffold does not own the canonical
		 * model contract — it only re-emits raw events to its consumer.
		 */
		onFrameworkErrorEvent?: (event: Event) => void;
		onSessionChanged?: (event: Event) => void;
		onRuntimeOwned?: (event: Event) => void;
		onRuntimeInherited?: (event: Event) => void;
		onToolkitReady?: (event: Event) => void;
	}>();
	let cardContextAnchor = $state<HTMLDivElement | null>(null);
	let navigationStatusMessage = $state("");
	let unsubscribeNavigationStatus: (() => void) | null = null;
	// Set when `item-selected` fires so the next `composition-changed` (which
	// carries the DOM update with the new `[is-current]` attribute) can move
	// focus according to the resolved `autoFocus` strategy. Needed because
	// the toolkit defers composition emission behind a RAF, so the DOM isn't
	// up to date when the controller's `item-selected` event fires.
	let pendingNavigationFocus: SectionPlayerAutoFocusStrategy | null = null;

	function buildStatusMessage(event: { itemIndex?: number; totalItems?: number; itemLabel?: string }): string {
		const position = typeof event.itemIndex === "number" ? event.itemIndex + 1 : null;
		const total = typeof event.totalItems === "number" ? event.totalItems : null;
		if (event.itemLabel && position !== null && total !== null) {
			return `${event.itemLabel}, question ${position} of ${total}`;
		}
		if (position !== null && total !== null) {
			return `Question ${position} of ${total}`;
		}
		return "";
	}

	function getFocusRoot(): Document | HTMLElement {
		const rooted = getHostElementFromAnchor(cardContextAnchor);
		return rooted || document;
	}

	function focusAndReveal(el: HTMLElement | null | undefined): boolean {
		if (!el) return false;
		el.scrollIntoView({ block: "start", inline: "nearest" });
		el.focus();
		return true;
	}

	function focusStartOfContent(): boolean {
		const root = getFocusRoot();
		const passage = root.querySelector<HTMLElement>(
			"pie-section-player-passage-card",
		);
		if (passage) return focusAndReveal(passage);
		const itemsPane = root.querySelector("pie-section-player-items-pane");
		const firstItem =
			itemsPane?.querySelector<HTMLElement>("pie-section-player-item-card") ||
			root.querySelector<HTMLElement>("pie-section-player-item-card");
		if (!focusAndReveal(firstItem)) return false;
		nestFocusIntoItemPlayerIfPresent(firstItem);
		return true;
	}

	type ItemPlayerWithFocusFirst = HTMLElement & { focusFirst?: () => boolean };

	/** After focusing an item card, move into `pie-item-player` when it exposes `focusFirst()`. */
	function nestFocusIntoItemPlayerIfPresent(itemCard: HTMLElement | null | undefined): void {
		if (!itemCard) return;
		const player = itemCard.querySelector(
			"pie-item-player",
		) as ItemPlayerWithFocusFirst | null;
		if (!player) return;
		const focusFirst = player.focusFirst;
		if (typeof focusFirst !== "function") return;
		void tick().then(() => {
			try {
				focusFirst.call(player);
			} catch {
				// ignore cross-browser focus edge cases
			}
		});
	}

	function focusCurrentItem(): boolean {
		const root = getFocusRoot();
		const target = root.querySelector<HTMLElement>(
			"pie-section-player-item-card[is-current]",
		);
		if (!focusAndReveal(target)) return false;
		nestFocusIntoItemPlayerIfPresent(target);
		return true;
	}

	function subscribeNavigationStatus(controller: SectionControllerHandle | null): void {
		unsubscribeNavigationStatus?.();
		unsubscribeNavigationStatus = null;
		if (!controller?.subscribe) return;
		unsubscribeNavigationStatus = controller.subscribe((event: any) => {
			if (event?.type !== "item-selected") return;
			navigationStatusMessage = buildStatusMessage(event);
			const strategy = resolveAutoFocusStrategy(focusPolicy);
			if (strategy === "none") return;
			// Defer the focus move until the next `composition-changed` event
			// so we query after Svelte has flushed the new `[is-current]`
			// attribute reflection onto the item card in the DOM.
			pendingNavigationFocus = strategy;
		});
	}

	onDestroy(() => {
		unsubscribeNavigationStatus?.();
	});

	let baseElement = $state<{
		navigateToItem?: (index: number) => unknown;
		getCompositionModelSnapshot?: () => unknown;
		getSectionController?: () => SectionControllerHandle | null;
		waitForSectionController?: (
			timeoutMs?: number,
		) => Promise<SectionControllerHandle | null>;
		getNavigationStateSnapshot?: () => {
			currentIndex: number;
			totalItems: number;
			canNext: boolean;
			canPrevious: boolean;
			currentItemId?: string;
		};
	} | null>(null);
	let cardContextProvider = $state<{
		setValue: (value: SectionPlayerCardRenderContext) => void;
		disconnect: () => void;
	} | null>(null);
	const host = $derived.by(() => getHostElementFromAnchor(cardContextAnchor));
	const normalizedShowToolbar = $derived(coerceBooleanLike(showToolbar, false));

	function handleCompositionChanged(event: Event) {
		onCompositionChanged?.(event);
		const pending = pendingNavigationFocus;
		if (pending) {
			pendingNavigationFocus = null;
			// Svelte still needs one more flush to propagate the new
			// composition down to SectionItemsPane and reflect `is-current`.
			void tick().then(() => {
				if (pending === "start-of-content") {
					focusStartOfContent();
				} else if (pending === "current-item") {
					focusCurrentItem();
				}
			});
		}
	}

	function handleSectionReady(event: Event) {
		onSectionReady?.(event);
	}

	function handleFrameworkError(event: Event) {
		onFrameworkErrorEvent?.(event);
	}

	function handleSessionChanged(event: Event) {
		onSessionChanged?.(event);
	}

	function handleRuntimeOwned(event: Event) {
		onRuntimeOwned?.(event);
	}

	function handleRuntimeInherited(event: Event) {
		onRuntimeInherited?.(event);
	}

	function handleToolkitReady(event: Event) {
		onToolkitReady?.(event);
		// Subscribe for navigation announcements as soon as the controller is available.
		const controller = baseElement?.getSectionController?.() ?? null;
		subscribeNavigationStatus(controller);
	}

	export function navigateToItem(index: number): boolean {
		if (typeof index !== "number" || !Number.isFinite(index)) return false;
		if (!baseElement?.navigateToItem) return false;
		const before = getNavigationStateSnapshot();
		const result = baseElement.navigateToItem(index);
		const after = getNavigationStateSnapshot();
		if (after.currentIndex !== before.currentIndex) return true;
		return result !== null && result !== undefined && result !== false;
	}

	export function getCompositionModelSnapshot(): unknown {
		return baseElement?.getCompositionModelSnapshot?.() ?? null;
	}

	export function getNavigationStateSnapshot(): {
		currentIndex: number;
		totalItems: number;
		canNext: boolean;
		canPrevious: boolean;
		currentItemId?: string;
	} {
		return (
			baseElement?.getNavigationStateSnapshot?.() || {
				currentIndex: 0,
				totalItems: 0,
				canNext: false,
				canPrevious: false,
			}
		);
	}

	export function getSectionController(): SectionControllerHandle | null {
		return baseElement?.getSectionController?.() ?? null;
	}

	export async function waitForSectionController(
		timeoutMs = 5000,
	): Promise<SectionControllerHandle | null> {
		if (!baseElement?.waitForSectionController) return null;
		return baseElement.waitForSectionController(timeoutMs);
	}

	/**
	 * Host-triggered focus escape hatch for moments the framework cannot observe
	 * (Skip-to-Main). Honors `SectionPlayerFocusPolicy.autoFocus`:
	 * - `"current-item"` → focuses the item card currently marked `is-current`
	 *   (falls back to start-of-content if no current item is resolvable).
	 * - `"start-of-content"` / `"none"` → focuses the passage card when
	 *   present, else the first item card.
	 *
	 * Hosts reach for `focusStart()` specifically when they *want* focus to
	 * move (a Skip-to-Main button only exists for that reason), so `"none"`
	 * is treated as "default to start-of-content" rather than "do nothing".
	 */
	export function focusStart(): boolean {
		const strategy = resolveAutoFocusStrategy(focusPolicy);
		if (strategy === "current-item") {
			return focusCurrentItem() || focusStartOfContent();
		}
		return focusStartOfContent();
	}

	$effect(() => {
		if (!host || !cardRenderContext) return;
		cardContextProvider = createSectionPlayerCardRenderContextProvider(
			host,
			cardRenderContext,
		);
		return () => {
			cardContextProvider?.disconnect();
			cardContextProvider = null;
		};
	});

	$effect(() => {
		if (!cardRenderContext) return;
		cardContextProvider?.setValue(cardRenderContext);
	});
</script>

<div bind:this={cardContextAnchor} class="pie-section-player-layout-scaffold-anchor" aria-hidden="true"></div>
<div
	class="pie-section-player-nav-status"
	role="alert"
	aria-live="assertive"
	aria-atomic="true"
>{navigationStatusMessage}</div>
<pie-section-player-base
	bind:this={baseElement}
	{runtime}
	{section}
	section-id={sectionId}
	attempt-id={attemptId}
	{toolRegistry}
	oncomposition-changed={handleCompositionChanged}
	onsection-ready={handleSectionReady}
	onframework-error={handleFrameworkError}
	onsession-changed={handleSessionChanged}
	onruntime-owned={handleRuntimeOwned}
	onruntime-inherited={handleRuntimeInherited}
	ontoolkit-ready={handleToolkitReady}
>
	<pie-section-player-shell
		show-toolbar={normalizedShowToolbar}
		toolbar-position={toolbarPosition}
		enabled-tools={enabledTools}
		{toolRegistry}
		{sectionHostButtons}
	>
		<slot></slot>
	</pie-section-player-shell>
</pie-section-player-base>

<style>
	.pie-section-player-layout-scaffold-anchor {
		display: none;
	}

	/* Visually hidden but available to screen readers (WCAG 4.1.3). */
	.pie-section-player-nav-status {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
