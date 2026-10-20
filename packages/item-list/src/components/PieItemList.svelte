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
			i18n: { type: "Object", reflect: false },
			expanded: { attribute: "expanded", type: "Boolean" },
			expandedIds: { type: "Array", reflect: false },
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
PIE items as a list of `<pie-item-summary>` rows, for a host with no list chrome of its own. Each row shows the entry's details in a leading column, the host's actions in its top-end corner, the item's summary clipped to a fixed height under its passage's first line, and the entry's search matches below it. The row's expand button removes the clips and mounts the item's player.

@fires {CustomEvent<{ id: string; expanded: boolean; expandedIds: string[] }>} expanded-change - A row's expand button was pressed. `expandedIds` lists every expanded row, for a host that restores them through `expandedIds`.
@fires {CustomEvent<{ id: string; code: string; message: string; recoverable: boolean }>} player-error - A row's player failed to load, with the entry `id` added to `<pie-item-summary>`'s detail.
@fires {CustomEvent<{ view: "summary" | "player" }>} load-complete - Bubbles unchanged from each row's `<pie-item-summary>`, passage rows included; the entry's `id` is on the closest `[data-item-id]`.
@fires {CustomEvent<{ kind: "i18n-locale-load"; source: string; message: string; details: string[]; recoverable: true; scope: "runtime"; cause?: unknown }>} framework-error - A requested interface-locale catalog failed to load; the labels fall back to English, and re-setting `locale` retries.
-->

<script lang="ts">
	import type { I18nProvider } from "@pie-players/pie-players-shared/i18n";
	import type { Env } from "@pie-players/pie-players-shared/types";
	import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
	import { tick, untrack } from "svelte";
	import {
		type ItemListEntry,
		type ItemListExtension,
		type ItemListHighlight,
		mountExtension,
	} from "../list/extension.js";
	import { type RenderedHighlight, renderHighlights } from "../list/highlights.js";
	import type { PlayerLoadInputs } from "../player/scheduler.js";
	import type { SummaryResolver } from "../summarize/summarize-item.js";
	import { useInterfaceI18n } from "./interface-i18n.svelte.js";
	import "./PieItemSummary.svelte";

	let {
		items = [],
		env,
		resolve,
		locale = "",
		i18n,
		expanded = false,
		expandedIds,
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
		i18n?: I18nProvider | null;
		expanded?: boolean;
		expandedIds?: string[];
		strategy?: PlayerLoadInputs["strategy"];
		loaderOptions?: PlayerLoadInputs["loaderOptions"];
		details?: ItemListExtension;
		actions?: ItemListExtension;
		highlights?: ItemListExtension;
	} = $props();

	const hostElement: HTMLElement = $host();
	const listId = `pie-item-list-${++listCount}`;

	// One provider for the list, its rows and their players.
	const interfaceI18n = useInterfaceI18n(hostElement, "pie-item-list", () => ({ i18n, locale }));
	const messages = $derived(interfaceI18n.messages);

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

	// Compared by content, so a host that hands over an equal array on every render keeps the rows' toggles.
	const requestedKey = $derived(
		Array.isArray(expandedIds)
			? JSON.stringify([...new Set(expandedIds.filter((id) => typeof id === "string"))].sort())
			: "[]",
	);
	const requested = $derived(new Set<string>(JSON.parse(requestedKey)));

	// A row's own toggle overrides `expanded` and `expandedIds` until either changes again.
	let overrides = $state<Record<string, boolean>>({});
	// Rows whose expanded player has loaded or failed, which ends their `aria-busy`.
	let settled = $state<Record<string, true>>({});
	$effect(() => {
		void expanded;
		void requestedKey;
		untrack(() => {
			overrides = {};
			settled = {};
		});
	});

	function isExpanded(id: string): boolean {
		return overrides[id] ?? (expanded === true || requested.has(id));
	}

	function toggle(id: string, button: HTMLElement): void {
		const next = !isExpanded(id);
		overrides = { ...overrides, [id]: next };
		const { [id]: _, ...rest } = settled;
		settled = rest;
		announce("expanded-change", {
			id,
			expanded: next,
			expandedIds: rows.filter((entry) => isExpanded(entry.id)).map((entry) => entry.id),
		});
		// A tall row collapsing under the reader would leave its button above the viewport.
		if (!next) void tick().then(() => button.scrollIntoView?.({ block: "nearest" }));
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

	// Parsed once per `highlights` array, not on every render of its row.
	const parsedHighlights = new WeakMap<ItemListHighlight[], RenderedHighlight[]>();
	function shownHighlights(entry: ItemListEntry): RenderedHighlight[] {
		const source = entry.highlights;
		if (!Array.isArray(source)) return [];
		let parsed = parsedHighlights.get(source);
		if (!parsed) {
			parsed = renderHighlights(source);
			parsedHighlights.set(source, parsed);
		}
		return parsed;
	}

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

	// Marks a clipped summary whose content runs past the clip, so only that one fades.
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
		{@const detailsId = `${listId}-details-${index}`}
		{@const found = highlights ? [] : shownHighlights(entry)}
		<li
			class="pie-item-list__row"
			data-item-id={entry.id}
			aria-busy={open && !settled[entry.id] ? "true" : undefined}
		>
			<div class="pie-item-list__details" id={detailsId}>
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
				<div class="pie-item-list__view" id={viewId}>
					{#if entry.passage}
						<pie-item-summary
							class="pie-item-list__passage"
							class:pie-item-list__passage--collapsed={!open}
							config={entry.passage}
							{env}
							{resolve}
							i18n={interfaceI18n.provider}
							{strategy}
							{loaderOptions}
							expanded={open}
						></pie-item-summary>
					{/if}
					<pie-item-summary
						class="pie-item-list__item"
						class:pie-item-list__item--clipped={!open}
						config={entry.config}
						summary={entry.summary}
						{env}
						{resolve}
						i18n={interfaceI18n.provider}
						{strategy}
						{loaderOptions}
						expanded={open}
						use:clip
					></pie-item-summary>
				</div>
				{#if highlights}
					<div class="pie-item-list__highlights" use:extension={[highlights, entry]}></div>
				{:else if found.length > 0}
					<div class="pie-item-list__highlights" role="group" aria-labelledby={`${listId}-highlights-${index}`}>
						<p class="pie-item-list__highlights-title" id={`${listId}-highlights-${index}`}>
							{messages.t("player.list.highlights")}
						</p>
						<ul class="pie-item-list__highlight-fields">
							{#each found as field, fieldIndex (fieldIndex)}
								<li class="pie-item-list__highlight-field">
									{#if field.label}
										<span class="pie-item-list__highlight-label">{field.label}</span>
									{/if}
									{#each field.snippets as snippet, snippetIndex (snippetIndex)}
										<p class="pie-item-list__snippet">{#each snippet as segment, segmentIndex (segmentIndex)}{#if segment.mark}<mark>{segment.text}</mark>{:else}{segment.text}{/if}{/each}</p>
									{/each}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
			<button
				type="button"
				class="pie-item-list__toggle"
				aria-expanded={open ? "true" : "false"}
				aria-controls={viewId}
				aria-describedby={detailsId}
				aria-label={messages.t("player.list.expandA11y")}
				title={messages.t("player.list.expandA11y")}
				onclick={(event) => toggle(entry.id, event.currentTarget)}
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

	/* Collapsed, a passage shows its first line, so the item below it stays in view. */
	.pie-item-list__passage--collapsed {
		max-height: 1.5em;
		max-height: 1lh;
		overflow: hidden;
	}

	.pie-item-list__item {
		display: block;
	}

	.pie-item-list__item--clipped {
		max-height: var(--pie-item-list-clip-height, 7em);
		overflow: hidden;
	}

	.pie-item-list__item--clipped:global([data-overflowing]) {
		mask-image: linear-gradient(to bottom, #000 60%, transparent);
	}

	.pie-item-list__passage {
		display: block;
		padding-bottom: 0.75em;
		border-bottom: 1px dashed var(--pie-border-light, #d1d5db);
	}

	/* Outside the clips, so a collapsed row still shows why it matched. */
	.pie-item-list__highlights {
		clear: both;
		margin-top: 0.75em;
		font-size: 0.875em;
	}

	.pie-item-list__highlights:empty {
		display: none;
	}

	.pie-item-list__highlights-title {
		margin: 0 0 0.25em;
		font-weight: 600;
	}

	.pie-item-list__highlight-fields {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.375em;
	}

	.pie-item-list__highlight-label {
		font-weight: 500;
	}

	.pie-item-list__snippet {
		margin: 0.125em 0 0;
		padding-inline-start: 0.75em;
		overflow-wrap: anywhere;
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
		/* Stays in view while a tall expanded row scrolls past, below any sticky host header. */
		position: sticky;
		top: calc(var(--pie-item-list-sticky-top, 0px) + 0.5em);
		scroll-margin-top: calc(var(--pie-item-list-sticky-top, 0px) + 0.5em);
		z-index: 1;
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

	/* While the row's player loads, a spinner stands in for the chevron. */
	.pie-item-list__row[aria-busy="true"] .pie-item-list__toggle svg {
		opacity: 0;
	}

	.pie-item-list__row[aria-busy="true"] .pie-item-list__toggle::after {
		content: "";
		position: absolute;
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-inline-end-color: transparent;
		border-radius: 50%;
		animation: pie-item-list-spin 800ms linear infinite;
	}

	@keyframes pie-item-list-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pie-item-list__toggle svg {
			transition: none;
		}

		.pie-item-list__row[aria-busy="true"] .pie-item-list__toggle::after {
			animation: none;
		}
	}
</style>
