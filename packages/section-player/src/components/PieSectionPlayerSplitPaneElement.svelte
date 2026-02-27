<svelte:options
	customElement={{
		tag: "pie-section-player-splitpane",
		// Use light DOM so item-player/runtime styles can cascade into rendered item content.
		shadow: "none",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			runtime: { type: "Object", reflect: false },
			section: { type: "Object", reflect: false },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			view: { type: "String" },
			playerType: { attribute: "player-type", type: "String" },
			player: { type: "Object", reflect: false },
			lazyInit: { attribute: "lazy-init", type: "Boolean" },
			tools: { type: "Object", reflect: false },
			accessibility: { type: "Object", reflect: false },
			coordinator: { type: "Object", reflect: false },
			createSectionController: { type: "Object", reflect: false },
			isolation: { attribute: "isolation", type: "String" },
			env: { type: "Object", reflect: false },
			iifeBundleHost: { attribute: "iife-bundle-host", type: "String" },
			showToolbar: { attribute: "show-toolbar", type: "Boolean" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
		},
	}}
/>

<script lang="ts">
	import "./section-player-base-element.js";
	import "./item-shell-element.js";
	import "./passage-shell-element.js";
	import "@pie-players/pie-iife-player";
	import "@pie-players/pie-section-tools-toolbar";
	import "@pie-players/pie-assessment-toolkit/components/item-toolbar-element";
	import "@pie-players/pie-tool-calculator-inline";
	import "@pie-players/pie-tool-calculator";
	import {
		normalizeToolsConfig,
		parseToolList,
	} from "@pie-players/pie-assessment-toolkit";
	import { IifeElementLoader } from "@pie-players/pie-players-shared";
	import type { SectionCompositionModel } from "../controllers/types.js";
	import type { AssessmentSection, ItemEntity } from "@pie-players/pie-players-shared/types";

	const EMPTY_COMPOSITION: SectionCompositionModel = {
		section: null,
		assessmentItemRefs: [],
		passages: [],
		items: [],
		rubricBlocks: [],
		instructions: [],
		currentItemIndex: 0,
		currentItem: null,
		isPageMode: false,
		itemSessionsByItemId: {},
		testAttemptSession: null,
	};
	const DEFAULT_ASSESSMENT_ID = "section-demo-direct";
	const DEFAULT_PLAYER_TYPE = "iife";
	const DEFAULT_LAZY_INIT = true;
	const DEFAULT_ISOLATION = "inherit";
	const LEGACY_RUNTIME_WARNING_KEY = "pie-section-player-splitpane:legacy-runtime-props";
	const warnedKeys = new Set<string>();
	type RuntimeConfig = {
		assessmentId?: string;
		playerType?: string;
		player?: Record<string, unknown> | null;
		lazyInit?: boolean;
		tools?: Record<string, unknown> | null;
		accessibility?: Record<string, unknown> | null;
		coordinator?: unknown;
		createSectionController?: unknown;
		isolation?: string;
		env?: Record<string, unknown>;
	};

	let {
		assessmentId = DEFAULT_ASSESSMENT_ID,
		runtime = null as RuntimeConfig | null,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		view = "candidate",
		playerType = DEFAULT_PLAYER_TYPE,
		player = null as Record<string, unknown> | null,
		lazyInit = DEFAULT_LAZY_INIT,
		tools = null as Record<string, unknown> | null,
		accessibility = null as Record<string, unknown> | null,
		coordinator = null as unknown,
		createSectionController = null as unknown,
		isolation = DEFAULT_ISOLATION,
		env = { mode: "gather", role: "student" } as Record<string, unknown>,
		iifeBundleHost = "https://proxy.pie-api.com/bundles",
		showToolbar = true,
		toolbarPosition = "right",
		enabledTools = "",
		itemToolbarTools = "",
		passageToolbarTools = "",
	} = $props();

	let compositionModel = $state<SectionCompositionModel>(EMPTY_COMPOSITION);
	let leftPanelWidth = $state(50);
	let isDragging = $state(false);
	let splitContainerElement = $state<HTMLDivElement | null>(null);
	let elementsLoaded = $state(false);

	const passages = $derived(compositionModel.passages || []);
	const items = $derived(compositionModel.items || []);
	const itemSessionsByItemId = $derived(compositionModel.itemSessionsByItemId || {});
	const hasPassages = $derived(passages.length > 0);
	const shouldRenderToolbar = $derived(showToolbar && toolbarPosition !== "none");
	const toolbarBeforeContent = $derived(
		toolbarPosition === "top" || toolbarPosition === "left",
	);
	const toolbarInline = $derived(toolbarPosition === "left" || toolbarPosition === "right");
	const preloadedRenderables = $derived.by(() => [
		...(passages as unknown as ItemEntity[]),
		...(items as ItemEntity[]),
	]);
	const effectiveToolsConfig = $derived.by(() => {
		const runtimeTools = ((runtime as RuntimeConfig | null)?.tools || tools || {}) as any;
		const normalized = normalizeToolsConfig(runtimeTools);
		const sectionTools = parseToolList(enabledTools);
		const itemTools = parseToolList(itemToolbarTools);
		const passageTools = parseToolList(passageToolbarTools);
		return normalizeToolsConfig({
			...normalized,
			placement: {
				...normalized.placement,
				section: sectionTools.length > 0 ? sectionTools : normalized.placement.section,
				item: itemTools.length > 0 ? itemTools : normalized.placement.item,
				passage: passageTools.length > 0 ? passageTools : normalized.placement.passage,
			},
		});
	});
	const effectiveRuntime = $derived.by(() => ({
		assessmentId,
		playerType,
		player,
		lazyInit,
		accessibility,
		coordinator,
		createSectionController,
		isolation,
		env,
		...(runtime || {}),
		tools: effectiveToolsConfig,
	}));

	function handleBaseCompositionChanged(event: Event) {
		const detail = (event as CustomEvent<{ composition?: SectionCompositionModel }>).detail;
		compositionModel = detail?.composition || EMPTY_COMPOSITION;
	}

	function getSessionForItem(item: ItemEntity): unknown {
		const itemId = item.id || "";
		return itemSessionsByItemId[itemId];
	}

	function handleDividerMouseDown(event: MouseEvent) {
		event.preventDefault();
		isDragging = true;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}

	function handleDividerMouseMove(event: MouseEvent) {
		if (!isDragging || !splitContainerElement) return;
		const containerRect = splitContainerElement.getBoundingClientRect();
		const offsetX = event.clientX - containerRect.left;
		const newWidth = (offsetX / containerRect.width) * 100;
		if (newWidth >= 20 && newWidth <= 80) {
			leftPanelWidth = newWidth;
		}
	}

	function handleDividerMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}

	function handleDividerKeyDown(event: KeyboardEvent) {
		const step = 5;
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			leftPanelWidth = Math.max(20, leftPanelWidth - step);
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			leftPanelWidth = Math.min(80, leftPanelWidth + step);
		}
	}

	$effect(() => {
		if (!isDragging) return;
		window.addEventListener("mousemove", handleDividerMouseMove);
		window.addEventListener("mouseup", handleDividerMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleDividerMouseMove);
			window.removeEventListener("mouseup", handleDividerMouseUp);
		};
	});

	$effect(() => {
		const renderables = preloadedRenderables;
		if (renderables.length === 0) {
			elementsLoaded = true;
			return;
		}

		const bundleHost = String(iifeBundleHost || "").trim();
		if (!bundleHost) {
			console.warn(
				"[pie-section-player-splitpane] Missing iifeBundleHost for element preloading; rendering without preload.",
			);
			elementsLoaded = true;
			return;
		}

		let cancelled = false;
		elementsLoaded = false;
		const loader = new IifeElementLoader({
			bundleHost,
			debugEnabled: () => false,
		});
		const loaderView = (env as any)?.mode === "author" ? "author" : "delivery";

		void loader
			.loadFromItems(renderables, {
				view: loaderView,
				needsControllers: true,
			})
			.then(() => {
				if (!cancelled) elementsLoaded = true;
			})
			.catch((error) => {
				console.error(
					"[pie-section-player-splitpane] Failed to preload PIE elements:",
					error,
				);
				if (!cancelled) elementsLoaded = true;
			});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (typeof window === "undefined" || runtime) return;
		const usedLegacyProps: string[] = [];
		if (assessmentId !== DEFAULT_ASSESSMENT_ID) usedLegacyProps.push("assessmentId");
		if (playerType !== DEFAULT_PLAYER_TYPE) usedLegacyProps.push("playerType");
		if (player !== null) usedLegacyProps.push("player");
		if (lazyInit !== DEFAULT_LAZY_INIT) usedLegacyProps.push("lazyInit");
		if (tools !== null) usedLegacyProps.push("tools");
		if (accessibility !== null) usedLegacyProps.push("accessibility");
		if (coordinator !== null) usedLegacyProps.push("coordinator");
		if (createSectionController !== null) usedLegacyProps.push("createSectionController");
		if (isolation !== DEFAULT_ISOLATION) usedLegacyProps.push("isolation");
		const key = `${LEGACY_RUNTIME_WARNING_KEY}:${usedLegacyProps.sort().join(",")}`;
		if (usedLegacyProps.length === 0 || warnedKeys.has(key)) return;
		warnedKeys.add(key);
		console.warn(
			`[pie-section-player-splitpane] Runtime props (${usedLegacyProps.join(", ")}) are deprecated. Prefer the \`runtime\` object prop.`,
		);
	});

</script>

<pie-section-player-base
	runtime={effectiveRuntime}
	{assessmentId}
	{section}
	section-id={sectionId}
	attempt-id={attemptId}
	{view}
	player-type={playerType}
	{player}
	lazy-init={lazyInit}
	{tools}
	{accessibility}
	{coordinator}
	create-section-controller={createSectionController}
	{isolation}
	oncomposition-changed={handleBaseCompositionChanged}
>
	<div class={`player-shell player-shell--${toolbarPosition}`}>
		{#if shouldRenderToolbar && toolbarBeforeContent}
			<pie-section-tools-toolbar
				class={`section-toolbar section-toolbar--${toolbarPosition}`}
				position={toolbarPosition}
				enabled-tools={enabledTools}
			></pie-section-tools-toolbar>
		{/if}

		<div class={`layout-body ${toolbarInline ? "layout-body--inline" : ""}`}>
			<div
				class={`split-content ${!hasPassages ? "split-content--no-passages" : ""}`}
				bind:this={splitContainerElement}
				style={hasPassages
					? `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%`
					: "grid-template-columns: 1fr"}
			>
				{#if hasPassages}
					<aside class="passages-pane" aria-label="Passages">
						{#if !elementsLoaded}
							<div class="content-card">
								<div class="content-card-body passage-content pie-section-player__passage-content">
									Loading passage content...
								</div>
							</div>
						{:else}
							{#each passages as passage, passageIndex (passage.id || passageIndex)}
								<pie-passage-shell
									item-id={passage.id}
									content-kind="rubric-block-stimulus"
									item={passage}
								>
									<div class="content-card">
										<div
											class="content-card-header passage-header pie-section-player__passage-header"
											data-region="header"
										>
											<h2>Passage {passageIndex + 1}</h2>
											<pie-item-toolbar
												item-id={passage.id}
												catalog-id={passage.id}
												tools={passageToolbarTools}
												content-kind="rubric-block-stimulus"
												size="md"
												language="en-US"
											></pie-item-toolbar>
										</div>
										<div
											class="content-card-body passage-content pie-section-player__passage-content"
											data-region="content"
										>
											<pie-iife-player
												config={JSON.stringify(passage.config || {})}
												env={JSON.stringify({ mode: "view", role: (env as any)?.role || "student" })}
												bundle-host={iifeBundleHost}
												skip-element-loading={true}
											></pie-iife-player>
										</div>
									</div>
								</pie-passage-shell>
							{/each}
						{/if}
					</aside>

					<button
						type="button"
						class={`split-divider ${isDragging ? "split-divider--dragging" : ""}`}
						onmousedown={handleDividerMouseDown}
						onkeydown={handleDividerKeyDown}
						aria-label="Resize panels"
					>
						<span class="split-divider-handle"></span>
					</button>
				{/if}

				<main class="items-pane" aria-label="Items">
					{#if !elementsLoaded}
						<div class="content-card">
							<div class="content-card-body item-content pie-section-player__item-content">
								Loading section content...
							</div>
						</div>
					{:else}
						{#each items as item, itemIndex (item.id || itemIndex)}
						<pie-item-shell item-id={item.id} content-kind="assessment-item" item={item}>
							<div class="content-card">
								<div
									class="content-card-header item-header pie-section-player__item-header"
									data-region="header"
								>
									<h2>Question {itemIndex + 1}</h2>
									<pie-item-toolbar
										item-id={item.id}
										catalog-id={item.id}
										tools={itemToolbarTools}
										content-kind="assessment-item"
										size="md"
										language="en-US"
									></pie-item-toolbar>
								</div>
								<div
									class="content-card-body item-content pie-section-player__item-content"
									data-region="content"
								>
									<pie-iife-player
										config={JSON.stringify(item.config || {})}
										env={JSON.stringify(env)}
										session={JSON.stringify(getSessionForItem(item) || { id: "", data: [] })}
										bundle-host={iifeBundleHost}
										skip-element-loading={true}
									></pie-iife-player>
								</div>
								<div data-region="footer"></div>
							</div>
						</pie-item-shell>
						{/each}
					{/if}
				</main>
			</div>

			{#if shouldRenderToolbar && toolbarInline && toolbarPosition === "right"}
				<aside class="section-toolbar-pane section-toolbar-pane--right" aria-label="Section tools">
					<pie-section-tools-toolbar
						position="right"
						enabled-tools={enabledTools}
					></pie-section-tools-toolbar>
				</aside>
			{/if}

			{#if shouldRenderToolbar && toolbarInline && toolbarPosition === "left"}
				<aside class="section-toolbar-pane section-toolbar-pane--left" aria-label="Section tools">
					<pie-section-tools-toolbar
						position="left"
						enabled-tools={enabledTools}
					></pie-section-tools-toolbar>
				</aside>
			{/if}
		</div>

		{#if shouldRenderToolbar && !toolbarBeforeContent && !toolbarInline}
			<pie-section-tools-toolbar
				class={`section-toolbar section-toolbar--${toolbarPosition}`}
				position={toolbarPosition}
				enabled-tools={enabledTools}
			></pie-section-tools-toolbar>
		{/if}
	</div>
</pie-section-player-base>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
	}

	.player-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.player-shell--left,
	.player-shell--right {
		flex-direction: row;
	}

	.player-shell--left .layout-body--inline {
		order: 2;
	}

	.player-shell--left .section-toolbar-pane--left {
		order: 1;
	}

	.layout-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.layout-body--inline {
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
	}

	.split-content {
		display: grid;
		gap: 0;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	.split-content--no-passages .items-pane {
		padding-left: 0;
	}

	.passages-pane,
	.items-pane {
		height: 100%;
		max-height: 100%;
		min-height: 0;
		min-width: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-toolbar-pane {
		min-height: 0;
		overflow: auto;
	}

	.section-toolbar-pane--right {
		border-left: 1px solid var(--pie-border-light, #e5e7eb);
		padding-left: 0.5rem;
	}

	.section-toolbar-pane--left {
		border-right: 1px solid var(--pie-border-light, #e5e7eb);
		padding-right: 0.5rem;
	}

	.split-divider {
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		align-self: stretch;
		height: 100%;
		min-height: 0;
		position: relative;
		cursor: col-resize;
		background: var(--pie-secondary-background, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;
		transition: background 0.2s ease;
	}

	.split-divider:hover {
		background: var(--pie-border-light, #e5e7eb);
	}

	.split-divider:focus {
		outline: 2px solid var(--pie-focus-checked-border, #1976d2);
		outline-offset: -2px;
	}

	.split-divider-handle {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 6px;
		height: 60px;
		background: var(--pie-blue-grey-600, #9ca3af);
		border-radius: 3px;
		transition: all 0.2s ease;
		pointer-events: none;
	}

	.split-divider-handle::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 20px;
		background: var(--pie-white, white);
		border-radius: 1px;
		opacity: 0.8;
	}

	.split-divider:hover .split-divider-handle,
	.split-divider:focus .split-divider-handle,
	.split-divider--dragging .split-divider-handle {
		background: var(--pie-primary, #1976d2);
		height: 80px;
		box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
	}

	.split-divider--dragging {
		background: var(--pie-primary-light, #dbeafe);
	}

	.content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-white, #fff);
	}

	.content-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.content-card-header h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.content-card-body {
		padding: 1rem;
	}

	@media (max-width: 1100px) {
		.player-shell--left,
		.player-shell--right {
			flex-direction: column;
		}

		.layout-body--inline {
			grid-template-columns: 1fr;
		}

		.split-content {
			grid-template-columns: 1fr !important;
		}

		.split-divider {
			display: none;
		}

		.section-toolbar-pane--left,
		.section-toolbar-pane--right {
			border: none;
			padding: 0;
		}
	}
</style>
