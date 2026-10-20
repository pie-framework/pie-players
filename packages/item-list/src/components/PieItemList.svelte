<svelte:options
	customElement={{
		// The build's `guardSvelteCustomElementDefines` leaves an already-registered tag alone.
		tag: "pie-item-list",
		// Light DOM, so the host's content styles reach every row.
		shadow: "none",
		props: {
			items: { type: "Array", reflect: false },
			env: { attribute: "env", type: "Object" },
			resolve: { type: "Object", reflect: false },
			locale: { attribute: "locale", type: "String" },
			expanded: { attribute: "expanded", type: "Boolean" },
			strategy: { attribute: "strategy", type: "String" },
			loaderOptions: { type: "Object", reflect: false },
			// A tag name can be set as an attribute; a function only as a property.
			details: { attribute: "details", type: "String" },
			actions: { attribute: "actions", type: "String" },
			highlights: { attribute: "highlights", type: "String" },
		},
		extend: coerceBooleanAttributes,
	}}
/>

<script module lang="ts">
	let listCount = 0;
</script>

<!--
@component
PIE items as a list of `<pie-item-summary>` rows, for a host with no list chrome of its own. Each row shows the entry's details in a leading column, the host's actions in its top-end corner, the item's summary clipped to a fixed height, with its passage above it, and the host's search matches below it. The row's expand button removes the clip and mounts the item's player.

@fires {CustomEvent<{ id: string; expanded: boolean }>} expanded-change - A row's expand button was pressed.
@fires {CustomEvent<{ id: string; code: string; message: string; recoverable: boolean }>} player-error - A row's player failed to load, with the entry `id` added to `<pie-item-summary>`'s detail.
@fires {CustomEvent<{ view: "summary" | "player" }>} load-complete - Bubbles unchanged from each row's `<pie-item-summary>`, passage rows included; the entry's `id` is on the closest `[data-item-id]`.
-->

<script lang="ts">
	import {
		createPieI18n,
		DEFAULT_LOCALE,
	} from "@pie-players/pie-players-shared/i18n";
	import type { Env } from "@pie-players/pie-players-shared/types";
	import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
	import { untrack } from "svelte";
	import {
		type ItemListEntry,
		type ItemListExtension,
		mountExtension,
	} from "../list/extension.js";
	import type { PlayerLoadInputs } from "../player/scheduler.js";
	import type { SummaryResolver } from "../summarize/summarize-item.js";
	import "./PieItemSummary.svelte";

	let {
		items = [],
		env,
		resolve,
		locale = "",
		expanded = false,
		strategy,
		loaderOptions,
		details,
		actions,
		highlights,
	}: {
		items?: ItemListEntry[];
		env?: Env;
		resolve?: SummaryResolver;
		locale?: string;
		expanded?: boolean;
		strategy?: PlayerLoadInputs["strategy"];
		loaderOptions?: PlayerLoadInputs["loaderOptions"];
		details?: ItemListExtension;
		actions?: ItemListExtension;
		highlights?: ItemListExtension;
	} = $props();

	const hostElement: HTMLElement = $host();
	const listId = `pie-item-list-${++listCount}`;

	const i18n = createPieI18n();
	let i18nVersion = $state(0);
	$effect(() =>
		i18n.subscribe(() => {
			i18nVersion += 1;
		}),
	);
	$effect(() => {
		const requested = typeof locale === "string" ? locale.trim() : "";
		untrack(() => {
			void Promise.resolve(i18n.setLocale(requested || DEFAULT_LOCALE)).catch(
				() => {},
			);
		});
	});
	const messages = $derived((void i18nVersion, { t: i18n.t.bind(i18n) }));

	// Keyed by `id`; a repeated id would break the keyed rows, so only its first entry shows.
	const rows = $derived.by(() => {
		if (!Array.isArray(items)) return [];
		const seen = new Set<string>();
		return items.filter((entry) => {
			if (!entry || typeof entry.id !== "string" || seen.has(entry.id)) {
				if (entry && seen.has(entry.id)) {
					console.warn(`[pie-item-list] Entry id "${entry.id}" repeats; only its first entry shows.`);
				}
				return false;
			}
			seen.add(entry.id);
			return true;
		});
	});

	// A row's own toggle overrides `expanded` until `expanded` changes again.
	let overrides = $state<Record<string, boolean>>({});
	// Rows whose expanded player has loaded or failed, which ends their `aria-busy`.
	let settled = $state<Record<string, true>>({});
	$effect(() => {
		void expanded;
		untrack(() => {
			overrides = {};
			settled = {};
		});
	});

	function isExpanded(id: string): boolean {
		return overrides[id] ?? expanded === true;
	}

	function toggle(id: string): void {
		const next = !isExpanded(id);
		overrides = { ...overrides, [id]: next };
		const { [id]: _, ...rest } = settled;
		settled = rest;
		announce("expanded-change", { id, expanded: next });
	}

	function announce(type: string, detail: unknown): void {
		hostElement.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
	}

	function rowId(event: Event): string | undefined {
		const target = event.target instanceof Element ? event.target : null;
		return target?.closest("[data-item-id]")?.getAttribute("data-item-id") ?? undefined;
	}

	function isItemRow(event: Event): boolean {
		return event.target instanceof Element && event.target.classList.contains("pie-item-list__item");
	}

	let listElement = $state<HTMLElement | undefined>();
	$effect(() => {
		const target = listElement;
		if (!target) return;
		const onError = (event: Event) => {
			const id = rowId(event);
			if (id === undefined) return;
			event.stopPropagation();
			if (isItemRow(event)) settled = { ...settled, [id]: true };
			announce("player-error", { ...(event as CustomEvent).detail, id });
		};
		const onLoad = (event: Event) => {
			const id = rowId(event);
			if (id === undefined || !isItemRow(event)) return;
			if ((event as CustomEvent).detail?.view === "player") settled = { ...settled, [id]: true };
		};
		target.addEventListener("player-error", onError);
		target.addEventListener("load-complete", onLoad);
		return () => {
			target.removeEventListener("player-error", onError);
			target.removeEventListener("load-complete", onLoad);
		};
	});

	// Hosts the entry's extension; re-renders only when the entry or extension changes identity.
	function extension(
		node: HTMLElement,
		[source, entry]: [ItemListExtension, ItemListEntry],
	) {
		const mounted = mountExtension(node, source, entry);
		return {
			update: ([nextSource, nextEntry]: [ItemListExtension, ItemListEntry]) =>
				mounted.update(nextSource, nextEntry),
			destroy: () => mounted.destroy(),
		};
	}

	// Marks a clipped view whose content runs past the clip, so only that one fades.
	function clip(node: HTMLElement) {
		const measure = () => {
			node.toggleAttribute("data-overflowing", node.scrollHeight > node.clientHeight + 1);
		};
		if (typeof ResizeObserver === "undefined") {
			measure();
			return {};
		}
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		for (const child of node.children) observer.observe(child);
		const mutations = new MutationObserver(() => {
			observer.disconnect();
			observer.observe(node);
			for (const child of node.children) observer.observe(child);
			measure();
		});
		mutations.observe(node, { childList: true });
		return {
			destroy() {
				observer.disconnect();
				mutations.disconnect();
			},
		};
	}
</script>

<ul class="pie-item-list" bind:this={listElement}>
	{#each rows as entry, index (entry.id)}
		{@const open = isExpanded(entry.id)}
		{@const viewId = `${listId}-view-${index}`}
		<li
			class="pie-item-list__row"
			data-item-id={entry.id}
			aria-busy={open && !settled[entry.id] ? "true" : undefined}
		>
			<div class="pie-item-list__details">
				{#if details}
					<div class="pie-item-list__extension" use:extension={[details, entry]}></div>
				{:else}
					{#if entry.name}
						<div class="pie-item-list__name">{entry.name}</div>
					{/if}
					<code class="pie-item-list__id">{entry.id}</code>
					{#if entry.version}
						<div class="pie-item-list__version">{entry.version}</div>
					{/if}
				{/if}
			</div>
			<div class="pie-item-list__content">
				{#if actions}
					<div class="pie-item-list__actions" use:extension={[actions, entry]}></div>
				{/if}
				<div
					class="pie-item-list__view"
					class:pie-item-list__view--clipped={!open}
					id={viewId}
					use:clip
				>
					{#if entry.passage}
						<pie-item-summary
							class="pie-item-list__passage"
							config={entry.passage}
							{env}
							{resolve}
							{locale}
							{strategy}
							{loaderOptions}
							expanded={open}
						></pie-item-summary>
					{/if}
					<pie-item-summary
						class="pie-item-list__item"
						config={entry.config}
						summary={entry.summary}
						{env}
						{resolve}
						{locale}
						{strategy}
						{loaderOptions}
						expanded={open}
					></pie-item-summary>
				</div>
				{#if highlights}
					<div class="pie-item-list__highlights" use:extension={[highlights, entry]}></div>
				{/if}
			</div>
			<button
				type="button"
				class="pie-item-list__toggle"
				aria-expanded={open ? "true" : "false"}
				aria-controls={viewId}
				aria-label={messages.t("player.list.expandA11y")}
				title={messages.t("player.list.expandA11y")}
				onclick={() => toggle(entry.id)}
			>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
					<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</li>
	{/each}
</ul>

<style>
	.pie-item-list {
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--pie-text, #1f2937);
		font-size: calc(1rem * var(--pie-font-scale, 1));
		container-type: inline-size;
	}

	.pie-item-list__row {
		display: grid;
		grid-template-columns: minmax(0, 12em) minmax(0, 1fr) auto;
		grid-template-areas: "details content toggle";
		align-items: start;
		gap: 0.75em 1em;
		padding: 0.75em 0;
		border-bottom: 1px solid var(--pie-border-light, #d1d5db);
	}

	/* Narrow lists stack the details above the content, keeping the toggle beside the details. */
	@container (max-width: 36em) {
		.pie-item-list__row {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-areas:
				"details toggle"
				"content content";
		}
	}

	.pie-item-list__details {
		grid-area: details;
		display: flex;
		flex-direction: column;
		gap: 0.25em;
		overflow-wrap: anywhere;
	}

	.pie-item-list__name {
		font-weight: 600;
	}

	.pie-item-list__id,
	.pie-item-list__version {
		font-size: 0.875em;
	}

	.pie-item-list__content {
		grid-area: content;
		min-width: 0;
	}

	/* Floated, so the summary flows around the host's buttons instead of under them. */
	.pie-item-list__actions {
		float: inline-end;
		margin-inline-start: 0.75em;
		margin-bottom: 0.5em;
	}

	.pie-item-list__view {
		display: flex;
		flex-direction: column;
		gap: 0.75em;
	}

	.pie-item-list__view > :global(*) {
		flex-shrink: 0;
	}

	.pie-item-list__view--clipped {
		max-height: 7em;
		overflow: hidden;
	}

	.pie-item-list__view--clipped:global([data-overflowing]) {
		mask-image: linear-gradient(to bottom, #000 60%, transparent);
	}

	/* Outside the clip, so a collapsed row still shows why it matched. */
	.pie-item-list__highlights {
		clear: both;
		margin-top: 0.75em;
	}

	.pie-item-list__highlights:empty {
		display: none;
	}

	.pie-item-list__passage {
		display: block;
		padding-bottom: 0.75em;
		border-bottom: 1px dashed var(--pie-border-light, #d1d5db);
	}

	.pie-item-list__toggle {
		grid-area: toggle;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25em;
		height: 2.25em;
		padding: 0;
		border: 1px solid var(--pie-border-light, #d1d5db);
		border-radius: 0.375em;
		background: var(--pie-secondary-background, #f3f4f6);
		color: inherit;
		cursor: pointer;
	}

	.pie-item-list__toggle:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	.pie-item-list__toggle svg {
		transition: transform 150ms ease;
	}

	.pie-item-list__toggle[aria-expanded="true"] svg {
		transform: rotate(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.pie-item-list__toggle svg {
			transition: none;
		}
	}
</style>
