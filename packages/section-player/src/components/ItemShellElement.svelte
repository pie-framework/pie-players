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
			item: { type: "Object", reflect: false },
		},
	}}
/>

<script module lang="ts">
	const crossShellSessionDedupe = new Map<
		string,
		{ fingerprint: string; timestamp: number }
	>();
</script>

<script lang="ts">
	import {
		PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
		PIE_ITEM_SESSION_CHANGED_EVENT,
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		assessmentToolkitRegionScopeContext,
		assessmentToolkitShellContext,
		dispatchCrossBoundaryEvent,
		type AssessmentToolkitRegionScopeContext,
		type AssessmentToolkitShellContext,
		type InternalItemSessionChangedDetail,
		type ItemSessionChangedDetail,
		type RuntimeRegistrationDetail,
	} from "@pie-players/pie-assessment-toolkit";
	import { normalizeItemSessionChange } from "@pie-players/pie-players-shared";
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
		contentKind = "assessment-item",
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
				kind: "item",
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
			kind: "item",
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			contentKind,
			item,
			element: host,
		};
		dispatchCrossBoundaryEvent(host, eventName, detail);
	}

	function normalizeAndDispatchSession(event: Event): void {
		if (!host || !itemId) return;
		const detail = (event as CustomEvent).detail;
		const internalPayload: InternalItemSessionChangedDetail = {
			itemId,
			session: detail,
		};
		// Internal runtime session wiring must always continue to keep item UI/state synchronized.
		dispatchCrossBoundaryEvent(host, PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT, internalPayload);
		// Keep public item stream response-focused; metadata-only belongs on canonical session-changed.
		const normalized = normalizeItemSessionChange({
			itemId,
			sessionDetail: detail,
		});
		if (normalized.intent === "metadata-only" || !normalized.session) {
			return;
		}
		const payload: ItemSessionChangedDetail = {
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			session: normalized.session,
		};
		dispatchCrossBoundaryEvent(host, PIE_ITEM_SESSION_CHANGED_EVENT, payload);
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

	function createSessionEventFingerprint(detail: unknown): string {
		const semanticDetail =
			detail && typeof detail === "object"
				? { ...(detail as Record<string, unknown>) }
				: detail;
		if (semanticDetail && typeof semanticDetail === "object") {
			delete (semanticDetail as Record<string, unknown>).timestamp;
			delete (semanticDetail as Record<string, unknown>).sourceRuntimeId;
		}
		try {
			return JSON.stringify(semanticDetail);
		} catch {
			return String(semanticDetail);
		}
	}

	$effect(() => {
		if (!host) return;
		dispatchRegistration(PIE_REGISTER_EVENT);

		const seenSessionEvents = new WeakSet<Event>();
		let lastForwardedFingerprint = "";
		const CROSS_SHELL_DEDUPE_WINDOW_MS = 500;
		const onSessionChanged = (event: Event) => {
			// Keep framework surface minimal: normalize these descendant events and do not
			// leak raw item-player session events to external listeners.
			event.stopPropagation();
			// Some players emit `session-changed`, others emit `sessionchanged`.
			// Guard against duplicate forwarding when both fire for the same payload.
			if (seenSessionEvents.has(event)) return;
			seenSessionEvents.add(event);
			const fingerprint = createSessionEventFingerprint((event as CustomEvent).detail);
			if (fingerprint === lastForwardedFingerprint) return;
			const dedupeKey = itemId || canonicalItemId || "__unknown-item__";
			const now = Date.now();
			const lastCrossShell = crossShellSessionDedupe.get(dedupeKey);
			if (
				lastCrossShell &&
				lastCrossShell.fingerprint === fingerprint &&
				now - lastCrossShell.timestamp < CROSS_SHELL_DEDUPE_WINDOW_MS
			) {
				return;
			}
			crossShellSessionDedupe.set(dedupeKey, { fingerprint, timestamp: now });
			lastForwardedFingerprint = fingerprint;
			normalizeAndDispatchSession(event);
		};
		host.addEventListener("sessionchanged", onSessionChanged);
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
			host?.removeEventListener("sessionchanged", onSessionChanged);
			host?.removeEventListener("session-changed", onSessionChanged);
			host?.removeEventListener("load-complete", onLoadComplete);
			host?.removeEventListener("player-error", onPlayerError);
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
<slot></slot>

<style>
	.pie-item-shell-anchor {
		display: none;
	}
</style>
