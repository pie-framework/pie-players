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
			loaderConfig: { type: "Object", reflect: false },
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
PIE items as a list of `<pie-item-summary>` rows, for a host with no list chrome of its own. Each row shows the entry's details in a leading column, the host's actions in its top-end corner, the item's summary clipped to a fixed height under the first line of each of its passages, and the entry's search matches below it. The row's expand button removes the clips and mounts the item's player.

@fires {CustomEvent<{ id: string; expanded: boolean; expandedIds: string[] }>} expanded-changed - A row's expand button was pressed. `expandedIds` lists the expanded rows among the current `items`, for a host that restores them through `expandedIds`.
@fires {CustomEvent<{ id: string; part: "item" | "passage"; code: string; message: string; recoverable: boolean }>} player-error - A row's player failed to load, with the entry `id` and the failed `part` added to `<pie-item-summary>`'s detail.
@fires {CustomEvent<{ id: string; part: "item" | "passage"; view: "summary" | "player" }>} load-complete - A row's item or passage summary rendered, or its player loaded.
@fires {CustomEvent<{ id: string; slot: "details" | "actions" | "highlights"; phase: "render" | "update" | "destroy"; cause: unknown }>} extension-error - A row extension threw or rejected; the rest of the list keeps rendering.
@fires {CustomEvent<{ kind: "i18n-locale-load"; source: string; message: string; details: string[]; recoverable: true; scope: "runtime"; cause?: unknown }>} framework-error - A requested interface-locale catalog failed to load; the labels fall back to English, and re-setting `locale` retries.
-->

<script lang="ts">
	import type { I18nProvider } from "@pie-players/pie-players-shared/i18n";
	import type { Env } from "@pie-players/pie-players-shared/types";
	import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
	import { useInterfaceI18n } from "@pie-players/pie-players-shared/ui/interface-i18n";
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
		loaderConfig,
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
		loaderConfig?: PlayerLoadInputs["loaderConfig"];
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
			if (!entry || typeof entry.id !== "string" || entry.id.length === 0) {
				console.warn("[pie-item-list] An entry without a string `id` does not show.", entry);
				return false;
			}
			if (seen.has(entry.id)) {
				console.warn(`[pie-item-list] Entry id "${entry.id}" repeats; only its first entry shows.`);
				return false;
			}
			seen.add(entry.id);
			return true;
		});
	});

	// `expandedIds`, when set, decides which rows open; `expanded` applies only without it. Compared by
	// content, so a host that hands over an equal array on every render keeps the rows' toggles.
	const requestedKey = $derived(
		Array.isArray(expandedIds)
			? JSON.stringify([...new Set(expandedIds.filter((id) => typeof id === "string"))].sort())
			: expanded === true
				? "all"
				: "none",
	);
	const requested = $derived(
		requestedKey === "all" || requestedKey === "none"
			? requestedKey === "all"
			: new Set<string>(JSON.parse(requestedKey)),
	);

	// A row's own toggle overrides the requested state until the request changes.
	let overrides = $state<Record<string, boolean>>({});
	// Expanded rows whose player has loaded or failed, which ends their `aria-busy`. A row without a
	// `config` has no player to wait for, so it is not busy until the host sets one.
	let settled = $state<Record<string, true>>({});
	// A row whose player failed, until it collapses.
	let failed = $state<Record<string, true>>({});

	function isRequested(id: string): boolean {
		return typeof requested === "boolean" ? requested : requested.has(id);
	}

	function isExpanded(id: string): boolean {
		return overrides[id] ?? isRequested(id);
	}

	/** `record` without the ids `keep` rejects, or `record` itself when it loses none. */
	function pruned<T>(record: Record<string, T>, keep: (id: string) => boolean): Record<string, T> {
		const ids = Object.keys(record);
		return ids.every(keep) ? record : Object.fromEntries(ids.filter(keep).map((id) => [id, record[id]]));
	}

	// A new request resets the toggles. A row that stays open keeps its loaded player, so only rows
	// that close lose their load state.
	$effect(() => {
		void requestedKey;
		untrack(() => {
			overrides = {};
			settled = pruned(settled, isRequested);
			failed = pruned(failed, isRequested);
		});
	});

	// State for entries that left `items` goes, so an entry that returns starts fresh.
	$effect(() => {
		const present = new Set(rows.map((entry) => entry.id));
		const keep = (id: string) => present.has(id);
		untrack(() => {
			overrides = pruned(overrides, keep);
			settled = pruned(settled, keep);
			failed = pruned(failed, keep);
		});
	});

	function toggle(id: string, button: HTMLElement): void {
		const next = !isExpanded(id);
		overrides = { ...overrides, [id]: next };
		settled = pruned(settled, (key) => key !== id);
		failed = pruned(failed, (key) => key !== id);
		announce("expanded-changed", {
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

	/** The entry and part of an event from one of this list's own summaries; extensions' events pass by. */
	function origin(event: Event): { id: string; part: "item" | "passage" } | undefined {
		const target = event.target;
		if (!(target instanceof Element) || target.parentElement?.dataset.pieItemListView !== listId) return;
		const id = target.closest("[data-pie-item-id]")?.getAttribute("data-pie-item-id");
		if (id == null) return;
		return { id, part: target.classList.contains("pie-item-list__passage") ? "passage" : "item" };
	}

	let listElement = $state<HTMLElement | undefined>();
	$effect(() => {
		const target = listElement;
		if (!target) return;
		const onError = (event: Event) => {
			const from = origin(event);
			if (!from) return;
			event.stopPropagation();
			if (from.part === "item") {
				settled = { ...settled, [from.id]: true };
				failed = { ...failed, [from.id]: true };
			}
			announce("player-error", { ...(event as CustomEvent).detail, ...from });
		};
		const onLoad = (event: Event) => {
			const from = origin(event);
			if (!from) return;
			event.stopPropagation();
			const view = (event as CustomEvent).detail?.view;
			if (from.part === "item" && view === "player") {
				settled = { ...settled, [from.id]: true };
				failed = pruned(failed, (key) => key !== from.id);
			}
			announce("load-complete", { ...from, view });
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

	type Slot = "details" | "actions" | "highlights";

	// Hosts the entry's extension; re-renders only when the entry or extension changes identity.
	function extension(
		node: HTMLElement,
		[slot, source, entry]: [Slot, ItemListExtension, ItemListEntry],
	) {
		let shown = entry;
		const mounted = mountExtension(node, source, entry, (phase, cause) => {
			console.error(`[pie-item-list] The ${slot} extension failed to ${phase}.`, cause);
			announce("extension-error", { id: shown.id, slot, phase, cause });
		});
		return {
			update: ([, nextSource, nextEntry]: [Slot, ItemListExtension, ItemListEntry]) => {
				shown = nextEntry;
				mounted.update(nextSource, nextEntry);
			},
			destroy: () => mounted.destroy(),
		};
	}

	// An entry id as an id token: `aria-controls` and `aria-labelledby` split on whitespace.
	function idToken(id: string): string {
		return id.replace(/[^A-Za-z0-9-]/g, (char) => `_${char.charCodeAt(0).toString(16)}_`);
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
	{#each rows as entry (entry.id)}
		{@const open = isExpanded(entry.id)}
		{@const token = `${listId}-${idToken(entry.id)}`}
		{@const found = highlights ? [] : shownHighlights(entry)}
		<li
			class="pie-item-list__row"
			data-pie-item-id={entry.id}
			aria-busy={open && entry.config && !settled[entry.id] ? "true" : undefined}
		>
			<div class="pie-item-list__details" id={`${token}-details`}>
				{#if details}
					<div class="pie-item-list__extension" use:extension={["details", details, entry]}></div>
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
			<!-- Before the content, so the button follows the row's details in reading and focus order. -->
			<button
				type="button"
				class="pie-item-list__toggle"
				id={`${token}-toggle`}
				aria-expanded={open ? "true" : "false"}
				aria-controls={`${token}-view`}
				aria-label={messages.t("player.list.expandA11y")}
				aria-labelledby={`${token}-toggle ${token}-details`}
				title={messages.t(open ? "player.list.collapse" : "player.list.expandA11y")}
				onclick={(event) => toggle(entry.id, event.currentTarget)}
			>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
					<path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
			<div class="pie-item-list__content">
				{#if actions}
					<div class="pie-item-list__actions" use:extension={["actions", actions, entry]}></div>
				{/if}
				<div class="pie-item-list__view" id={`${token}-view`} data-pie-item-list-view={listId}>
					{#each Array.isArray(entry.passages) ? entry.passages : [] as passage, passageIndex (passageIndex)}
						<pie-item-summary
							class="pie-item-list__passage"
							class:pie-item-list__passage--collapsed={!open}
							config={passage}
							{env}
							{resolve}
							i18n={interfaceI18n.provider}
							{strategy}
							{loaderOptions}
							{loaderConfig}
							expanded={open}
						></pie-item-summary>
					{/each}
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
						{loaderConfig}
						expanded={open}
						use:clip
					></pie-item-summary>
				</div>
				{#if open && failed[entry.id]}
					<p class="pie-item-list__status" role="alert">{messages.t("player.list.playerError")}</p>
				{/if}
				{#if highlights}
					<div class="pie-item-list__highlights" use:extension={["highlights", highlights, entry]}></div>
				{:else if found.length > 0}
					<div class="pie-item-list__highlights" role="group" aria-label={messages.t("player.list.highlights")}>
						<p class="pie-item-list__highlights-title" aria-hidden="true">
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

		/* The content spans the row's width here, so a sticky toggle would cover the player. */
		.pie-item-list__toggle {
			position: static;
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

	/* A function that renders nothing leaves the block empty; a tag name's element sets `hidden`. */
	.pie-item-list__highlights:empty,
	.pie-item-list__highlights:has(> [hidden]:only-child) {
		display: none;
	}

	.pie-item-list__status {
		margin: 0.5em 0 0;
		font-size: 0.875em;
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

	/* Forced colours paint every border one colour, so the ring's gap takes the background's. */
	@media (forced-colors: active) {
		.pie-item-list__row[aria-busy="true"] .pie-item-list__toggle::after {
			border-inline-end-color: Canvas;
		}
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
