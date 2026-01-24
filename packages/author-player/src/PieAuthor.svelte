<!--
  pie-author (legacy-compatible)

  Goal: full API parity with the production Stencil `pie-author` component.
  Internals are implemented using pie-players-shared (authoring mode + preview mode) and IIFE bundle loading.
-->
<svelte:options
	customElement={{
		tag: "pie-author",
		shadow: "none",
		props: {
			// Legacy props
			config: { attribute: "config", type: "Object" },
			addPreview: { attribute: "add-preview", type: "Boolean" },
			addRubric: { attribute: "add-rubric", type: "Boolean" },
			bundleHost: { attribute: "bundle-host", type: "String" },
			bundleEndpoints: { attribute: "bundle-endpoints", type: "Object" },
			disableBundler: { attribute: "disable-bundler", type: "Boolean" },
			configSettings: { attribute: "config-settings", type: "Object" },
			imageSupport: { attribute: "image-support", type: "Object" },
			uploadSoundSupport: { attribute: "upload-sound-support", type: "Object" },
			version: { attribute: "version", type: "String" },
			defaultComplexRubricModel: { attribute: "default-complex-rubric-model", type: "Object" },
			isInsidePieApiAuthor: { attribute: "is-inside-pie-api-author", type: "Boolean" },
			reFetchBundle: { attribute: "re-fetch-bundle", type: "Boolean" },

			// Shared loader config (not in legacy docs but harmless)
			loaderConfig: { attribute: "loader-config", type: "Object" }
		}
	}}
/>

<script lang="ts">
	import PieItemPlayer from "@pie-framework/pie-players-shared/components/PieItemPlayer.svelte";
	import PiePreviewLayout from "@pie-framework/pie-players-shared/components/PiePreviewLayout.svelte";
	import PieSpinner from "@pie-framework/pie-players-shared/components/PieSpinner.svelte";
	import type { LoaderConfig } from "@pie-framework/pie-players-shared/loader-config";
	import { DEFAULT_LOADER_CONFIG } from "@pie-framework/pie-players-shared/loader-config";
	import { IifePieLoader } from "@pie-framework/pie-players-shared/pie/iife-loader";
	import { isGlobalDebugEnabled } from "@pie-framework/pie-players-shared/pie/logger";
	import { BundleType } from "@pie-framework/pie-players-shared/pie/types";
	import type { ImageHandler, SoundHandler } from "@pie-framework/pie-players-shared/types";

	import {
		mergePieContentBackIntoConfig,
		type PieContent,
		pieContentFromConfig
	} from "./legacy-utils";
	import {
		addComplexRubric,
		addPackageToContent,
		addRubric,
		COMPLEX_RUBRIC,
		complexRubricChecks,
		removeComplexRubricFromMarkup
	} from "./rubric-utils";

	// Legacy default endpoints (copied from pie-player-components DEFAULT_ENDPOINTS)
	const DEFAULT_ENDPOINTS = {
		prod: { buildServiceBase: "https://proxy.pie-api.com/bundles/", bundleBase: "https://pits-cdn.pie-api.io/bundles/" },
		stage: { buildServiceBase: "https://proxy.pie-api.com/bundles/", bundleBase: "https://pits-cdn.pie-api.io/bundles/" },
		dev: { buildServiceBase: "https://proxy.dev.pie-api.com/bundles/", bundleBase: "https://pits-cdn.pie-api.io/bundles/" }
	} as const;

	// Props
	let {
		config = null as any,
		addPreview = false,
		addRubric: addRubricDeprecated = undefined as any,
		bundleHost = undefined as any,
		bundleEndpoints = undefined as any,
		disableBundler = false,
		configSettings = undefined as any,
		imageSupport = undefined as any,
		uploadSoundSupport = undefined as any,
		version: _version = "" as any,
		defaultComplexRubricModel = undefined as any,
		isInsidePieApiAuthor = false,
		reFetchBundle = false,
		loaderConfig = DEFAULT_LOADER_CONFIG as LoaderConfig
	} = $props();

	// State
	let loading = $state(true);
	let error: string | null = $state(null);
	let pieContentModel = $state<PieContent | null>(null);
	let hostEl: HTMLElement | null = $state(null);
	let modelsInitialized = $state(false);

	// Legacy prop parity: expose `version` on the host element for debugging/inspection.
	// (This also prevents unused-prop errors without capturing a stale initial value.)
	$effect(() => {
		if (hostEl) hostEl.dataset.pieAuthorVersion = String(_version ?? "");
	});

	// Preview toggle mode (legacy: only present when addPreview)
	let previewMode = $state<"author" | "preview">("author");

	// Resolve bundle host for IIFE loads
	function resolveBundleHost(): string {
		// Legacy: bundleHost can be 'dev'|'stage'|'prod'. Also supports overriding endpoints.
		if (bundleEndpoints?.buildServiceBase) return String(bundleEndpoints.buildServiceBase);
		if (bundleHost && ["dev", "stage", "prod"].includes(String(bundleHost))) {
			return DEFAULT_ENDPOINTS[String(bundleHost) as "dev" | "stage" | "prod"].buildServiceBase;
		}
		// If provided and looks like a URL, use directly.
		if (bundleHost && String(bundleHost).startsWith("http")) return String(bundleHost);
		// Default: use prod proxy (legacy behavior).
		return DEFAULT_ENDPOINTS.prod.buildServiceBase;
	}

	function setPieLoadingClass(isLoading: boolean) {
		if (!hostEl) return;
		hostEl.classList.toggle("pie-loading", isLoading);
	}

	// Convert legacy `configSettings` to new `configuration` shape.
	const configuration = $derived.by(() => (configSettings && typeof configSettings === "object" ? configSettings : {}));

	// Load needed bundle type for current view.
	async function ensureBundlesLoaded(content: PieContent, bundleType: BundleType) {
		if (disableBundler) return;
		const iifeLoader = new IifePieLoader({
			bundleHost: resolveBundleHost(),
			debugEnabled: () => isGlobalDebugEnabled(),
			reFetchBundle: Boolean(reFetchBundle),
			whenDefinedTimeoutMs: 5000
		});

		const needsControllers = bundleType !== BundleType.editor; // legacy authoring doesn't require controllers
		await iifeLoader.load(content, document, bundleType, needsControllers);

		// Wait for elements to be defined. Editor bundles define -config tags.
		const isEditor = bundleType === BundleType.editor;
		const elements = Object.keys(content.elements).map((tag) => ({
			name: tag,
			tag: isEditor ? `${tag}-config` : tag
		}));
		await iifeLoader.elementsHaveLoaded(elements);
	}

	function buildModelsIfMissing(content: PieContent) {
		// Legacy behavior: ensure a model exists for each element instance in markup.
		if (!content?.markup || !content?.elements) return content;
		if (!content.models) content.models = [];
		const tempDiv = document.createElement("div");
		tempDiv.innerHTML = content.markup;
		const elsWithId = tempDiv.querySelectorAll("[id]");
		elsWithId.forEach((el) => {
			const elementId = (el as HTMLElement).getAttribute("id");
			if (!elementId) return;
			const tagName = el.tagName.toLowerCase();
			// For author markup, tags may already be `-config`; strip it.
			const baseTag = tagName.split("-config")[0];
			if (!content.elements[baseTag]) return;
			if (!content.models.find((m: any) => m.id === elementId)) {
				content.models.push({ id: elementId, element: baseTag });
			}
		});
		tempDiv.remove();
		return content;
	}

	async function processConfig(newConfig: any) {
		error = null;
		loading = true;
		setPieLoadingClass(true);
		modelsInitialized = false;

		try {
			const pc = pieContentFromConfig(newConfig);
			if (!pc) {
				throw new Error("Invalid config: must contain {elements, models?, markup} or { pie: ... }");
			}

			// Apply complex rubric checks/toggling (legacy parity).
			const checked = complexRubricChecks(pc, configuration);
			const { shouldAddComplexRubric, shouldRemoveComplexRubric, complexRubricElements } = (checked || {}) as any;

			let updated = pc;
			if (shouldRemoveComplexRubric && Array.isArray(complexRubricElements)) {
				// Remove complex rubric markup + models + elements.
				const { markupWithoutComplexRubric, deletedComplexRubricItemIds } = removeComplexRubricFromMarkup(
					updated,
					complexRubricElements,
					document
				);
				updated = cloneAndMutate(updated, (m) => {
					m.markup = markupWithoutComplexRubric;
					m.models = (m.models || []).filter((mm: any) => !deletedComplexRubricItemIds.includes(mm.id));
					complexRubricElements.forEach((elName: string) => {
						delete (m.elements as any)[elName];
					});
				});
			} else if (shouldAddComplexRubric) {
				// Add complex rubric package + model + markup.
				updated = cloneAndMutate(updated, (m) => {
					const defaultModel = defaultComplexRubricModel ? { ...defaultComplexRubricModel } : { rubricType: "rubricless", rubricEnabled: true };
					addPackageToContent(m, `@pie-element/${COMPLEX_RUBRIC}`, defaultModel);
				});
				updated = addComplexRubric(updated);
			}

			// Legacy: deprecated addRubric adds rubric markup if rubric exists (best-effort).
			if (addRubricDeprecated) {
				// Not a full port; treat as "ensure rubric markup exists if rubric package present".
				updated = addRubric(updated);
			}

			updated = buildModelsIfMissing(updated);

			// Ensure bundles for current view are loaded.
			const bundleType = addPreview && previewMode === "preview" ? BundleType.clientPlayer : BundleType.editor;
			await ensureBundlesLoaded(updated, bundleType);

			pieContentModel = updated;
			loading = false;
			setPieLoadingClass(false);
		} catch (e: any) {
			error = e?.message || String(e);
			loading = false;
			setPieLoadingClass(false);
			pieContentModel = null;
		}
	}

	function cloneAndMutate<T>(obj: T, fn: (o: any) => void): T {
		const copy = structuredClone ? structuredClone(obj as any) : JSON.parse(JSON.stringify(obj));
		fn(copy);
		return copy;
	}

	// Watch config changes (legacy behavior)
	let lastConfig: any = null;
	$effect(() => {
		const current = config;
		if (current && current !== lastConfig) {
			lastConfig = current;
			queueMicrotask(() => processConfig(current));
		} else if (!current) {
			pieContentModel = null;
			loading = true;
			setPieLoadingClass(true);
		}
	});

	// Re-process config when preview mode changes (only when addPreview=true)
	$effect(() => {
		if (!addPreview) return;
		// Track previewMode (dependency)
		void previewMode;
		if (pieContentModel) {
			queueMicrotask(() => processConfig(config));
		}
	});

	// Emit legacy events
	function emit(name: "modelLoaded" | "modelUpdated", detail: any) {
		const ev = new CustomEvent(name, { detail, bubbles: true, composed: true });
		hostEl?.dispatchEvent(ev);
	}

	// When the inner player reports load complete in author mode, emit modelLoaded once.
	function handleLoadComplete() {
		if (!pieContentModel || modelsInitialized) return;
		modelsInitialized = true;
		emit("modelLoaded", mergePieContentBackIntoConfig(config, pieContentModel));
	}

	// Model-updated -> update models in pieContentModel -> emit modelUpdated (legacy parity).
	function handleModelUpdated(detail: any) {
		if (!pieContentModel || !detail?.update) return;
		const update = detail.update;

		for (const m of pieContentModel.models || []) {
			if (m.id === update.id && m.element === update.element) {
				Object.assign(m, update);
			}
		}

		// Legacy: if used inside pie-api-author, emit updated config object so host can set it back.
		emit("modelUpdated", mergePieContentBackIntoConfig(config, pieContentModel));

		// If rubricEnabled toggled, re-run complex rubric checks immediately (legacy parity).
		if (!isInsidePieApiAuthor && Object.prototype.hasOwnProperty.call(update, "rubricEnabled")) {
			// Best-effort: re-process current config to apply complex-rubric add/remove rules.
			queueMicrotask(() => processConfig(config));
		}
	}

	// Asset support (legacy default: data urls). We map to the legacy imageSupport/uploadSoundSupport objects if provided.
	function defaultInsertViaFileReader(handler: ImageHandler | SoundHandler, accept: string) {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return handler.cancel?.();
			// @ts-expect-error handler types differ slightly
			handler.fileChosen(file);
		};
		input.click();
	}

	const onInsertImage = (handler: ImageHandler) => {
		const support = imageSupport as any;
		if (support?.insert) {
			// emulate legacy: host is responsible for prompting file picker
			defaultInsertViaFileReader(handler, "image/*");
			handler.fileChosen = (file: File) => {
				support.insert(
					file,
					(err: Error | null, src: string) => handler.done(err || undefined, src),
					(percent: number, bytes: number, total: number) => handler.progress(percent, bytes, total)
				);
			};
			return;
		}
		// Fallback: use built-in handler behavior (file picker + data URL via FileReader)
		defaultInsertViaFileReader(handler, "image/*");
		handler.fileChosen = (file: File) => {
			const r = new FileReader();
			r.onload = () => handler.done(undefined, String(r.result));
			r.onerror = () => handler.done(new Error("Failed to read file"));
			r.readAsDataURL(file);
		};
	};

	const onDeleteImage = (src: string, done: (err?: Error) => void) => {
		const support = imageSupport as any;
		if (support?.delete) return support.delete(src, done);
		done();
	};

	const onInsertSound = (handler: SoundHandler) => {
		const support = uploadSoundSupport as any;
		if (support?.insert) {
			// prompt for audio file; then call into legacy support
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "audio/*";
			input.onchange = (e) => {
				const file = (e.target as HTMLInputElement).files?.[0];
				if (!file) return handler.cancel?.();
				support.insert(
					file,
					(err: Error | null, src: string) => handler.done(err || undefined, src),
					(percent: number, bytes: number, total: number) => handler.progress(percent, bytes, total)
				);
			};
			input.click();
			return;
		}
		// fallback data url
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "audio/*";
		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return handler.cancel?.();
			const r = new FileReader();
			r.onload = () => handler.done(undefined, String(r.result));
			r.onerror = () => handler.done(new Error("Failed to read file"));
			r.readAsDataURL(file);
		};
		input.click();
	};

	const onDeleteSound = (src: string, done: (err?: Error) => void) => {
		const support = uploadSoundSupport as any;
		if (support?.delete) return support.delete(src, done);
		done();
	};
</script>

<div class="pie-author" bind:this={hostEl}>
	{#if error}
		<div class="pie-player-error" style="padding: 12px; border: 1px solid #d32f2f; color: #c62828; background: #ffebee;">
			<strong>pie-author error:</strong> {error}
		</div>
	{:else if loading || !pieContentModel}
		<PieSpinner />
	{:else}
		{#if addPreview}
			<PiePreviewLayout
				mode={previewMode}
				itemConfig={pieContentModel}
				configuration={configuration}
				env={{ mode: "gather", role: "student" }}
				session={[]}
				bundleTypeAuthor={BundleType.editor}
				bundleTypePreview={BundleType.clientPlayer}
				{loaderConfig}
				onLoadComplete={handleLoadComplete}
				onModelUpdated={handleModelUpdated}
				{onInsertImage}
				{onDeleteImage}
				{onInsertSound}
				{onDeleteSound}
			/>
		{:else}
			<PieItemPlayer
				itemConfig={pieContentModel}
				env={{ mode: "author", role: "instructor" }}
				session={[]}
				bundleType={BundleType.editor}
				{loaderConfig}
				mode="author"
				configuration={configuration}
				onLoadComplete={handleLoadComplete}
				onModelUpdated={handleModelUpdated}
				{onInsertImage}
				{onDeleteImage}
				{onInsertSound}
				{onDeleteSound}
			/>
		{/if}
	{/if}
</div>

<style>
	:host {
		display: block;
	}
</style>

