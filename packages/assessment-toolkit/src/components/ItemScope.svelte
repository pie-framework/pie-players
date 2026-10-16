<svelte:options
	customElement={{
		tag: "pie-item-scope",
		shadow: "open",
		props: {
			itemId: { attribute: "item-id", type: "String" },
			canonicalItemId: { attribute: "canonical-item-id", type: "String" },
			contentKind: { attribute: "content-kind", type: "String" },
			regionPolicy: { attribute: "region-policy", type: "String" },
			scopeElement: { type: "Object", reflect: false },
			ttsHighlightTargetResolver: { type: "Object", reflect: false },
			item: { type: "Object", reflect: false },
			settings: { type: "Object", reflect: false },
		},
	}}
/>

<!--
@component
An item's scope for the toolkit's tools, in a section player's card or around a host's own item player. A host gives it the item, its `item-id` and its policy `settings`; the toolbars and tools inside take the item from it and act on it, and it registers the item with the enclosing `<pie-assessment-toolkit>`, which files the item's accessibility catalogs. In a toolkit that holds a section it is also the item's channel to that toolkit; otherwise the item player's events pass through unchanged.

@fires {CustomEvent<{ kind: "item"; itemId: string; canonicalItemId: string; contentKind: string; item: unknown; settings?: { requiredTools?: string[]; restrictedTools?: string[]; toolParameters?: Record<string, unknown> }; element: HTMLElement; runtimeId: string }>} pie-register - Registration handshake, once a toolkit has answered the scope and again when the item's identity, settings or catalogs change; the toolkit whose `runtimeId` it carries claims it and stops its propagation.
@fires {CustomEvent<{ kind: "item"; itemId: string; canonicalItemId: string; contentKind: string; item: unknown; settings?: { requiredTools?: string[]; restrictedTools?: string[]; toolParameters?: Record<string, unknown> }; element: HTMLElement; runtimeId: string }>} pie-unregister - Retires the registration when the scope tears down, loses its item id or moves to another toolkit; claimed like `pie-register`.
@fires {CustomEvent<{ itemId: string; canonicalItemId: string; session: unknown; sessionCommitReason?: "teardown" | "navigate" | "page-hidden" }>} item-session-changed - In a toolkit that holds a section, when the item player reports a response change; the player's own `session-changed` stops at the scope.
@fires {CustomEvent<{ itemId: string; session: unknown; runtimeId: string }>} pie-item-session-changed - Internal channel event, in a toolkit that holds a section, for each distinct session change the item player reports, metadata-only ones included; claimed by the toolkit.
@fires {CustomEvent<{ itemId: string; canonicalItemId: string; contentKind: string; detail: unknown; runtimeId: string }>} pie-content-loaded - Internal channel event when the item player reports `load-complete`; claimed by the toolkit.
@fires {CustomEvent<{ itemId: string; canonicalItemId: string; contentKind: string; error: unknown; runtimeId: string }>} pie-item-player-error - Internal channel event when the item player reports `player-error`; claimed by the toolkit.
@slot - The item's content: its toolbar and a `[data-region="content"]` region holding the item player.
-->

<script lang="ts">
	/**
	 * An item's scope for the toolkit's tools, in a section player's card or around
	 * a host's own item player: the item's identity, the region its tools act on,
	 * and its registration with the toolkit, which files the item's accessibility
	 * catalogs.
	 *
	 * `settings` is the item's policy settings (`requiredTools`,
	 * `restrictedTools`, `toolParameters`), registered with the item. They
	 * govern only decisions scoped to this item: its own item-level toolbar, and
	 * the feature decisions its content asks. A section player fills it from the
	 * assessment's item reference; a host composing its own item player sets it.
	 *
	 * In a toolkit that holds a section the scope is also the item's channel to
	 * it. Otherwise the host owns the item player and its events pass through
	 * unchanged; the toolkit hears only that the item loaded or failed.
	 *
	 * Either way it answers the item player's request for the toolkit's feature
	 * decisions on the item (`itemFeatureDecisionsContext`), and relays the
	 * player's `feature-decision-applied` to the toolkit.
	 */
	import { connectHostRuntimeContext } from "../runtime/tool-host-contract.js";
	import {
		PENDING_INPUT_WARNING_DELAY_MS,
		warnOncePerDocument,
	} from "../runtime/page-warnings.js";
	import {
		type ItemFeatureDecisionsProvider,
		provideItemFeatureDecisions,
	} from "../runtime/item-feature-decisions.js";
	import { createShellEventBridge } from "../runtime/shell-event-bridge.js";
	import { createShellScope } from "../runtime/shell-scope.js";
	import type { ItemSettings } from "@pie-players/pie-players-shared/types";
	import type { TTSHighlightTargetResolver } from "../services/tts/highlight-target-resolver.js";

	let {
		itemId = "",
		canonicalItemId = "",
		contentKind = "assessment-item",
		regionPolicy = "default",
		scopeElement = null as HTMLElement | null,
		ttsHighlightTargetResolver = null as TTSHighlightTargetResolver | null,
		item = null as unknown,
		settings = null as ItemSettings | null,
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);
	const host = $derived.by((): HTMLElement | null => {
		const root = anchor?.getRootNode();
		return root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
	});

	const scope = createShellScope();
	// Not reactive: the effect on `host` creates it, the publication below
	// tells it the item.
	let featureDecisions: ItemFeatureDecisionsProvider | null = null;

	// Keyed on `host` alone and ahead of the publication below, so a new host is
	// released before it is published to. The bridge reads the identity and the
	// mode when an event arrives.
	$effect(() => {
		if (!host) return;
		const scopeHost = host;
		let sectionBound = false;
		let runtimeFound = false;
		const decisions = provideItemFeatureDecisions(scopeHost);
		featureDecisions = decisions;
		const stopFollowingRuntime = connectHostRuntimeContext(
			scopeHost,
			(runtime) => {
				runtimeFound = true;
				sectionBound = runtime.sectionBound === true;
				decisions.setCoordinator(runtime.coordinator ?? null);
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
				decisions.disconnect();
				if (featureDecisions === decisions) featureDecisions = null;
			}
		};
	});

	// Re-runs on every parent re-render, which re-applies the props; the scope
	// publishes only what changed. The item's feature decisions follow its
	// registration, which files its settings with the toolkit.
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
						settings,
					}
				: null,
		);
		featureDecisions?.setItem(host ? { itemId, canonicalItemId } : null);
	});
</script>

<div bind:this={anchor} class="pie-item-scope-anchor" aria-hidden="true"></div>
<slot></slot>

<style>
	.pie-item-scope-anchor {
		display: none;
	}
</style>
