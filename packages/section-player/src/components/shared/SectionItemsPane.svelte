<svelte:options
	customElement={{
		tag: "pie-section-player-items-pane",
		// Keep light DOM so rendered item content can inherit assessment/runtime styles.
		shadow: "none",
		props: {
			items: { type: "Object", reflect: false },
			compositionModel: { attribute: "composition-model", type: "Object", reflect: false },
			resolvedPlayerEnv: { attribute: "resolved-player-env", type: "Object", reflect: false },
			resolvedPlayerAttributes: {
				attribute: "resolved-player-attributes",
				type: "Object",
				reflect: false,
			},
			resolvedPlayerProps: { attribute: "resolved-player-props", type: "Object", reflect: false },
			playerStrategy: { attribute: "player-strategy", type: "String" },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			hostButtons: { type: "Object", reflect: false },
			iifeBundleHost: { attribute: "iife-bundle-host", type: "String" },
			preloadedRenderables: { attribute: "preloaded-renderables", type: "Object", reflect: false },
			preloadedRenderablesSignature: {
				attribute: "preloaded-renderables-signature",
				type: "String",
			},
			preloadComponentTag: { attribute: "preload-component-tag", type: "String" },
		},
	}}
/>

<script lang="ts">
	import { createEventDispatcher, untrack } from "svelte";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import "../section-player-item-card-element.js";
	import type { ItemEntity } from "@pie-players/pie-players-shared/types";
	import { usePromise } from "@pie-players/pie-players-shared/ui/use-promise";
	import type { SectionCompositionModel } from "../../controllers/types.js";
	import {
		buildBackendConfigFromProps,
		describeBundleHost,
		describeBundleType,
		type ElementPreloadErrorDetail,
		type ElementPreloadRetryDetail,
		formatElementLoadError,
		getPreloadLogger,
		getRenderablesSignature,
		PreloadStageError,
		type PreloadStage,
		toErrorMessage,
		warmupSectionElements,
	} from "./player-preload.js";
	import {
		getCanonicalItemId,
		getItemPlayerParams,
	} from "./section-player-view-state.js";

	let {
		items = [] as ItemEntity[],
		compositionModel,
		resolvedPlayerEnv = {} as Record<string, unknown>,
		resolvedPlayerAttributes = {} as Record<string, string>,
		resolvedPlayerProps = {} as Record<string, unknown>,
		playerStrategy = "preloaded",
		itemToolbarTools = "",
		toolRegistry = null as ToolRegistry | null,
		hostButtons = [] as ToolbarItem[],
		iifeBundleHost = "",
		preloadedRenderables = [] as ItemEntity[],
		/* preloadedRenderablesSignature is plumbed through the host element
		 * tree for back-compat, but the deep ElementLoader primitive
		 * deduplicates concurrent requests by itself, so we no longer key
		 * warmup on it. The prop stays accepted so call-sites outside this
		 * package don't have to change in lock-step. */
		preloadComponentTag = "pie-section-player-items-pane",
	} = $props<{
		items: ItemEntity[];
		compositionModel: SectionCompositionModel;
		resolvedPlayerEnv: Record<string, unknown>;
		resolvedPlayerAttributes: Record<string, string>;
		resolvedPlayerProps: Record<string, unknown>;
		playerStrategy: string;
		itemToolbarTools: string;
		toolRegistry?: ToolRegistry | null;
		hostButtons?: ToolbarItem[];
		iifeBundleHost?: string | null;
		preloadedRenderables: ItemEntity[];
		preloadedRenderablesSignature: string;
		preloadComponentTag?: string;
	}>();

	const dispatch = createEventDispatcher<{
		"elements-loaded-change": { elementsLoaded: boolean };
		"element-preload-retry": ElementPreloadRetryDetail;
		"element-preload-error": ElementPreloadErrorDetail;
	}>();

	const logger = $derived(getPreloadLogger(preloadComponentTag));

	/*
	 * The reactive key for the warmup call. Captures only the inputs that
	 * logically alter the `ensureRegistered` request: the strategy, the
	 * element-set signature of the renderables, the bundle host for IIFE,
	 * and the view/bundle-type discriminants read from player props/env.
	 *
	 * This is NOT the old `lastPreloadSignature` guard — the deep
	 * ElementLoader primitive already dedupes concurrent identical
	 * requests internally. The signature here serves a different purpose:
	 * it stabilizes `usePromise`'s reactive input so that semantically
	 * no-op prop churn (current-item index change, session data updates,
	 * controller event emission) does not drag `elementsLoaded` back to
	 * `pending` and force an items-pane remount. Without this, navigation
	 * and session-update tests observe transient "Loading section
	 * content…" flashes that break focus and shell identity invariants.
	 */
	const warmupInputsSignature = $derived(
		JSON.stringify({
			strategy: playerStrategy,
			renderables: getRenderablesSignature(preloadedRenderables),
			iifeBundleHost,
			mode:
				(resolvedPlayerProps as Record<string, unknown> | undefined)?.mode ?? null,
			hosted:
				(resolvedPlayerProps as Record<string, unknown> | undefined)?.hosted ??
				null,
			envMode:
				(resolvedPlayerEnv as Record<string, unknown> | undefined)?.mode ?? null,
			loaderOptions:
				(resolvedPlayerProps as Record<string, unknown> | undefined)
					?.loaderOptions ?? null,
		}),
	);

	/*
	 * The readiness lifecycle value.
	 *
	 * `usePromise` turns an async factory into a reactive
	 * `{ status: "idle" | "pending" | "resolved" | "rejected" }` value that
	 * invalidates instantly on signature change and ignores late
	 * resolutions from stale invocations. This is what used to be a
	 * hand-rolled trio of `$state` fields (`elementsLoaded`,
	 * `preloadRunToken`, `lastPreloadSignature`) plus a separate
	 * state-setter in `player-preload.ts` — all of which only existed to
	 * re-implement this helper badly and produced the sporadic
	 * section-swap race in the process.
	 *
	 * Reactive dep: `warmupInputsSignature` only. The factory reads the
	 * live prop values inside `untrack(...)` so transient reactive churn
	 * on those same props (e.g. parent re-rendering on a composition
	 * update) does not retrigger the effect.
	 */
	const readiness = usePromise(() => {
		// Establish the single reactive dep.
		// biome-ignore lint/correctness/noUnusedExpressions: track signature
		warmupInputsSignature;
		return untrack(() =>
			warmupSectionElements({
				strategy: playerStrategy,
				renderables: preloadedRenderables,
				resolvedPlayerProps: resolvedPlayerProps as Record<string, unknown>,
				resolvedPlayerEnv: resolvedPlayerEnv as Record<string, unknown>,
				iifeBundleHost,
				logger,
				onBundleRetryStatus: (status) => {
					// Mirror the IIFE bundle-build retry transitions into the host's
					// existing `element-preload-retry` event surface so hosts that
					// already render "bundle still building, retrying" messaging
					// keep working under the deep-primitive architecture. We dispatch
					// every transition (retrying / completed / timeout / cancelled)
					// so consumers can drive show/hide UI from the same stream.
					let backendForTelemetry: ReturnType<
						typeof buildBackendConfigFromProps
					> | null = null;
					try {
						backendForTelemetry = buildBackendConfigFromProps({
							strategy: playerStrategy,
							resolvedPlayerProps: resolvedPlayerProps as Record<string, unknown>,
							resolvedPlayerEnv: resolvedPlayerEnv as Record<string, unknown>,
							iifeBundleHost,
						});
					} catch {
						backendForTelemetry = null;
					}
					const retryDelayMs = Math.max(status.retryDelayMs ?? 0, 1);
					const maxRetries = Math.max(
						1,
						Math.ceil(status.timeoutMs / retryDelayMs),
					);
					dispatch("element-preload-retry", {
						componentTag: preloadComponentTag,
						stage: "iife-load",
						attempt: status.attempt,
						maxRetries,
						error: status.reason ?? status.state,
						strategy: playerStrategy,
						bundleType: describeBundleType(backendForTelemetry),
						bundleHost: describeBundleHost(backendForTelemetry),
						renderablesCount: preloadedRenderables.length,
					});
				},
			}),
		);
	});

	const elementsLoaded = $derived(readiness.current.status === "resolved");

	$effect(() => {
		dispatch("elements-loaded-change", { elementsLoaded });
	});

	$effect(() => {
		if (readiness.current.status !== "rejected") return;
		const error = readiness.current.error;
		const stage: PreloadStage =
			error instanceof PreloadStageError
				? error.stage
				: playerStrategy === "esm"
					? "esm-load"
					: "iife-load";
		const cause =
			error instanceof PreloadStageError ? error.cause : error;
		logger.error(formatElementLoadError(stage, cause));
		let backendForTelemetry: ReturnType<typeof buildBackendConfigFromProps> | null =
			null;
		try {
			backendForTelemetry = buildBackendConfigFromProps({
				strategy: playerStrategy,
				resolvedPlayerProps: resolvedPlayerProps as Record<string, unknown>,
				resolvedPlayerEnv: resolvedPlayerEnv as Record<string, unknown>,
				iifeBundleHost,
			});
		} catch {
			backendForTelemetry = null;
		}
		dispatch("element-preload-error", {
			componentTag: preloadComponentTag,
			stage,
			error: toErrorMessage(cause),
			strategy: playerStrategy,
			bundleType: describeBundleType(backendForTelemetry),
			bundleHost: describeBundleHost(backendForTelemetry),
			renderablesCount: preloadedRenderables.length,
		});
	});

	const currentItemIndex = $derived(
		Number.isFinite(compositionModel?.currentItemIndex)
			? Math.max(0, Number(compositionModel.currentItemIndex))
			: -1,
	);
</script>

{#if !elementsLoaded}
	<div class="pie-section-player-content-card">
		<div
			class="pie-section-player-content-card-body pie-section-player-item-content pie-section-player__item-content"
		>
			Loading section content...
		</div>
	</div>
{:else}
	{#each items as item, itemIndex (item.id || itemIndex)}
		<pie-section-player-item-card
			{item}
			itemIndex={itemIndex}
			itemCount={items.length}
			isCurrent={itemIndex === currentItemIndex}
			canonicalItemId={getCanonicalItemId({ compositionModel, item })}
			playerParams={getItemPlayerParams({
				item,
				compositionModel,
				resolvedPlayerEnv,
				resolvedPlayerAttributes,
				resolvedPlayerProps,
				playerStrategy,
			})}
			itemToolbarTools={itemToolbarTools}
			{toolRegistry}
			{hostButtons}
		></pie-section-player-item-card>
	{/each}
{/if}

<style>
	:host {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		min-width: 0;
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-background, #fff);
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
	}
</style>
