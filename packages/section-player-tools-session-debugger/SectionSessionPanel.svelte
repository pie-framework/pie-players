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
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';
	const dispatch = createEventDispatcher<{ close: undefined }>();


	type SessionPanelSnapshot = {
		currentItemIndex: number | null;
		currentItemId: string | null;
		visitedItemIdentifiers: string[];
		updatedAt: number | null;
		lastChangedItemId: string | null;
		itemSessions: Record<string, unknown>;
	};

	type SectionAttemptSliceLike = {
		currentItemIndex?: number;
		currentItemId?: string;
		visitedItemIdentifiers?: string[];
		itemSessions?: Record<string, unknown>;
	};

	type SectionControllerLike = {
		getCurrentSectionAttemptSlice?: () => SectionAttemptSliceLike | null;
		subscribe?: (listener: (event: { itemId?: string; timestamp?: number }) => void) => () => void;
	};

	type ToolkitCoordinatorLike = {
		getSectionController?: (args: { sectionId: string; attemptId?: string }) => SectionControllerLike | undefined;
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
	let isSessionDragging = $state(false);
	let isSessionResizing = $state(false);

	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartWindowX = 0;
	let dragStartWindowY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	let sessionPanelSnapshot = $state<SessionPanelSnapshot>({
		currentItemIndex: null,
		currentItemId: null,
		visitedItemIdentifiers: [],
		updatedAt: null,
		lastChangedItemId: null,
		itemSessions: {}
	});
	let activeController = $state<SectionControllerLike | null>(null);
	let unsubscribeController: (() => void) | null = null;
	let unsubscribeLifecycle: (() => void) | null = null;
	let controllerAvailable = $state(false);
	let liveRefreshHandle: number | null = null;

	function cloneSessionSnapshot<T>(value: T): T {
		try {
			return structuredClone(value);
		} catch {
			return JSON.parse(JSON.stringify(value)) as T;
		}
	}

	function getController(): SectionControllerLike | undefined {
		if (!toolkitCoordinator || !sectionId) return undefined;
		return toolkitCoordinator.getSectionController?.({ sectionId, attemptId });
	}

	function refreshFromController(
		meta?: { itemId?: string; updatedAt?: number },
		controllerOverride?: SectionControllerLike | null
	) {
		const controller = controllerOverride || getController();
		const sectionSlice = controller?.getCurrentSectionAttemptSlice?.() || null;
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
			updatedAt: meta?.updatedAt || Date.now(),
			lastChangedItemId: meta?.itemId || null,
			itemSessions: cloneSessionSnapshot(sectionSlice?.itemSessions || {})
		};
	}

	function detachControllerSubscription() {
		unsubscribeController?.();
		unsubscribeController = null;
		activeController = null;
	}

	function detachLifecycleSubscription() {
		unsubscribeLifecycle?.();
		unsubscribeLifecycle = null;
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
				updatedAt: Date.now(),
				lastChangedItemId: null,
				itemSessions: {}
			};
			return;
		}
		if (controller === activeController) return;
		detachControllerSubscription();
		activeController = controller;
		const subscribe = typeof controller.subscribe === 'function' ? controller.subscribe.bind(controller) : null;
		unsubscribeController =
			subscribe?.((detail) => {
				refreshFromController(
					{
						itemId: detail?.itemId,
						updatedAt: detail?.timestamp || Date.now()
					},
					controller
				);
			}) || null;
		refreshFromController(undefined, controller);
	}

	export function refreshFromHost(): void {
		ensureControllerSubscription();
		refreshFromController({
			updatedAt: Date.now()
		});
	}

	$effect(() => {
		if (!toolkitCoordinator || !sectionId) return;
		ensureControllerSubscription();
		detachLifecycleSubscription();
		unsubscribeLifecycle = toolkitCoordinator.onSectionControllerLifecycle?.((event) => {
			const eventSectionId = event?.key?.sectionId || '';
			const eventAttemptId = event?.key?.attemptId || undefined;
			if (eventSectionId !== sectionId) return;
			if ((eventAttemptId || undefined) !== (attemptId || undefined)) return;
			ensureControllerSubscription();
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
		const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		sessionWindowWidth = clamp(Math.round(viewportWidth * 0.29), 280, 560);
		sessionWindowHeight = clamp(Math.round(viewportHeight * 0.72), 360, 860);
		sessionWindowX = Math.max(16, Math.round(viewportWidth * 0.08));
		sessionWindowY = Math.max(16, Math.round((viewportHeight - sessionWindowHeight) / 2));

		const handleRuntimeSessionEvent = () => {
			refreshFromController({
				updatedAt: Date.now()
			});
		};
		document.addEventListener('session-changed', handleRuntimeSessionEvent as EventListener, true);
		document.addEventListener('item-session-changed', handleRuntimeSessionEvent as EventListener, true);
		liveRefreshHandle = window.setInterval(() => {
			refreshFromController({
				updatedAt: Date.now()
			});
		}, 250);
		return () => {
			document.removeEventListener('session-changed', handleRuntimeSessionEvent as EventListener, true);
			document.removeEventListener('item-session-changed', handleRuntimeSessionEvent as EventListener, true);
			if (liveRefreshHandle != null) {
				window.clearInterval(liveRefreshHandle);
				liveRefreshHandle = null;
			}
		};
	});

	function startSessionDrag(e: MouseEvent) {
		isSessionDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartWindowX = sessionWindowX;
		dragStartWindowY = sessionWindowY;

		document.addEventListener('mousemove', onSessionDrag);
		document.addEventListener('mouseup', stopSessionDrag);
	}

	function onSessionDrag(e: MouseEvent) {
		if (!isSessionDragging) return;
		const deltaX = e.clientX - dragStartX;
		const deltaY = e.clientY - dragStartY;
		sessionWindowX = dragStartWindowX + deltaX;
		sessionWindowY = dragStartWindowY + deltaY;
		sessionWindowX = Math.max(0, Math.min(sessionWindowX, window.innerWidth - sessionWindowWidth));
		sessionWindowY = Math.max(0, Math.min(sessionWindowY, window.innerHeight - 100));
	}

	function stopSessionDrag() {
		isSessionDragging = false;
		document.removeEventListener('mousemove', onSessionDrag);
		document.removeEventListener('mouseup', stopSessionDrag);
	}

	function startSessionResize(e: MouseEvent) {
		isSessionResizing = true;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeStartWidth = sessionWindowWidth;
		resizeStartHeight = sessionWindowHeight;
		document.addEventListener('mousemove', onSessionResize);
		document.addEventListener('mouseup', stopSessionResize);
		e.stopPropagation();
	}

	function onSessionResize(e: MouseEvent) {
		if (!isSessionResizing) return;
		const deltaX = e.clientX - resizeStartX;
		const deltaY = e.clientY - resizeStartY;
		sessionWindowWidth = Math.max(300, Math.min(resizeStartWidth + deltaX, window.innerWidth - sessionWindowX));
		sessionWindowHeight = Math.max(
			200,
			Math.min(resizeStartHeight + deltaY, window.innerHeight - sessionWindowY)
		);
	}

	function stopSessionResize() {
		isSessionResizing = false;
		document.removeEventListener('mousemove', onSessionResize);
		document.removeEventListener('mouseup', stopSessionResize);
	}

	$effect(() => {
		return () => {
			stopSessionDrag();
			stopSessionResize();
		};
	});
</script>

<div
	class="fixed z-100 bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
	style="left: {sessionWindowX}px; top: {sessionWindowY}px; width: {sessionWindowWidth}px; {isSessionMinimized ? 'height: auto;' : `height: ${sessionWindowHeight}px;`}"
>
	<div
		class="flex items-center justify-between px-4 py-2 bg-base-200 rounded-t-lg cursor-move select-none border-b border-base-300"
		onmousedown={startSessionDrag}
		role="button"
		tabindex="0"
		aria-label="Drag session panel"
	>
		<div class="flex items-center gap-2">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			<h3 class="font-bold text-sm">Session Data</h3>
		</div>
		<div class="flex gap-1">
			<button
				class="btn btn-xs btn-ghost btn-circle"
				onclick={() => (isSessionMinimized = !isSessionMinimized)}
				title={isSessionMinimized ? 'Maximize' : 'Minimize'}
			>
				{#if isSessionMinimized}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</button>
			<button class="btn btn-xs btn-ghost btn-circle" onclick={() => dispatch('close')} title="Close">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	{#if !isSessionMinimized}
		<div class="p-4 flex flex-col min-h-0 overflow-hidden" style="height: {sessionWindowHeight - 60}px;">
			<div class="space-y-3 flex-1 min-h-0 flex flex-col">
				<div class="mb-2">
					<div class="text-sm font-bold mb-2">PIE Session Data (Persistent)</div>
				</div>

				{#if !controllerAvailable}
					<div class="alert alert-warning">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
						</svg>
						<span class="text-xs">Section controller not available for this section yet.</span>
					</div>
				{:else if Object.keys(sessionPanelSnapshot.itemSessions || {}).length === 0}
					<div class="alert alert-info">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<span class="text-xs">No section session data yet. Interact with the questions to see updates.</span>
					</div>
				{:else}
					<div class="bg-base-200 rounded p-3 flex-1 min-h-0 flex flex-col">
						<div class="text-xs font-semibold mb-2">
							Item Sessions Snapshot
						</div>
						<pre class="bg-base-300 p-2 rounded text-xs overflow-auto flex-1 min-h-0">{JSON.stringify(sessionPanelSnapshot, null, 2)}</pre>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if !isSessionMinimized}
		<div
			class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
			onmousedown={startSessionResize}
			role="button"
			tabindex="0"
			title="Resize window"
		>
			<svg class="w-full h-full text-base-content/30" viewBox="0 0 16 16" fill="currentColor">
				<path d="M16 16V14H14V16H16Z" />
				<path d="M16 11V9H14V11H16Z" />
				<path d="M13 16V14H11V16H13Z" />
			</svg>
		</div>
	{/if}
</div>
