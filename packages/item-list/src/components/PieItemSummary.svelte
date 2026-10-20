<svelte:options
	customElement={{
		// The build's `guardSvelteCustomElementDefines` leaves an already-registered tag alone.
		tag: "pie-item-summary",
		// Light DOM, so the host's content styles reach the summary as they reach the player.
		shadow: "none",
		props: {
			config: { attribute: "config", type: "Object" },
			env: { attribute: "env", type: "Object" },
			summary: { attribute: "summary", type: "Object" },
			resolve: { type: "Object", reflect: false },
			// Interface locale for the row's own labels, as a BCP-47 tag. Unset renders `en-US`.
			locale: { attribute: "locale", type: "String" },
			// A provider for the row's labels and its player's; `<pie-item-list>` hands every row its own.
			i18n: { type: "Object", reflect: false },
			expanded: { attribute: "expanded", type: "Boolean" },
			strategy: { attribute: "strategy", type: "String" },
			loaderOptions: { type: "Object", reflect: false },
		},
		extend: coerceBooleanAttributes,
	}}
/>

<!--
@component
One PIE item as a list row: its stem, prompts, options and, for instructors, its answers, rendered as sanitized HTML with math as MathML, loading no element code until it expands. A host gives it the item `config`, or a precomputed `summary`, and keeps its own list, card and expand chrome around it. Set `expanded` and the row mounts `<pie-item-player>` for the item once it nears the viewport, keeps the summary showing until the player has loaded, then swaps it in place.

@fires {CustomEvent<{ view: "summary" | "player" }>} load-complete - `summary` once per rendered summary, after math conversion; a new `env` with the same role does not re-render. `player` once the expanded row's player has loaded and replaced the summary.
@fires {CustomEvent<{ code: string; message: string; recoverable: boolean }>} player-error - The expanded row's player failed to load, re-dispatched with the player's detail, or did not load in time (`recoverable: true`). The summary keeps showing; collapsing and expanding again retries.
@fires {CustomEvent<{ kind: "i18n-locale-load"; source: string; message: string; details: string[]; recoverable: true; scope: "runtime"; cause?: unknown }>} framework-error - A requested interface-locale catalog failed to load; the row's labels fall back to English, and re-setting `locale` retries.
-->

<script lang="ts">
	import type { I18nProvider } from "@pie-players/pie-players-shared/i18n";
	import type { Env, ItemConfig } from "@pie-players/pie-players-shared/types";
	import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
	import { tick, untrack } from "svelte";
	import {
		loadItemPlayer,
		type PlayerLoadInputs,
		type PlayerTicket,
		playerScheduler,
	} from "../player/scheduler.js";
	import {
		type ItemSummary,
		type SummaryResolver,
		summarizeItem,
	} from "../summarize/summarize-item.js";
	import { isItemSummary } from "../summarize/validate.js";
	import { useInterfaceI18n } from "./interface-i18n.svelte.js";
	import {
		type RenderedBlock,
		type RenderedOption,
		type RenderedSummary,
		renderSummary,
	} from "./render.js";

	let {
		config,
		env,
		summary,
		resolve,
		locale = "",
		i18n,
		expanded = false,
		strategy,
		loaderOptions,
	}: {
		config?: ItemConfig;
		env?: Env;
		summary?: ItemSummary;
		resolve?: SummaryResolver;
		locale?: string;
		i18n?: I18nProvider | null;
		expanded?: boolean;
		strategy?: PlayerLoadInputs["strategy"];
		loaderOptions?: PlayerLoadInputs["loaderOptions"];
	} = $props();

	const hostElement: HTMLElement = $host();

	const interfaceI18n = useInterfaceI18n(hostElement, "pie-item-summary", () => ({ i18n, locale }));
	const messages = $derived(interfaceI18n.messages);

	let rendered = $state<RenderedSummary | null>(null);
	let generation = 0;

	// `env` defaults to an instructor view; only an explicit student role withholds answers. A
	// derived role re-renders on a role change alone, not on every new `env` object.
	const role = $derived(env?.role === "student" ? "student" : "instructor");

	$effect(() => {
		const viewRole = role;
		const precomputed = isItemSummary(summary) ? summary : null;
		const item = config;
		const resolver = resolve;
		const run = ++generation;
		void (async () => {
			try {
				const source =
					precomputed ??
					(item ? await summarizeItem(item, { role: viewRole, resolve: resolver }) : null);
				const view = source ? await renderSummary(source, viewRole) : null;
				if (run !== generation) return;
				rendered = view;
				if (!view) return;
				await tick();
				if (run !== generation || untrack(() => playerShown)) return;
				announce("load-complete", { view: "summary" });
			} catch (error) {
				console.error("[pie-item-summary] The summary could not be rendered.", error);
			}
		})();
	});

	function announce(type: string, detail: unknown): void {
		hostElement.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
	}

	// The player view. The scheduler grants the row a slot once it nears the viewport; the player
	// then mounts hidden behind the summary and replaces it on its `load-complete`.
	let playerMounted = $state(false);
	let playerShown = $state(false);
	let playerHost = $state<HTMLElement | undefined>();
	let ticket: PlayerTicket | undefined;
	const playerEnv = $derived(env ?? { mode: "view", role: "instructor" });

	$effect(() => {
		if (!expanded || !config) return;
		const item = config;
		const inputs: PlayerLoadInputs = { strategy, loaderOptions };
		let open = true;
		untrack(() => {
			ticket = playerScheduler().request({
				element: hostElement,
				config: item,
				inputs,
				grant: () => {
					loadItemPlayer().then(
						() => {
							if (open) playerMounted = true;
						},
						(error: unknown) => {
							if (!open) return;
							ticket?.release();
							announce("player-error", {
								code: "ITEM_SUMMARY_PLAYER_UNAVAILABLE",
								message: `The item player could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
								recoverable: true,
							});
						},
					);
				},
				timeout: () => {
					if (!open) return;
					playerMounted = false;
					announce("player-error", {
						code: "ITEM_SUMMARY_PLAYER_TIMEOUT",
						message: "The item player did not load in time; the summary keeps showing.",
						recoverable: true,
					});
				},
			});
		});
		return () => {
			open = false;
			ticket?.release();
			ticket = undefined;
			playerMounted = false;
			playerShown = false;
		};
	});

	// The player's own `load-complete` and `player-error` stop at the row, which reports them as its own.
	$effect(() => {
		const target = playerHost;
		if (!target) return;
		const onLoad = (event: Event) => {
			event.stopPropagation();
			if (playerShown) return;
			ticket?.release();
			playerShown = true;
			announce("load-complete", { view: "player" });
		};
		const onError = (event: Event) => {
			event.stopPropagation();
			const detail = (event as CustomEvent).detail;
			if (detail?.recoverable !== true) {
				ticket?.release();
				playerMounted = false;
				playerShown = false;
			}
			announce("player-error", detail);
		};
		target.addEventListener("load-complete", onLoad);
		target.addEventListener("player-error", onError);
		return () => {
			target.removeEventListener("load-complete", onLoad);
			target.removeEventListener("player-error", onError);
		};
	});
</script>

{#snippet options(list: RenderedOption[])}
	<ul class="pie-item-summary__options">
		{#each list as option (option.id)}
			<li class="pie-item-summary__option" class:pie-item-summary__option--correct={option.correct}>
				<span class="pie-item-summary__option-body">
					{#if option.correct}
						<span class="pie-item-summary__marker" aria-hidden="true">✓</span>
						<span class="pie-item-summary__sr-only">{messages.t("player.summary.correctA11y")}</span>
					{/if}
					<span class="pie-item-summary__option-label">{@html option.label}</span>
				</span>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet block(content: RenderedBlock)}
	{#if content.prompt}
		<div class="pie-item-summary__prompt">{@html content.prompt}</div>
	{/if}
	{#if content.groups.some((group) => group.label)}
		<ul class="pie-item-summary__groups">
			{#each content.groups as group, index (index)}
				<li class="pie-item-summary__group">
					{#if group.label}
						<div class="pie-item-summary__group-label">{@html group.label}</div>
					{/if}
					{@render options(group.options)}
				</li>
			{/each}
		</ul>
	{:else if content.groups.length > 0}
		{@render options(content.groups[0].options)}
	{/if}
	{#if content.answer}
		<div class="pie-item-summary__answer">
			<span class="pie-item-summary__answer-label">{messages.t("player.summary.answer")}</span>
			<div class="pie-item-summary__answer-content">{@html content.answer}</div>
		</div>
	{/if}
{/snippet}

<div class="pie-item-summary__view">
{#if rendered && !playerShown}
	<div class="pie-item-summary">
		{#if rendered.stem}
			<div class="pie-item-summary__stem">{@html rendered.stem}</div>
		{/if}
		{#each rendered.entries as entry (entry.id)}
			<div class="pie-item-summary__entry" data-pkg={entry.pkg} data-source={entry.source}>
				{#if entry.source === "label"}
					<p class="pie-item-summary__label">{entry.label}</p>
				{/if}
				{#if entry.manualScoring}
					<span class="pie-item-summary__badge">{messages.t("player.summary.manualScoring")}</span>
				{/if}
				{@render block(entry)}
				{#each entry.parts as part, index (index)}
					<div class="pie-item-summary__part">{@render block(part)}</div>
				{/each}
				{#if entry.figure}
					<div class="pie-item-summary__figure">{@html entry.figure}</div>
				{/if}
				{#each entry.media as media, index (index)}
					<p class="pie-item-summary__media">
						{messages.t(media.kind === "video" ? "player.summary.video" : "player.summary.audio")}{media.title
							? `: ${media.title}`
							: ""}
					</p>
				{/each}
			</div>
		{/each}
	</div>
{/if}
{#if playerMounted}
	<div
		class="pie-item-summary__player"
		class:pie-item-summary__player--pending={!playerShown}
		aria-hidden={playerShown ? undefined : "true"}
		inert={!playerShown}
		bind:this={playerHost}
	>
		<pie-item-player
			config={config}
			env={playerEnv}
			strategy={strategy}
			loaderOptions={loaderOptions}
			i18n={interfaceI18n.provider}
			addCorrectResponse={role === "instructor"}
		></pie-item-player>
	</div>
{/if}
</div>

<style>
	.pie-item-summary__view {
		position: relative;
	}

	/* Laid out at the row's width while it loads, so elements measure as they will show. */
	.pie-item-summary__player--pending {
		position: absolute;
		inset: 0 0 auto 0;
		visibility: hidden;
		pointer-events: none;
	}

	.pie-item-summary {
		color: var(--pie-text, #1f2937);
		font-size: calc(1rem * var(--pie-font-scale, 1));
		display: flex;
		flex-direction: column;
		gap: 0.5em;
	}

	.pie-item-summary__entry,
	.pie-item-summary__part {
		display: flex;
		flex-direction: column;
		gap: 0.375em;
	}

	.pie-item-summary__label {
		margin: 0;
		font-style: italic;
	}

	.pie-item-summary__badge {
		align-self: flex-start;
		padding: 0.125em 0.5em;
		border: 1px solid var(--pie-border-light, #d1d5db);
		border-radius: 999px;
		background: var(--pie-secondary-background, #f3f4f6);
		font-size: 0.875em;
	}

	.pie-item-summary__options,
	.pie-item-summary__groups {
		margin: 0;
		padding-inline-start: 1.5em;
	}

	.pie-item-summary__groups {
		list-style: none;
		padding-inline-start: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375em;
	}

	.pie-item-summary__group-label {
		font-weight: 600;
	}

	.pie-item-summary__option--correct {
		color: var(--pie-correct, #0b7a3e);
	}

	/* A row, so a label the author wrapped in a block element stays beside its check mark. */
	.pie-item-summary__option-body {
		display: flex;
		align-items: baseline;
		gap: 0.25em;
	}

	.pie-item-summary__option-label {
		min-width: 0;
	}

	/* The view's gaps space its blocks, so the outer margins of each authored fragment go. */
	:is(
			.pie-item-summary__stem,
			.pie-item-summary__prompt,
			.pie-item-summary__group-label,
			.pie-item-summary__option-label,
			.pie-item-summary__answer-content
		)
		:global(:first-child) {
		margin-block-start: 0;
	}

	:is(
			.pie-item-summary__stem,
			.pie-item-summary__prompt,
			.pie-item-summary__group-label,
			.pie-item-summary__option-label,
			.pie-item-summary__answer-content
		)
		:global(:last-child) {
		margin-block-end: 0;
	}

	.pie-item-summary__marker {
		font-weight: 700;
	}

	.pie-item-summary__answer-label {
		font-weight: 600;
	}

	/* Summarizers mark each cloze blank with its number, matching the numbered answer list. */
	.pie-item-summary :global(.pie-item-summary__blank) {
		display: inline-block;
		min-width: 2.5em;
		padding: 0 0.25em;
		border-bottom: 1px solid var(--pie-border-dark, #6b7280);
		text-align: center;
		font-weight: 600;
	}

	.pie-item-summary__answer-content :global(table) {
		border-collapse: collapse;
	}

	.pie-item-summary__answer-content :global(:is(th, td)) {
		padding: 0.125em 0.75em;
		border: 1px solid var(--pie-border-light, #d1d5db);
		text-align: start;
	}

	.pie-item-summary__media {
		margin: 0;
	}

	.pie-item-summary__figure :global(img) {
		max-width: 100%;
		height: auto;
	}

	.pie-item-summary__sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
