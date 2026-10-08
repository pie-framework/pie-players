<svelte:options
	customElement={{
		tag: "pie-item-scope",
		shadow: "open",
		props: {
			itemId: { attribute: "item-id", type: "String" },
			canonicalItemId: { attribute: "canonical-item-id", type: "String" },
			contentKind: { attribute: "content-kind", type: "String" },
			scopeElement: { type: "Object", reflect: false },
			ttsHighlightTargetResolver: { type: "Object", reflect: false },
			item: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	/**
	 * An item's scope for the toolkit's tools where no section player holds the
	 * item: the item's identity, the region its tools act on, and its
	 * registration with the toolkit, which files the item's accessibility
	 * catalogs. `<pie-item-shell>` publishes the same in a section card, and adds
	 * the section's session channel; the item player's events pass through this
	 * element unchanged.
	 */
	import { createShellScope } from "../runtime/shell-scope.js";
	import type { TTSHighlightTargetResolver } from "../services/tts/highlight-target-resolver.js";

	let {
		itemId = "",
		canonicalItemId = "",
		contentKind = "assessment-item",
		scopeElement = null as HTMLElement | null,
		ttsHighlightTargetResolver = null as TTSHighlightTargetResolver | null,
		item = null as unknown,
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);
	const host = $derived.by((): HTMLElement | null => {
		const root = anchor?.getRootNode();
		return root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
	});

	const scope = createShellScope();

	// Ahead of the publication below, so a new host is released before it is
	// published to.
	$effect(() => {
		if (!host) return;
		return () => {
			scope.retire();
			scope.disconnect();
		};
	});

	// Re-runs on every parent re-render, which re-applies the props; the scope
	// publishes only what changed.
	$effect(() => {
		scope.publish(
			host
				? {
						host,
						kind: "item",
						itemId,
						canonicalItemId,
						contentKind,
						scopeElement,
						ttsHighlightTargetResolver,
						item,
					}
				: null,
		);
	});
</script>

<div bind:this={anchor} class="pie-item-scope-anchor" aria-hidden="true"></div>
<slot></slot>

<style>
	.pie-item-scope-anchor {
		display: none;
	}
</style>
