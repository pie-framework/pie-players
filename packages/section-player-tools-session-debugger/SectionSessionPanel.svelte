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
	import '@pie-players/pie-theme/components.css';
	import SharedFloatingPanel from '@pie-players/pie-section-player-tools-shared/SharedFloatingPanel.svelte';
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
		subscribeItemEvents?: (args: {
			sectionId: string;
			attemptId?: string;
			listener: (event: { itemId?: string; timestamp?: number }) => void;
		}) => () => void;
		subscribeSectionLifecycleEvents?: (args: {
			sectionId: string;
			attemptId?: string;
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
			sectionId,
			attemptId,
			listener: handleItemControllerEvent
		}) || null;
		const unsubscribeSection = toolkitCoordinator?.subscribeSectionLifecycleEvents?.({
			sectionId,
			attemptId,
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
				<pre class="pie-section-player-tools-session-debugger__card-pre">{JSON.stringify(sessionPanelSnapshot, null, 2)}</pre>
			</div>
		{/if}
	</div>
</SharedFloatingPanel>

<style>
	.pie-section-player-tools-session-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

</style>
