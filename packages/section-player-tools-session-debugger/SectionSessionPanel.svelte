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
	import PanelResizeHandle from '@pie-players/pie-section-player-tools-shared/PanelResizeHandle.svelte';
	import PanelWindowControls from '@pie-players/pie-section-player-tools-shared/PanelWindowControls.svelte';
	import {
		computePanelSizeFromViewport,
		createFloatingPanelPointerController,
		getSectionControllerFromCoordinator,
		isMatchingSectionControllerLifecycleEvent
	} from '@pie-players/pie-section-player-tools-shared';
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';
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

	let isSessionMinimized = $state(false);
	let sessionWindowX = $state(24);
	let sessionWindowY = $state(100);
	let sessionWindowWidth = $state(220);
	let sessionWindowHeight = $state(600);

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
			listener: handleControllerEvent
		}) || null;
		const unsubscribeSection = toolkitCoordinator?.subscribeSectionLifecycleEvents?.({
			sectionId,
			attemptId,
			listener: handleControllerEvent
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

	onMount(() => {
		const initial = computePanelSizeFromViewport(
			{ width: window.innerWidth, height: window.innerHeight },
			{
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
			}
		);
		sessionWindowX = initial.x;
		sessionWindowY = initial.y;
		sessionWindowWidth = initial.width;
		sessionWindowHeight = initial.height;
	});

	const pointerController = createFloatingPanelPointerController({
		getState: () => ({
			x: sessionWindowX,
			y: sessionWindowY,
			width: sessionWindowWidth,
			height: sessionWindowHeight
		}),
		setState: (next) => {
			sessionWindowX = next.x;
			sessionWindowY = next.y;
			sessionWindowWidth = next.width;
			sessionWindowHeight = next.height;
		},
		minWidth: 300,
		minHeight: 200
	});

	$effect(() => {
		return () => {
			pointerController.stop();
		};
	});
</script>

<div
	class="pie-section-player-tools-session-debugger"
	style="left: {sessionWindowX}px; top: {sessionWindowY}px; width: {sessionWindowWidth}px; {isSessionMinimized ? 'height: auto;' : `height: ${sessionWindowHeight}px;`}"
>
	<div
		class="pie-section-player-tools-session-debugger__header"
		onmousedown={(event: MouseEvent) => pointerController.startDrag(event)}
		role="button"
		tabindex="0"
		aria-label="Drag session panel"
	>
		<div class="pie-section-player-tools-session-debugger__header-title">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="pie-section-player-tools-session-debugger__icon-sm"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			<h3 class="pie-section-player-tools-session-debugger__title">Session Data</h3>
		</div>
		<div class="pie-section-player-tools-session-debugger__header-actions">
			<PanelWindowControls
				minimized={isSessionMinimized}
				onToggle={() => (isSessionMinimized = !isSessionMinimized)}
				onClose={() => dispatch('close')}
			/>
		</div>
	</div>

	{#if !isSessionMinimized}
		<div class="pie-section-player-tools-session-debugger__content-shell" style="height: {sessionWindowHeight - 50}px;">
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
		</div>
	{/if}

	{#if !isSessionMinimized}
		<PanelResizeHandle onPointerDown={(event: MouseEvent) => pointerController.startResize(event)} />
	{/if}
</div>

<style>
	.pie-section-player-tools-session-debugger {
		position: fixed;
		z-index: 9999;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #1f2937);
		border: 2px solid var(--color-base-300, #d1d5db);
		border-radius: 8px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		font-family: var(--pie-font-family, Inter, system-ui, sans-serif);
	}

	.pie-section-player-tools-session-debugger__header {
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-base-200, #f3f4f6);
		cursor: move;
		user-select: none;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-section-player-tools-session-debugger__header-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pie-section-player-tools-session-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-section-player-tools-session-debugger__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.pie-section-player-tools-session-debugger__header-actions {
		display: flex;
		gap: 4px;
	}

	.pie-section-player-tools-session-debugger__content-shell {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

</style>
