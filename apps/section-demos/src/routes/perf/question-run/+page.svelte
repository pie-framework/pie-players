<script lang="ts">
	import { onMount } from 'svelte';
	import { preloadDemoElements } from '@pie-players/demo-ui/preloaded';
	import { ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
	import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';
	import { sectionFromItem } from '@pie-players/pie-section-player/item-section';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import {
		fact,
		factItem,
		factResponseId,
		installedVersion,
		MATH_INLINE_PACKAGE
	} from '#lib/perf/math-facts.js';
	import { fieldSelector, whenFieldsInteractive } from '#lib/perf/readiness.js';
	import { getUrlEnumParam } from '#lib/demo-runtime/demo-page-helpers.js';
	import { withDemoLoaderOptions } from '#lib/demo-runtime/demo-player-config.js';

	/**
	 * A run of questions, one `math-inline` item each, delivered as a one-item
	 * section (`sectionFromItem`) in `<pie-section-player-splitpane>`:
	 *
	 * - `shape=remount`: a fresh player per question, every player given the
	 *   host's one coordinator, as the section player integration guide orders it.
	 * - `shape=remount-own`: a fresh player per question with no host
	 *   coordinator and a new attempt id, so each player's toolkit builds and
	 *   disposes its own.
	 * - `shape=replace`: one player for the whole run; the host sets
	 *   `section-id` and `section` per question and persists the section it left.
	 *
	 * `?player=esm|preloaded` picks the loading strategy. The delivery-cost
	 * harness drives the page through `window.__perf`.
	 */
	const SHAPES = ['remount', 'remount-own', 'replace'] as const;
	const STRATEGIES = ['esm', 'preloaded'] as const;
	const ASSESSMENT_ID = 'perf-question-run';

	const params = new URL(window.location.href).searchParams;
	const shape = getUrlEnumParam('shape', SHAPES, 'remount');
	const playerType = getUrlEnumParam('player', STRATEGIES, 'esm');
	const count = Number(params.get('count') ?? '20');
	// `esm` can load a published version the demos do not install.
	const version =
		(playerType === 'esm' && params.get('mathInlineVersion')) ||
		installedVersion(MATH_INLINE_PACKAGE);

	const items = Array.from({ length: count }, (_, n) => factItem(n, version));
	const sections = items.map((item) => sectionFromItem(item).section);
	const toolRegistry = createPackagedToolRegistry();
	const runId = Math.random().toString(36).slice(2);
	const coordinator =
		shape === 'remount-own'
			? null
			: new ToolkitCoordinator({ assessmentId: ASSESSMENT_ID, toolRegistry });
	const runtime = {
		assessmentId: ASSESSMENT_ID,
		playerType,
		lazyInit: true,
		player: withDemoLoaderOptions({}),
		env: { mode: 'gather', role: 'student' },
		...(coordinator ? { coordinator } : {})
	};

	type PlayerElement = HTMLElement & {
		runtime?: unknown;
		section?: unknown;
		toolRegistry?: unknown;
	};

	let host: HTMLElement;
	let player: PlayerElement | null = null;
	let current = -1;
	let sessionChanges = 0;

	function createPlayer(index: number): PlayerElement {
		const element = document.createElement('pie-section-player-splitpane') as PlayerElement;
		element.setAttribute('section-id', sections[index].identifier);
		element.setAttribute('attempt-id', shape === 'remount-own' ? `${runId}-${index}` : runId);
		element.setAttribute('show-toolbar', 'false');
		element.runtime = runtime;
		element.toolRegistry = toolRegistry;
		element.section = sections[index];
		return element;
	}

	/** Shows question `index` and resolves with the time it took to become interactive. */
	async function show(index: number): Promise<{ tti: number; at: number }> {
		const started = performance.now();
		const previous = current;
		current = index;
		if (shape === 'replace' && player) {
			player.setAttribute('section-id', sections[index].identifier);
			player.section = sections[index];
			void coordinator
				?.getSectionController({ sectionId: sections[previous].identifier, attemptId: runId })
				?.persist?.();
		} else {
			player?.remove();
			player = createPlayer(index);
			host.append(player);
		}
		const at = await whenFieldsInteractive(host, 1, `[id="${factResponseId(index)}"]`);
		return { tti: at - started, at };
	}

	/** Removes the player, and disposes the host's coordinator. */
	async function teardown(): Promise<void> {
		player?.remove();
		player = null;
		await new Promise((resolve) => setTimeout(resolve, 500));
		await coordinator?.dispose();
	}

	onMount(() => {
		// Each page load is a fresh attempt: nothing restores from an earlier run.
		window.localStorage.clear();
		const onSessionChanged = () => {
			sessionChanges += 1;
		};
		document.addEventListener('session-changed', onSessionChanged);
		const ready = playerType === 'preloaded'
			? preloadDemoElements([items[0].elements as Record<string, string>])
			: Promise.resolve();
		(window as unknown as { __perf: unknown }).__perf = {
			shape,
			playerType,
			version: `${MATH_INLINE_PACKAGE}@${version}`,
			count,
			ready: ready.then(() => performance.now()),
			show,
			teardown,
			responseSelector: (index: number) => fieldSelector(`[id="${factResponseId(index)}"]`),
			keys: (index: number) => fact(index).keys,
			sessionChanges: () => sessionChanges,
			storageBytes: () =>
				Object.keys(window.localStorage).reduce(
					(total, key) => total + key.length + (window.localStorage.getItem(key)?.length ?? 0),
					0
				)
		};
		return () => document.removeEventListener('session-changed', onSessionChanged);
	});
</script>

<main class="perf-host" bind:this={host} aria-label="Question run"></main>

<style>
	.perf-host {
		display: flex;
		flex-direction: column;
		height: 100vh;
		min-height: 0;
	}
	.perf-host :global(pie-section-player-splitpane) {
		display: flex;
		flex: 1;
		min-height: 0;
	}
</style>
