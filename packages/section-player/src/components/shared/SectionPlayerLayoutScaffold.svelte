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
	import { onDestroy } from "svelte";
	import type { SectionPlayerFocusPolicy } from "../../policies/types.js";

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
		focusPolicy = { autoFocusFirstItem: false } as SectionPlayerFocusPolicy,
		cardRenderContext = null as SectionPlayerCardRenderContext | null,
		onCompositionChanged,
		onSectionReady,
		onRuntimeError,
		onFrameworkError,
		frameworkErrorHook: _frameworkErrorHook,
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
		onRuntimeError?: (event: Event) => void;
		onFrameworkError?: (event: Event) => void;
		frameworkErrorHook?: (errorModel: Record<string, unknown>) => void;
		onSessionChanged?: (event: Event) => void;
		onRuntimeOwned?: (event: Event) => void;
		onRuntimeInherited?: (event: Event) => void;
		onToolkitReady?: (event: Event) => void;
	}>();
	let cardContextAnchor = $state<HTMLDivElement | null>(null);
	let navigationStatusMessage = $state("");
	let unsubscribeNavigationStatus: (() => void) | null = null;

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

	function subscribeNavigationStatus(controller: SectionControllerHandle | null): void {
		unsubscribeNavigationStatus?.();
		unsubscribeNavigationStatus = null;
		if (!controller?.subscribe) return;
		unsubscribeNavigationStatus = controller.subscribe((event: any) => {
			if (event?.type !== "item-selected") return;
			navigationStatusMessage = buildStatusMessage(event);
			if (focusPolicy?.autoFocusFirstItem !== true) return;
			queueMicrotask(() => {
				const cards = Array.from(
					document.querySelectorAll<HTMLElement>(
						".pie-section-player-content-card[data-section-item-card]",
					),
				);
				if (!cards.length) return;
				const cardById = cards.find(
					(card) =>
						(event.currentItemId &&
							card.getAttribute("data-canonical-item-id") ===
								String(event.currentItemId)) ||
						(event.currentItemId &&
							card.closest("pie-item-shell")?.getAttribute("canonical-item-id") ===
								String(event.currentItemId)),
				);
				const target = cardById || cards[0];
				target.scrollIntoView({ block: "start", inline: "nearest" });
				target.focus();
			});
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
	}

	function handleSectionReady(event: Event) {
		onSectionReady?.(event);
	}

	function handleRuntimeError(event: Event) {
		onRuntimeError?.(event);
	}

	function handleFrameworkError(event: Event) {
		onFrameworkError?.(event);
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
	onruntime-error={handleRuntimeError}
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
