<script lang="ts">
	import { onMount } from 'svelte';
	import { preloadDemoElements } from '@pie-players/demo-ui/preloaded';
	import '@pie-players/pie-item-player';
	import {
		factGridItem,
		factItem,
		installedVersion,
		MATH_INLINE_PACKAGE,
		MATH_TEMPLATED_PACKAGE
	} from '#lib/perf/math-facts.js';
	import { whenFieldsInteractive } from '#lib/perf/readiness.js';
	import { getUrlEnumParam } from '#lib/demo-runtime/demo-page-helpers.js';
	import { withDemoLoaderOptions } from '#lib/demo-runtime/demo-player-config.js';

	/**
	 * A page of facts in one grid:
	 *
	 * - `shape=items`: one `math-inline` item per fact, each in its own
	 *   `<pie-item-player>`.
	 * - `shape=templated`: one `math-templated` item with a response area per
	 *   fact, in one `<pie-item-player>`.
	 *
	 * `?player=esm|preloaded` picks the loading strategy and `?count=` the
	 * number of facts (24). The delivery-cost harness reads `window.__perf`.
	 */
	const SHAPES = ['items', 'templated'] as const;
	const STRATEGIES = ['esm', 'preloaded'] as const;

	const params = new URL(window.location.href).searchParams;
	const shape = getUrlEnumParam('shape', SHAPES, 'items');
	const playerType = getUrlEnumParam('player', STRATEGIES, 'esm');
	const count = Number(params.get('count') ?? '24');
	const packageName = shape === 'items' ? MATH_INLINE_PACKAGE : MATH_TEMPLATED_PACKAGE;
	const version = installedVersion(packageName);
	const configs =
		shape === 'items'
			? Array.from({ length: count }, (_, n) => factItem(n, version))
			: [factGridItem(count, version)];
	const loaderOptions = withDemoLoaderOptions<{ loaderOptions?: Record<string, unknown> }>({}).loaderOptions;

	type ItemPlayerElement = HTMLElement & {
		config?: unknown;
		env?: unknown;
		session?: unknown;
		loaderOptions?: unknown;
	};

	let grid: HTMLElement;

	function mountPlayers(): void {
		for (const config of configs) {
			const player = document.createElement('pie-item-player') as ItemPlayerElement;
			player.setAttribute('strategy', playerType);
			if (loaderOptions) player.loaderOptions = loaderOptions;
			player.env = { mode: 'gather', role: 'student' };
			player.session = { id: `${config.id}-session`, data: [] };
			player.config = config;
			grid.append(player);
		}
	}

	onMount(() => {
		const registered =
			playerType === 'preloaded'
				? preloadDemoElements([configs[0].elements as Record<string, string>])
				: Promise.resolve();
		const interactive = registered.then(() => {
			mountPlayers();
			return whenFieldsInteractive(grid, count);
		});
		const firstInteractive = registered.then(() => whenFieldsInteractive(grid, 1));
		(window as unknown as { __perf: unknown }).__perf = {
			shape,
			playerType,
			version: `${packageName}@${version}`,
			count,
			interactive,
			firstInteractive,
			teardown: () => grid.replaceChildren()
		};
	});
</script>

<main class="perf-grid" class:perf-grid-items={shape === 'items'} bind:this={grid} aria-label="Fact grid"></main>

<style>
	.perf-grid {
		padding: 0.5rem;
	}
	.perf-grid-items {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		gap: 0.25rem;
	}
</style>
