/**
 * Tool Registry
 *
 * Central registry for all assessment tools. Manages tool metadata, visibility logic,
 * and button/instance creation. Supports dynamic registration and override by integrators.
 */

import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import type { CatalogOwnerContext } from "./AccessibilityCatalogResolver.js";
import type { ToolContext, ToolLevel } from "./tool-context.js";
import type { ToolComponentOverrides } from "../tools/tool-tag-map.js";
import type {
	AccessibilityCatalogResolverApi,
	ElementToolStateStoreApi,
	ToolCoordinatorApi,
	ToolkitCoordinatorApi,
	TtsServiceApi,
} from "./interfaces.js";
import type { ToolProviderApi } from "./tool-providers/ToolProviderApi.js";
import type { ToolProviderConfig as ToolRuntimeConfig } from "./tools-config-normalizer.js";
import type { ToolConfigDiagnostic } from "./tool-config-validation.js";
import { normalizeToolAlias } from "./tools-config-normalizer.js";

export type ToolModuleLoader = () => Promise<unknown>;

export interface ToolToolbarButtonDefinition {
	toolId: string;
	label: string;
	/**
	 * Optional to match what the renderers already do: `ToolButton.svelte` and
	 * `ItemToolBar.svelte` both guard on `button.icon`, and `ToolbarItem.icon` is
	 * already optional, so requiring it here claimed a guarantee nothing relied
	 * on. A registration that renders a button still has to declare an icon —
	 * `assertToolRegistrationShape` enforces that.
	 */
	icon?: string;
	ariaLabel: string;
	tooltip?: string;
	onClick: () => void;
	className?: string;
	disabled?: boolean;
	active?: boolean;
}

export interface ToolbarContext {
	scope: {
		level: ToolLevel;
		scopeId: string;
		assessmentId?: string;
		sectionId?: string;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
	};
	itemId: string;
	catalogId: string;
	language: string;
	ui?: {
		size?: string;
	};
	getScopeElement?: () => HTMLElement | null;
	getGlobalElementId?: () => string | null;
	toolCoordinator: ToolCoordinatorApi | null;
	toolkitCoordinator: ToolkitCoordinatorApi | null;
	ttsService: TtsServiceApi | null;
	elementToolStateStore: ElementToolStateStoreApi | null;
	toggleTool: (toolId: string) => void;
	isToolVisible: (toolId: string) => boolean;
	subscribeVisibility: ((listener: () => void) => () => void) | null;
	componentOverrides?: ToolComponentOverrides;
	getResolvedToolContext?: (toolId: string) => ResolvedToolContext | null;
	getToolRenderParams?: (toolId: string) => Record<string, unknown> | null;
}

export interface ToolContextResolverContext {
	toolId: string;
	context: ToolContext;
	toolbarContext: ToolbarContext;
}

export interface ToolContextResolverResult {
	visible?: boolean;
	params?: Record<string, unknown>;
	reason?: string;
}

export type ToolContextResolver = (
	context: ToolContextResolverContext,
) => ToolContextResolverResult | null | undefined;

export type ToolContextResolverMap = Record<
	string,
	ToolContextResolver | null | undefined
>;

export interface ResolvedToolContext {
	toolId: string;
	visible: boolean;
	params: Record<string, unknown>;
	reason?: string;
}

export interface ToolRenderElement {
	element: HTMLElement | null;
	mount: "before-buttons" | "after-buttons" | "controls-row";
	layoutHints?: {
		controlsRow?: {
			reserveSpace?: boolean;
			showWhenToolActive?: boolean;
		};
		headerOverlay?: {
			showWhenToolActive?: boolean;
		};
	};
	shell?: ToolWindowShellConfig;
}

export interface ToolWindowShellAction {
	id: string;
	label: string;
	ariaLabel?: string;
	iconSvg?: string;
	onClick: () => void;
}

/**
 * Alignment corner for the initial shell position.
 * The shell is offset by `initialMargin` (default 16 px) from the chosen corner.
 */
export type ToolWindowShellAlign =
	| "center"
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right";

export interface ToolWindowShellContentConfig {
	/** Vertical overflow behavior for the hosted content pane. Defaults to "hidden". */
	overflowY?: "hidden" | "auto";
	/**
	 * Preserve the content area's configured minimum height when the shell shrinks
	 * below `minHeight`, letting the content pane scroll instead of compressing
	 * the hosted element.
	 */
	preserveMinHeight?: boolean;
}

export interface ToolWindowShellConfig {
	title?: string;
	draggable?: boolean;
	resizable?: boolean;
	closeable?: boolean;
	initialWidth?: number;
	initialHeight?: number;
	minWidth?: number;
	minHeight?: number;
	maxWidth?: number;
	maxHeight?: number;
	/** Initial placement of the shell. Defaults to `'center'`. */
	initialAlign?: ToolWindowShellAlign;
	/** Distance (px) from the viewport edge when using a corner align. Defaults to 16. */
	initialMargin?: number;
	content?: ToolWindowShellContentConfig;
	actions?: ToolWindowShellAction[];
}

export interface HostedToolContext {
	toolId: string;
	toolbarContext: ToolbarContext;
	shellConfig: ToolWindowShellConfig;
}

export interface HostedToolSize {
	width: number;
	height: number;
}

export interface ToolProviderDescriptor {
	getProviderId?: (config: ToolRuntimeConfig | undefined) => string;
	createProvider: (config: ToolRuntimeConfig | undefined) => ToolProviderApi;
	getInitConfig?: (
		config: ToolRuntimeConfig | undefined,
	) => Record<string, unknown>;
	sanitizeConfig?: (config: ToolRuntimeConfig) => ToolRuntimeConfig;
	validateConfig?: (config: ToolRuntimeConfig) => ToolConfigDiagnostic[];
	getAuthFetcher?: (
		config: ToolRuntimeConfig | undefined,
	) => (() => Promise<Record<string, unknown>>) | undefined;
	lazy?: boolean;
}

export interface ToolToolbarRenderResult {
	toolId: string;
	elements?: ToolRenderElement[];
	button?: ToolToolbarButtonDefinition | null;
	sync?: () => void;
	subscribeActive?: (callback: (active: boolean) => void) => () => void;
}

export type ToolActivation = "toolbar-toggle" | "selection-gateway" | "region";
export type ToolSingletonScope = "section";

/**
 * Services a host hands a capability rendering into one of its surfaces.
 *
 * Deliberately the same three references a toolbar tool reaches through
 * `ToolbarContext`, and no more: a capability that needs the coordinator can ask
 * it for anything else. Passing the host's own component or state would make the
 * registration depend on which renderer mounted it.
 */
export interface ToolSurfaceServices {
	toolkitCoordinator: ToolkitCoordinatorApi | null;
	ttsService: TtsServiceApi | null;
	catalogResolver: AccessibilityCatalogResolverApi | null;
}

/**
 * What a host tells a capability when asking it to fill a surface.
 *
 * `surface` is a host-defined slot name. Core defines none and validates only
 * that a region capability claims at least one, so a host can open a new surface
 * without a change here and a capability can declare which of a host's surfaces
 * it fits. Section-player ships `"item-media"` (the per-item card region) and
 * `"section-overlay"` (the section-scoped singleton).
 *
 * `content` carries whatever the capability's own `requiresAuthoredContent`
 * resolved, so the host neither inspects nor names it — it hands back what the
 * capability asked for.
 */
export interface ToolSurfaceRenderContext {
	toolId: string;
	/** The PNP/AfA support id policy granted for this render. */
	featureId: string;
	/** Host slot being filled. */
	surface: string;
	/** Feature parameters from the policy decision, if any. */
	parameters?: unknown;
	/** Resolved content dependency, when the capability declares one. */
	content?: unknown;
	services: ToolSurfaceServices;
	componentOverrides?: ToolComponentOverrides;
}

/**
 * What a host tells a capability when asking whether the content it needs is
 * present.
 */
export interface ToolContentDependencyContext {
	/** The PNP/AfA support id being resolved. */
	featureId: string;
	/** Feature parameters from the policy decision, if any. */
	parameters?: unknown;
	catalogResolver: AccessibilityCatalogResolverApi | null;
	/** Owner scope for catalog lookups, without `modelId`. */
	ownerContext: CatalogOwnerContext;
	/** The item in scope, when the host renders per item. */
	item?: ItemEntity | null;
}

/**
 * A capability's declaration that it needs authored content to have anything to
 * show, and the check that decides whether that content is present.
 *
 * This is the resource half of AfA's PNP/DRD pair. Signing needs an authored
 * catalog card, braille a transcription, authored SSML a `<speak>` in that item.
 * It is intrinsic to the capability, unlike eligibility tier, which is a property
 * of the program.
 *
 * Two independent things follow from declaring it, and both used to be done by
 * naming ids in core:
 *
 *   1. **Availability is grant AND content.** The host renders only when policy
 *      granted the feature *and* `resolve` returned something. Neither half
 *      implies the other and neither is a default, so a learner with the
 *      accommodation still sees nothing on an item that carries no resource — no
 *      dead affordance.
 *   2. **It is not granted wholesale.** A host building a default grant list
 *      filters on this declaration instead of on a compile-time array of ids it
 *      cannot extend. `@pie-players/pie-default-tool-loaders` asserts its
 *      universal preset holds no id belonging to a capability that declares one.
 *
 * `resolve` returns the resolved content, which the host hands straight back
 * through `ToolSurfaceRenderContext.content` without inspecting it. That is what
 * keeps the resolver and the host from knowing which accommodation they are
 * resolving.
 */
export interface ToolContentDependency {
	/** The resolved content, or `null` when the item carries none. */
	resolve(context: ToolContentDependencyContext): unknown | null;
	/**
	 * Optional human-readable description of what has to be authored, for a
	 * policy debugger explaining why an otherwise-granted capability is absent.
	 */
	description?: string;
}

export interface ToolSurfaceRenderResult {
	/** Element for the host to mount into its surface. */
	element: HTMLElement;
	/** Accessible name for the surface, when the capability owns that wording. */
	ariaLabel?: string;
	/** Reapply props after policy, parameters or content change. */
	sync?: () => void;
	/** Release listeners and media before the host unmounts the element. */
	destroy?: () => void;
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

	/**
	 * Icon identifier or SVG string. Required for the activations that render a
	 * toolbar button; a region capability has no button, so it has no icon.
	 */
	icon?: string | ((context: ToolContext) => string);

	/** Which levels this tool supports */
	supportedLevels: ToolLevel[];

	/**
	 * Activation model for this tool.
	 * - toolbar-toggle: rendered as a toolbar button (default)
	 * - selection-gateway: rendered as a singleton selection-driven gateway
	 * - region: rendered into a host surface, with no toolbar button
	 */
	activation?: ToolActivation;

	/**
	 * Host surfaces this capability can fill. Required for `activation: "region"`
	 * and meaningful for any activation whose capability also has a non-toolbar
	 * surface — the annotation toolbar is both a toolbar button and a
	 * section-scoped singleton.
	 *
	 * Names are the host's, not core's. A host discovers what it can mount by
	 * asking {@link ToolRegistry.getToolsBySurface}, which is what keeps a
	 * renderer from naming a capability.
	 */
	surfaces?: string[];

	/**
	 * Optional singleton scope for activation models that mount exactly one instance.
	 */
	singletonScope?: ToolSingletonScope;

	/**
	 * PNP support IDs that enable this tool (optional)
	 * Used by the tool policy engine to determine if a PNP support enables this tool.
	 * Example: ['calculator', 'basic-calculator', 'scientific-calculator']
	 */
	pnpSupportIds?: string[];

	/**
	 * Authored content this capability needs before it has anything to show.
	 *
	 * Declaring it makes availability "grant AND content", and excludes the
	 * capability from any wholesale default grant. See
	 * {@link ToolContentDependency}.
	 */
	requiresAuthoredContent?: ToolContentDependency;

	/**
	 * Optional provider registration metadata.
	 * When present, ToolkitCoordinator can register provider(s) generically
	 * without hardcoded tool-specific branches.
	 */
	provider?: ToolProviderDescriptor;
	/**
	 * Optional shell-host lifecycle hooks for hosted (floating) tools.
	 */
	onHostedMount?: (
		element: HTMLElement,
		context: HostedToolContext,
	) => void | Promise<void>;
	onHostedResize?: (
		size: HostedToolSize,
		element: HTMLElement,
		context: HostedToolContext,
	) => void | Promise<void>;
	onHostedUnmount?: (
		element: HTMLElement,
		context: HostedToolContext,
	) => void | Promise<void>;

	/**
	 * Pass 2: Tool decides if it's relevant in this context
	 * Called ONLY if orchestrator has already allowed the tool (Pass 1)
	 *
	 * Required for the toolbar activations, and meaningless for `activation:
	 * "region"`: a region capability has no toolbar presence to be relevant to, and
	 * the question it *would* answer — is there anything to show here — is
	 * `requiresAuthoredContent`. A registration that omits this is never returned
	 * by `getVisibleTools`.
	 *
	 * @param context - Rich context about where tool is being evaluated
	 * @returns true if tool should be visible, false to hide
	 */
	isVisibleInContext?(context: ToolContext): boolean;

	/**
	 * Toolbar render contract. Required for `toolbar-toggle` and
	 * `selection-gateway`; a region capability renders through
	 * {@link ToolRegistration.renderSurface} instead.
	 */
	renderToolbar?(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult | null;

	/**
	 * Render into one of the host surfaces this capability declares.
	 *
	 * Returning `null` means "nothing to show for this render" and is not an
	 * error — a capability may decline once the host has already granted and
	 * resolved content. The host mounts the returned element and calls `sync()`
	 * when policy, parameters or content move.
	 */
	renderSurface?(
		context: ToolSurfaceRenderContext,
	): ToolSurfaceRenderResult | null;
}

const VALID_TOOL_LEVELS: ToolLevel[] = [
	"assessment",
	"section",
	"item",
	"passage",
	"rubric",
	"element",
];

function assertNonEmptyString(
	value: unknown,
	fieldName: string,
): asserts value is string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(
			`Invalid tool registration: "${fieldName}" must be a non-empty string.`,
		);
	}
}

// Defence-in-depth: reject obvious XSS payloads in tool-registered icon
// markup at registration time. Runtime rendering still runs each icon
// through DOMPurify (see `ToolIcon.svelte`), but surfacing the problem
// early produces a clearer error for tool authors than "the icon silently
// disappeared after sanitization".
const SCRIPTABLE_ICON_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{ pattern: /<script\b/i, reason: "contains a <script> tag" },
	{
		pattern: /\son[a-z]+\s*=/i,
		reason: "contains an inline event handler (on*=) attribute",
	},
	{ pattern: /javascript:/i, reason: "contains a javascript: URL" },
	{
		pattern: /<foreignObject\b/i,
		reason: "contains a <foreignObject> element",
	},
];

function assertIconStringIsSafe(
	toolId: string,
	icon: string,
	fieldName: string,
): void {
	const trimmed = icon.trimStart();
	const looksLikeSvg = trimmed.toLowerCase().startsWith("<svg");
	const looksLikeUrl = /^https?:/i.test(trimmed);
	const looksLikeDataUrl = /^data:/i.test(trimmed);
	if (looksLikeDataUrl) {
		throw new Error(
			`Invalid tool registration "${toolId}": "${fieldName}" may not be a data: URL.`,
		);
	}
	if (!looksLikeSvg && !looksLikeUrl) return;
	for (const { pattern, reason } of SCRIPTABLE_ICON_PATTERNS) {
		if (pattern.test(icon)) {
			throw new Error(
				`Invalid tool registration "${toolId}": "${fieldName}" ${reason}. Inline SVG icons must not include scriptable content.`,
			);
		}
	}
}

function assertToolRegistrationShape(registration: ToolRegistration): void {
	assertNonEmptyString(registration.toolId, "toolId");
	assertNonEmptyString(registration.name, "name");
	assertNonEmptyString(registration.description, "description");

	// A region capability renders into a host surface and has no toolbar button,
	// so it needs neither an icon nor `renderToolbar`. Both stay required for the
	// activations that do render a button, so no existing registration is relaxed.
	const isRegion = registration.activation === "region";

	if (!isRegion || registration.icon !== undefined) {
		if (
			typeof registration.icon !== "string" &&
			typeof registration.icon !== "function"
		) {
			throw new Error(
				`Invalid tool registration "${registration.toolId}": "icon" must be a string or function.`,
			);
		}
	}
	if (typeof registration.icon === "string") {
		assertIconStringIsSafe(registration.toolId, registration.icon, "icon");
	}
	if (
		!Array.isArray(registration.supportedLevels) ||
		registration.supportedLevels.length === 0
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "supportedLevels" must be a non-empty array.`,
		);
	}
	const invalidLevel = registration.supportedLevels.find(
		(level) => !VALID_TOOL_LEVELS.includes(level),
	);
	if (invalidLevel) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": unsupported level "${invalidLevel}".`,
		);
	}
	if (
		registration.activation !== undefined &&
		registration.activation !== "toolbar-toggle" &&
		registration.activation !== "selection-gateway" &&
		registration.activation !== "region"
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": unsupported activation "${String(registration.activation)}".`,
		);
	}
	if (
		registration.surfaces !== undefined &&
		(!Array.isArray(registration.surfaces) ||
			registration.surfaces.some(
				(surface) => typeof surface !== "string" || surface.trim().length === 0,
			))
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "surfaces" must be an array of non-empty strings.`,
		);
	}
	if (isRegion && !registration.surfaces?.length) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": region tools must declare at least one host surface in "surfaces".`,
		);
	}
	if (isRegion && typeof registration.renderSurface !== "function") {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": region tools must implement "renderSurface".`,
		);
	}
	if (
		registration.renderSurface !== undefined &&
		typeof registration.renderSurface !== "function"
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "renderSurface" must be a function.`,
		);
	}
	if (registration.renderSurface && !registration.surfaces?.length) {
		// A surface renderer nothing can find is a registration that silently does
		// not render, which is the failure mode this mechanism exists to remove.
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "renderSurface" requires at least one entry in "surfaces".`,
		);
	}
	if (
		registration.singletonScope !== undefined &&
		registration.singletonScope !== "section"
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": unsupported singletonScope "${String(registration.singletonScope)}".`,
		);
	}
	if (
		registration.activation === "selection-gateway" &&
		registration.singletonScope !== "section"
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": selection-gateway tools must declare singletonScope "section".`,
		);
	}
	if (
		registration.pnpSupportIds !== undefined &&
		(!Array.isArray(registration.pnpSupportIds) ||
			registration.pnpSupportIds.some(
				(pnpId) => typeof pnpId !== "string" || pnpId.trim().length === 0,
			))
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "pnpSupportIds" must be an array of non-empty strings.`,
		);
	}
	if (
		registration.activation !== "region" &&
		typeof registration.isVisibleInContext !== "function"
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "isVisibleInContext" must be a function.`,
		);
	}
	if (
		registration.isVisibleInContext !== undefined &&
		typeof registration.isVisibleInContext !== "function"
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "isVisibleInContext" must be a function when present.`,
		);
	}
	if (registration.requiresAuthoredContent !== undefined) {
		if (
			typeof registration.requiresAuthoredContent !== "object" ||
			registration.requiresAuthoredContent === null ||
			typeof registration.requiresAuthoredContent.resolve !== "function"
		) {
			throw new Error(
				`Invalid tool registration "${registration.toolId}": "requiresAuthoredContent" must be an object with a "resolve" function.`,
			);
		}
		if (!registration.pnpSupportIds?.length) {
			// A content dependency's second job is keeping the capability out of a
			// wholesale grant, and a host filters that by support id. Declaring one
			// with no id to filter on would silently drop that guarantee.
			throw new Error(
				`Invalid tool registration "${registration.toolId}": "requiresAuthoredContent" requires at least one entry in "pnpSupportIds", which is what a host filters a default grant list on.`,
			);
		}
	}
	if (registration.renderToolbar !== undefined) {
		if (typeof registration.renderToolbar !== "function") {
			throw new Error(
				`Invalid tool registration "${registration.toolId}": "renderToolbar" must be a function.`,
			);
		}
	} else if (!isRegion) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "renderToolbar" must be a function.`,
		);
	}
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
		return normalizeToolAlias(toolId);
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
		assertToolRegistrationShape(registration);
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
		assertToolRegistrationShape(registration);
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
	 * Resolve tool activation, defaulting to toolbar-toggle.
	 */
	getToolActivation(toolId: string): ToolActivation {
		return this.get(toolId)?.activation || "toolbar-toggle";
	}

	/**
	 * Resolve singleton scope for a tool when present.
	 */
	getToolSingletonScope(toolId: string): ToolSingletonScope | null {
		return this.get(toolId)?.singletonScope || null;
	}

	/**
	 * Registrations that can fill a named host surface.
	 *
	 * The discovery call a renderer makes instead of naming a capability. Order
	 * follows registration order, so a host mounting several capabilities into one
	 * surface gets a stable sequence without core deciding a precedence it has no
	 * basis for.
	 */
	getToolsBySurface(surface: string): ToolRegistration[] {
		if (!surface) return [];
		return this.getAllTools().filter(
			(tool) =>
				typeof tool.renderSurface === "function" &&
				tool.surfaces?.includes(surface),
		);
	}

	/**
	 * Support ids belonging to capabilities that need authored content.
	 *
	 * What a host filters a default grant list on, in place of the compile-time
	 * exclusion array this replaced: granting one of these wholesale grants an
	 * accommodation to learners with no documented need for it.
	 */
	getContentDependentSupportIds(): string[] {
		const ids = new Set<string>();
		for (const tool of this.getAllTools()) {
			if (!tool.requiresAuthoredContent) continue;
			for (const supportId of tool.pnpSupportIds || []) ids.add(supportId);
		}
		return [...ids].sort();
	}

	/**
	 * Filter tool IDs by activation type.
	 */
	filterToolIdsByActivation(
		toolIds: string[],
		activation: ToolActivation,
	): string[] {
		return toolIds.filter(
			(toolId) => this.getToolActivation(toolId) === activation,
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

			// Pass 2: Ask tool if it's relevant. A region capability declares no
			// answer and has no toolbar presence, so it is never visible here.
			try {
				if (tool.isVisibleInContext?.(context)) {
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
		activation: ToolActivation;
		singletonScope: ToolSingletonScope | null;
		surfaces: string[];
		requiresAuthoredContent: boolean;
		contentDependencyDescription: string | null;
	}> {
		return this.getAllTools().map((tool) => ({
			toolId: tool.toolId,
			name: tool.name,
			description: tool.description,
			pnpSupportIds: tool.pnpSupportIds || [],
			supportedLevels: tool.supportedLevels,
			activation: tool.activation || "toolbar-toggle",
			singletonScope: tool.singletonScope || null,
			surfaces: tool.surfaces || [],
			requiresAuthoredContent: Boolean(tool.requiresAuthoredContent),
			contentDependencyDescription:
				tool.requiresAuthoredContent?.description ?? null,
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
			assertNonEmptyString(toolId, "tool module loader id");
			if (typeof loader !== "function") {
				throw new Error(
					`Invalid tool module loader for "${toolId}": expected a function.`,
				);
			}
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
		await Promise.all(
			toolIds.map((toolId) => this.ensureToolModuleLoaded(toolId)),
		);
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
		if (typeof tool.renderToolbar !== "function") {
			// Naming the activation rather than "renderToolbar is not a function":
			// the caller's mistake is asking a surface capability for a toolbar
			// button, and it is fixed by placement config, not by the registration.
			throw new Error(
				`Tool '${toolId}' has activation "${tool.activation || "toolbar-toggle"}" and renders into a host surface, not a toolbar. Remove it from toolbar placement.`,
			);
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

	/**
	 * Render a capability into a host surface, with component overrides attached.
	 *
	 * The surface counterpart of {@link renderForToolbar}, and it exists for the
	 * same reason: the registry owns the component-override map, so a host calling
	 * `registration.renderSurface(...)` directly would resolve element tags against
	 * nothing and fail on every packaged capability. Overrides passed in the
	 * context still win, matching the toolbar path's precedence.
	 */
	renderForSurface(
		toolId: string,
		context: Omit<ToolSurfaceRenderContext, "componentOverrides"> & {
			componentOverrides?: ToolComponentOverrides;
		},
	): ToolSurfaceRenderResult | null {
		const tool = this.get(toolId);
		if (!tool) {
			throw new Error(`Tool '${toolId}' is not registered`);
		}
		if (typeof tool.renderSurface !== "function") {
			throw new Error(
				`Tool '${toolId}' does not render into a host surface. Surface capabilities declare "surfaces" and implement "renderSurface".`,
			);
		}
		return tool.renderSurface({
			...context,
			componentOverrides: {
				...(this.componentOverrides || {}),
				...(context.componentOverrides || {}),
			},
		});
	}
}
