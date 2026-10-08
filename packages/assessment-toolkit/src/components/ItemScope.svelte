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
	 * catalogs. `<pie-item-shell>` publishes the same in a section card.
	 *
	 * In a toolkit that holds a section the scope is also the item's channel to
	 * it, as `<pie-item-shell>` is. Otherwise the host owns the item player and
	 * its events pass through unchanged; the toolkit hears only that the item
	 * loaded or failed.
	 */
	import { connectAssessmentToolkitHostRuntimeContext } from "../context/runtime-context-consumer.js";
	import {
		PENDING_INPUT_WARNING_DELAY_MS,
		warnOncePerDocument,
	} from "../runtime/page-warnings.js";
	import { createShellEventBridge } from "../runtime/shell-event-bridge.js";
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

	// Keyed on `host` alone and ahead of the publication below, so a new host is
	// released before it is published to. The bridge reads the identity and the
	// mode when an event arrives.
	$effect(() => {
		if (!host) return;
		const scopeHost = host;
		let sectionBound = false;
		let runtimeFound = false;
		const stopFollowingRuntime = connectAssessmentToolkitHostRuntimeContext(
			scopeHost,
			(runtime) => {
				runtimeFound = true;
				sectionBound = runtime.sectionBound === true;
			},
		);
		// The scope keeps waiting: a host may mount the toolkit last.
		const noToolkitTimer = setTimeout(() => {
			if (runtimeFound || !scopeHost.isConnected) return;
			warnOncePerDocument(
				scopeHost.ownerDocument,
				"itemScopeWithoutToolkit",
				`[pie-item-scope] No <pie-assessment-toolkit> has answered item "${itemId}" after ${PENDING_INPUT_WARNING_DELAY_MS / 1000} s, so the item is not registered and the tools inside the scope have no runtime. Place the scope inside the toolkit element; it keeps waiting for one. Reported once per page.`,
			);
		}, PENDING_INPUT_WARNING_DELAY_MS);
		const bridge = createShellEventBridge({
			host: scopeHost,
			kind: "item",
			identity: () => ({ itemId, canonicalItemId, contentKind }),
			mode: () => (sectionBound ? "section" : "plain"),
			send: scope.send,
		});
		return () => {
			clearTimeout(noToolkitTimer);
			try {
				bridge.disconnect();
			} finally {
				stopFollowingRuntime();
				scope.retire();
				scope.disconnect();
			}
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
