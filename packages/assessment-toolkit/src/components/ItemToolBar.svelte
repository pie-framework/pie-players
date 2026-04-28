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
			item: { type: 'Object', reflect: false },
			hostButtons: { type: 'Object', reflect: false }
		}
	}}
/>

<!--
  ItemToolBar - Inline toolbar for item/passage headers

  Button visibility is always registry-driven:
  - Pass 1: ToolkitCoordinator.decideToolPolicy(...) — placement,
    policy.allowed/blocked, provider veto, QTI gates, and registered
    custom PolicySources are all applied inside the ToolPolicyEngine.
    The legacy `pnpResolver` / `assessment` / `itemRef` props were
    removed in M8 PR 3; hosts that need to drive QTI inputs should
    bind `assessment` / `currentItemRef` on the parent
    `pie-assessment-toolkit` element instead.
  - Pass 2: tool-owned isVisibleInContext(context) — relevance gate,
    e.g. "show calculator only when math content is present". Lives
    at the toolbar boundary by design (engine doesn't import tool
    registry render context).
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
	import type {
		HostedToolContext,
		ToolRegistry,
		ToolRenderElement,
		ToolToolbarRenderResult,
		ToolbarContext
	} from '../services/ToolRegistry.js';
	import {
		isExternalIconUrl,
		isInlineSvgIcon,
		isToolbarLinkItem,
		isValidToolbarItemShape,
		type ToolbarItem
	} from '../services/toolbar-items.js';
	import { sanitizeSvgIcon } from '@pie-players/pie-players-shared/security';
	import { createFocusTrap } from '@pie-players/pie-players-shared';
	import { createPackagedToolRegistry } from '../services/createDefaultToolRegistry.js';
	import { DEFAULT_TOOL_MODULE_LOADERS } from '../tools/default-tool-module-loaders.js';
	import { parseToolList } from '../services/tools-config-normalizer.js';
	import { createScopedToolId, parseScopedToolId } from '../services/tool-instance-id.js';
	import type { AssessmentItemRef, AssessmentEntity, ItemEntity } from '@pie-players/pie-players-shared/types';
	import type { ElementToolContext, ItemToolContext, ToolLevel, ToolContext } from '../services/tool-context.js';
	import type { ToolPolicyDecision } from '../policy/engine.js';

	const isBrowser = typeof window !== 'undefined';
	const fallbackToolRegistry = createPackagedToolRegistry({
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
	// Bumped from `coordinator.onPolicyChange(...)` so the engine-driven
	// `policyDecision` / `policyInputs` derivations rerun on input
	// changes (`updateAssessment`, `setQtiEnforcement`, custom source
	// register / remove). The decision itself is computed by the
	// coordinator's policy engine — this counter is just the reactive
	// fanout that lets Svelte know the engine answer may have changed.
	let policyChangeVersion = $state(0);

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

	$effect(() => {
		const coord = runtimeContext?.toolkitCoordinator;
		if (!coord || typeof coord.onPolicyChange !== 'function') return;
		const unsubscribe = coord.onPolicyChange(() => {
			policyChangeVersion += 1;
		});
		return () => {
			try {
				unsubscribe?.();
			} catch {
				// detach errors are non-fatal: the coordinator may already
				// be torn down, in which case the listener set is GC-eligible.
			}
		};
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
	const placementLevel = $derived.by((): 'section' | 'item' | 'passage' => {
		if (effectiveLevel === 'section') return 'section';
		if (effectiveLevel === 'passage' || effectiveContentKind === 'rubric-block-stimulus') return 'passage';
		return 'item';
	});

	// Pass 1 — single source of truth via the ToolPolicyEngine
	// (M8 PR 3). When the toolbar is mounted under
	// `<pie-assessment-toolkit>` the coordinator owns the engine and
	// applies `placement → policy.allowed → policy.blocked →
	// providers → QTI` plus any custom `PolicySource`s the host has
	// registered. The toolbar trusts that decision verbatim — the
	// `tools=` prop is *not* applied as a downstream filter.
	//
	// The `tools=` attribute is only consulted in the standalone
	// fallback path (no coordinator in scope, e.g. fixtures that
	// mount `<pie-item-toolbar>` directly). Hosts that want to
	// restrict the engine's visible set should configure
	// `tools.policy` / `tools.providers` on the assessment-toolkit
	// inputs, or register a custom `PolicySource`, rather than
	// passing `tools=` here.
	const policyDecision = $derived.by((): ToolPolicyDecision | null => {
		// Read `policyChangeVersion` so we re-derive whenever the
		// coordinator emits a policy change (assessment binding,
		// QTI enforcement override, custom source registration).
		void policyChangeVersion;
		const coord = runtimeContext?.toolkitCoordinator;
		if (!coord || typeof coord.decideToolPolicy !== 'function') {
			return null;
		}
		return coord.decideToolPolicy({
			level: placementLevel,
			scope: {
				level: effectiveLevel,
				scopeId: effectiveScopeId,
				assessmentId: runtimeContext?.assessmentId,
				sectionId: effectiveSectionId || undefined,
				itemId: effectiveItemId || undefined,
				canonicalItemId: effectiveCanonicalItemId || undefined,
				contentKind: effectiveContentKind,
			},
		});
	});
	const allowedToolIds = $derived.by((): string[] => {
		const dedupe = (toolIds: string[]): string[] => Array.from(new Set(toolIds));
		if (policyDecision) {
			return dedupe(
				effectiveToolRegistry
					.normalizeToolIds(
						policyDecision.visibleTools.map((entry) => entry.toolId),
					)
					.filter(Boolean),
			);
		}
		// Standalone fallback: no coordinator in scope. Honour the
		// explicit `tools=` prop verbatim so demo fixtures keep
		// working without a `<pie-assessment-toolkit>` ancestor.
		return dedupe(normalizedExplicitTools);
	});

	const contentReady = $derived.by(() => {
		if (effectiveLevel === 'section' || effectiveLevel === 'assessment') return true;
		const config = (effectiveItem as ItemEntity | null)?.config;
		return !!(effectiveItem && config && typeof config === 'object');
	});

	// QTI inputs (`assessment`, `currentItemRef`) live on the
	// coordinator after M8 PR 2; the toolbar reads them through
	// `getPolicyInputs()` so it can build the correct Pass-2 context
	// without re-binding props. Standalone (no-coordinator) usage
	// falls back to the empty / canonical-id-derived contexts that
	// satisfy the `ToolContext` shape for `isVisibleInContext` calls.
	const policyInputs = $derived.by(() => {
		void policyChangeVersion;
		const coord = runtimeContext?.toolkitCoordinator;
		if (!coord || typeof coord.getPolicyInputs !== 'function') {
			return null;
		}
		return coord.getPolicyInputs();
	});
	const effectiveAssessment = $derived(policyInputs?.assessment ?? null);
	const effectiveItemRef = $derived(policyInputs?.currentItemRef ?? null);

	const toolContext = $derived.by((): ItemToolContext | null => {
		if (effectiveLevel === 'section') {
			return {
				level: 'section',
				assessment: (effectiveAssessment || {}) as AssessmentEntity,
				section: {} as any
			} as ToolContext as ItemToolContext;
		}
		if (effectiveLevel === 'assessment') {
			return {
				level: 'assessment',
				assessment: (effectiveAssessment || {}) as AssessmentEntity
			} as ToolContext as ItemToolContext;
		}
		if (!contentReady || !effectiveItem) {
			return null;
		}
		if (effectiveLevel === 'passage') {
			return {
				level: 'passage',
				assessment: (effectiveAssessment || {}) as AssessmentEntity,
				itemRef: (effectiveItemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
				passage: effectiveItem as any
			} as ToolContext as ItemToolContext;
		}
		return {
			level: 'item',
			assessment: (effectiveAssessment || {}) as AssessmentEntity,
			itemRef: (effectiveItemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
			item: effectiveItem as ItemEntity
		} as ToolContext as ItemToolContext;
	});

	const renderContext = $derived.by((): ToolContext => {
		if (toolContext) return toolContext;
		return {
			level: 'item',
			assessment: (effectiveAssessment || {}) as AssessmentEntity,
			itemRef: (effectiveItemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
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
				assessment: (effectiveAssessment || {}) as AssessmentEntity,
				itemRef: (effectiveItemRef || ({ id: effectiveCanonicalItemId } as AssessmentItemRef)) as AssessmentItemRef,
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
	const toolbarVisibleToolIds = $derived.by(() =>
		effectiveToolRegistry.filterToolIdsByActivation(visibleToolIds, 'toolbar-toggle')
	);

	// Dynamically load whatever tools are currently visible.
	// The registry owns module loader configuration by toolId.
	$effect(() => {
		if (!isBrowser) return;
		let cancelled = false;
		void effectiveToolRegistry
			.ensureToolModulesLoaded(toolbarVisibleToolIds)
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
				: null
		};
	});

	let renderedTools = $derived.by((): ToolToolbarRenderResult[] => {
		if (!isBrowser) return [];
		moduleLoadVersion;

		const rendered: ToolToolbarRenderResult[] = [];
		for (const toolId of toolbarVisibleToolIds) {
			const result = effectiveToolRegistry.renderForToolbar(toolId, renderContext, toolbarContext);
			if (result) {
				rendered.push(result);
			}
		}
		return rendered;
	});
	const normalizedHostButtons = $derived.by((): ToolbarItem[] => {
		if (!Array.isArray(hostButtons)) return [];
		const valid: ToolbarItem[] = [];
		hostButtons.forEach((item, index) => {
			if (isValidToolbarItemShape(item)) {
				valid.push(item);
				return;
			}
			console.warn(
				`[ItemToolBar] Ignoring invalid host button at index ${index}. Expected { id, label, href | onClick } with valid types.`,
			);
		});
		return valid;
	});
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
	type MountedToolElement = {
		key: string;
		toolId: string;
		entry: ToolRenderElement & { element: HTMLElement };
	};
	const renderedToolActiveById = $derived.by(() => {
		const result: Record<string, boolean> = {};
		for (const renderedTool of renderedTools) {
			result[renderedTool.toolId] =
				activeToolState[renderedTool.toolId] ?? renderedTool.button?.active ?? false;
		}
		return result;
	});
	const mountedElementsBeforeButtons = $derived.by((): MountedToolElement[] =>
		renderedTools.flatMap((renderedTool) =>
			(renderedTool.elements || [])
				.filter((entry) => entry.mount === 'before-buttons')
				.filter((entry): entry is ToolRenderElement & { element: HTMLElement } => Boolean(entry.element))
				.map((entry, index) => ({
					key: `before-${renderedTool.toolId}-${index}`,
					toolId: renderedTool.toolId,
					entry
				}))
		)
	);
	const mountedElementsAfterButtons = $derived.by((): MountedToolElement[] =>
		renderedTools.flatMap((renderedTool) =>
			(renderedTool.elements || [])
				.filter((entry) => entry.mount === 'after-buttons')
				.filter((entry): entry is ToolRenderElement & { element: HTMLElement } => Boolean(entry.element))
				.map((entry, index) => ({
					key: `after-${renderedTool.toolId}-${index}`,
					toolId: renderedTool.toolId,
					entry
				}))
		)
	);
	const mountedElementsControlsRow = $derived.by((): MountedToolElement[] =>
		renderedTools.flatMap((renderedTool) =>
			(renderedTool.elements || [])
				.filter((entry) => entry.mount === 'controls-row')
				.filter((entry): entry is ToolRenderElement & { element: HTMLElement } => Boolean(entry.element))
				.map((entry, index) => ({
					key: `controls-row-${renderedTool.toolId}-${index}`,
					toolId: renderedTool.toolId,
					entry
				}))
		)
	);
	const controlsRowHints = $derived.by(() =>
		renderedTools.flatMap((renderedTool) =>
			(renderedTool.elements || [])
				.map((entry) => ({
					toolId: renderedTool.toolId,
					hint: entry.layoutHints?.controlsRow
				}))
				.filter((entry) => Boolean(entry.hint))
		)
	);
	const controlsRowShouldReserveSpace = $derived.by(
		() => controlsRowHints.some((entry) => entry.hint?.reserveSpace === true)
	);
	const controlsRowShouldExpandForActiveTool = $derived.by(
		() =>
			controlsRowHints.some(
				(entry) =>
					entry.hint?.showWhenToolActive === true &&
					(renderedToolActiveById[entry.toolId] ?? false)
			)
	);
	const controlsRowAlignStart = $derived.by(() =>
		position === 'left' || position === 'right'
	);
	const shouldRenderControlsRow = $derived.by(
		() =>
			mountedElementsControlsRow.length > 0 ||
			controlsRowShouldReserveSpace ||
			controlsRowShouldExpandForActiveTool
	);

	function isToolbarItemActive(item: ToolbarItem): boolean {
		if (item.id in activeToolState) {
			return activeToolState[item.id] === true;
		}
		return item.active === true;
	}

	function getFallbackIconSvg(iconName: string): string | null {
		const iconMap: Record<string, string> = {
			calculator:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v4h10V4H7Zm0 6v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Zm-8 4v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Zm-8 4v2h2v-2H7Zm4 0v2h2v-2h-2Zm4 0v2h2v-2h-2Z" fill="currentColor"/></svg>',
			'volume-up':
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 3.23v2.06A7.002 7.002 0 0 1 19 12a7 7 0 0 1-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77Zm-2 17.75V3L7 8H3v8h4l5 5Zm4.5-9a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12Z" fill="currentColor"/></svg>',
			swatch:
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.55-.45-1-1-1h-2.5a1.5 1.5 0 0 1 0-3H20a1 1 0 0 0 1-1 8.99 8.99 0 0 0-9-4Zm-5.5 9A1.5 1.5 0 1 1 8 13.5 1.5 1.5 0 0 1 6.5 12Zm3-4A1.5 1.5 0 1 1 11 9.5 1.5 1.5 0 0 1 9.5 8Zm5 0A1.5 1.5 0 1 1 16 9.5 1.5 1.5 0 0 1 14.5 8Z" fill="currentColor"/></svg>',
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
				let disposed = false;
				const unsubscribe = renderedTool.subscribeActive((active) => {
					// Tools may dispatch their active-change signal from inside
					// a tracked Svelte $effect (e.g. tool-tts-inline does this
					// on mount). When the toolbar synchronously creates / re-
					// connects the tool element during its own template/
					// derivation pass — for example when the section player
					// collapses on resize — that dispatch lands back here while
					// our parent derivation is still running, and Svelte
					// rejects the `activeToolState` write with
					// `state_unsafe_mutation`. Queue the update on a
					// microtask so the mutation happens after the current
					// reactive flush settles.
					queueMicrotask(() => {
						if (disposed) return;
						activeToolState = {
							...activeToolState,
							[renderedTool.toolId]: active
						};
						renderedTool.sync?.();
					});
				});
				unsubs.push(() => {
					disposed = true;
					unsubscribe();
				});
			}
		}

		return () => {
			unsubs.forEach((unsub) => unsub());
		};
	});

	$effect(() => {
		if (!toolbarContext.subscribeVisibility) return;
		let disposed = false;
		const unsubscribe = toolbarContext.subscribeVisibility(() => {
			// Defense-in-depth: defer the state write so a synchronous
			// visibility broadcast from the coordinator never lands inside
			// an active parent derivation/template flush. See the
			// `subscribeActive` handler above for the failure mode this
			// pattern prevents.
			queueMicrotask(() => {
				if (disposed) return;
				syncRenderedToolsState();
			});
		});
		return () => {
			disposed = true;
			unsubscribe?.();
		};
	});

	$effect(() => {
		const toolkitCoordinator = toolbarContext.toolkitCoordinator as
			| { subscribeTelemetry?: (listener: (args: { eventName?: string; payload?: { toolId?: string } }) => void) => () => void }
			| null;
		if (typeof toolkitCoordinator?.subscribeTelemetry !== 'function') return;
		let disposed = false;
		const unsubscribe = toolkitCoordinator.subscribeTelemetry(({ eventName, payload }) => {
			if (eventName !== 'pie-toolkit-tool-config-updated') return;
			if (payload?.toolId && !toolbarVisibleToolIds.includes(payload.toolId)) return;
			// Defense-in-depth: telemetry can be emitted from anywhere in
			// the toolkit lifecycle, including paths that flush
			// synchronously while this component's deriveds are running.
			// Defer the writes so the parent flush always settles first.
			queueMicrotask(() => {
				if (disposed) return;
				moduleLoadVersion += 1;
				syncRenderedToolsState();
			});
		});
		return () => {
			disposed = true;
			unsubscribe?.();
		};
	});

	function mountElement(node: HTMLSpanElement, element: HTMLElement | null) {
		let mountedElement: HTMLElement | null = null;
		const invokeElementUnmount = (value: HTMLElement | null) => {
			if (!value) return;
			const callback = (value as unknown as { [key: string]: unknown })[
				'__pieToolElementUnmount'
			];
			if (typeof callback === 'function') {
				(callback as () => void)();
			}
		};
		const updateMountedElement = (nextElement: HTMLElement | null) => {
			if (mountedElement === nextElement) return;
			if (mountedElement) {
				invokeElementUnmount(mountedElement);
				if (mountedElement.parentNode === node) {
					node.removeChild(mountedElement);
				}
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

	type ShellMountedArgs = {
		mounted: MountedToolElement;
		active: boolean;
	};

	function mountElementWithShell(node: HTMLSpanElement, args: ShellMountedArgs) {
		let currentArgs = args;
		let shellEl: HTMLDivElement | null = null;
		let headerEl: HTMLDivElement | null = null;
		let contentEl: HTMLDivElement | null = null;
		let titleEl: HTMLSpanElement | null = null;
		let controlsEl: HTMLDivElement | null = null;
		let closeButtonEl: HTMLButtonElement | null = null;
		let resizeHandleEl: HTMLDivElement | null = null;
		let mountedContentElement: HTMLElement | null = null;
		let dragPointerId: number | null = null;
		let resizePointerId: number | null = null;
		let dragOffsetX = 0;
		let dragOffsetY = 0;
		let resizeStartWidth = 0;
		let resizeStartHeight = 0;
		let resizeStartX = 0;
		let resizeStartY = 0;
		let x = 0;
		let y = 0;
		let width = currentArgs.mounted.entry.shell?.initialWidth ?? 720;
		let height = currentArgs.mounted.entry.shell?.initialHeight ?? 560;
		let focusTrapCleanup: (() => void) | null = null;
		let openerEl: HTMLElement | null = null;
		let previousActive = false;
		const invokeElementUnmount = (value: HTMLElement | null) => {
			if (!value) return;
			const callback = (value as unknown as { [key: string]: unknown })[
				'__pieToolElementUnmount'
			];
			if (typeof callback === 'function') {
				(callback as () => void)();
			}
		};
		const getHostedContext = (): HostedToolContext | null => {
			const shellConfig = currentArgs.mounted.entry.shell;
			if (!shellConfig) return null;
			return {
				toolId: currentArgs.mounted.toolId,
				toolbarContext,
				shellConfig
			};
		};
		const notifyHostedMount = (element: HTMLElement) => {
			const registration = effectiveToolRegistry.get(currentArgs.mounted.toolId);
			const context = getHostedContext();
			if (!registration?.onHostedMount || !context) return;
			void registration.onHostedMount(element, context);
		};
		const notifyHostedResize = () => {
			const registration = effectiveToolRegistry.get(currentArgs.mounted.toolId);
			const context = getHostedContext();
			if (!registration?.onHostedResize || !context) return;
			void registration.onHostedResize({ width, height }, currentArgs.mounted.entry.element, context);
		};
		const notifyHostedUnmount = () => {
			const registration = effectiveToolRegistry.get(currentArgs.mounted.toolId);
			const context = getHostedContext();
			if (!registration?.onHostedUnmount || !context) return;
			void registration.onHostedUnmount(currentArgs.mounted.entry.element, context);
		};

		const clamp = (value: number, min: number, max: number): number =>
			Math.max(min, Math.min(value, max));

		const getShellBounds = () => {
			const shellConfig = currentArgs.mounted.entry.shell;
			const minWidth = shellConfig?.minWidth ?? 320;
			const minHeight = shellConfig?.minHeight ?? 240;
			const maxWidth = shellConfig?.maxWidth ?? window.innerWidth;
			const maxHeight = shellConfig?.maxHeight ?? window.innerHeight;
			return {
				minWidth,
				minHeight,
				maxWidth,
				maxHeight
			};
		};

		const applyPositionAndSize = () => {
			const { minWidth, minHeight, maxWidth, maxHeight } = getShellBounds();
			width = clamp(width, minWidth, Math.max(minWidth, Math.min(maxWidth, window.innerWidth)));
			height = clamp(height, minHeight, Math.max(minHeight, Math.min(maxHeight, window.innerHeight)));
			x = clamp(x, 0, Math.max(0, window.innerWidth - width));
			y = clamp(y, 0, Math.max(0, window.innerHeight - height));
			applyShellStyle();
			notifyHostedResize();
		};

		const moveBy = (dx: number, dy: number) => {
			x += dx;
			y += dy;
			applyPositionAndSize();
		};

		const resizeBy = (dw: number, dh: number) => {
			width += dw;
			height += dh;
			applyPositionAndSize();
		};

		const createShellControlButton = (
			label: string,
			glyph: string,
			onActivate: () => void
		) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'pie-tool-shell__control';
			button.setAttribute('aria-label', label);
			button.title = label;
			button.textContent = glyph;
			button.style.border = '1px solid transparent';
			button.style.background = 'color-mix(in srgb, var(--pie-white, #fff) 10%, transparent)';
			button.style.color = 'inherit';
			button.style.cursor = 'pointer';
			button.style.display = 'inline-flex';
			button.style.alignItems = 'center';
			button.style.justifyContent = 'center';
			button.style.width = '28px';
			button.style.height = '28px';
			button.style.padding = '0';
			button.style.fontSize = '14px';
			button.style.fontWeight = '700';
			button.style.borderRadius = '8px';
			button.style.lineHeight = '1';
			button.onclick = (event) => {
				event.stopPropagation();
				onActivate();
				bringToFront();
			};
			button.onfocus = () => {
				button.style.outline =
					'2px solid var(--pie-button-focus-outline, var(--pie-primary, #4A90E2))';
				button.style.outlineOffset = '2px';
			};
			button.onblur = () => {
				button.style.outline = 'none';
				button.style.outlineOffset = '0';
			};
			return button;
		};

		const applyShellStyle = () => {
			if (!shellEl) return;
			shellEl.style.left = `${x}px`;
			shellEl.style.top = `${y}px`;
			shellEl.style.width = `${width}px`;
			shellEl.style.height = `${height}px`;
			shellEl.style.display = currentArgs.active ? 'flex' : 'none';
		};

		const mountContent = () => {
			if (!contentEl) return;
			const element = currentArgs.mounted.entry.element;
			element.style.display = 'block';
			element.style.width = '100%';
			element.style.height = '100%';
			element.style.flex = '1 1 auto';
			element.style.minHeight = '0';
			if (mountedContentElement && mountedContentElement !== element) {
				if (mountedContentElement.parentNode === contentEl) {
					invokeElementUnmount(mountedContentElement);
					contentEl.removeChild(mountedContentElement);
				}
				mountedContentElement = null;
			}
			if (element.parentNode && element.parentNode !== contentEl) {
				element.parentNode.removeChild(element);
			}
			if (element.parentNode !== contentEl) {
				contentEl.appendChild(element);
			}
			mountedContentElement = element;
			notifyHostedMount(element);
		};

		const bringToFront = () => {
			if (effectiveToolCoordinator && shellEl) {
				effectiveToolCoordinator.bringToFront(shellEl);
			}
		};

		const centerShell = () => {
			const viewportW = window.innerWidth;
			const viewportH = window.innerHeight;
			x = Math.max(0, Math.round((viewportW - width) / 2));
			y = Math.max(0, Math.round((viewportH - height) / 2));
			applyPositionAndSize();
		};

		const restoreOpenerFocus = () => {
			const target = openerEl;
			if (!target) return;
			queueMicrotask(() => {
				if (!target.isConnected) return;
				try {
					target.focus();
				} catch {
					// ignore
				}
			});
		};

		const getDeepActiveElement = (): HTMLElement | null => {
			if (typeof document === 'undefined') return null;
			let active: Element | null = document.activeElement;
			while (active) {
				const root = (active as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
				if (root && root.activeElement && root.activeElement !== active) {
					active = root.activeElement;
				} else {
					break;
				}
			}
			return (active as HTMLElement | null) ?? null;
		};

		const installFocusTrap = () => {
			if (!shellEl || focusTrapCleanup) return;
			const active = getDeepActiveElement();
			// Only update opener if we don't already have one (survives re-open within a
			// single mount lifecycle) and the active element isn't inside the shell itself.
			if (!openerEl && active && !shellEl.contains(active)) {
				openerEl = active;
			}
			focusTrapCleanup = createFocusTrap(shellEl, {
				initialFocus: closeButtonEl,
				onEscape: () => {
					closeShell();
				}
			});
		};

		const removeFocusTrap = () => {
			if (!focusTrapCleanup) return;
			const cleanup = focusTrapCleanup;
			focusTrapCleanup = null;
			try {
				cleanup();
			} catch {
				// ignore
			}
			restoreOpenerFocus();
		};

		const closeShell = () => {
			toolbarContext.toggleTool(currentArgs.mounted.toolId);
			syncRenderedToolsState();
		};

		const onHeaderPointerDown = (event: PointerEvent) => {
			if (!currentArgs.mounted.entry.shell?.draggable) return;
			const target = event.target as HTMLElement;
			if (target.closest('button')) return;
			if (!shellEl) return;
			dragPointerId = event.pointerId;
			dragOffsetX = event.clientX - x;
			dragOffsetY = event.clientY - y;
			shellEl.setPointerCapture(event.pointerId);
			bringToFront();
		};

		const onResizePointerDown = (event: PointerEvent) => {
			if (!shellEl || !currentArgs.mounted.entry.shell?.resizable) return;
			event.stopPropagation();
			resizePointerId = event.pointerId;
			resizeStartWidth = width;
			resizeStartHeight = height;
			resizeStartX = event.clientX;
			resizeStartY = event.clientY;
			shellEl.setPointerCapture(event.pointerId);
			bringToFront();
		};

		const onShellPointerMove = (event: PointerEvent) => {
			if (!shellEl) return;
			if (dragPointerId === event.pointerId) {
				const maxX = Math.max(0, window.innerWidth - width);
				const maxY = Math.max(0, window.innerHeight - height);
				x = clamp(event.clientX - dragOffsetX, 0, maxX);
				y = clamp(event.clientY - dragOffsetY, 0, maxY);
				applyShellStyle();
				return;
			}
			if (resizePointerId === event.pointerId) {
				const shellConfig = currentArgs.mounted.entry.shell;
				const minWidth = shellConfig?.minWidth ?? 320;
				const minHeight = shellConfig?.minHeight ?? 240;
				const maxWidth = shellConfig?.maxWidth ?? window.innerWidth;
				const maxHeight = shellConfig?.maxHeight ?? window.innerHeight;
				width = clamp(
					resizeStartWidth + (event.clientX - resizeStartX),
					minWidth,
					Math.max(minWidth, Math.min(maxWidth, window.innerWidth - x))
				);
				height = clamp(
					resizeStartHeight + (event.clientY - resizeStartY),
					minHeight,
					Math.max(minHeight, Math.min(maxHeight, window.innerHeight - y))
				);
				applyShellStyle();
				notifyHostedResize();
			}
		};

		const onShellPointerUp = (event: PointerEvent) => {
			if (!shellEl) return;
			if (dragPointerId === event.pointerId) {
				dragPointerId = null;
				shellEl.releasePointerCapture(event.pointerId);
			}
			if (resizePointerId === event.pointerId) {
				resizePointerId = null;
				shellEl.releasePointerCapture(event.pointerId);
			}
		};

		const onWindowResize = () => {
			applyPositionAndSize();
		};

		if (isBrowser && currentArgs.mounted.entry.shell) {
			shellEl = document.createElement('div');
			shellEl.className = 'pie-tool-shell';
			shellEl.setAttribute('data-pie-tool-shell', currentArgs.mounted.toolId);
			shellEl.style.position = 'fixed';
			shellEl.style.zIndex = '2000';
			shellEl.style.background = 'var(--pie-background, #fff)';
			shellEl.style.border = '1px solid var(--pie-border-light, #d1d5db)';
			shellEl.style.borderRadius = '12px';
			shellEl.style.boxShadow =
				'0 10px 40px color-mix(in srgb, var(--pie-black, #000) 25%, transparent)';
			shellEl.style.overflow = 'hidden';
			shellEl.style.display = currentArgs.active ? 'flex' : 'none';
			shellEl.style.flexDirection = 'column';

			headerEl = document.createElement('div');
			headerEl.className = 'pie-tool-shell__header';
			headerEl.style.display = 'flex';
			headerEl.style.alignItems = 'center';
			headerEl.style.justifyContent = 'space-between';
			headerEl.style.padding = '10px 12px';
			headerEl.style.background = 'var(--pie-primary-dark, #2c3e50)';
			headerEl.style.color = 'var(--pie-white, #fff)';
			headerEl.style.cursor = currentArgs.mounted.entry.shell.draggable === false ? 'default' : 'move';
			headerEl.style.flex = '0 0 auto';

			titleEl = document.createElement('span');
			titleEl.className = 'pie-tool-shell__title';
			titleEl.textContent = currentArgs.mounted.entry.shell.title || currentArgs.mounted.toolId;
			headerEl.appendChild(titleEl);

			controlsEl = document.createElement('div');
			controlsEl.className = 'pie-tool-shell__controls';
			controlsEl.style.display = 'inline-flex';
			controlsEl.style.alignItems = 'center';
			controlsEl.style.gap = '4px';
			const shellConfig = currentArgs.mounted.entry.shell;
			if (shellConfig?.draggable !== false) {
				controlsEl.appendChild(
					createShellControlButton('Move tool left', '←', () => moveBy(-24, 0))
				);
				controlsEl.appendChild(
					createShellControlButton('Move tool right', '→', () => moveBy(24, 0))
				);
			}
			if (shellConfig?.resizable !== false) {
				controlsEl.appendChild(
					createShellControlButton('Shrink tool window', '−', () => resizeBy(-40, -40))
				);
				controlsEl.appendChild(
					createShellControlButton('Grow tool window', '+', () => resizeBy(40, 40))
				);
			}
			controlsEl.appendChild(createShellControlButton('Center tool window', '◎', centerShell));
			headerEl.appendChild(controlsEl);

			closeButtonEl = document.createElement('button');
			closeButtonEl.type = 'button';
			closeButtonEl.className = 'pie-tool-shell__close';
			closeButtonEl.setAttribute('aria-label', 'Close tool');
			const svgNs = 'http://www.w3.org/2000/svg';
			const closeIconEl = document.createElementNS(svgNs, 'svg');
			closeIconEl.setAttribute('xmlns', svgNs);
			closeIconEl.setAttribute('viewBox', '0 0 16 16');
			closeIconEl.setAttribute('aria-hidden', 'true');
			const closeIconPath = document.createElementNS(svgNs, 'path');
			closeIconPath.setAttribute('d', 'M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5');
			closeIconPath.setAttribute('stroke', 'currentColor');
			closeIconPath.setAttribute('stroke-width', '1.8');
			closeIconPath.setAttribute('stroke-linecap', 'round');
			closeIconEl.appendChild(closeIconPath);
			closeButtonEl.appendChild(closeIconEl);
			// SVGElement.style exists but is readonly in DOM types; cast once.
			const closeIconStyle = (closeIconEl as unknown as HTMLElement).style;
			closeIconStyle.width = '16px';
			closeIconStyle.height = '16px';
			closeIconStyle.display = 'block';
			closeIconStyle.flexShrink = '0';
			closeIconStyle.pointerEvents = 'none';
			const closeButtonBaseBackground =
				'color-mix(in srgb, var(--pie-white, #fff) 8%, transparent)';
			const closeButtonHoverBackground =
				'color-mix(in srgb, var(--pie-white, #fff) 18%, transparent)';
			closeButtonEl.style.border = '1px solid transparent';
			closeButtonEl.style.background = closeButtonBaseBackground;
			closeButtonEl.style.color = 'inherit';
			closeButtonEl.style.cursor = 'pointer';
			closeButtonEl.style.display = 'inline-flex';
			closeButtonEl.style.alignItems = 'center';
			closeButtonEl.style.justifyContent = 'center';
			closeButtonEl.style.width = '28px';
			closeButtonEl.style.height = '28px';
			closeButtonEl.style.padding = '0';
			closeButtonEl.style.borderRadius = '8px';
			closeButtonEl.style.lineHeight = '0';
			closeButtonEl.style.transition = 'background-color 0.15s ease, border-color 0.15s ease';
			closeButtonEl.style.display =
				currentArgs.mounted.entry.shell.closeable === false ? 'none' : 'inline-flex';
			closeButtonEl.onmouseenter = () => {
				closeButtonEl && (closeButtonEl.style.background = closeButtonHoverBackground);
			};
			closeButtonEl.onmouseleave = () => {
				closeButtonEl && (closeButtonEl.style.background = closeButtonBaseBackground);
			};
			closeButtonEl.onfocus = () => {
				closeButtonEl && (closeButtonEl.style.outline =
					'2px solid var(--pie-button-focus-outline, var(--pie-primary, #4A90E2))');
				closeButtonEl && (closeButtonEl.style.outlineOffset = '2px');
			};
			closeButtonEl.onblur = () => {
				closeButtonEl && (closeButtonEl.style.outline = 'none');
				closeButtonEl && (closeButtonEl.style.outlineOffset = '0');
			};
			closeButtonEl.onclick = closeShell;
			headerEl.appendChild(closeButtonEl);
			headerEl.tabIndex = 0;
			headerEl.onkeydown = (event: KeyboardEvent) => {
				if (event.key === 'Home') {
					event.preventDefault();
					centerShell();
					return;
				}
				const keyboardShellConfig = currentArgs.mounted.entry.shell;
				if (event.shiftKey && keyboardShellConfig?.resizable !== false) {
					if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
						event.preventDefault();
						resizeBy(40, 40);
						return;
					}
					if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
						event.preventDefault();
						resizeBy(-40, -40);
						return;
					}
				}
				if (keyboardShellConfig?.draggable !== false) {
					if (event.key === 'ArrowLeft') {
						event.preventDefault();
						moveBy(-24, 0);
					} else if (event.key === 'ArrowRight') {
						event.preventDefault();
						moveBy(24, 0);
					} else if (event.key === 'ArrowUp') {
						event.preventDefault();
						moveBy(0, -24);
					} else if (event.key === 'ArrowDown') {
						event.preventDefault();
						moveBy(0, 24);
					}
				}
			};

			contentEl = document.createElement('div');
			contentEl.className = 'pie-tool-shell__content';
			contentEl.style.position = 'relative';
			contentEl.style.width = '100%';
			contentEl.style.flex = '1 1 auto';
			contentEl.style.minHeight = '0';

			shellEl.appendChild(headerEl);
			shellEl.appendChild(contentEl);

			if (currentArgs.mounted.entry.shell.resizable !== false) {
				resizeHandleEl = document.createElement('div');
				resizeHandleEl.className = 'pie-tool-shell__resize';
				resizeHandleEl.style.position = 'absolute';
				resizeHandleEl.style.right = '0';
				resizeHandleEl.style.bottom = '0';
				resizeHandleEl.style.width = '24px';
				resizeHandleEl.style.height = '24px';
				resizeHandleEl.style.cursor = 'nwse-resize';
				resizeHandleEl.style.background =
					'linear-gradient(135deg, transparent 0%, transparent 40%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.35) 60%, transparent 60%, transparent 100%)';
				shellEl.appendChild(resizeHandleEl);
				resizeHandleEl.addEventListener('pointerdown', onResizePointerDown);
			}

			headerEl.addEventListener('pointerdown', onHeaderPointerDown);
			shellEl.addEventListener('pointermove', onShellPointerMove);
			shellEl.addEventListener('pointerup', onShellPointerUp);
			shellEl.addEventListener('pointerdown', bringToFront);
			window.addEventListener('resize', onWindowResize);
			document.body.appendChild(shellEl);

			centerShell();
			applyShellStyle();
			mountContent();
			notifyHostedResize();
			if (currentArgs.active) {
				installFocusTrap();
			}
			previousActive = currentArgs.active;
		}

		return {
			update(nextArgs: ShellMountedArgs) {
				currentArgs = nextArgs;
				if (!shellEl || !contentEl || !titleEl || !closeButtonEl) return;
				titleEl.textContent = currentArgs.mounted.entry.shell?.title || currentArgs.mounted.toolId;
				closeButtonEl.style.display =
					currentArgs.mounted.entry.shell?.closeable === false ? 'none' : 'inline-flex';
				mountContent();
				applyShellStyle();
				notifyHostedResize();
				if (!previousActive && currentArgs.active) {
					installFocusTrap();
				} else if (previousActive && !currentArgs.active) {
					removeFocusTrap();
					openerEl = null;
				}
				previousActive = currentArgs.active;
			},
			destroy() {
				notifyHostedUnmount();
				if (focusTrapCleanup) {
					removeFocusTrap();
				}
				openerEl = null;
				if (resizeHandleEl) {
					resizeHandleEl.removeEventListener('pointerdown', onResizePointerDown);
				}
				if (headerEl) {
					headerEl.removeEventListener('pointerdown', onHeaderPointerDown);
					headerEl.onkeydown = null;
				}
				if (shellEl) {
					shellEl.removeEventListener('pointermove', onShellPointerMove);
					shellEl.removeEventListener('pointerup', onShellPointerUp);
					shellEl.removeEventListener('pointerdown', bringToFront);
				}
				window.removeEventListener('resize', onWindowResize);
				if (mountedContentElement && contentEl && mountedContentElement.parentNode === contentEl) {
					invokeElementUnmount(mountedContentElement);
					contentEl.removeChild(mountedContentElement);
				}
				mountedContentElement = null;
				if (shellEl && shellEl.parentElement) {
					shellEl.remove();
				}
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
		<div class="item-toolbar__tools-row">
			{#each mountedElementsBeforeButtons as mounted (mounted.key)}
				{#if mounted.entry.shell}
					<span
						class="item-toolbar__element-host"
						use:mountElementWithShell={{
							mounted,
							active: renderedToolActiveById[mounted.toolId] ?? false
						}}
					></span>
				{:else}
					<span class="item-toolbar__element-host" use:mountElement={mounted.entry.element}></span>
				{/if}
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
								<span aria-hidden="true">{@html sanitizeSvgIcon(item.icon)}</span>
							{:else if isExternalIconUrl(item.icon)}
								<img class="item-toolbar__icon-image" src={item.icon} alt="" />
							{:else}
								{@const fallbackIcon = getFallbackIconSvg(item.icon)}
								{#if fallbackIcon}
									<span aria-hidden="true">{@html sanitizeSvgIcon(fallbackIcon)}</span>
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
								<span aria-hidden="true">{@html sanitizeSvgIcon(item.icon)}</span>
							{:else if isExternalIconUrl(item.icon)}
								<img class="item-toolbar__icon-image" src={item.icon} alt="" />
							{:else}
								{@const fallbackIcon = getFallbackIconSvg(item.icon)}
								{#if fallbackIcon}
									<span aria-hidden="true">{@html sanitizeSvgIcon(fallbackIcon)}</span>
								{:else}
									<i class={`icon icon-${item.icon}`} aria-hidden="true"></i>
								{/if}
							{/if}
						{/if}
					</button>
				{/if}
			{/each}

			{#each mountedElementsAfterButtons as mounted (mounted.key)}
				{#if mounted.entry.shell}
					<span
						class="item-toolbar__element-host"
						use:mountElementWithShell={{
							mounted,
							active: renderedToolActiveById[mounted.toolId] ?? false
						}}
					></span>
				{:else}
					<span class="item-toolbar__element-host" use:mountElement={mounted.entry.element}></span>
				{/if}
			{/each}
		</div>
		{#if shouldRenderControlsRow}
			<div
				class="item-toolbar__controls-row"
				class:item-toolbar__controls-row--reserve={controlsRowShouldReserveSpace}
				class:item-toolbar__controls-row--active={controlsRowShouldExpandForActiveTool}
				class:item-toolbar__controls-row--align-start={controlsRowAlignStart}
			>
				{#each mountedElementsControlsRow as mounted (mounted.key)}
					{#if mounted.entry.shell}
						<span
							class="item-toolbar__controls-host"
							use:mountElementWithShell={{
								mounted,
								active: renderedToolActiveById[mounted.toolId] ?? false
							}}
						></span>
					{:else}
						<span class="item-toolbar__controls-host" use:mountElement={mounted.entry.element}></span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.item-toolbar {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0;
		--pie-toolbar-tools-row-height: 2rem;
		--pie-tts-controls-row-height: 2.875rem;
	}

	.item-toolbar__tools-row {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-wrap: nowrap;
		gap: 0.5rem;
		min-height: var(--pie-toolbar-tools-row-height);
	}

	.item-toolbar__controls-row {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		width: 100%;
		min-height: 0;
		height: auto;
	}

	.item-toolbar__controls-row--reserve {
		min-height: var(--pie-tts-controls-row-height);
		height: var(--pie-tts-controls-row-height);
	}

	.item-toolbar__controls-row--active {
		min-height: var(--pie-tts-controls-row-height);
		height: var(--pie-tts-controls-row-height);
	}

	.item-toolbar__controls-row--align-start {
		justify-content: flex-start;
	}

	.item-toolbar__controls-host {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		width: 100%;
	}

	.item-toolbar--top,
	.item-toolbar--bottom {
		align-items: flex-end;
	}

	.item-toolbar--left,
	.item-toolbar--right {
		align-items: stretch;
	}

	.item-toolbar--left .item-toolbar__tools-row,
	.item-toolbar--right .item-toolbar__tools-row {
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		flex-wrap: nowrap;
	}

	.item-toolbar--left .item-toolbar__controls-row,
	.item-toolbar--right .item-toolbar__controls-row {
		justify-content: flex-start;
		width: auto;
		min-height: 0;
		height: auto;
	}

	.item-toolbar__button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0.25rem;
		border: 1px solid var(--pie-button-border, var(--pie-border, #ccc));
		border-radius: 0.25rem;
		background-color: var(--pie-button-bg, var(--pie-background, white));
		color: var(--pie-button-color, var(--pie-text, #333));
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

	.item-toolbar--sm {
		--pie-toolbar-tools-row-height: 2.75rem;
		--pie-tts-controls-row-height: 3.625rem;
	}

	.item-toolbar--lg .item-toolbar__button {
		width: 2.5rem;
		height: 2.5rem;
	}

	.item-toolbar--lg {
		--pie-toolbar-tools-row-height: 2.5rem;
		--pie-tts-controls-row-height: 3.375rem;
	}

	.item-toolbar__button:hover:not(:disabled) {
		background-color: var(--pie-button-hover-bg, var(--pie-secondary-background, #f5f5f5));
		border-color: var(--pie-button-hover-border, var(--pie-button-border, var(--pie-border, #ccc)));
		color: var(--pie-button-hover-color, var(--pie-button-color, var(--pie-text, #333)));
		transform: translateY(-1px);
		box-shadow: 0 2px 4px color-mix(in srgb, var(--pie-black, #000) 10%, transparent);
	}

	.item-toolbar__button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	.item-toolbar__button--active {
		background-color: var(--pie-primary, #1976d2);
		color: var(--pie-white, #fff);
		border-color: var(--pie-primary, #1976d2);
	}

	.item-toolbar__button--active:hover:not(:disabled) {
		background-color: var(--pie-primary-dark, #1565c0);
	}

	.item-toolbar__button:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, var(--pie-primary, #1976d2));
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
