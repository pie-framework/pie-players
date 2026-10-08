<svelte:options
	customElement={{
		tag: "pie-item-shell",
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
	import { createShellEventBridge } from "@pie-players/pie-assessment-toolkit/runtime/internal";

	let {
		itemId = "",
		canonicalItemId = "",
		contentKind = "assessment-item",
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
	 * The session channel, keyed on `host` alone so it survives every prop
	 * change: the bridge reads the identity when an event arrives, and its
	 * dedupe state stays intact across prop changes.
	 *
	 * Its teardown is the shell's only real teardown, which is why `pie-unregister`
	 * is dispatched from here, after the bridge's last commit.
	 */
	$effect(() => {
		if (!host) return;
		const bridgeHost = host;
		const bridge = createShellEventBridge({
			host: bridgeHost,
			kind: "item",
			identity: () => ({ itemId, canonicalItemId, contentKind }),
			mode: () => "section",
			send: (type, detail) => dispatchCrossBoundaryEvent(bridgeHost, type, detail),
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
						kind: "item",
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

<div bind:this={anchor} class="pie-item-shell-anchor" aria-hidden="true"></div>
<slot></slot>

<style>
	.pie-item-shell-anchor {
		display: none;
	}
</style>
