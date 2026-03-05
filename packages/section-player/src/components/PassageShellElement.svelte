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
			item: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import {
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		assessmentToolkitRegionScopeContext,
		assessmentToolkitShellContext,
		dispatchCrossBoundaryEvent,
		type AssessmentToolkitRegionScopeContext,
		type AssessmentToolkitShellContext,
		type RuntimeRegistrationDetail,
	} from "@pie-players/pie-assessment-toolkit";
	import { ContextProvider, ContextRoot } from "@pie-players/pie-context";

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
		item = null as unknown,
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);
	const shellContextVersion = Date.now();
	let shellContextProvider: ContextProvider<
		typeof assessmentToolkitShellContext
	> | null = null;
	let shellContextRoot: ContextRoot | null = null;
	let regionScopeProvider: ContextProvider<
		typeof assessmentToolkitRegionScopeContext
	> | null = null;
	let regionScopeRoot: ContextRoot | null = null;

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		const rootNode = anchor.getRootNode();
		if (rootNode && "host" in rootNode) {
			return (rootNode as ShadowRoot).host as HTMLElement;
		}
		return anchor.parentElement as HTMLElement | null;
	}
	const host = $derived.by(() => getHostElement());
	const effectiveScopeElement = $derived(scopeElement || host || null);
	const regionScopeValue = $derived.by(
		(): AssessmentToolkitRegionScopeContext | null => {
			if (!effectiveScopeElement) return null;
			return {
				scopeElement: effectiveScopeElement,
			};
		},
	);

	const shellContextValue = $derived.by(
		(): AssessmentToolkitShellContext | null => {
			if (!host) return null;
			const canonical = canonicalItemId || itemId;
			return {
				kind: "passage",
				itemId,
				canonicalItemId: canonical,
				contentKind,
				regionPolicy,
				scopeElement: effectiveScopeElement,
				item,
				contextVersion: shellContextVersion,
			};
		},
	);

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
		dispatchCrossBoundaryEvent(host, eventName, detail);
	}

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

	$effect(() => {
		if (!host) return;
		dispatchRegistration(PIE_REGISTER_EVENT);
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
			host?.removeEventListener("load-complete", onLoadComplete);
			host?.removeEventListener("player-error", onPlayerError);
			dispatchRegistration(PIE_UNREGISTER_EVENT);
		};
	});

	$effect(() => {
		if (!host) return;
		host.setAttribute("data-item-id", itemId);
		host.setAttribute("data-canonical-item-id", canonicalItemId || itemId);
		host.setAttribute("data-pie-shell-root", "passage");
		host.setAttribute("data-region-policy", regionPolicy);
	});

	$effect(() => {
		if (!host || !shellContextValue) return;
		shellContextProvider = new ContextProvider(host, {
			context: assessmentToolkitShellContext,
			initialValue: shellContextValue,
		});
		shellContextProvider.connect();
		shellContextRoot = new ContextRoot(host);
		shellContextRoot.attach();

		return () => {
			shellContextRoot?.detach();
			shellContextRoot = null;
			shellContextProvider?.disconnect();
			shellContextProvider = null;
		};
	});

	$effect(() => {
		if (!shellContextValue) return;
		shellContextProvider?.setValue(shellContextValue);
	});

	$effect(() => {
		if (!host || !regionScopeValue) return;
		regionScopeProvider = new ContextProvider(host, {
			context: assessmentToolkitRegionScopeContext,
			initialValue: regionScopeValue,
		});
		regionScopeProvider.connect();
		regionScopeRoot = new ContextRoot(host);
		regionScopeRoot.attach();
		return () => {
			regionScopeRoot?.detach();
			regionScopeRoot = null;
			regionScopeProvider?.disconnect();
			regionScopeProvider = null;
		};
	});

	$effect(() => {
		if (!regionScopeValue) return;
		regionScopeProvider?.setValue(regionScopeValue);
	});
</script>

<div bind:this={anchor} class="pie-passage-shell-anchor" aria-hidden="true"></div>
<slot></slot>

<style>
	.pie-passage-shell-anchor {
		display: none;
	}
</style>
