<svelte:options
	customElement={{
		tag: "pie-passage-shell",
		shadow: "none",
		props: {
			itemId: { attribute: "item-id", type: "String" },
			canonicalItemId: { attribute: "canonical-item-id", type: "String" },
			contentKind: { attribute: "content-kind", type: "String" },
			regionPolicy: { attribute: "region-policy", type: "String" },
			item: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import {
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		type RuntimeRegistrationDetail,
	} from "@pie-players/pie-assessment-toolkit";

	let {
		itemId = "",
		canonicalItemId = "",
		contentKind = "rubric-block-stimulus",
		regionPolicy = "default",
		item = null as unknown,
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);
	let observer: MutationObserver | null = null;

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		return anchor.closest("pie-passage-shell");
	}
	const host = $derived.by(() => getHostElement());

	function getRegion(region: string): HTMLElement | null {
		if (!host) return null;
		return (
			(host.querySelector(`[data-region="${region}"]`) as HTMLElement | null) ??
			(host.querySelector(`[data-pie-region="${region}"]`) as HTMLElement | null)
		);
	}

	function getContentScope(): HTMLElement | null {
		return getRegion("content") || getRegion("header") || host;
	}

	function bindToolbarDefaults(): void {
		if (!host) return;
		host.setAttribute("data-pie-shell-root", "passage");
		host.setAttribute("data-region-policy", regionPolicy);
		const toolbarNodes = Array.from(host.querySelectorAll("pie-item-toolbar"));
		const scope = getContentScope();
		for (const node of toolbarNodes) {
			const toolbar = node as any;
			if (!toolbar.itemId) toolbar.itemId = itemId;
			if (!toolbar.catalogId) toolbar.catalogId = itemId;
			if (!toolbar.contentKind) toolbar.contentKind = contentKind;
			if (!toolbar.scopeElement && scope) toolbar.scopeElement = scope;
			if (!toolbar.item && item) toolbar.item = item;
		}
	}

	function dispatchRegistration(eventName: string): void {
		if (!host || !itemId) return;
		const detail: RuntimeRegistrationDetail = {
			kind: "passage",
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			contentKind,
			item,
			element: host,
		};
		host.dispatchEvent(
			new CustomEvent(eventName, {
				detail,
				bubbles: true,
				composed: true,
			}),
		);
	}

	$effect(() => {
		if (!host) return;
		dispatchRegistration(PIE_REGISTER_EVENT);
		bindToolbarDefaults();

		observer = new MutationObserver(() => {
			bindToolbarDefaults();
		});
		observer.observe(host, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["data-region", "data-pie-region"],
		});

		return () => {
			observer?.disconnect();
			observer = null;
			dispatchRegistration(PIE_UNREGISTER_EVENT);
		};
	});

	$effect(() => {
		bindToolbarDefaults();
		if (!host) return;
		host.setAttribute("data-item-id", itemId);
		host.setAttribute("data-canonical-item-id", canonicalItemId || itemId);
	});
</script>

<div bind:this={anchor} class="pie-passage-shell-anchor" aria-hidden="true"></div>

<style>
	.pie-passage-shell-anchor {
		display: none;
	}
</style>
