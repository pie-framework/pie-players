<svelte:options
	customElement={{
		tag: 'pie-section-player-tools-session-debugger',
		shadow: 'none',
		props: {
			sectionId: { type: 'String', attribute: 'section-id' },
			attemptId: { type: 'String', attribute: 'attempt-id' },
			toolkitCoordinator: { type: 'Object', attribute: 'toolkit-coordinator' }
		}
	}}
/>

<script lang="ts">
	import { SharedFloatingPanel } from "@pie-players/pie-section-player-tools-shared";
	import {
		getSectionControllerFromCoordinator,
		isMatchingSectionControllerLifecycleEvent
	} from '@pie-players/pie-section-player-tools-shared';
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher<{ close: undefined }>();


	type SessionPanelSnapshot = {
		currentItemIndex: number | null;
		currentItemId: string | null;
		visitedItemIdentifiers: string[];
		loadingComplete: boolean;
		totalRegistered: number;
		totalLoaded: number;
		itemsComplete: boolean;
		completedCount: number;
		totalItems: number;
		updatedAt: number | null;
		lastChangedItemId: string | null;
		itemSessions: Record<string, unknown>;
	};

	type SectionAttemptSliceLike = {
		currentItemIndex?: number;
		currentItemId?: string;
		visitedItemIdentifiers?: string[];
		itemSessions?: Record<string, unknown>;
		loadingComplete?: boolean;
		totalRegistered?: number;
		totalLoaded?: number;
		itemsComplete?: boolean;
		completedCount?: number;
		totalItems?: number;
	};

	type SectionSessionStateLike = {
		itemSessions?: Record<string, unknown>;
	};

	type SectionControllerLike = {
		getRuntimeState?: () => SectionAttemptSliceLike | null;
		getSession?: () => SectionSessionStateLike | null;
		subscribe?: (listener: (event: { itemId?: string; timestamp?: number }) => void) => () => void;
	};

	type ToolkitCoordinatorLike = {
		getSectionController?: (args: { sectionId: string; attemptId?: string }) => SectionControllerLike | undefined;
		// Phase D (>=0.3.35): subscribe* helpers follow the toolkit's
		// active section cohort automatically and do not accept
		// sectionId / attemptId arguments. The session panel keeps
		// `sectionId` + `attemptId` in `subscriptionTarget` purely to
		// gate same-target re-subscribe and to drive `getSectionController`.
		subscribeItemEvents?: (args: {
			listener: (event: { itemId?: string; timestamp?: number }) => void;
		}) => () => void;
		subscribeSectionLifecycleEvents?: (args: {
			listener: (event: { itemId?: string; timestamp?: number }) => void;
		}) => () => void;
	onSectionControllerLifecycle?: (
		listener: (event: { type: 'ready' | 'disposed'; key?: { sectionId?: string; attemptId?: string } }) => void
	) => () => void;
	};

	let {
		toolkitCoordinator = null,
		sectionId = '',
		attemptId = undefined
	}: {
		toolkitCoordinator?: ToolkitCoordinatorLike | null;
		sectionId: string;
		attemptId?: string;
	} = $props();

	let sessionPanelSnapshot = $state<SessionPanelSnapshot>({
		currentItemIndex: null,
		currentItemId: null,
		visitedItemIdentifiers: [],
		loadingComplete: false,
		totalRegistered: 0,
		totalLoaded: 0,
		itemsComplete: false,
		completedCount: 0,
		totalItems: 0,
		updatedAt: null,
		lastChangedItemId: null,
		itemSessions: {}
	});
	let unsubscribeController: (() => void) | null = null;
	let unsubscribeLifecycle: (() => void) | null = null;
	let controllerAvailable = $state(false);
	let resubscribeQueued = false;
	const subscriptionTarget: {
		controller: SectionControllerLike | null;
		sectionId: string;
		attemptId?: string;
	} = {
		controller: null,
		sectionId: '',
		attemptId: undefined
	};

	function cloneSessionSnapshot<T>(value: T): T {
		try {
			return structuredClone(value);
		} catch {
			try {
				return JSON.parse(JSON.stringify(value)) as T;
			} catch {
				// Keep debugger resilient if a session payload contains non-serializable values.
				return value;
			}
		}
	}

	function getController(): SectionControllerLike | undefined {
		return (
			getSectionControllerFromCoordinator(
				toolkitCoordinator,
				sectionId,
				attemptId
			) || undefined
		);
	}

	function refreshFromController(
		meta?: { itemId?: string; updatedAt?: number },
		controllerOverride?: SectionControllerLike | null
	) {
		const controller = controllerOverride || getController();
		const sectionSlice = controller?.getRuntimeState?.() || null;
		const persistedSlice = controller?.getSession?.() || null;
		controllerAvailable = Boolean(controller);
		sessionPanelSnapshot = {
			currentItemIndex:
				typeof sectionSlice?.currentItemIndex === 'number' && sectionSlice.currentItemIndex >= 0
					? sectionSlice.currentItemIndex
					: null,
			currentItemId:
				typeof sectionSlice?.currentItemId === 'string' && sectionSlice.currentItemId
					? sectionSlice.currentItemId
					: null,
			visitedItemIdentifiers: cloneSessionSnapshot(sectionSlice?.visitedItemIdentifiers || []),
			loadingComplete: sectionSlice?.loadingComplete === true,
			totalRegistered: typeof sectionSlice?.totalRegistered === 'number' ? sectionSlice.totalRegistered : 0,
			totalLoaded: typeof sectionSlice?.totalLoaded === 'number' ? sectionSlice.totalLoaded : 0,
			itemsComplete: sectionSlice?.itemsComplete === true,
			completedCount: typeof sectionSlice?.completedCount === 'number' ? sectionSlice.completedCount : 0,
			totalItems: typeof sectionSlice?.totalItems === 'number' ? sectionSlice.totalItems : 0,
			updatedAt: meta?.updatedAt || Date.now(),
			lastChangedItemId: meta?.itemId || null,
			itemSessions: cloneSessionSnapshot(
				sectionSlice?.itemSessions || persistedSlice?.itemSessions || {}
			)
		};
	}

	function detachControllerSubscription() {
		unsubscribeController?.();
		unsubscribeController = null;
		subscriptionTarget.controller = null;
		subscriptionTarget.sectionId = '';
		subscriptionTarget.attemptId = undefined;
	}

	function detachLifecycleSubscription() {
		unsubscribeLifecycle?.();
		unsubscribeLifecycle = null;
	}

	function handleControllerEvent(detail: { itemId?: string; timestamp?: number }): void {
		refreshFromController({
			itemId: detail?.itemId,
			updatedAt: detail?.timestamp || Date.now()
		});
	}

	function handleItemControllerEvent(detail: { itemId?: string; timestamp?: number }): void {
		handleControllerEvent(detail);
	}

	function handleSectionControllerEvent(detail: { itemId?: string; timestamp?: number }): void {
		handleControllerEvent(detail);
	}

	function ensureControllerSubscription() {
		const controller = getController() || null;
		if (!controller) {
			detachControllerSubscription();
			controllerAvailable = false;
			sessionPanelSnapshot = {
				currentItemIndex: null,
				currentItemId: null,
				visitedItemIdentifiers: [],
				loadingComplete: false,
				totalRegistered: 0,
				totalLoaded: 0,
				itemsComplete: false,
				completedCount: 0,
				totalItems: 0,
				updatedAt: Date.now(),
				lastChangedItemId: null,
				itemSessions: {}
			};
			return;
		}
		const nextAttemptId = attemptId || undefined;
		const isSameTarget =
			subscriptionTarget.controller === controller &&
			subscriptionTarget.sectionId === sectionId &&
			subscriptionTarget.attemptId === nextAttemptId;
		if (isSameTarget && unsubscribeController) {
			refreshFromController(undefined, controller);
			return;
		}
		detachControllerSubscription();
		const unsubscribeItem = toolkitCoordinator?.subscribeItemEvents?.({
			listener: handleItemControllerEvent
		}) || null;
		const unsubscribeSection = toolkitCoordinator?.subscribeSectionLifecycleEvents?.({
			listener: handleSectionControllerEvent
		}) || null;
		unsubscribeController = () => {
			unsubscribeItem?.();
			unsubscribeSection?.();
		};
		subscriptionTarget.controller = controller;
		subscriptionTarget.sectionId = sectionId;
		subscriptionTarget.attemptId = nextAttemptId;
		refreshFromController(undefined, controller);
	}

	function queueEnsureControllerSubscription(): void {
		if (resubscribeQueued) return;
		resubscribeQueued = true;
		queueMicrotask(() => {
			resubscribeQueued = false;
			ensureControllerSubscription();
		});
	}

	$effect(() => {
		if (!toolkitCoordinator || !sectionId) return;
		ensureControllerSubscription();
		detachLifecycleSubscription();
		unsubscribeLifecycle = toolkitCoordinator.onSectionControllerLifecycle?.((event) => {
			if (!isMatchingSectionControllerLifecycleEvent(event, sectionId, attemptId)) return;
			queueEnsureControllerSubscription();
			refreshFromController({
				updatedAt: Date.now()
			});
		}) || null;
		return () => {
			detachControllerSubscription();
			detachLifecycleSubscription();
		};
	});

</script>

<SharedFloatingPanel
	title="Session Data"
	ariaLabel="Drag session panel"
	minWidth={340}
	minHeight={260}
	initialSizing={{
		widthRatio: 0.29,
		heightRatio: 0.72,
		minWidth: 280,
		maxWidth: 560,
		minHeight: 360,
		maxHeight: 860,
		alignX: 'left',
		alignY: 'center',
		paddingX: 16,
		paddingY: 16
	}}
	className="pie-section-player-tools-session-debugger"
	bodyClass="pie-section-player-tools-session-debugger__content-shell"
	onClose={() => dispatch('close')}
>
	<svelte:fragment slot="icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="pie-section-player-tools-session-debugger__icon-sm"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
	</svelte:fragment>

	<div class="pie-section-player-tools-session-debugger__content">
		<div class="pie-section-player-tools-session-debugger__section-intro">
			<div class="pie-section-player-tools-session-debugger__heading">PIE Session Data (Persistent)</div>
		</div>

		{#if !controllerAvailable}
			<div class="pie-section-player-tools-session-debugger__alert pie-section-player-tools-session-debugger__alert--warning">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="pie-section-player-tools-session-debugger__icon-md"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
				</svg>
				<span class="pie-section-player-tools-session-debugger__text-xs">Section controller not available for this section yet.</span>
			</div>
		{:else}
			{#if Object.keys(sessionPanelSnapshot.itemSessions || {}).length === 0}
				<div class="pie-section-player-tools-session-debugger__alert pie-section-player-tools-session-debugger__alert--info">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="pie-section-player-tools-session-debugger__icon-md"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="pie-section-player-tools-session-debugger__text-xs">No section session data yet. Interact with the questions to see updates.</span>
				</div>
			{/if}
			<div class="pie-section-player-tools-session-debugger__card">
				<div class="pie-section-player-tools-session-debugger__card-title">
					Item Sessions Snapshot
				</div>
				<div
					class="pie-section-player-tools-session-debugger__card-region"
					role="textbox"
					aria-readonly="true"
					tabindex="0"
					aria-label="Section session snapshot JSON"
				>
					<pre class="pie-section-player-tools-session-debugger__card-pre">{JSON.stringify(sessionPanelSnapshot, null, 2)}</pre>
				</div>
			</div>
		{/if}
	</div>
</SharedFloatingPanel>

<style>
	/* Panel chrome, cards, and alerts, moved here from
	 * @pie-players/pie-theme/components.css. That stylesheet is for authored-content
	 * classes no component owns; these are private to this panel.
	 *
	 * :global() on the first two is required, not decorative. They are applied by
	 * SharedFloatingPanel rather than by this template -- `className` lands on its
	 * root element and `bodyClass` on its body element -- so Svelte would scope the
	 * selectors to this component and they would match nothing. The rest sit on
	 * elements in this file's markup and scope normally.
	 *
	 * `__card` and `__card-pre` fold in what were separate session-specific override
	 * rules in components.css, since there is no longer a shared base to override.
	 */
	:global(.pie-section-player-tools-session-debugger) {
		position: fixed;
		z-index: 100;
		overflow: hidden;
		background: var(--pie-white, #fff);
		border-radius: 0.5rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		border: 2px solid var(--pie-border-light, #d1d5db);
		color: var(--pie-text, #111827);
	}

	:global(.pie-section-player-tools-session-debugger__content-shell) {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.pie-section-player-tools-session-debugger__content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
		min-height: 0;
	}

	.pie-section-player-tools-session-debugger__card {
		background: var(--pie-secondary-background, #f3f4f6);
		border-radius: 0.375rem;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.pie-section-player-tools-session-debugger__card-title {
		font-size: 0.75rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.pie-section-player-tools-session-debugger__card-pre {
		background: var(--pie-background-dark, #e5e7eb);
		padding: 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		margin: 0;
		overflow: auto;
		flex: 1;
		min-height: 0;
	}

	.pie-section-player-tools-session-debugger__section-intro {
		margin-bottom: 0.25rem;
	}

	.pie-section-player-tools-session-debugger__heading {
		font-size: 0.875rem;
		font-weight: 700;
	}

	.pie-section-player-tools-session-debugger__text-xs {
		font-size: 0.75rem;
	}

	.pie-section-player-tools-session-debugger__alert {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid transparent;
	}

	.pie-section-player-tools-session-debugger__alert--warning {
		background: #fef3c7;
		border-color: #f59e0b;
		color: #92400e;
	}

	.pie-section-player-tools-session-debugger__alert--info {
		background: #e0f2fe;
		border-color: #38bdf8;
		color: #0c4a6e;
	}

	.pie-section-player-tools-session-debugger__icon-md {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.pie-section-player-tools-session-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-section-player-tools-session-debugger__card-region:focus-visible {
		outline: 2px solid var(--color-primary, #2563eb);
		outline-offset: 2px;
		border-radius: 0.5rem;
	}

</style>
