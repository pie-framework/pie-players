<svelte:options
	customElement={{
		tag: "pie-section-player-item-card",
		// Keep light DOM so hosted item-player output can inherit runtime/page styles.
		shadow: "none",
		props: {
			item: { type: "Object", reflect: false },
			itemIndex: { attribute: "item-index", type: "Number" },
			itemCount: { attribute: "item-count", type: "Number" },
			isCurrent: { attribute: "is-current", type: "Boolean", reflect: true },
			canonicalItemId: { attribute: "canonical-item-id", type: "String" },
			// Composition context published by the pane: the level this card's own
			// heading occupies. The card renders it, and the item/passage player
			// beneath derives its outline from the same number — see
			// docs/architecture/composition-context.md.
			baseHeadingLevel: { attribute: "base-heading-level", type: "Number" },
			resolvedPlayerTag: { attribute: "resolved-player-tag", type: "String" },
			playerAction: { type: "Object", reflect: false },
			playerParams: { attribute: "player-params", type: "Object", reflect: false },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			hostButtons: { type: "Object", reflect: false },
			// Resolved formative delivery state for this item, or null when the
			// section does not deliver formatively. The pane derives it; this card
			// renders it and reports learner actions.
			formativeView: { attribute: "formative-view", type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import { onMount, untrack } from "svelte";
	import "../item-shell-element.js";
	import "@pie-players/pie-assessment-toolkit/components/item-toolbar-element";
	import type {
		AssessmentToolkitRuntimeContext,
		CatalogOwnerContext,
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		catalogOwnerContextFor,
		connectAssessmentToolkitRuntimeContext,
		dispatchCrossBoundaryEvent,
		PIE_INTERNAL_FORMATIVE_ACTION_EVENT,
		type InternalFormativeActionDetail,
	} from "@pie-players/pie-assessment-toolkit";
	import type { ItemEntity } from "@pie-players/pie-players-shared/types";
	import type { FormativeItemView } from "@pie-players/pie-players-shared/formative";
	import type { SectionPlayerCardTitleFormatter } from "../../contracts/card-title-formatters.js";
	import type { PlayerElementParams } from "./player-action.js";
	import {
		DEFAULT_SECTION_BASE_HEADING_LEVEL,
		normalizeBaseHeadingLevel,
	} from "./section-player-view-state.js";
	import {
		connectSectionPlayerCardRenderContext,
		getHostElementFromAnchor,
		type SectionPlayerCardRenderContext,
	} from "./section-player-card-context.js";
	import SectionCardMediaSplit from "./SectionCardMediaSplit.svelte";
	import SectionCardSurfaceStack from "./SectionCardSurfaceStack.svelte";
	import { CONTENT_LEAD_SURFACE } from "./card-media-region.js";

	let {
		item,
		itemIndex = 0,
		itemCount = 1,
		isCurrent = false,
		canonicalItemId,
		baseHeadingLevel = DEFAULT_SECTION_BASE_HEADING_LEVEL as number,
		resolvedPlayerTag = "div",
		playerAction = (_node: HTMLElement, _params: PlayerElementParams) => undefined,
		playerParams,
		itemToolbarTools,
		toolRegistry = null as ToolRegistry | null,
		hostButtons = [] as ToolbarItem[],
		formativeView = null as FormativeItemView | null,
	} = $props<{
		item: ItemEntity;
		itemIndex?: number;
		itemCount?: number;
		isCurrent?: boolean;
		canonicalItemId: string;
		baseHeadingLevel?: number;
		resolvedPlayerTag?: string;
		playerAction?: (node: HTMLElement, params: PlayerElementParams) => unknown;
		playerParams: PlayerElementParams;
		itemToolbarTools: string;
		toolRegistry?: ToolRegistry | null;
		hostButtons?: ToolbarItem[];
		formativeView?: FormativeItemView | null;
	}>();

	// Clamped here rather than trusted: the pane normalizes, but this card is a
	// custom element a host can drive directly, and an out-of-range level would
	// render an `<h0>`/`<h7>` that is not a heading at all.
	const resolvedHeadingLevel = $derived(
		normalizeBaseHeadingLevel(baseHeadingLevel),
	);

	let contextAnchor = $state<HTMLDivElement | null>(null);
	let contextResolvedPlayerTag = $state<string | null>(null);
	let contextPlayerAction = $state<
		((node: HTMLElement, params: PlayerElementParams) => unknown) | null
	>(null);
	let contextCardTitleFormatter = $state<SectionPlayerCardTitleFormatter | null>(null);
	let contextConnected = $state(false);
	// Stable id for aria-labelledby wiring between the host and the card heading.
	const headingId = untrack(
		() =>
			`pie-section-player-item-card-heading-${
				item?.id ?? canonicalItemId ?? Math.random().toString(36).slice(2, 10)
			}`,
	);
	// Context is the canonical source for shared render wiring while connected.
	// Props are explicit fallback when context is unavailable.
	const effectiveResolvedPlayerTag = $derived(
		(contextConnected ? contextResolvedPlayerTag : null) || resolvedPlayerTag,
	);
	const effectivePlayerAction = $derived(
		(contextConnected ? contextPlayerAction : null) || playerAction,
	);
	const itemPosition = $derived(
		Number.isFinite(itemIndex) ? Math.max(0, Number(itemIndex)) + 1 : 1,
	);
	const totalItems = $derived(Number.isFinite(itemCount) ? Math.max(1, Number(itemCount)) : 1);
	const defaultHeaderTitle = $derived(totalItems > 1 ? `Question ${itemPosition}` : "Question");
	const effectiveCardTitleFormatter = $derived(
		(contextConnected ? contextCardTitleFormatter : null) || null,
	);
	const headerTitle = $derived.by(() => {
		if (!effectiveCardTitleFormatter) return defaultHeaderTitle;
		try {
			const nextTitle = effectiveCardTitleFormatter({
				kind: "item",
				item,
				itemIndex: itemPosition - 1,
				itemCount: totalItems,
				canonicalItemId,
				defaultTitle: defaultHeaderTitle,
			});
			if (typeof nextTitle !== "string") return defaultHeaderTitle;
			const trimmedTitle = nextTitle.trim();
			return trimmedTitle || defaultHeaderTitle;
		} catch {
			return defaultHeaderTitle;
		}
	});

	// ------------------------------------------------------------------
	// Docked media
	// ------------------------------------------------------------------
	//
	// The region itself lives in `SectionCardMediaSplit`, shared with the passage
	// card: an alternate is authored against a content node, and both card kinds
	// render content nodes. What differs is the owner scope of the lookup, which is
	// what this card supplies.

	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);

	const mediaRegionId = $derived(`${headingId}-media`);
	const leadRegionId = $derived(`${headingId}-lead`);

	// Built by the same function the runtime registers catalogs with, so the
	// lookup scope cannot drift from the registered one.
	const catalogOwnerContext = $derived.by((): CatalogOwnerContext =>
		catalogOwnerContextFor({
			kind: "item",
			itemId: item?.id ?? "",
			canonicalItemId,
			assessmentId: runtimeContext?.assessmentId,
			sectionId: runtimeContext?.sectionId,
		}),
	);

	$effect(() => {
		if (!contextAnchor) return;
		return connectAssessmentToolkitRuntimeContext(contextAnchor, (value) => {
			runtimeContext = value;
		});
	});

	function resetContextOverrides(): void {
		contextConnected = false;
		contextResolvedPlayerTag = null;
		contextPlayerAction = null;
		contextCardTitleFormatter = null;
	}

	function applyCardRenderContext(value: SectionPlayerCardRenderContext): void {
		if (!value || typeof value !== "object") return;
		if (typeof value.resolvedPlayerTag === "string" && value.resolvedPlayerTag.trim()) {
			contextResolvedPlayerTag = value.resolvedPlayerTag;
		}
		if (typeof value.playerAction === "function") {
			contextPlayerAction = value.playerAction;
		}
		if (typeof value.cardTitleFormatter === "function") {
			contextCardTitleFormatter = value.cardTitleFormatter;
		}
	}

	// ------------------------------------------------------------------
	// Formative delivery
	// ------------------------------------------------------------------
	//
	// The card owns the control because it owns the item player node, and
	// `provideScore()` is an imperative method on that node. It reports the
	// outcomes it gets rather than interpreting them: correctness derivation and
	// Try state belong to the section controller, so one aggregation policy
	// applies wherever a Try is recorded.

	let playerNode = $state<HTMLElement | null>(null);
	let checkPending = $state(false);
	let checkFailed = $state(false);

	const formativeEnabled = $derived(formativeView?.enabled === true);
	const showFormativeControl = $derived(
		formativeEnabled && (formativeView?.canCheck || formativeView?.canRetry),
	);
	const formativeButtonLabel = $derived(
		formativeView?.canRetry ? "Try again" : "Check answer",
	);

	function describeTriesRemaining(view: FormativeItemView): string {
		if (view.triesRemaining === "unlimited") return "";
		if (view.triesRemaining <= 0) return "";
		return view.triesRemaining === 1
			? "1 try left."
			: `${view.triesRemaining} tries left.`;
	}

	/**
	 * Correctness in words, never colour alone (WCAG 1.4.1), and only once the
	 * policy has actually revealed feedback — an outcome exists after a Try even
	 * under `feedback: "none"`, and announcing it there would leak what the policy
	 * withheld.
	 */
	function describeOutcome(view: FormativeItemView): string {
		if (!view.revealed) {
			return view.tryCount > 0 ? "Answer recorded." : "";
		}
		switch (view.lastOutcome?.correctness) {
			case "correct":
				return "Correct.";
			case "partial":
				return "Partly correct.";
			case "incorrect":
				return "Not correct.";
			case "unknown":
				return "Answer recorded. This question is not scored automatically.";
			default:
				return "Answer recorded.";
		}
	}

	const formativeStatus = $derived.by(() => {
		if (checkFailed) return "This question could not be checked. Try again.";
		if (!formativeView?.enabled) return "";
		const outcome = describeOutcome(formativeView);
		if (!outcome) return "";
		const remaining = formativeView.canRetry
			? describeTriesRemaining(formativeView)
			: "";
		return remaining ? `${outcome} ${remaining}` : outcome;
	});

	function dispatchFormativeAction(
		action: "check" | "retry",
		outcomes?: unknown[],
	): void {
		const host = getHostElementFromAnchor(contextAnchor);
		if (!host || !item?.id) return;
		const payload: InternalFormativeActionDetail = {
			itemId: item.id,
			canonicalItemId: canonicalItemId || item.id,
			action,
			outcomes,
		};
		dispatchCrossBoundaryEvent(
			host,
			PIE_INTERNAL_FORMATIVE_ACTION_EVENT,
			payload,
		);
	}

	async function handleFormativeClick(): Promise<void> {
		if (!formativeView?.enabled || checkPending) return;
		checkFailed = false;
		if (formativeView.canRetry) {
			dispatchFormativeAction("retry");
			return;
		}
		if (!formativeView.canCheck) return;
		const scorer = (
			playerNode as { provideScore?: () => Promise<false | unknown[]> } | null
		)?.provideScore;
		if (typeof scorer !== "function") {
			checkFailed = true;
			return;
		}
		checkPending = true;
		try {
			const results = await scorer.call(playerNode);
			// `false` means the item has no models to score, which is exactly the
			// `unknown` correctness case — the Try is real and gets recorded. A throw
			// is an error rather than an unscorable item, so it costs no Try.
			dispatchFormativeAction("check", Array.isArray(results) ? results : []);
		} catch (error) {
			checkFailed = true;
			console.warn(
				`[pie-section-player] provideScore() failed for item ${item?.id}:`,
				error,
			);
		} finally {
			checkPending = false;
		}
	}

	onMount(() => {
		const host = getHostElementFromAnchor(contextAnchor);
		if (!host) return;
		contextConnected = true;
		const disconnect = connectSectionPlayerCardRenderContext(
			host,
			applyCardRenderContext,
		);
		return () => {
			disconnect();
			resetContextOverrides();
		};
	});
</script>

<div bind:this={contextAnchor} class="pie-section-player-item-card-anchor" aria-hidden="true"></div>
<pie-item-shell
	item-id={item.id}
	canonical-item-id={canonicalItemId}
	content-kind="assessment-item"
	item={item}
>
	<div
		class="pie-section-player-content-card"
		data-section-item-card
		data-canonical-item-id={canonicalItemId}
		data-pie-tool-overlay-boundary
		aria-current={isCurrent ? "true" : undefined}
	>
		<div
			class="pie-section-player-content-card-header pie-section-player-item-header pie-section-player__item-header"
			data-region="header"
		>
			<svelte:element
				this={`h${resolvedHeadingLevel}`}
				id={headingId}
				data-pie-tool-overlay-protect
			>{headerTitle}</svelte:element>
			<pie-item-toolbar
				item-id={item.id}
				catalog-id={item.id}
				tools={itemToolbarTools}
				content-kind="assessment-item"
				size="md"
				language="en-US"
				{toolRegistry}
				{hostButtons}
			></pie-item-toolbar>
		</div>
		<!-- Text alternates the capability set contributes, read in order before the
		     content: a transcript precedes the audio control it transcribes, and no
		     element has to know it exists. -->
		<SectionCardSurfaceStack
			regionId={leadRegionId}
			surface={CONTENT_LEAD_SURFACE}
			ownerContext={catalogOwnerContext}
			{runtimeContext}
			{toolRegistry}
		/>
		<SectionCardMediaSplit
			regionId={mediaRegionId}
			ownerContext={catalogOwnerContext}
			{runtimeContext}
			{toolRegistry}
			dividerAriaLabel="Resize question and media panels"
		>
			{#snippet content()}
				<div
					class="pie-section-player-content-card-body pie-section-player-item-content pie-section-player__item-content"
					data-region="content"
				>
					<svelte:element
						this={effectiveResolvedPlayerTag}
						bind:this={playerNode}
						use:effectivePlayerAction={playerParams}
					></svelte:element>
				</div>
			{/snippet}
		</SectionCardMediaSplit>
		<div data-region="footer">
			{#if formativeEnabled}
				<div class="pie-section-player-formative">
					<!-- Present before it has content, so the first announcement is not
					     lost to a live region that did not yet exist (WCAG 4.1.3). -->
					<p
						class="pie-section-player-formative__status"
						data-pie-formative-status
						aria-live="polite"
					>{formativeStatus}</p>
					{#if showFormativeControl}
						<!-- Removed rather than disabled once Tries are spent: a disabled
						     control left in the tab order carries no explanation.

						     Not disabled while a check is in flight either. Disabling the
						     focused element moves focus to the document body, so a keyboard
						     learner who pressed Enter lost their place and had to tab back
						     to a control whose label had changed under them. `aria-busy`
						     says the same thing without taking the element out of the tree,
						     and re-entry is already dropped by the handler and by the
						     reducer. -->
						<button
							type="button"
							class="pie-section-player-formative__button"
							data-pie-formative-action={formativeView?.canRetry ? "retry" : "check"}
							aria-busy={checkPending ? "true" : undefined}
							onclick={handleFormativeClick}
						>{formativeButtonLabel}</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</pie-item-shell>

<style>
	.pie-section-player-item-card-anchor {
		display: none;
	}

	:global(pie-section-player-item-card) {
		display: block;
		border-radius: var(--pie-section-player-card-radius, 8px);
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: var(--pie-section-player-card-radius, 8px);
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
	}

	.pie-section-player-content-card-header {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		overflow: visible;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);

		/* Header fill is intentionally transparent by default. Hosts/themes
		   opt-in to a solid color via --pie-section-player-card-header-background
		   (e.g. a brand Bluegreen tint) without this framework encoding a palette. */
		background: var(--pie-section-player-card-header-background, transparent);
		/* Default just inside the card radius to avoid a double-radius effect with the border. */
		border-top-left-radius: var(
			--pie-section-player-card-header-radius,
			calc(var(--pie-section-player-card-radius, 8px) - 1px)
		);
		border-top-right-radius: var(
			--pie-section-player-card-header-radius,
			calc(var(--pie-section-player-card-radius, 8px) - 1px)
		);
	}

	/* Any heading level, not `h2`: the card renders at `base-heading-level`, so
	   the tag is composition context rather than a fixed choice, and a host that
	   nests the player deeper got an unstyled title. */
	.pie-section-player-content-card-header :is(h1, h2, h3, h4, h5, h6) {
		position: relative;
		z-index: 0;
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		/* Default to the themed body text color so titles stay legible across
		   DaisyUI themes; --pie-header-text remains a host opt-in override. */
		color: var(--pie-header-text, var(--pie-text, #111827));
	}

	.pie-section-player-content-card-header pie-item-toolbar {
		position: relative;
		z-index: 1;
		margin-left: auto;
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
		color: var(--pie-text, #111827);
	}

	/* Formative control. Painted only from `--pie-*` chains so it follows every
	   base theme, provider and colour scheme without a hook of its own. */
	.pie-section-player-formative {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-formative__status {
		margin: 0;
		font-size: 0.9rem;
		/* Correctness is carried by the text itself, so no state colour is needed
		   and none is applied — a colour here would be the only signal at exactly
		   the moment it must not be (WCAG 1.4.1). */
		color: var(--pie-text, #111827);
	}

	/* Empty until a Try lands; collapse so the footer does not reserve a blank
	   row before there is anything to announce. */
	.pie-section-player-formative__status:empty {
		display: none;
	}

	/* Canonical button-family chains, no component-scoped hook: this control is an
	   ordinary button and a host that restyles ordinary buttons should get it for
	   free. Geometry stays literal, as it does on the scroll hint — the contract
	   certifies colour pairs, not radii. */
	.pie-section-player-formative__button {
		/* Comfortably past the 24x24 minimum in WCAG 2.5.8, and the padding keeps
		   it there at the smallest supported text size. */
		min-height: 2.25rem;
		padding: 0.4rem 0.9rem;
		margin-left: auto;
		border: 1px solid var(--pie-button-border, var(--pie-border, #8f8f8f));
		border-radius: 4px;
		background: var(--pie-button-bg, var(--pie-white, #fff));
		color: var(--pie-button-color, var(--pie-text, #374151));
		font: inherit;
		cursor: pointer;
	}

	.pie-section-player-formative__button:hover {
		background: var(--pie-button-hover-bg, var(--pie-background-dark, #f9fafb));
		border-color: var(--pie-button-hover-border, var(--pie-border, #8b919c));
		color: var(--pie-button-hover-color, var(--pie-text, #111827));
	}

	.pie-section-player-formative__button:active {
		/* `--pie-button-color` is the only ink the contract certifies against this
		   fill, so the pair stays together. */
		background: var(--pie-button-active-bg, var(--pie-background-dark, #f3f4f6));
		color: var(--pie-button-color, var(--pie-text, #374151));
	}

	.pie-section-player-formative__button:focus-visible {
		outline: 2px solid
			var(--pie-button-focus-outline, var(--pie-primary, #3b82f6));
		outline-offset: 2px;
	}

	.pie-section-player-formative__button[aria-busy="true"] {
		cursor: progress;
	}

</style>
