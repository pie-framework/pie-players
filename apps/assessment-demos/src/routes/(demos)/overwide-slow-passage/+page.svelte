<!--
  Demo: Overwide Slow-Painting Passage

  Reproduces the production failure mode where a PIE element paints rich
  content (images / tables) into its own light DOM client-side, *after* the
  authored markup string has already been sanitized + wrapped. The
  string-based `wrapOverwide{Images,Tables}` skips children of `pie-*`
  elements (the element owns its template), so element-rendered content
  reaches the page unwrapped unless the post-render observer in
  `PieItemPlayer.svelte` catches it.

  Run with `?delay=2500` in the URL to slow the synthetic element further.
  Default delay is 1500ms — long enough that the wrapper's initial pass
  finds nothing, so only the MutationObserver path can land the wraps.

  Inspect the DOM after the delay: every <img> should be wrapped in
  <span class="pie-image-scroll"> and every <table> in
  <div class="pie-table-scroll">. If those wrappers are missing, the fix
  has regressed.
-->
<script lang="ts">
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import "@pie-players/pie-item-player";

	const SYNTHETIC_TAG = "pie-slow-passage";
	const SYNTHETIC_PACKAGE_VERSION = "1.0.0";
	// `makeUniqueTags` (run inside <pie-item-player>) rewrites every authored
	// tag to `<base>--version-<dot-encoded-version>` so the same item can host
	// multiple element versions on one page. We need to register the
	// custom element under that versioned name *and* the bare name so the
	// preloaded-strategy `assertRegistered` check finds it.
	const SYNTHETIC_VERSIONED_TAG = `${SYNTHETIC_TAG}--version-${SYNTHETIC_PACKAGE_VERSION.replace(/\./g, "-")}`;
	const SYNTHETIC_PACKAGE_SPEC = `@pie-demos/slow-passage@${SYNTHETIC_PACKAGE_VERSION}`;
	const DEFAULT_DELAY_MS = 1500;

	const PASSAGE_INNER_HTML = `
		<h2>Slow-painting passage (post-render wrap test)</h2>
		<p>This passage is rendered by a synthetic <code>${SYNTHETIC_TAG}</code> custom element that injects its rich content into its own light DOM after a delay. The authored markup that reaches the sanitizer is just the empty <code>${SYNTHETIC_TAG}</code> tag, so the string-based wrap pass never sees the &lt;img&gt; or &lt;table&gt; below.</p>
		<figure class="passage-figure">
			<img
				src="https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=1792"
				alt="Wide code-on-screens illustration meant to overflow narrow columns and surface a horizontal scroll affordance."
				width="1792"
				height="592"
				style="width: 1792px; height: auto; display: block; max-width: none;"
			/>
			<figcaption>An intentionally wide image painted into the slow passage's light DOM after the page mounted. Width is pinned at 1792px so the wrapper's horizontal scroll affordance is always visible regardless of viewport size.</figcaption>
		</figure>
		<table>
			<caption>Wide demo table painted late by ${SYNTHETIC_TAG}</caption>
			<thead>
				<tr>
					<th scope="col">City</th>
					<th scope="col">Region</th>
					<th scope="col">Population</th>
					<th scope="col">Notable industry</th>
					<th scope="col">Founded</th>
					<th scope="col">Major export</th>
					<th scope="col">University</th>
					<th scope="col">Civic landmark</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>Florence</td><td>Tuscany</td><td>70,000</td><td>Banking, wool textiles</td><td>59 BC</td><td>Wool</td><td>1321</td><td>Cattedrale di Santa Maria del Fiore</td>
				</tr>
				<tr>
					<td>Venice</td><td>Veneto</td><td>100,000</td><td>Maritime trade, glassmaking</td><td>421</td><td>Glass</td><td>1222</td><td>Basilica di San Marco</td>
				</tr>
				<tr>
					<td>Rome</td><td>Lazio</td><td>55,000</td><td>Pilgrimage, papal admin</td><td>753 BC</td><td>—</td><td>1303</td><td>St. Peter's Basilica</td>
				</tr>
			</tbody>
		</table>
	`;

	let fallbackDelayMs = DEFAULT_DELAY_MS;

	class SlowPassage extends HTMLElement {
		connectedCallback() {
			const requestedDelay = Number(this.getAttribute("delay"));
			const effectiveDelay =
				Number.isFinite(requestedDelay) && requestedDelay >= 0
					? requestedDelay
					: fallbackDelayMs;
			// Mirror the prod failure mode: the element first lands in the DOM
			// empty (which is what the string-wrap pass would see), then paints
			// its rich content asynchronously.
			setTimeout(() => {
				this.innerHTML = PASSAGE_INNER_HTML;
			}, effectiveDelay);
		}
	}

	// The custom-elements spec only allows a constructor to be registered under
	// one tag, so the versioned tag gets a thin subclass with the same behavior.
	class SlowPassageVersioned extends SlowPassage {}

	function ensureSlowPassageDefined(delayMs: number) {
		if (!browser) return;
		fallbackDelayMs = delayMs;
		if (!customElements.get(SYNTHETIC_TAG)) {
			customElements.define(SYNTHETIC_TAG, SlowPassage);
		}
		if (!customElements.get(SYNTHETIC_VERSIONED_TAG)) {
			customElements.define(SYNTHETIC_VERSIONED_TAG, SlowPassageVersioned);
		}
	}

	const ITEM_CONFIG = {
		id: "slow-passage-item",
		markup: `<${SYNTHETIC_TAG}></${SYNTHETIC_TAG}>`,
		// `pie-item-player` strategy="preloaded" runs `makeUniqueTags`, which
		// rewrites the authored tag to `<base>--version-<encoded-version>`,
		// then calls `assertRegistered` against the versioned name. We register
		// both the bare and versioned tag in onMount so the assertion passes
		// without going to a CDN.
		elements: {
			[SYNTHETIC_TAG]: SYNTHETIC_PACKAGE_SPEC,
		},
		models: [],
	};

	let delayMs = $state(DEFAULT_DELAY_MS);
	let playerEl = $state<HTMLElement | null>(null);
	let imgScrollCount = $state(0);
	let tableScrollCount = $state(0);
	let elapsed = $state(0);
	let mountedAt = $state(0);

	onMount(() => {
		const url = new URL(window.location.href);
		const requestedDelay = Number(url.searchParams.get("delay"));
		if (Number.isFinite(requestedDelay) && requestedDelay >= 0) {
			delayMs = requestedDelay;
		}
		ensureSlowPassageDefined(delayMs);
		(window as unknown as { PIE_PRELOADED_ELEMENTS?: Record<string, string> }).PIE_PRELOADED_ELEMENTS = {
			"@pie-demos/slow-passage": SYNTHETIC_PACKAGE_SPEC,
		};
		mountedAt = performance.now();

		// Poll the live DOM so the on-page status badge reflects whether the
		// post-render wrap actually ran. Stop once both wrappers are present
		// (or after 30s as a backstop).
		const interval = setInterval(() => {
			const root = playerEl?.querySelector(".pie-item-player") ?? playerEl;
			if (!root) return;
			imgScrollCount = root.querySelectorAll(".pie-image-scroll").length;
			tableScrollCount = root.querySelectorAll(".pie-table-scroll").length;
			elapsed = Math.round(performance.now() - mountedAt);
			if (elapsed > 30_000 || (imgScrollCount > 0 && tableScrollCount > 0)) {
				clearInterval(interval);
			}
		}, 100);

		return () => clearInterval(interval);
	});

	$effect(() => {
		if (!playerEl) return;
		(playerEl as any).config = ITEM_CONFIG;
		(playerEl as any).strategy = "preloaded";
		(playerEl as any).env = { mode: "gather", role: "student" };
		(playerEl as any).session = { id: "slow-passage-session", data: [] };
	});
</script>

<svelte:head>
	<title>Overwide Slow Passage Demo</title>
</svelte:head>

<main class="demo-page">
	<header class="demo-header">
		<h1>Overwide slow-painting passage</h1>
		<p>
			This page mounts <code>&lt;pie-item-player&gt;</code> with a markup that
			contains nothing but a <code>{SYNTHETIC_TAG}</code> tag. The synthetic
			element waits <strong>{delayMs}ms</strong> before injecting wide
			<code>&lt;img&gt;</code> and <code>&lt;table&gt;</code> elements into its
			own light DOM — the same shape as a real PIE element painting from
			<code>model</code> data after the host markup is already sanitized.
		</p>
		<p class="demo-hint">
			Append <code>?delay=2500</code> (or any millisecond value) to the URL to
			change the paint delay.
		</p>
	</header>

	<section class="demo-status" aria-live="polite">
		<p><strong>Paint delay:</strong> {delayMs}ms</p>
		<p><strong>Elapsed since mount:</strong> {elapsed}ms</p>
		<p>
			<strong>Image wrappers (<code>.pie-image-scroll</code>):</strong>
			{imgScrollCount}
		</p>
		<p>
			<strong>Table wrappers (<code>.pie-table-scroll</code>):</strong>
			{tableScrollCount}
		</p>
		<p class="demo-verdict">
			{#if imgScrollCount > 0 && tableScrollCount > 0}
				✅ Post-render wrap caught the late-painted content.
			{:else if elapsed > delayMs + 500}
				❌ Late-painted content is unwrapped — fix may have regressed.
			{:else}
				⏳ Waiting for the slow passage to paint…
			{/if}
		</p>
	</section>

	<section class="demo-frame">
		<pie-item-player bind:this={playerEl}></pie-item-player>
	</section>
</main>

<style>
	.demo-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		box-sizing: border-box;
		height: 100%;
		min-height: 0;
	}

	.demo-header h1 {
		margin: 0 0 0.4rem;
		font-size: 1.3rem;
	}

	.demo-header p {
		margin: 0.25rem 0;
		font-size: 0.95rem;
		max-width: 60rem;
	}

	.demo-hint {
		color: #555;
		font-size: 0.85rem;
	}

	.demo-status {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.4rem;
		background: #f9fafb;
		font-size: 0.9rem;
	}

	.demo-status p {
		margin: 0;
	}

	.demo-verdict {
		flex-basis: 100%;
		font-weight: 600;
	}

	.demo-frame {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 1rem;
		border: 1px solid #e5e7eb;
		border-radius: 0.4rem;
		background: #fff;
		/* Constrain width so the wide image + table actually exceed the column
		   and the scroll affordance is visible — without it the wrap is silent. */
		max-width: 720px;
	}
</style>
