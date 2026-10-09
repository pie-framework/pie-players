<script lang="ts">
	import "../section-player-base-element.js";
	import "../section-player-shell-element.js";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import type {
		AssessmentSection,
		SectionControllerSessionState,
	} from "@pie-players/pie-players-shared/types";
	import {
		createSectionPlayerCardRenderContextProvider,
		type SectionPlayerCardRenderContext,
	} from "./section-player-card-context.js";
	import { getHostElementFromAnchor } from "./host-element.js";
	import {
		createSectionPlayerLayoutContextProvider,
		type SectionPlayerLayoutContext,
	} from "./section-player-layout-context.js";
	import type {
		SectionControllerHandle,
		ToolkitCoordinatorApi,
	} from "@pie-players/pie-assessment-toolkit";
	import { coerceBooleanLike } from "@pie-players/pie-players-shared";
	import { onDestroy, untrack } from "svelte";

	let {
		runtime = null as Record<string, unknown> | null,
		section = null as AssessmentSection | null,
		session = null as SectionControllerSessionState | null,
		sectionId = "",
		attemptId = "",
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
		cardRenderContext = null as SectionPlayerCardRenderContext | null,
		layoutContext = null as SectionPlayerLayoutContext | null,
		onCompositionChanged,
		onSectionReady,
		onFrameworkErrorEvent,
		onToolkitReady,
	} = $props<{
		runtime?: Record<string, unknown> | null;
		section?: AssessmentSection | null;
		session?: SectionControllerSessionState | null;
		sectionId?: string;
		attemptId?: string;
		showToolbar?: boolean | string | null | undefined;
		toolbarPosition?: string;
		enabledTools?: string;
		toolRegistry?: ToolRegistry | null;
		sectionHostButtons?: ToolbarItem[];
		cardRenderContext?: SectionPlayerCardRenderContext | null;
		layoutContext?: SectionPlayerLayoutContext | null;
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
		onToolkitReady?: (event: Event) => void;
	}>();
	let cardContextAnchor = $state<HTMLDivElement | null>(null);
	let navigationStatusMessage = $state("");
	let unsubscribeNavigationStatus: (() => void) | null = null;
	let navigationStatusCoordinator: ToolkitCoordinatorApi | null = null;

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

	// One subscription per coordinator: it follows the active section across
	// navigation, as a host's does.
	function subscribeNavigationStatus(coordinator: ToolkitCoordinatorApi | null): void {
		if (!coordinator || coordinator === navigationStatusCoordinator) return;
		unsubscribeNavigationStatus?.();
		navigationStatusCoordinator = coordinator;
		unsubscribeNavigationStatus = coordinator.subscribeSectionEvents({
			eventTypes: ["item-selected"],
			listener: (event: any) => {
				navigationStatusMessage = buildStatusMessage(event);
			},
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
	let cardContextProvider: {
		setValue: (value: SectionPlayerCardRenderContext) => void;
		disconnect: () => void;
	} | null = null;
	let layoutContextProvider: {
		setValue: (value: SectionPlayerLayoutContext) => void;
		disconnect: () => void;
	} | null = null;
	const host = $derived.by(() => getHostElementFromAnchor(cardContextAnchor));
	const normalizedShowToolbar = $derived(coerceBooleanLike(showToolbar, false));

	function handleCompositionChanged(event: Event) {
		onCompositionChanged?.(event);
	}

	// The base's own toolkit renders in the base's shadow root. A ready event
	// from any other toolkit, such as one nested in the layout's content, is not
	// this section's.
	function isOwnToolkitEvent(event: Event): boolean {
		const origin = event.composedPath()[0] as Node | undefined;
		const base = event.currentTarget as Element | null;
		return Boolean(base?.shadowRoot) && origin?.getRootNode?.() === base?.shadowRoot;
	}

	function handleSectionReady(event: Event) {
		if (!isOwnToolkitEvent(event)) return;
		onSectionReady?.(event);
	}

	function handleFrameworkError(event: Event) {
		onFrameworkErrorEvent?.(event);
	}

	function handleToolkitReady(event: Event) {
		if (!isOwnToolkitEvent(event)) return;
		onToolkitReady?.(event);
		subscribeNavigationStatus(
			(event as CustomEvent<{ coordinator?: ToolkitCoordinatorApi }>).detail
				?.coordinator ?? null,
		);
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

	// One provider of each context for the host's lifetime, created with the
	// first value and republished with `setValue` after that: a card or pane
	// keeps the provider that answered it, so a replaced one would leave it
	// relying on the announce.
	$effect(() => {
		if (!host) return;
		return () => {
			cardContextProvider?.disconnect();
			cardContextProvider = null;
			layoutContextProvider?.disconnect();
			layoutContextProvider = null;
		};
	});

	$effect(() => {
		const currentHost = host;
		const value = cardRenderContext;
		if (!currentHost || !value) return;
		untrack(() => {
			if (cardContextProvider) {
				cardContextProvider.setValue(value);
				return;
			}
			cardContextProvider = createSectionPlayerCardRenderContextProvider(
				currentHost,
				value,
			);
		});
	});

	$effect(() => {
		const currentHost = host;
		const value = layoutContext;
		if (!currentHost || !value) return;
		untrack(() => {
			if (layoutContextProvider) {
				layoutContextProvider.setValue(value);
				return;
			}
			layoutContextProvider = createSectionPlayerLayoutContextProvider(
				currentHost,
				value,
			);
		});
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
	{session}
	section-id={sectionId}
	attempt-id={attemptId}
	{toolRegistry}
	oncomposition-changed={handleCompositionChanged}
	onsection-ready={handleSectionReady}
	onframework-error={handleFrameworkError}
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
