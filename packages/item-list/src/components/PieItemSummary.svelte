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
		},
	}}
/>

<!--
@component
One PIE item as a list row: its stem, prompts, options and, for instructors, its answers, rendered as sanitized HTML with math as MathML. No element code loads. A host gives it the item `config`, or a precomputed `summary`, and keeps its own list, card and expand chrome around it.

@fires {CustomEvent<{ view: "summary" }>} load-complete - Once the summary has rendered with its math converted.
-->

<script lang="ts">
	import {
		createPieI18n,
		DEFAULT_LOCALE,
	} from "@pie-players/pie-players-shared/i18n";
	import type { Env, ItemConfig } from "@pie-players/pie-players-shared/types";
	import { tick, untrack } from "svelte";
	import {
		type ItemSummary,
		type SummaryResolver,
		summarizeItem,
	} from "../summarize/summarize-item.js";
	import {
		type RenderedBlock,
		type RenderedSummary,
		renderSummary,
	} from "./render.js";

	let {
		config,
		env,
		summary,
		resolve,
		locale = "",
	}: {
		config?: ItemConfig;
		env?: Env;
		summary?: ItemSummary;
		resolve?: SummaryResolver;
		locale?: string;
	} = $props();

	const hostElement: HTMLElement = $host();

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
			// Every key still resolves through the English fallback when a catalog fails to load.
			void Promise.resolve(i18n.setLocale(requested || DEFAULT_LOCALE)).catch(
				() => {},
			);
		});
	});
	// A new object per catalog change: a derived that returns the same `i18n` compares equal and
	// never re-renders the labels read through it.
	const messages = $derived((void i18nVersion, { t: i18n.t.bind(i18n) }));

	let rendered = $state<RenderedSummary | null>(null);
	let generation = 0;

	$effect(() => {
		// `env` defaults to an instructor view; only an explicit student role withholds answers.
		const role = env?.role === "student" ? "student" : "instructor";
		const precomputed = summary?.schema === 1 ? summary : null;
		const item = config;
		const resolver = resolve;
		const run = ++generation;
		void (async () => {
			try {
				const source =
					precomputed ??
					(item ? await summarizeItem(item, { role, resolve: resolver }) : null);
				const view = source ? await renderSummary(source, role) : null;
				if (run !== generation) return;
				rendered = view;
				if (!view) return;
				await tick();
				if (run !== generation) return;
				hostElement.dispatchEvent(
					new CustomEvent("load-complete", {
						detail: { view: "summary" },
						bubbles: true,
						composed: true,
					}),
				);
			} catch (error) {
				console.error("[pie-item-summary] The summary could not be rendered.", error);
			}
		})();
	});
</script>

{#snippet block(content: RenderedBlock)}
	{#if content.prompt}
		<div class="pie-item-summary__prompt">{@html content.prompt}</div>
	{/if}
	{#if content.options.length > 0}
		<ul class="pie-item-summary__options">
			{#each content.options as option (option.id)}
				<li class="pie-item-summary__option" class:pie-item-summary__option--correct={option.correct}>
					{#if option.correct}
						<span class="pie-item-summary__marker" aria-hidden="true">✓</span>
						<span class="pie-item-summary__sr-only">{messages.t("player.summary.correctA11y")}</span>
					{/if}
					<span class="pie-item-summary__option-label">{@html option.label}</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#if content.answer}
		<div class="pie-item-summary__answer">
			<span class="pie-item-summary__answer-label">{messages.t("player.summary.answer")}</span>
			<div class="pie-item-summary__answer-content">{@html content.answer}</div>
		</div>
	{/if}
{/snippet}

{#if rendered}
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

<style>
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

	.pie-item-summary__options {
		margin: 0;
		padding-inline-start: 1.5em;
	}

	.pie-item-summary__option--correct {
		color: var(--pie-correct, #0b7a3e);
	}

	.pie-item-summary__marker {
		margin-inline-end: 0.25em;
		font-weight: 700;
	}

	.pie-item-summary__answer-label {
		font-weight: 600;
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
