<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { strategyElementVersions } from '@pie-players/demo-ui/element-versions';
	import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import { applyOverridesToSection } from '#lib/content/apply-overrides.js';
	import { createSectionDemoToolRegistry } from '#lib/demo-runtime/default-tool-registry.js';
	import {
		DEMO_ASSESSMENT_ID,
		getUrlEnumParam,
		PLAYER_OPTIONS
	} from '#lib/demo-runtime/demo-page-helpers.js';
	import { withDemoLoaderOptions } from '#lib/demo-runtime/demo-player-config.js';
	import type { PageData } from './$types';

	/**
	 * A host with its own section navigation, in the order such a host runs it:
	 * its current item moves to the target, the new section goes onto the same
	 * player element, and the previous section's controller is persisted.
	 * Everything the host hears is appended to `window.__hostLog`.
	 */
	type HostLogEntry = {
		channel: string;
		itemId?: string;
		canonicalItemId?: string;
		sectionId?: string;
		complete?: unknown;
		reason?: unknown;
		response?: string;
		at: number;
	};
	type SectionControllerLike = {
		persist?: () => Promise<void>;
		subscribe?: (listener: (event: Record<string, unknown>) => void) => () => void;
	};
	type SectionPlayerElement = HTMLElement & { section?: unknown };
	const SWAP_ORDER_OPTIONS = ['section-id-first', 'section-first'] as const;

	let { data }: { data: PageData } = $props();

	const playerType = getUrlEnumParam('player', PLAYER_OPTIONS, 'iife');
	// Which of `section-id` and `section` the host sets first. Angular applies
	// property bindings before attribute bindings, so `[section]` with
	// `[attr.section-id]` lands as `section` first.
	const swapOrder = getUrlEnumParam('order', SWAP_ORDER_OPTIONS, 'section-id-first');
	const versions = strategyElementVersions(playerType);
	// The page swaps sections itself, so it reads the route data once.
	const sections = untrack(() =>
		data.demoPages.map((page) => applyOverridesToSection(page.section, versions))
	);
	const toolRegistry = createSectionDemoToolRegistry();
	const coordinator = new ToolkitCoordinator({ assessmentId: DEMO_ASSESSMENT_ID, toolRegistry });
	const runtime = {
		assessmentId: DEMO_ASSESSMENT_ID,
		playerType,
		lazyInit: true,
		player: withDemoLoaderOptions({}),
		env: { mode: 'gather', role: 'student' },
		coordinator
	};

	const hostLog: HostLogEntry[] = [];
	let sectionIndex = $state(0);
	let currentItemId = $state(firstItemId(0));
	let playerElement = $state<SectionPlayerElement | null>(null);
	const subscribedSections = new Set<string>();

	function sectionIdAt(index: number): string {
		return String((sections[index] as { identifier?: string }).identifier ?? '');
	}

	function firstItemId(index: number): string {
		const refs = (sections[index] as { assessmentItemRefs?: Array<{ item?: { id?: string } }> })
			.assessmentItemRefs;
		return refs?.[0]?.item?.id ?? '';
	}

	function responseOf(session: unknown): string | undefined {
		const data = (session as { data?: Array<{ value?: unknown }> } | null)?.data;
		const value = data?.find((entry) => typeof entry?.value === 'string')?.value;
		return typeof value === 'string' ? value : undefined;
	}

	function record(channel: string, detail: Record<string, unknown> = {}) {
		hostLog.push({
			channel,
			itemId: (detail.itemId as string | undefined) ?? undefined,
			canonicalItemId: (detail.canonicalItemId as string | undefined) ?? undefined,
			sectionId: (detail.sectionId as string | undefined) ?? undefined,
			complete: detail.complete,
			reason: detail.sessionCommitReason ?? null,
			response: responseOf(detail.session),
			at: performance.now()
		});
	}

	async function waitForController(sectionId: string): Promise<SectionControllerLike | null> {
		for (let attempt = 0; attempt < 200; attempt += 1) {
			const controller = coordinator.getSectionController({ sectionId }) as
				| SectionControllerLike
				| undefined;
			if (controller) return controller;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		return null;
	}

	async function subscribeToController(sectionId: string) {
		if (subscribedSections.has(sectionId)) return;
		subscribedSections.add(sectionId);
		const controller = await waitForController(sectionId);
		const firstSubscription = subscribedSections.size === 1;
		controller?.subscribe?.((event) => {
			if (event.type === 'item-session-data-changed' || event.type === 'item-session-meta-changed') {
				record(`controller:${String(event.type)}`, { ...event, sectionId });
			}
		});
		if (firstSubscription) {
			// Where a host with its own navigation listens: the active section's events.
			coordinator.subscribeItemEvents({
				eventTypes: ['item-session-data-changed'],
				listener: (event: unknown) =>
					record('coordinator:item-session-data-changed', event as Record<string, unknown>)
			});
		}
	}

	function navigate(delta: number) {
		const target = sectionIndex + delta;
		if (target < 0 || target >= sections.length || !playerElement) return;
		const previousSectionId = sectionIdAt(sectionIndex);
		currentItemId = firstItemId(target);
		record('host:current-item', { itemId: currentItemId });
		sectionIndex = target;
		record('host:section-input', { sectionId: sectionIdAt(target) });
		if (swapOrder === 'section-first') {
			playerElement.section = sections[target];
			playerElement.setAttribute('section-id', sectionIdAt(target));
		} else {
			playerElement.setAttribute('section-id', sectionIdAt(target));
			playerElement.section = sections[target];
		}
		const previous = coordinator.getSectionController({ sectionId: previousSectionId });
		record('host:persist', { sectionId: previousSectionId });
		void previous?.persist?.();
		void subscribeToController(sectionIdAt(target));
	}

	onMount(() => {
		(window as unknown as { __hostLog: HostLogEntry[] }).__hostLog = hostLog;
		const onDocumentEvent = (event: Event) => {
			if (!playerElement || !event.composedPath().includes(playerElement)) return;
			record(`document:${event.type}`, ((event as CustomEvent).detail ?? {}) as Record<string, unknown>);
		};
		document.addEventListener('session-changed', onDocumentEvent);
		document.addEventListener('item-session-changed', onDocumentEvent);
		void subscribeToController(sectionIdAt(0));
		return () => {
			document.removeEventListener('session-changed', onDocumentEvent);
			document.removeEventListener('item-session-changed', onDocumentEvent);
		};
	});
</script>

<div class="host">
	<pie-section-player-splitpane
		bind:this={playerElement}
		section-id={sectionIdAt(0)}
		{runtime}
		section={sections[0]}
		{toolRegistry}
		show-toolbar="false"
	></pie-section-player-splitpane>
	<nav class="host-nav" aria-label="Host section navigation">
		<button type="button" id="host-previous-section" onclick={() => navigate(-1)}>
			Previous section
		</button>
		<span data-testid="host-current-item">{currentItemId}</span>
		<button type="button" id="host-next-section" onclick={() => navigate(1)}>
			Next section
		</button>
	</nav>
</div>

<style>
	.host {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.host-nav {
		order: -1;
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 0.5rem 1rem;
	}
	.host :global(pie-section-player-splitpane) {
		display: flex;
		flex: 1;
		min-height: 0;
	}
</style>
