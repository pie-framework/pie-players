<svelte:options
	customElement={{
		tag: 'pie-item-toolbar',
		shadow: 'open',
		props: {
			level: { type: 'String', attribute: 'level' },
			scopeId: { type: 'String', attribute: 'scope-id' },
			itemId: { type: 'String', attribute: 'item-id' },
			sectionId: { type: 'String', attribute: 'section-id' },
			catalogId: { type: 'String', attribute: 'catalog-id' },
			tools: { type: 'String', attribute: 'tools' },
			contentKind: { type: 'String', attribute: 'content-kind' },
			position: { type: 'String', attribute: 'position' },
			size: { type: 'String', attribute: 'size' },
			language: { type: 'String', attribute: 'language' },

			// Local runtime contracts (passed as JS properties, not attributes)
			scopeElement: { type: 'Object', reflect: false },
			toolRegistry: { type: 'Object', reflect: false },
			pnpResolver: { type: 'Object', reflect: false },
			assessment: { type: 'Object', reflect: false },
			itemRef: { type: 'Object', reflect: false },
			item: { type: 'Object', reflect: false },
			hostButtons: { type: 'Object', reflect: false }
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
	import {
		isExternalIconUrl,
		isInlineSvgIcon,
		isToolbarLinkItem,
		type ToolbarItem
	} from '../services/toolbar-items.js';
	import type { PNPToolResolver } from '../services/PNPToolResolver.js';
	import { createDefaultToolRegistry } from '../services/createDefaultToolRegistry.js';
	import { DEFAULT_TOOL_MODULE_LOADERS } from '../tools/default-tool-module-loaders.js';
	import {
		normalizeToolsConfig,
		parseToolList,
		resolveToolsForLevel,
	} from '../services/tools-config-normalizer.js';
	import { createScopedToolId, parseScopedToolId } from '../services/tool-instance-id.js';
	import type { AssessmentEntity, AssessmentItemRef, ItemEntity } from '@pie-players/pie-players-shared/types';
	import type { ElementToolContext, ItemToolContext, ToolLevel, ToolContext } from '../services/tool-context.js';

	const isBrowser = typeof window !== 'undefined';
	const fallbackToolRegistry = createDefaultToolRegistry({
		toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS
	});

	let activeToolState = $state<Record<string, boolean>>({});

	// Props
	let {
		level = 'item' as ToolLevel,
		scopeId = '',
		itemId = '',
		sectionId = '',
		catalogId = '',
		tools = 'calculator,textToSpeech,answerEliminator',
		contentKind = 'assessment-item',
		position = 'bottom' as 'top' | 'right' | 'bottom' | 'left' | 'none',
		scopeElement = null,
		toolRegistry = null,
		pnpResolver = null,
		assessment = null,
		itemRef = null,
		item = null,
		hostButtons = [] as ToolbarItem[],
		class: className = '',
		size = 'md' as 'sm' | 'md' | 'lg',
		language = 'en-US'
	}: {
		level?: ToolLevel;
		scopeId?: string;
		itemId?: string;
		sectionId?: string;
		catalogId?: string;
		tools?: string;
		contentKind?: string;
		position?: 'top' | 'right' | 'bottom' | 'left' | 'none';
		scopeElement?: HTMLElement | null;
		toolRegistry?: ToolRegistry | null;
		pnpResolver?: PNPToolResolver | null;
		assessment?: AssessmentEntity | null;
		itemRef?: AssessmentItemRef | null;
		item?: ItemEntity | null;
		hostButtons?: ToolbarItem[];
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
	const effectiveItemId = $derived(itemId || shellContext?.itemId || '');
	const effectiveCanonicalItemId = $derived(shellContext?.canonicalItemId || effectiveItemId);
	const effectiveSectionId = $derived(sectionId || runtimeContext?.sectionId || '');
	const effectiveContentKind = $derived(contentKind || shellContext?.contentKind || (level === 'section' ? 'section' : 'assessment-item'));
	const effectiveLevel = $derived.by((): ToolLevel => {
		if (level && level !== 'item') return level;
		if (effectiveContentKind === 'rubric-block-stimulus') return 'passage';
		return 'item';
	});
	const effectiveScopeId = $derived.by(() => {
		if (scopeId) return scopeId;
		if (effectiveLevel === 'section') return effectiveSectionId || runtimeContext?.sectionId || 'default-section';
		if (effectiveLevel === 'assessment') return runtimeContext?.assessmentId || 'default-assessment';
		return effectiveCanonicalItemId || effectiveItemId || 'default-item';
	});
	const effectiveCatalogId = $derived(catalogId || effectiveScopeId);
	const effectiveItem = $derived((item as ItemEntity | null) || (shellContext?.item as ItemEntity | null) || null);

	// Effective registry for visibility and metadata ownership.
	const effectiveToolRegistry = $derived(toolRegistry || fallbackToolRegistry);

	const explicitTools = $derived(parseToolList(tools));
	const normalizedExplicitTools = $derived(
		effectiveToolRegistry.normalizeToolIds(explicitTools).filter(Boolean)
	);
	const effectiveToolsConfig = $derived.by(() => {
		const coordinatorConfig = runtimeContext?.toolkitCoordinator?.config?.tools as any;
		return normalizeToolsConfig(coordinatorConfig || {});
	});
	const placementLevel = $derived.by(() => {
		if (effectiveLevel === 'section') return 'section';
		if (effectiveLevel === 'passage' || effectiveContentKind === 'rubric-block-stimulus') return 'passage';
		return 'item';
	});
	const placementAllowedToolIds = $derived.by(() => {
		const resolved = resolveToolsForLevel(effectiveToolsConfig, placementLevel);
		return effectiveToolRegistry.normalizeToolIds(resolved).filter(Boolean);
	});

	// Pass 1: determine allowed tools
	const allowedToolIds = $derived.by(() => {
		const configuredTools =
			normalizedExplicitTools.length > 0 ? normalizedExplicitTools : placementAllowedToolIds;
		if (pnpResolver && assessment && itemRef) {
			const allowedByPnp = pnpResolver.getAllowedToolIds(assessment, itemRef);
			if (configuredTools.length === 0) return allowedByPnp;
			return allowedByPnp.filter((toolId) => configuredTools.includes(toolId));
		}
		return configuredTools;
	});

	const contentReady = $derived.by(() => {
		if (effectiveLevel === 'section' || effectiveLevel === 'assessment') return true;
		const config = (effectiveItem as ItemEntity | null)?.config;
		return !!(effectiveItem && config && typeof config === 'object');
	});

	const toolContext = $derived.by((): ItemToolContext | null => {
		if (effectiveLevel === 'section') {
			return {
				level: 'section',
				assessment: (assessment || {}) as AssessmentEntity,
				section: {} as any
			} as ToolContext as ItemToolContext;
		}
		if (effectiveLevel === 'assessment') {
			return {
				level: 'assessment',
				assessment: (assessment || {}) as AssessmentEntity
			} as ToolContext as ItemToolContext;
		}
		if (!contentReady || !effectiveItem) {
			return null;
		}
		if (effectiveLevel === 'passage') {
			return {
				level: 'passage',
				assessment: (assessment || {}) as AssessmentEntity,
				itemRef: (itemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
				passage: effectiveItem as any
			} as ToolContext as ItemToolContext;
		}
		return {
			level: 'item',
			assessment: (assessment || {}) as AssessmentEntity,
			itemRef: (itemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
			item: effectiveItem as ItemEntity
		} as ToolContext as ItemToolContext;
	});

	const renderContext = $derived.by((): ToolContext => {
		if (toolContext) return toolContext;
		return {
			level: 'item',
			assessment: (assessment || {}) as AssessmentEntity,
			itemRef: (itemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
			item: ((effectiveItem as ItemEntity | null) || ({ id: effectiveCanonicalItemId, config: {} } as ItemEntity)) as ItemEntity
		} as ToolContext;
	});

	const elementContexts = $derived.by((): ElementToolContext[] => {
		if (effectiveLevel !== 'item' && effectiveLevel !== 'passage') return [];
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
		const levelCompatibleToolIds = allowedToolIds.filter((toolId) => {
			const registration = effectiveToolRegistry.get(toolId);
			return registration ? registration.supportedLevels.includes(effectiveLevel) : false;
		});
		if (effectiveLevel === 'section') {
			// Section toolbars are orchestrator-driven. Tool-level relevance is often
			// item-content dependent. Keep pass-1 as the source of truth here.
			return allowedToolIds;
		}
		if (!contentReady) {
			// Stage 1: orchestrator-level allow-list only.
			return levelCompatibleToolIds;
		}
		if (!toolContext && elementContexts.length === 0) {
			return levelCompatibleToolIds;
		}
		const visible = new Set<string>();
		if (toolContext) {
			effectiveToolRegistry
				.filterVisibleInContext(levelCompatibleToolIds, toolContext)
				.forEach((tool) => visible.add(tool.toolId));
		}

		for (const context of elementContexts) {
			effectiveToolRegistry
				.filterVisibleInContext(levelCompatibleToolIds, context)
				.forEach((tool) => visible.add(tool.toolId));
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
			// Accept either base tool IDs (e.g. "calculator") or already-scoped IDs.
			// This keeps toolbar contracts stable across mixed registration implementations.
			return parseScopedToolId(toolId)
				? toolId
				: createScopedToolId(toolId, effectiveLevel, effectiveScopeId);
		};
		return {
			scope: {
				level: effectiveLevel,
				scopeId: effectiveScopeId,
				assessmentId: runtimeContext?.assessmentId,
				sectionId: effectiveSectionId,
				itemId: effectiveItemId,
				canonicalItemId: effectiveCanonicalItemId,
				contentKind: effectiveContentKind
			},
			itemId: effectiveScopeId,
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
				const instanceToolId = toInstanceToolId(toolId);
				// Some tools only self-register after first visibility sync.
				// Seed a placeholder registration so first toggle always works.
				if (!effectiveToolCoordinator.getToolState(instanceToolId)) {
					effectiveToolCoordinator.registerTool(instanceToolId, toolId);
				}
				effectiveToolCoordinator.toggleTool(instanceToolId);
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
	const normalizedHostButtons = $derived.by((): ToolbarItem[] =>
		Array.isArray(hostButtons)
			? hostButtons.filter((item): item is ToolbarItem => !!item && typeof item.id === 'string')
			: []
	);
	const nativeToolbarItems = $derived.by((): ToolbarItem[] =>
		renderedTools
			.filter((renderedTool) => !!renderedTool.button)
			.map((renderedTool) => {
				const button = renderedTool.button!;
				return {
					id: renderedTool.toolId,
					label: button.label,
					ariaLabel: button.ariaLabel || button.label,
					icon: button.icon,
					tooltip: button.tooltip || button.label,
					disabled: button.disabled,
					active: activeToolState[renderedTool.toolId] ?? button.active ?? false,
					onClick: () => {
						button.onClick();
						syncRenderedToolsState();
					},
				} satisfies ToolbarItem;
			})
	);
	const toolbarItems = $derived.by((): ToolbarItem[] => [
		...nativeToolbarItems,
		...normalizedHostButtons
	]);
	const mountedElementsBeforeButtons = $derived.by(() =>
		renderedTools.flatMap((renderedTool) =>
			(renderedTool.elements || [])
				.filter((entry) => entry.mount === 'before-buttons')
				.map((entry) => entry.element)
				.filter((entry): entry is HTMLElement => Boolean(entry))
		)
	);
	const mountedElementsAfterButtons = $derived.by(() =>
		renderedTools.flatMap((renderedTool) =>
			(renderedTool.elements || [])
				.filter((entry) => entry.mount === 'after-buttons')
				.map((entry) => entry.element)
				.filter((entry): entry is HTMLElement => Boolean(entry))
		)
	);

	function isToolbarItemActive(item: ToolbarItem): boolean {
		if (item.id in activeToolState) {
			return activeToolState[item.id] === true;
		}
		return item.active === true;
	}

	function getFallbackIconSvg(iconName: string): string | null {
		const iconMap: Record<string, string> = {
			'chart-bar':
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4.75 5a.76.76 0 0 1 .75.75v11c0 .438.313.75.75.75h13a.76.76 0 0 1 .696 1.039.74.74 0 0 1-.696.461h-13C5 19 4 18 4 16.75v-11A.74.74 0 0 1 4.75 5ZM8 8.25a.74.74 0 0 1 .75-.75h6.5a.76.76 0 0 1 .696 1.039.74.74 0 0 1-.696.461h-6.5A.722.722 0 0 1 8 8.25Zm.75 2.25h4.5a.76.76 0 0 1 .696 1.039.74.74 0 0 1-.696.461h-4.5a.723.723 0 0 1-.75-.75.74.74 0 0 1 .75-.75Zm0 3h8.5a.76.76 0 0 1 .696 1.039.74.74 0 0 1-.696.461h-8.5a.723.723 0 0 1-.75-.75.74.74 0 0 1 .75-.75Z" fill="currentColor"/></svg>',
			beaker:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 21c-.85 0-1.454-.38-1.813-1.137-.358-.759-.27-1.463.263-2.113L9 11V5H8a.968.968 0 0 1-.713-.287A.968.968 0 0 1 7 4c0-.283.096-.52.287-.712A.968.968 0 0 1 8 3h8c.283 0 .52.096.712.288.192.191.288.429.288.712s-.096.52-.288.713A.968.968 0 0 1 16 5h-1v6l5.55 6.75c.533.65.62 1.354.262 2.113C20.454 20.62 19.85 21 19 21H5Zm2-3h10l-3.4-4h-3.2L7 18Zm-2 1h14l-6-7.3V5h-2v6.7L5 19Z" fill="currentColor"/></svg>',
			protractor:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m6.75 21-.25-2.2 2.85-7.85a3.95 3.95 0 0 0 1.75.95l-2.75 7.55L6.75 21Zm10.5 0-1.6-1.55-2.75-7.55a3.948 3.948 0 0 0 1.75-.95l2.85 7.85-.25 2.2ZM12 11a2.893 2.893 0 0 1-2.125-.875A2.893 2.893 0 0 1 9 8c0-.65.188-1.23.563-1.737A2.935 2.935 0 0 1 11 5.2V3h2v2.2c.583.2 1.063.554 1.438 1.063C14.812 6.77 15 7.35 15 8c0 .833-.292 1.542-.875 2.125A2.893 2.893 0 0 1 12 11Zm0-2c.283 0 .52-.096.713-.287A.967.967 0 0 0 13 8a.967.967 0 0 0-.287-.713A.968.968 0 0 0 12 7a.968.968 0 0 0-.713.287A.967.967 0 0 0 11 8c0 .283.096.52.287.713.192.191.43.287.713.287Z" fill="currentColor"/></svg>',
			'bars-3':
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6.85 15c.517 0 .98-.15 1.388-.45.408-.3.695-.692.862-1.175l.375-1.15c.267-.8.2-1.537-.2-2.213C8.875 9.337 8.3 9 7.55 9H4.025l.475 3.925c.083.583.346 1.075.787 1.475.442.4.963.6 1.563.6Zm10.3 0c.6 0 1.12-.2 1.563-.6.441-.4.704-.892.787-1.475L19.975 9h-3.5c-.75 0-1.325.342-1.725 1.025-.4.683-.467 1.425-.2 2.225l.35 1.125c.167.483.454.875.862 1.175.409.3.871.45 1.388.45Zm-10.3 2c-1.1 0-2.063-.363-2.887-1.088a4.198 4.198 0 0 1-1.438-2.737L2 9H1V7h6.55c.733 0 1.404.18 2.013.537A3.906 3.906 0 0 1 11 9h2.025c.35-.617.83-1.104 1.438-1.463A3.892 3.892 0 0 1 16.474 7H23v2h-1l-.525 4.175a4.198 4.198 0 0 1-1.438 2.737A4.238 4.238 0 0 1 17.15 17c-.95 0-1.804-.27-2.562-.813A4.234 4.234 0 0 1 13 14.026l-.375-1.125a21.35 21.35 0 0 1-.1-.363 4.926 4.926 0 0 1-.1-.537h-.85c-.033.2-.067.363-.1.488a21.35 21.35 0 0 1-.1.362L11 14a4.3 4.3 0 0 1-1.588 2.175A4.258 4.258 0 0 1 6.85 17Z" fill="currentColor"/></svg>',
			ruler:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m8.8 10.95 2.15-2.175-1.4-1.425-1.1 1.1-1.4-1.4 1.075-1.1L7 4.825 4.825 7 8.8 10.95Zm8.2 8.225L19.175 17l-1.125-1.125-1.1 1.075-1.4-1.4 1.075-1.1-1.425-1.4-2.15 2.15L17 19.175ZM7.25 21H3v-4.25l4.375-4.375L2 7l5-5 5.4 5.4 3.775-3.8c.2-.2.425-.35.675-.45a2.068 2.068 0 0 1 1.55 0c.25.1.475.25.675.45L20.4 4.95c.2.2.35.425.45.675.1.25.15.508.15.775a1.975 1.975 0 0 1-.6 1.425l-3.775 3.8L22 17l-5 5-5.375-5.375L7.25 21ZM5 19h1.4l9.8-9.775L14.775 7.8 5 17.6V19Z" fill="currentColor"/></svg>'
		};
		return iconMap[iconName] || null;
	}

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
		class:item-toolbar--top={position === 'top'}
		class:item-toolbar--right={position === 'right'}
		class:item-toolbar--bottom={position === 'bottom'}
		class:item-toolbar--left={position === 'left'}
		data-content-kind={effectiveContentKind}
		data-level={effectiveLevel}
		bind:this={toolbarRootElement}
	>
		{#each mountedElementsBeforeButtons as mountedElement (`before-${mountedElement.tagName}-${mountedElement.getAttribute('tool-id') || ''}`)}
			<span class="item-toolbar__element-host" use:mountElement={mountedElement}></span>
		{/each}

		{#each toolbarItems as item (item.id)}
			{#if isToolbarLinkItem(item)}
				<a
					class="item-toolbar__button"
					class:item-toolbar__button--active={isToolbarItemActive(item)}
					href={item.disabled ? undefined : item.href}
					target={item.target}
					rel={item.rel}
					aria-label={item.ariaLabel || item.label}
					title={item.tooltip || item.label}
					aria-disabled={item.disabled ? 'true' : undefined}
					onclick={(event) => {
						if (item.disabled) {
							event.preventDefault();
						}
					}}
				>
					{#if item.icon}
						{#if isInlineSvgIcon(item.icon)}
							{@html item.icon}
						{:else if isExternalIconUrl(item.icon)}
							<img class="item-toolbar__icon-image" src={item.icon} alt="" />
						{:else}
							{@const fallbackIcon = getFallbackIconSvg(item.icon)}
							{#if fallbackIcon}
								{@html fallbackIcon}
							{:else}
								<i class={`icon icon-${item.icon}`} aria-hidden="true"></i>
							{/if}
						{/if}
					{/if}
				</a>
			{:else}
				<button
					type="button"
					class="item-toolbar__button"
					class:item-toolbar__button--active={isToolbarItemActive(item)}
					onclick={item.onClick}
					aria-label={item.ariaLabel || item.label}
					aria-pressed={isToolbarItemActive(item)}
					title={item.tooltip || item.label}
					disabled={item.disabled}
				>
					{#if item.icon}
						{#if isInlineSvgIcon(item.icon)}
							{@html item.icon}
						{:else if isExternalIconUrl(item.icon)}
							<img class="item-toolbar__icon-image" src={item.icon} alt="" />
						{:else}
							{@const fallbackIcon = getFallbackIconSvg(item.icon)}
							{#if fallbackIcon}
								{@html fallbackIcon}
							{:else}
								<i class={`icon icon-${item.icon}`} aria-hidden="true"></i>
							{/if}
						{/if}
					{/if}
				</button>
			{/if}
		{/each}

		{#each mountedElementsAfterButtons as mountedElement (`after-${mountedElement.tagName}-${mountedElement.getAttribute('tool-id') || ''}`)}
			<span class="item-toolbar__element-host" use:mountElement={mountedElement}></span>
		{/each}
	</div>
{/if}

<style>
	.item-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.item-toolbar--top,
	.item-toolbar--bottom {
		flex-direction: row;
		flex-wrap: wrap;
	}

	.item-toolbar--left,
	.item-toolbar--right {
		flex-direction: column;
		align-items: stretch;
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
		text-decoration: none;
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
