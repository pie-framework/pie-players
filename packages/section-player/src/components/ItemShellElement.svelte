<svelte:options
	customElement={{
		tag: "pie-item-shell",
		shadow: "none",
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
		PIE_ITEM_SESSION_CHANGED_EVENT,
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		assessmentToolkitRegionScopeContext,
		assessmentToolkitShellContext,
		type AssessmentToolkitRegionScopeContext,
		type AssessmentToolkitShellContext,
		type ItemSessionChangedDetail,
		type RuntimeRegistrationDetail,
	} from "@pie-players/pie-assessment-toolkit";
	import { ContextProvider, ContextRoot } from "@pie-players/pie-context";

	let {
		itemId = "",
		canonicalItemId = "",
		contentKind = "assessment-item",
		regionPolicy = "default",
		scopeElement = null as HTMLElement | null,
		item = null as unknown,
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);
	let shellLayoutVersion = $state(0);
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
			shellLayoutVersion;
			if (!host) return null;
			const canonical = canonicalItemId || itemId;
			return {
				kind: "item",
				itemId,
				canonicalItemId: canonical,
				contentKind,
				regionPolicy,
				scopeElement: effectiveScopeElement,
				item,
				contextVersion: shellLayoutVersion,
			};
		},
	);

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
		shellLayoutVersion += 1;

		const onSessionChanged = (event: Event) => normalizeAndDispatchSession(event);
		host.addEventListener("sessionchanged", onSessionChanged);

		return () => {
			host?.removeEventListener("sessionchanged", onSessionChanged);
			dispatchRegistration(PIE_UNREGISTER_EVENT);
		};
	});

	$effect(() => {
		if (!host) return;
		host.setAttribute("data-item-id", itemId);
		host.setAttribute("data-canonical-item-id", canonicalItemId || itemId);
		host.setAttribute("data-pie-shell-root", "item");
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

<div bind:this={anchor} class="pie-item-shell-anchor" aria-hidden="true"></div>

<style>
	.pie-item-shell-anchor {
		display: none;
	}
</style>
