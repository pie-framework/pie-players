<svelte:options
	customElement={{
		tag: 'pie-item-toolbar',
		shadow: 'none',
		props: {
			itemId: { type: 'String', attribute: 'item-id' },
			catalogId: { type: 'String', attribute: 'catalog-id' },
			tools: { type: 'String', attribute: 'tools' },
			contentKind: { type: 'String', attribute: 'content-kind' },
			size: { type: 'String', attribute: 'size' },
			language: { type: 'String', attribute: 'language' },

			// Local runtime contracts (passed as JS properties, not attributes)
			scopeElement: { type: 'Object', reflect: false },
			toolRegistry: { type: 'Object', reflect: false },
			pnpResolver: { type: 'Object', reflect: false },
			assessment: { type: 'Object', reflect: false },
			itemRef: { type: 'Object', reflect: false },
			item: { type: 'Object', reflect: false }
		}
	}}
/>

<!--
  ItemToolBar - Inline toolbar for item/passage headers

  Button visibility is always registry-driven:
  - Pass 1: allowed tool IDs (PNP resolver when available, otherwise explicit tools prop)
  - Pass 2: tool-owned isVisibleInContext(context)
-->
<script lang="ts">
	import {
		type AssessmentToolkitShellContext,
		type AssessmentToolkitRuntimeContext
	} from '../context/assessment-toolkit-context.js';
	import {
		connectAssessmentToolkitRuntimeContext,
		connectAssessmentToolkitShellContext,
	} from '../context/runtime-context-consumer.js';
	import type { ToolRegistry, ToolToolbarRenderResult, ToolbarContext } from '../services/ToolRegistry.js';
	import type { PNPToolResolver } from '../services/PNPToolResolver.js';
	import { createDefaultToolRegistry } from '../services/createDefaultToolRegistry.js';
	import { DEFAULT_TOOL_MODULE_LOADERS } from '../tools/default-tool-module-loaders.js';
	import type { AssessmentEntity, AssessmentItemRef, ItemEntity } from '@pie-players/pie-players-shared/types';
	import type { ElementToolContext, ItemToolContext } from '../services/tool-context.js';

	const isBrowser = typeof window !== 'undefined';
	const fallbackToolRegistry = createDefaultToolRegistry({
		toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS
	});

	let activeToolState = $state<Record<string, boolean>>({});

	// Props
	let {
		itemId = '',
		catalogId = '',
		tools = 'calculator,textToSpeech,answerEliminator',
		contentKind = 'assessment-item',
		scopeElement = null,
		toolRegistry = null,
		pnpResolver = null,
		assessment = null,
		itemRef = null,
		item = null,
		class: className = '',
		size = 'md' as 'sm' | 'md' | 'lg',
		language = 'en-US'
	}: {
		itemId?: string;
		catalogId?: string;
		tools?: string;
		contentKind?: string;
		scopeElement?: HTMLElement | null;
		toolRegistry?: ToolRegistry | null;
		pnpResolver?: PNPToolResolver | null;
		assessment?: AssessmentEntity | null;
		itemRef?: AssessmentItemRef | null;
		item?: ItemEntity | null;
		class?: string;
		size?: 'sm' | 'md' | 'lg';
		language?: string;
	} = $props();

	let toolbarRootElement = $state<HTMLDivElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let shellContext = $state<AssessmentToolkitShellContext | null>(null);
	let moduleLoadVersion = $state(0);

	$effect(() => {
		if (!toolbarRootElement) return;
		return connectAssessmentToolkitRuntimeContext(toolbarRootElement, (value) => {
			runtimeContext = value;
		});
	});

	$effect(() => {
		if (!toolbarRootElement) return;
		return connectAssessmentToolkitShellContext(toolbarRootElement, (value) => {
			shellContext = value;
		});
	});

	const effectiveToolCoordinator = $derived(runtimeContext?.toolCoordinator);
	const effectiveTTSService = $derived(runtimeContext?.ttsService);
	const effectiveElementToolStateStore = $derived(runtimeContext?.elementToolStateStore);
	const effectiveAssessmentId = $derived(runtimeContext?.assessmentId ?? '');
	const effectiveSectionId = $derived(runtimeContext?.sectionId ?? '');
	const effectiveItemId = $derived(itemId || shellContext?.itemId || '');
	const effectiveCanonicalItemId = $derived(shellContext?.canonicalItemId || effectiveItemId);
	const effectiveCatalogId = $derived(catalogId || effectiveItemId);
	const effectiveContentKind = $derived(contentKind || shellContext?.contentKind || 'assessment-item');
	const effectiveItem = $derived((item as ItemEntity | null) || (shellContext?.item as ItemEntity | null) || null);

	// Effective registry for visibility and metadata ownership.
	const effectiveToolRegistry = $derived(toolRegistry || fallbackToolRegistry);

	const enabledTools = $derived(
		tools
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean)
	);

	const normalizedEnabledTools = $derived(
		effectiveToolRegistry
			.normalizeToolIds(enabledTools)
			.filter(Boolean)
	);

	// Pass 1: determine allowed tools
	const allowedToolIds = $derived.by(() => {
		if (pnpResolver && assessment && itemRef) {
			const allowedByPnp = pnpResolver.getAllowedToolIds(assessment, itemRef);
			if (normalizedEnabledTools.length === 0) return allowedByPnp;
			return allowedByPnp.filter((toolId) => normalizedEnabledTools.includes(toolId));
		}
		return normalizedEnabledTools;
	});

	const contentReady = $derived.by(() => {
		const config = (effectiveItem as ItemEntity | null)?.config;
		return !!(effectiveItem && config && typeof config === 'object');
	});

	const toolContext = $derived.by((): ItemToolContext | null => {
		if (!contentReady || !effectiveItem) {
			return null;
		}
		return {
			level: 'item',
			assessment: (assessment || {}) as AssessmentEntity,
			itemRef: (itemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
			item: effectiveItem as ItemEntity
		};
	});

	const renderContext = $derived.by((): ItemToolContext => {
		if (toolContext) return toolContext;
		return {
			level: 'item',
			assessment: (assessment || {}) as AssessmentEntity,
			itemRef: (itemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
			item: ((effectiveItem as ItemEntity | null) || ({ id: effectiveCanonicalItemId, config: {} } as ItemEntity)) as ItemEntity
		};
	});

	const elementContexts = $derived.by((): ElementToolContext[] => {
		if (!contentReady || !effectiveItem) return [];
		const modelsRaw = (effectiveItem as any)?.config?.models;
		const models = Array.isArray(modelsRaw)
			? modelsRaw
			: modelsRaw && typeof modelsRaw === 'object'
				? Object.values(modelsRaw)
				: [];
		return models
			.filter((model: any) => model && typeof model === 'object' && typeof model.id === 'string')
			.map((model: any) => ({
				level: 'element' as const,
				assessment: (assessment || {}) as AssessmentEntity,
				itemRef: (itemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
				item: effectiveItem as ItemEntity,
				elementId: model.id as string
			}));
	});

	// Pass 2: tool-owned context filtering (item + element aggregation)
	const visibleToolIds = $derived.by(() => {
		if (!contentReady) {
			// Stage 1: orchestrator-level allow-list only.
			return allowedToolIds;
		}
		if (!toolContext && elementContexts.length === 0) {
			return allowedToolIds;
		}
		const visible = new Set<string>();
		if (toolContext) {
			effectiveToolRegistry.filterVisibleInContext(allowedToolIds, toolContext).forEach((tool) => visible.add(tool.toolId));
		}

		for (const context of elementContexts) {
			effectiveToolRegistry.filterVisibleInContext(allowedToolIds, context).forEach((tool) => visible.add(tool.toolId));
		}

		return Array.from(visible);
	});

	// Dynamically load whatever tools are currently visible.
	// The registry owns module loader configuration by toolId.
	$effect(() => {
		if (!isBrowser) return;
		let cancelled = false;
		void effectiveToolRegistry
			.ensureToolModulesLoaded(visibleToolIds)
			.then(() => {
				if (!cancelled) moduleLoadVersion += 1;
			})
			.catch((error: unknown) => {
				console.error('[ItemToolBar] Failed to load one or more tool modules:', error);
			});
		return () => {
			cancelled = true;
		};
	});

	function resolveScopeElement(): HTMLElement | null {
		if (scopeElement) return scopeElement;
		return shellContext?.scopeElement || null;
	}

	function resolveGlobalElementId(): string | null {
		if (!effectiveElementToolStateStore || !effectiveAssessmentId || !effectiveSectionId || !effectiveCanonicalItemId)
			return null;
		return effectiveElementToolStateStore.getGlobalElementId(
			effectiveAssessmentId,
			effectiveSectionId,
			effectiveCanonicalItemId,
			effectiveCanonicalItemId
		);
	}

	const toolbarContext = $derived.by((): ToolbarContext => {
		const toolkitCoordinator = runtimeContext?.toolkitCoordinator || null;
		const toInstanceToolId = (toolId: string): string => {
			const suffix = `-${effectiveCanonicalItemId}`;
			return toolId.endsWith(suffix) ? toolId : `${toolId}${suffix}`;
		};
		return {
			itemId: effectiveCanonicalItemId,
			catalogId: effectiveCatalogId,
			language,
			ui: {
				size
			},
			getScopeElement: resolveScopeElement,
			getGlobalElementId: resolveGlobalElementId,
			toolCoordinator: effectiveToolCoordinator || null,
			toolkitCoordinator,
			ttsService: effectiveTTSService || null,
			elementToolStateStore: effectiveElementToolStateStore || null,
			toggleTool: (toolId: string) => {
				if (!effectiveToolCoordinator) return;
				effectiveToolCoordinator.toggleTool(toInstanceToolId(toolId));
			},
			isToolVisible: (toolId: string) => {
				if (!effectiveToolCoordinator) return false;
				return effectiveToolCoordinator.isToolVisible(toInstanceToolId(toolId));
			},
			subscribeVisibility: effectiveToolCoordinator
				? (listener: () => void) => effectiveToolCoordinator.subscribe(listener)
				: null,
			ensureTTSReady: toolkitCoordinator ? () => toolkitCoordinator.ensureTTSReady() : null
		};
	});

	let renderedTools = $derived.by((): ToolToolbarRenderResult[] => {
		if (!isBrowser) return [];
		moduleLoadVersion;

		const rendered: ToolToolbarRenderResult[] = [];
		for (const toolId of visibleToolIds) {
			const result = effectiveToolRegistry.renderForToolbar(toolId, renderContext, toolbarContext);
			if (result) {
				rendered.push(result);
			}
		}
		return rendered;
	});

	function syncRenderedToolsState() {
		const nextActiveState: Record<string, boolean> = {};
		for (const renderedTool of renderedTools) {
			renderedTool.sync?.();
			if (renderedTool.button) {
				nextActiveState[renderedTool.toolId] = renderedTool.button.active ?? false;
			}
		}
		activeToolState = nextActiveState;
	}

	$effect(() => {
		const unsubs: Array<() => void> = [];
		syncRenderedToolsState();
		for (const renderedTool of renderedTools) {
			if (renderedTool.subscribeActive) {
				const unsubscribe = renderedTool.subscribeActive((active) => {
					activeToolState = {
						...activeToolState,
						[renderedTool.toolId]: active
					};
					renderedTool.sync?.();
				});
				unsubs.push(unsubscribe);
			}
		}

		return () => {
			unsubs.forEach((unsub) => unsub());
		};
	});

	$effect(() => {
		if (!toolbarContext.subscribeVisibility) return;
		return toolbarContext.subscribeVisibility(() => {
			syncRenderedToolsState();
		});
	});

	function mountElement(node: HTMLSpanElement, element: HTMLElement | null) {
		let mountedElement: HTMLElement | null = null;
		const updateMountedElement = (nextElement: HTMLElement | null) => {
			if (mountedElement === nextElement) return;
			if (mountedElement && mountedElement.parentNode === node) {
				node.removeChild(mountedElement);
			}
			mountedElement = nextElement;
			if (mountedElement) {
				if (mountedElement.parentNode && mountedElement.parentNode !== node) {
					mountedElement.parentNode.removeChild(mountedElement);
				}
				node.appendChild(mountedElement);
			}
		};
		updateMountedElement(element);
		return {
			update(nextElement: HTMLElement | null) {
				updateMountedElement(nextElement);
			},
			destroy() {
				updateMountedElement(null);
			}
		};
	}
</script>

{#if isBrowser}
	<div
		class="item-toolbar {className} item-toolbar--{size}"
		data-content-kind={effectiveContentKind}
		bind:this={toolbarRootElement}
	>
		{#each renderedTools as renderedTool (renderedTool.toolId)}
			{#if renderedTool.inlineElement}
				<span class="item-toolbar__element-host" use:mountElement={renderedTool.inlineElement}></span>
			{/if}

			{#if renderedTool.button}
				<button
					type="button"
					class="item-toolbar__button {renderedTool.button.className || ''}"
					class:item-toolbar__button--active={activeToolState[renderedTool.toolId] ?? renderedTool.button.active ?? false}
					onclick={() => {
						renderedTool.button?.onClick();
						syncRenderedToolsState();
					}}
					aria-label={renderedTool.button.ariaLabel || renderedTool.button.label}
					aria-pressed={activeToolState[renderedTool.toolId] ?? renderedTool.button.active ?? false}
					title={renderedTool.button.tooltip || renderedTool.button.label}
					disabled={renderedTool.button.disabled}
				>
					{#if renderedTool.button.icon.startsWith('<svg')}
						{@html renderedTool.button.icon}
					{:else if renderedTool.button.icon.startsWith('http')}
						<img class="item-toolbar__icon-image" src={renderedTool.button.icon} alt="" />
					{:else}
						<i class={`icon icon-${renderedTool.button.icon}`} aria-hidden="true"></i>
					{/if}
				</button>
			{/if}

			{#if renderedTool.overlayElement}
				<span class="item-toolbar__element-host" use:mountElement={renderedTool.overlayElement}></span>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.item-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.item-toolbar__button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0.25rem;
		border: 1px solid var(--pie-border, #ccc);
		border-radius: 0.25rem;
		background-color: var(--pie-background, white);
		color: var(--pie-text, #333);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.item-toolbar__element-host {
		display: contents;
	}

	.item-toolbar--sm .item-toolbar__button {
		width: 2.75rem;
		height: 2.75rem;
	}

	.item-toolbar--lg .item-toolbar__button {
		width: 2.5rem;
		height: 2.5rem;
	}

	.item-toolbar__button:hover:not(:disabled) {
		background-color: var(--pie-secondary-background, #f5f5f5);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.item-toolbar__button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	.item-toolbar__button--active {
		background-color: var(--pie-primary, #1976d2);
		color: white;
		border-color: var(--pie-primary, #1976d2);
	}

	.item-toolbar__button--active:hover:not(:disabled) {
		background-color: var(--pie-primary-dark, #1565c0);
	}

	.item-toolbar__button:focus-visible {
		outline: 2px solid var(--pie-primary, #1976d2);
		outline-offset: 2px;
	}

	.item-toolbar__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.item-toolbar__button :global(svg) {
		width: 100%;
		height: 100%;
	}

	.item-toolbar__icon-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
