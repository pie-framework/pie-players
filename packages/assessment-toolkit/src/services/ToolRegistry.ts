/**
 * Tool Registry
 *
 * Central registry for all assessment tools. Manages tool metadata, visibility logic,
 * and button/instance creation. Supports dynamic registration and override by integrators.
 */

import type { ToolContext, ToolLevel } from "./tool-context.js";
import type { ToolComponentOverrides } from "../tools/tool-tag-map.js";
import type {
	IElementToolStateStore,
	IToolCoordinator,
	IToolkitCoordinator,
	ITTSService,
} from "./interfaces.js";

export type ToolModuleLoader = () => Promise<unknown>;

export interface ToolToolbarButtonDefinition {
	toolId: string;
	label: string;
	icon: string;
	ariaLabel: string;
	tooltip?: string;
	onClick: () => void;
	className?: string;
	disabled?: boolean;
	active?: boolean;
}

export interface ToolbarContext {
	itemId: string;
	catalogId: string;
	language: string;
	ui?: {
		size?: string;
	};
	getScopeElement?: () => HTMLElement | null;
	getGlobalElementId?: () => string | null;
	toolCoordinator: IToolCoordinator | null;
	toolkitCoordinator: IToolkitCoordinator | null;
	ttsService: ITTSService | null;
	elementToolStateStore: IElementToolStateStore | null;
	toggleTool: (toolId: string) => void;
	isToolVisible: (toolId: string) => boolean;
	subscribeVisibility: ((listener: () => void) => (() => void)) | null;
	ensureTTSReady: (() => Promise<void>) | null;
	componentOverrides?: ToolComponentOverrides;
}

export interface ToolToolbarRenderResult {
	toolId: string;
	inlineElement?: HTMLElement | null;
	overlayElement?: HTMLElement | null;
	button?: ToolToolbarButtonDefinition | null;
	sync?: () => void;
	subscribeActive?: (callback: (active: boolean) => void) => (() => void);
}

/**
 * Tool registration interface
 */
export interface ToolRegistration {
	/** Unique tool identifier (e.g., 'calculator', 'textToSpeech') */
	toolId: string;

	/** Human-readable name */
	name: string;

	/** Description of what the tool does */
	description: string;

	/** Icon identifier or SVG string */
	icon: string | ((context: ToolContext) => string);

	/** Which levels this tool supports */
	supportedLevels: ToolLevel[];

	/**
	 * PNP support IDs that enable this tool (optional)
	 * Used by PNPToolResolver to determine if tool is allowed
	 * Example: ['calculator', 'basic-calculator', 'scientific-calculator']
	 */
	pnpSupportIds?: string[];

	/**
	 * Pass 2: Tool decides if it's relevant in this context
	 * Called ONLY if orchestrator has already allowed the tool (Pass 1)
	 *
	 * @param context - Rich context about where tool is being evaluated
	 * @returns true if tool should be visible, false to hide
	 */
	isVisibleInContext(context: ToolContext): boolean;

	/** Required toolbar-first render contract. */
	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult | null;
}

/**
 * Tool Registry
 *
 * Manages tool registrations and provides query/lookup functionality
 */
export class ToolRegistry {
	private tools = new Map<string, ToolRegistration>();
	private pnpIndex = new Map<string, Set<string>>(); // pnpSupportId → Set<toolId>
	private componentOverrides: ToolComponentOverrides = {};
	private moduleLoaders = new Map<string, ToolModuleLoader>();
	private loadedToolModules = new Set<string>();
	private moduleLoadPromises = new Map<string, Promise<void>>();

	/**
	 * Normalize a single tool alias to canonical toolId.
	 */
	normalizeToolId(toolId: string): string {
		return toolId === "tts" ? "textToSpeech" : toolId;
	}

	/**
	 * Normalize a list of tool aliases to canonical toolIds.
	 */
	normalizeToolIds(toolIds: string[]): string[] {
		return toolIds.map((toolId) => this.normalizeToolId(toolId));
	}

	/**
	 * Register a tool
	 *
	 * @param registration - Tool registration
	 * @throws Error if toolId is already registered
	 */
	register(registration: ToolRegistration): void {
		if (this.tools.has(registration.toolId)) {
			throw new Error(`Tool '${registration.toolId}' is already registered`);
		}

		this.tools.set(registration.toolId, registration);

		// Index PNP support IDs
		if (registration.pnpSupportIds) {
			for (const pnpId of registration.pnpSupportIds) {
				if (!this.pnpIndex.has(pnpId)) {
					this.pnpIndex.set(pnpId, new Set());
				}
				this.pnpIndex.get(pnpId)!.add(registration.toolId);
			}
		}
	}

	/**
	 * Override an existing tool registration
	 *
	 * @param registration - New tool registration (must have existing toolId)
	 */
	override(registration: ToolRegistration): void {
		if (!this.tools.has(registration.toolId)) {
			throw new Error(
				`Cannot override non-existent tool '${registration.toolId}'`,
			);
		}

		// Remove old PNP index entries
		const oldReg = this.tools.get(registration.toolId)!;
		if (oldReg.pnpSupportIds) {
			for (const pnpId of oldReg.pnpSupportIds) {
				this.pnpIndex.get(pnpId)?.delete(registration.toolId);
			}
		}

		// Add new registration
		this.tools.set(registration.toolId, registration);

		// Re-index PNP support IDs
		if (registration.pnpSupportIds) {
			for (const pnpId of registration.pnpSupportIds) {
				if (!this.pnpIndex.has(pnpId)) {
					this.pnpIndex.set(pnpId, new Set());
				}
				this.pnpIndex.get(pnpId)!.add(registration.toolId);
			}
		}
	}

	/**
	 * Unregister a tool
	 *
	 * @param toolId - Tool ID to remove
	 */
	unregister(toolId: string): void {
		const reg = this.tools.get(toolId);
		if (!reg) return;

		// Remove PNP index entries
		if (reg.pnpSupportIds) {
			for (const pnpId of reg.pnpSupportIds) {
				this.pnpIndex.get(pnpId)?.delete(toolId);
			}
		}

		this.tools.delete(toolId);
	}

	/**
	 * Get a tool registration by ID
	 *
	 * @param toolId - Tool ID
	 * @returns Tool registration or undefined
	 */
	get(toolId: string): ToolRegistration | undefined {
		return this.tools.get(toolId);
	}

	/**
	 * Check if a tool is registered
	 *
	 * @param toolId - Tool ID
	 * @returns true if registered
	 */
	has(toolId: string): boolean {
		return this.tools.has(toolId);
	}

	/**
	 * Get all registered tool IDs
	 *
	 * @returns Array of tool IDs
	 */
	getAllToolIds(): string[] {
		return Array.from(this.tools.keys());
	}

	/**
	 * Get all tool registrations
	 *
	 * @returns Array of tool registrations
	 */
	getAllTools(): ToolRegistration[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Find tool IDs that support a given PNP support ID
	 *
	 * @param pnpSupportId - PNP support ID (e.g., 'calculator')
	 * @returns Set of tool IDs that support this PNP ID
	 */
	getToolsByPNPSupport(pnpSupportId: string): Set<string> {
		return this.pnpIndex.get(pnpSupportId) || new Set();
	}

	/**
	 * Get tools that support a specific level
	 *
	 * @param level - Tool level (assessment, section, item, passage, element)
	 * @returns Array of tool registrations that support this level
	 */
	getToolsByLevel(level: ToolLevel): ToolRegistration[] {
		return this.getAllTools().filter((tool) =>
			tool.supportedLevels.includes(level),
		);
	}

	/**
	 * Filter tools by visibility in a given context
	 *
	 * Pass 2 of the two-pass model: Given a list of allowed tool IDs (from Pass 1),
	 * ask each tool if it's relevant in this context.
	 *
	 * @param allowedToolIds - Tool IDs that passed Pass 1 (orchestrator approval)
	 * @param context - Context to evaluate
	 * @returns Array of visible tool registrations
	 */
	filterVisibleInContext(
		allowedToolIds: string[],
		context: ToolContext,
	): ToolRegistration[] {
		const visible: ToolRegistration[] = [];

		for (const toolId of allowedToolIds) {
			const tool = this.get(toolId);
			if (!tool) {
				console.warn(`Tool '${toolId}' is allowed but not registered`);
				continue;
			}

			// Check if tool supports this level
			if (!tool.supportedLevels.includes(context.level)) {
				continue;
			}

			// Pass 2: Ask tool if it's relevant
			try {
				if (tool.isVisibleInContext(context)) {
					visible.push(tool);
				}
			} catch (error) {
				console.error(
					`Error evaluating visibility for tool '${toolId}':`,
					error,
				);
			}
		}

		return visible;
	}

	/**
	 * Get tool metadata for building UIs
	 * Useful for building PNP configuration interfaces
	 *
	 * @returns Array of tool metadata (id, name, description, pnpSupportIds)
	 */
	getToolMetadata(): Array<{
		toolId: string;
		name: string;
		description: string;
		pnpSupportIds: string[];
		supportedLevels: ToolLevel[];
	}> {
		return this.getAllTools().map((tool) => ({
			toolId: tool.toolId,
			name: tool.name,
			description: tool.description,
			pnpSupportIds: tool.pnpSupportIds || [],
			supportedLevels: tool.supportedLevels,
		}));
	}

	/**
	 * Generate PNP support IDs from enabled tools
	 * Useful for creating PNP profiles
	 *
	 * @param enabledToolIds - Tool IDs to enable
	 * @returns Array of unique PNP support IDs
	 */
	generatePNPSupportsFromTools(enabledToolIds: string[]): string[] {
		const pnpSupports = new Set<string>();

		for (const toolId of enabledToolIds) {
			const tool = this.get(toolId);
			if (tool?.pnpSupportIds) {
				for (const pnpId of tool.pnpSupportIds) {
					pnpSupports.add(pnpId);
				}
			}
		}

		return Array.from(pnpSupports);
	}

	/**
	 * Clear all registrations (useful for testing)
	 */
	clear(): void {
		this.tools.clear();
		this.pnpIndex.clear();
	}

	/**
	 * Configure global component overrides used by tool instance creation.
	 */
	setComponentOverrides(overrides: ToolComponentOverrides): void {
		this.componentOverrides = overrides;
	}

	/**
	 * Register lazy module loaders by toolId.
	 * Toolbars call ensureToolModuleLoaded(toolId) before instance creation.
	 */
	setToolModuleLoaders(
		loaders: Partial<Record<string, ToolModuleLoader>>,
	): void {
		for (const [toolId, loader] of Object.entries(loaders)) {
			if (!loader) continue;
			this.moduleLoaders.set(toolId, loader);
		}
	}

	/**
	 * Ensure tool module side-effects are loaded exactly once.
	 * Safe to call repeatedly; concurrent callers share the same promise.
	 */
	async ensureToolModuleLoaded(toolId: string): Promise<void> {
		if (this.loadedToolModules.has(toolId)) return;

		const existingPromise = this.moduleLoadPromises.get(toolId);
		if (existingPromise) {
			await existingPromise;
			return;
		}

		const loader = this.moduleLoaders.get(toolId);
		if (!loader) return;

		const loadPromise = (async () => {
			await loader();
			this.loadedToolModules.add(toolId);
		})();

		this.moduleLoadPromises.set(toolId, loadPromise);
		try {
			await loadPromise;
		} finally {
			this.moduleLoadPromises.delete(toolId);
		}
	}

	/**
	 * Ensure a set of tool modules are loaded.
	 */
	async ensureToolModulesLoaded(toolIds: string[]): Promise<void> {
		await Promise.all(toolIds.map((toolId) => this.ensureToolModuleLoaded(toolId)));
	}

	/**
	 * Whether a tool module has already been loaded.
	 */
	isToolModuleLoaded(toolId: string): boolean {
		return this.loadedToolModules.has(toolId);
	}

	/**
	 * Render a tool for toolbar use with component overrides attached.
	 */
	renderForToolbar(
		toolId: string,
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult | null {
		const tool = this.get(toolId);
		if (!tool) {
			throw new Error(`Tool '${toolId}' is not registered`);
		}

		const mergedContext: ToolbarContext = {
			...toolbarContext,
			componentOverrides: {
				...(this.componentOverrides || {}),
				...(toolbarContext.componentOverrides || {}),
			},
		};

		return tool.renderToolbar(context, mergedContext);
	}
}
