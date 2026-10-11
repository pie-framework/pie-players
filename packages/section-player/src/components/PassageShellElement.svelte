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

<!--
@component
Shell around a passage in a section player: it publishes the passage's identity and region to the tools inside it, registers the passage with the toolkit it sits in, and forwards the passage player's load and error events to that toolkit. The passage card renders it, naming the passage through `item-id`, `content-kind` and `item`.

@fires {CustomEvent<{ kind: "passage"; itemId: string; canonicalItemId?: string; contentKind?: string; item?: unknown; element: HTMLElement; runtimeId?: string }>} pie-register - When the shell registers its passage with the toolkit it sits in.
@fires {CustomEvent<{ kind: "passage"; itemId: string; canonicalItemId?: string; contentKind?: string; item?: unknown; element: HTMLElement; runtimeId?: string }>} pie-unregister - When the shell retires its passage's registration.
@fires {CustomEvent<{ itemId: string; canonicalItemId?: string; contentKind?: string; detail?: unknown; runtimeId: string }>} pie-content-loaded - When the passage player reports `load-complete`.
@fires {CustomEvent<{ itemId: string; canonicalItemId?: string; contentKind?: string; error: unknown; runtimeId: string }>} pie-item-player-error - When the passage player reports `player-error`.
@slot - The passage card's header, toolbar and passage player.
-->

<script lang="ts">
	import {
		createShellScope,
		type TTSHighlightTargetResolver,
	} from "@pie-players/pie-assessment-toolkit";
	import { createShellEventBridge } from "@pie-players/pie-assessment-toolkit";

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

	/**
	 * The passage's events, keyed on `host` alone so they survive every prop
	 * change: the bridge reads the identity when an event arrives.
	 *
	 * Its teardown is the shell's only real teardown, which is why `pie-unregister`
	 * is dispatched from here.
	 */
	$effect(() => {
		if (!host) return;
		const bridge = createShellEventBridge({
			host,
			kind: "passage",
			identity: () => ({ itemId, canonicalItemId, contentKind }),
			mode: () => "section",
			send: scope.send,
		});
		return () => {
			try {
				bridge.disconnect();
			} finally {
				scope.retire();
				scope.disconnect();
			}
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
