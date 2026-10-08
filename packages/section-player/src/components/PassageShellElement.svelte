<svelte:options
	customElement={{
		tag: "pie-passage-shell",
		shadow: "open",
		props: {
			itemId: { attribute: "item-id", type: "String" },
			canonicalItemId: { attribute: "canonical-item-id", type: "String" },
			contentKind: { attribute: "content-kind", type: "String" },
			regionPolicy: { attribute: "region-policy", type: "String" },
			scopeElement: { type: "Object", reflect: false },
			ttsHighlightTargetResolver: { type: "Object", reflect: false },
			item: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import {
		createShellScope,
		dispatchCrossBoundaryEvent,
		type TTSHighlightTargetResolver,
	} from "@pie-players/pie-assessment-toolkit";

	const PIE_INTERNAL_CONTENT_LOADED_EVENT = "pie-content-loaded";
	const PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT = "pie-item-player-error";
	type InternalContentLoadedDetail = {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
	};
	type InternalItemPlayerErrorDetail = {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
	};

	let {
		itemId = "",
		canonicalItemId = "",
		contentKind = "rubric-block-stimulus",
		regionPolicy = "default",
		scopeElement = null as HTMLElement | null,
		ttsHighlightTargetResolver = null as TTSHighlightTargetResolver | null,
		item = null as unknown,
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		const rootNode = anchor.getRootNode();
		if (rootNode && "host" in rootNode) {
			return (rootNode as ShadowRoot).host as HTMLElement;
		}
		return anchor.parentElement as HTMLElement | null;
	}
	const host = $derived.by(() => getHostElement());

	// The shell's identity, region and registration, published as every shell
	// publishes them.
	const scope = createShellScope();

	function dispatchLoaded(detail: unknown): void {
		if (!host || !itemId) return;
		const payload: InternalContentLoadedDetail = {
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			contentKind,
			detail,
		};
		dispatchCrossBoundaryEvent(host, PIE_INTERNAL_CONTENT_LOADED_EVENT, payload);
	}

	function dispatchPlayerError(error: unknown): void {
		if (!host || !itemId) return;
		const payload: InternalItemPlayerErrorDetail = {
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			contentKind,
			error,
		};
		dispatchCrossBoundaryEvent(host, PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT, payload);
	}

	/**
	 * Listener attachment keyed on `host` alone, so it survives every prop change.
	 * These handlers read the props when an event arrives rather than while the
	 * effect runs, so nothing else belongs in this dependency set.
	 *
	 * Its teardown is the shell's only real teardown, which is why `pie-unregister`
	 * is dispatched from here.
	 */
	$effect(() => {
		if (!host) return;
		// Raw item-player session events stay inside the shell, as they do in
		// the item shell. A passage carries no response, so nothing is forwarded:
		// a passage id on the section's session stream names no item a host has.
		const onSessionChanged = (event: Event) => {
			event.stopPropagation();
		};
		host.addEventListener("session-changed", onSessionChanged);
		const onLoadComplete = (event: Event) => {
			event.stopPropagation();
			dispatchLoaded((event as CustomEvent).detail);
		};
		const onPlayerError = (event: Event) => {
			event.stopPropagation();
			dispatchPlayerError((event as CustomEvent).detail);
		};
		host.addEventListener("load-complete", onLoadComplete);
		host.addEventListener("player-error", onPlayerError);

		return () => {
			host?.removeEventListener("session-changed", onSessionChanged);
			host?.removeEventListener("load-complete", onLoadComplete);
			host?.removeEventListener("player-error", onPlayerError);
			scope.retire();
			scope.disconnect();
		};
	});

	// Re-runs on every parent re-render, because Svelte re-applies
	// custom-element properties whenever the parent template updates. The scope
	// is what decides whether that means anything — see `shell-registration.ts`
	// in the toolkit for what an unconditional registration cost.
	$effect(() => {
		scope.publish(
			host
				? {
						host,
						kind: "passage",
						itemId,
						canonicalItemId,
						contentKind,
						regionPolicy,
						scopeElement,
						ttsHighlightTargetResolver,
						item,
					}
				: null,
		);
	});
</script>

<div bind:this={anchor} class="pie-passage-shell-anchor" aria-hidden="true"></div>
<slot></slot>

<style>
	.pie-passage-shell-anchor {
		display: none;
	}
</style>
