<svelte:options
	customElement={{
		tag: "pie-item-shell",
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
		PIE_ITEM_SESSION_CHANGED_EVENT,
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		type ItemSessionChangedDetail,
		type RuntimeRegistrationDetail,
	} from "@pie-players/pie-assessment-toolkit";

	let {
		itemId = "",
		canonicalItemId = "",
		contentKind = "assessment-item",
		regionPolicy = "default",
		item = null as unknown,
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);
	let observer: MutationObserver | null = null;

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		return anchor.closest("pie-item-shell");
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
		host.setAttribute("data-pie-shell-root", "item");
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
			kind: "item",
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

	function normalizeAndDispatchSession(event: Event): void {
		if (!host || !itemId) return;
		const detail = (event as CustomEvent).detail;
		const payload: ItemSessionChangedDetail = {
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			session: detail,
		};
		host.dispatchEvent(
			new CustomEvent(PIE_ITEM_SESSION_CHANGED_EVENT, {
				detail: payload,
				bubbles: true,
				composed: true,
			}),
		);
		host.dispatchEvent(
			new CustomEvent("item-session-changed", {
				detail: payload,
				bubbles: true,
				composed: true,
			}),
		);
	}

	$effect(() => {
		if (!host) return;
		dispatchRegistration(PIE_REGISTER_EVENT);
		bindToolbarDefaults();

		const onSessionChanged = (event: Event) => normalizeAndDispatchSession(event);
		host.addEventListener("sessionchanged", onSessionChanged);

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
			host?.removeEventListener("sessionchanged", onSessionChanged);
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

<div bind:this={anchor} class="pie-item-shell-anchor" aria-hidden="true"></div>

<style>
	.pie-item-shell-anchor {
		display: none;
	}
</style>
