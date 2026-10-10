/**
 * Tool Registry
 *
 * Central registry for all assessment tools. Manages tool metadata, visibility logic,
 * and button/instance creation. Supports dynamic registration and override by integrators.
 */

import { dynamicMessageKey } from "@pie-players/pie-players-shared/i18n/provider";
import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
import type { ToolParametersFor } from "@pie-players/pie-players-shared/types";
import type { CatalogOwnerSnapshot } from "./AccessibilityCatalogResolver.js";
import type { ToolPolicyEntry } from "../policy/core/decision-types.js";
import type { ToolContext, ToolLevel } from "./tool-context.js";
import type { ToolScopeLevel } from "./tool-instance-id.js";
import {
	type ToolComponentOverrides,
	resolveToolTag,
} from "../tools/tool-tag-map.js";
import {
	PENDING_INPUT_WARNING_DELAY_MS,
	warnOncePerDocument,
} from "../runtime/page-warnings.js";
import type {
	AccessibilityCatalogResolverApi,
	ElementToolStateStoreApi,
	ToolCoordinatorApi,
	ToolkitCoordinatorApi,
	TtsServiceApi,
} from "./interfaces.js";
import type { ToolProviderApi } from "./tool-providers/ToolProviderApi.js";
import type { ToolProviderConfig } from "./tools-config-normalizer.js";
import type { ToolConfigDiagnostic } from "./tool-config-validation.js";
import type { ToolFailurePhase } from "./tool-failure.js";

export type ToolModuleLoader = () => Promise<unknown>;

/** Receives a registration callback's throw, from which the registry recovers. */
export type ToolCallbackFailureHandler = (
	toolId: string,
	phase: Extract<ToolFailurePhase, "tool-visibility" | "tool-applicability">,
	error: unknown,
) => void;

const logToolCallbackFailure: ToolCallbackFailureHandler = (
	toolId,
	phase,
	error,
) => console.error(`[ToolRegistry] Tool '${toolId}' ${phase} check threw:`, error);

export type ToolRegistryChangeKind =
	| "register"
	| "override"
	| "unregister"
	| "clear"
	| "component-overrides"
	| "module-loaders";

/** A successful mutation to discoverable or rendering registry state. */
export interface ToolRegistryChangeEvent {
	kind: ToolRegistryChangeKind;
	toolIds: readonly string[];
}

export type ToolRegistryChangeListener = (
	event: ToolRegistryChangeEvent,
) => void;

export interface ToolToolbarButtonDefinition {
	toolId: string;
	label: string;
	/**
	 * Optional to match what the renderer already does: `ItemToolBar.svelte`
	 * guards on `button.icon`, and `ToolbarItem.icon` is
	 * already optional, so requiring it here claimed a guarantee nothing relied
	 * on. A registration that renders a button still has to declare an icon —
	 * `assertToolRegistrationShape` enforces that.
	 */
	icon?: string;
	/**
	 * FontAwesome icon name, opting this button into `<nds-icon-button>` rendering
	 * where the host enables NDS icons (`ndsIcons`). Absent means the toolbar keeps
	 * its own button rendering, which is what every capability got before the NDS
	 * button existed.
	 *
	 * A declaration rather than a toolId lookup in the toolbar: which capabilities
	 * a deployment renders through the host's design system is a composition-layer
	 * decision, and the generic core names no capability.
	 */
	faIconName?: string;
	ariaLabel: string;
	tooltip?: string;
	onClick: () => void;
	className?: string;
	disabled?: boolean;
	active?: boolean;
}

export interface ToolbarContext {
	scope: {
		level: ToolScopeLevel;
		scopeId: string;
		assessmentId?: string;
		sectionId?: string;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
	};
	itemId: string;
	catalogId: string;
	/**
	 * Content-alternate language: which authored alternate the catalog resolver
	 * should select. Not the interface locale — see {@link ToolbarContext.i18n}. The
	 * two are independent by QTI 3's own statement, and conflating them is how a
	 * Spanish passage ends up forcing Spanish widget chrome. Absent when neither
	 * the toolbar's `language` nor the host's `content-language` names one.
	 */
	language?: string;
	/**
	 * Interface-locale provider for this capability's own UI strings.
	 *
	 * Required, and always the facade `resolveInterfaceI18n` returns: the toolbar
	 * resolves it once from the toolkit runtime context, so a registration reads
	 * `toolbarContext.i18n` and neither repeats the no-publisher fallback nor
	 * misses the republish that a locale change produces. With no publisher the
	 * facade wraps the English-only default, which is why this can be required
	 * rather than optional.
	 */
	i18n: I18nProvider;
	ui?: {
		size?: string;
	};
	getScopeElement?: () => HTMLElement | null;
	/**
	 * State key of one PIE element in this toolbar's item, by its model id, for
	 * `elementToolStateStore`. `null` until the store and the ids it needs are
	 * known.
	 */
	getGlobalElementId?: (elementId: string) => string | null;
	toolCoordinator: ToolCoordinatorApi | null;
	toolkitCoordinator: ToolkitCoordinatorApi | null;
	ttsService: TtsServiceApi | null;
	elementToolStateStore: ElementToolStateStoreApi | null;
	/** Toggles this toolbar's instance of a base tool id. */
	toggleTool: (toolId: string) => void;
	/** Whether this toolbar's instance of a base tool id is shown. */
	isToolVisible: (toolId: string) => boolean;
	subscribeVisibility: ((listener: () => void) => () => void) | null;
	componentOverrides?: ToolComponentOverrides;
	getResolvedToolContext?: (toolId: string) => ResolvedToolContext | null;
	getToolRenderParams?: (toolId: string) => Record<string, unknown> | null;
	/**
	 * The tool's policy parameters on this toolbar: the item's `toolParameters`
	 * entry on an item's own toolbar, else the assessment's `toolParameters` entry.
	 * Authored content, so a registration checks what it reads.
	 */
	getToolParameters?: <K extends string>(
		toolId: K,
	) => ToolParametersFor<K> | null;
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
	/**
	 * Which box the element is appended to. `mount` places it among the toolbar's
	 * own regions; this chooses the box it is positioned against.
	 *
	 * `"toolbar"` (the default) leaves it in the toolbar, whose element is the
	 * containing block for anything absolutely positioned inside it.
	 * `"content-boundary"` appends it to the nearest element the host marked with
	 * `data-pie-tool-overlay-boundary` — the content a tool was placed on. An
	 * element that draws its own surface over that content and computes its own
	 * coordinates needs the content's box as its frame, and the toolbar's box is a
	 * header-sized one. When the host declares no boundary the element stays in
	 * the toolbar.
	 */
	container?: "toolbar" | "content-boundary";
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
	/**
	 * Render the shell's own header controls as `<nds-icon-button>`s where the host
	 * enables NDS icons. Shells without this keep the plain `<button>` controls, and
	 * an opted-out host gets those either way.
	 */
	ndsHeaderControls?: boolean;
	/**
	 * Let Tab and Shift+Tab cross between the page and this shell rather than
	 * cycling inside it.
	 *
	 * The shell is appended to `<body>`, so it sits outside the document order its
	 * opener lives in. A shell a learner works *alongside* — reading the question
	 * while using the tool — needs Tab from the opener to enter it and Shift+Tab
	 * from the first question control to reach its end. A shell a learner works
	 * *inside* wants the default trap, which keeps focus captured until dismissed.
	 */
	pageTabOrder?: boolean;
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

/**
 * How the coordinator builds a tool's provider from the tool's config. The
 * provider registers under the tool's own id, so `ensureProviderReady(toolId)`
 * finds it; `provider.id` in the config selects an implementation and never
 * renames the registration.
 */
export interface ToolProviderDescriptor {
	createProvider: (config: ToolProviderConfig | undefined) => ToolProviderApi;
	getInitConfig?: (
		config: ToolProviderConfig | undefined,
	) => Record<string, unknown>;
	getAuthFetcher?: (
		config: ToolProviderConfig | undefined,
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

/**
 * A registration's display name in the interface locale.
 *
 * Precedence: the resolved `nameKey`, then `name`. A key that does not resolve
 * falls back to `name` rather than rendering the key, so a catalog gap degrades
 * to English instead of to `tools.something.name` on a toolbar button.
 *
 * It lives here so the toolbars, the settings panels and the PNP debugger
 * cannot each invent their own precedence.
 */
export function resolveToolRegistrationName(
	registration: Pick<ToolRegistration, "name" | "nameKey">,
	i18n?: I18nProvider,
): string {
	return resolveKeyedString(registration.name, registration.nameKey, i18n);
}

function resolveKeyedString(
	source: string,
	key: string | undefined,
	i18n?: I18nProvider,
): string {
	if (!key || !i18n) return source;
	// A registration may be host-authored against a host catalog, so the key is
	// not drawn from PIE's `MessageKey` union and has to be asserted.
	const messageKey = dynamicMessageKey(key);
	if (i18n.hasKey) return i18n.hasKey(messageKey) ? i18n.t(messageKey) : source;
	// A provider without `hasKey` still signals a miss by returning the key.
	const resolved = i18n.t(messageKey);
	return resolved === key ? source : resolved;
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
	/**
	 * Interface-locale provider for the surface's own labels — a region's
	 * `aria-label`, a heading it emits. Required, and always the facade
	 * `resolveInterfaceI18n` returns, which wraps the English-only default where
	 * the host published nothing.
	 */
	i18n: I18nProvider;
}

/**
 * What a host tells a capability when asking it to fill a surface.
 *
 * `surface` is a host-defined slot name. Core defines none and validates only
 * that a region capability claims at least one, so a host can open a new surface
 * without a change here and a capability can declare which of a host's surfaces
 * it fits. Section-player ships `"content-lead"` and `"content-media"` on item
 * and passage cards, plus `"section-overlay"` at section scope.
 *
 * `content` carries whatever the capability's own `requiresAuthoredContent`
 * resolved, so the host neither inspects nor names it — it hands back what the
 * capability asked for.
 */
export interface ToolSurfaceRenderContext {
	toolId: string;
	/**
	 * Whether a PNP support, a requirement or a test-administration override
	 * granted the capability. `false` for a capability rendered because it is
	 * placed with no grant, and for a
	 * {@link ToolRegistration.resolvesWithoutGrant} capability answering from
	 * content alone.
	 */
	granted: boolean;
	/** Host slot being filled. */
	surface: string;
	/** Feature parameters from the policy decision, if any. */
	parameters?: Record<string, unknown>;
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
	/** Feature parameters from the policy decision, if any. */
	parameters?: Record<string, unknown>;
	/**
	 * Owner-scoped catalog cards, or `null` when no resolver is available.
	 *
	 * The catalog module has already applied item/passage/model traversal and
	 * registration precedence. A capability interprets its own card type without
	 * reconstructing the owner scope or reading the raw entity.
	 */
	catalogs: CatalogOwnerSnapshot | null;
	/**
	 * Whether policy granted this capability's support id.
	 *
	 * `false` reaches `resolve` only for a capability that declares
	 * {@link ToolRegistration.resolvesWithoutGrant}, and it is the signal that the
	 * capability must answer from the content alone. Everything else sees `true`,
	 * because the host asks about eligibility first and stops there.
	 */
	granted: boolean;
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
 *
 * Resolvable only on a surface the host renders per item or per passage. The
 * owner snapshot represents an item/model or passage, never a section, because a DRD
 * resource pairs with a piece of content and not with a container. A capability
 * declaring one and claiming a section-scoped surface is declined there rather
 * than mounted with no content. `resolve` is also synchronous — a capability whose
 * resource has to be fetched resolves the reference here and fetches inside its
 * own element, where it can show its own pending state.
 */
export interface ToolContentDependency {
	/**
	 * The resolved content, or `null` when the item carries none.
	 *
	 * Must be JSON-serializable. A host re-resolves on every policy and catalog
	 * signal and compares the answer structurally to decide whether anything moved,
	 * because every resolution builds fresh objects and identity would report a
	 * change each time. A `Map`, function, DOM node, cyclic value, or other
	 * non-serializable result is rejected for that capability and reported as a
	 * recoverable surface warning instead of escaping into the player.
	 */
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
	/**
	 * Reapply props after policy, parameters or content change.
	 *
	 * Takes the current context rather than closing over the one captured at
	 * render: the whole point of reconciling by `toolId` instead of remounting is
	 * that a re-resolve reaches the mounted element, and a closure over the
	 * render-time context re-applies the values the host already had. A signed
	 * alternate re-resolved to a different recording — a live `signLang` change, or
	 * a catalog registering after first paint — would otherwise leave the learner
	 * watching the previous one with no error anywhere.
	 */
	sync?: (context: ToolSurfaceRenderContext) => void;
	/** Release listeners and media before the host unmounts the element. */
	destroy?: () => void;
}

/**
 * Tool registration interface
 */
export interface ToolRegistration {
	/** Unique tool identifier (e.g., 'calculator', 'textToSpeech') */
	toolId: string;

	/**
	 * Human-readable name.
	 *
	 * Required, and stays required: it is part of the contract a host implements
	 * when it contributes its own capability, and a host cannot be made to ship a
	 * message catalog. Treat it as the English source.
	 */
	name: string;

	/** Description of what the tool does. English source, like {@link name}. */
	description: string;

	/**
	 * Message key resolving to {@link name} in the interface locale.
	 *
	 * Optional by design. A capability that supplies one is localizable; one that
	 * does not renders `name` verbatim, which is what keeps a host-authored
	 * registration working with no catalog. Resolve with
	 * {@link resolveToolRegistrationName} rather than reading either field
	 * directly, so precedence stays in one place.
	 */
	nameKey?: string;

	/** Message key resolving to {@link description} in the interface locale. */
	descriptionKey?: string;

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
	 * Authored content this capability needs before it has anything to show.
	 *
	 * Declaring it makes availability "grant AND content", and excludes the
	 * capability from any wholesale default grant. See
	 * {@link ToolContentDependency}.
	 */
	requiresAuthoredContent?: ToolContentDependency;

	/**
	 * Ask this capability for its content even when policy granted nothing.
	 *
	 * Only meaningful together with {@link ToolRegistration.requiresAuthoredContent},
	 * and only correct for a capability whose authored content can declare itself
	 * *presentation* rather than an accommodation — content authored to be delivered
	 * that way to everyone, which no profile grants and none revokes. Such a
	 * capability must return `null` from `resolve` when its content is the
	 * accommodation kind and the grant is absent, and the `granted` flag on the
	 * context is how it tells the two apart.
	 *
	 * Without this, "no grant" ends the question before content is consulted, which
	 * is the right default: it is what keeps an accommodation off the item of a
	 * learner with no documented need.
	 */
	resolvesWithoutGrant?: boolean;

	/**
	 * Optional provider registration metadata.
	 * When present, ToolkitCoordinator can register provider(s) generically
	 * without hardcoded tool-specific branches.
	 */
	provider?: ToolProviderDescriptor;
	/**
	 * Normalize this tool's `tools.providers.<toolId>` entry. Tools-config
	 * validation runs it before {@link ToolRegistration.validateConfig}; a throw is
	 * reported as a diagnostic and the entry passes through unchanged.
	 */
	sanitizeConfig?: (config: ToolProviderConfig) => ToolProviderConfig;
	/**
	 * Diagnostics for this tool's sanitized `tools.providers.<toolId>` entry.
	 */
	validateConfig?: (config: ToolProviderConfig) => ToolConfigDiagnostic[];
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
	 * Whether this tool can act on this content at all — a capability question,
	 * not a relevance heuristic. Answering `false` withdraws the tool even where
	 * a PNP grant would otherwise keep it, which {@link
	 * ToolRegistration.isVisibleInContext} deliberately cannot do.
	 *
	 * The two gates answer different questions, and most tools declare only the
	 * first. A calculator is *applicable* to every item — a learner granted one
	 * keeps it on an item that does not look mathematical — while its relevance
	 * is a guess about usefulness. An answer eliminator on an item with no choice
	 * interaction has nothing to strike through, so no grant can make it work.
	 *
	 * Declare this only where the tool's own controls provably do nothing:
	 * withdrawing a granted accommodation on a false negative is the more
	 * expensive failure. Omitting it means "applicable".
	 *
	 * @param context - The item or element context the tool would act on
	 * @returns false to withdraw the tool from this context
	 */
	isApplicableToContent?(context: ToolContext): boolean;

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
// through DOMPurify (`sanitizeSvgIcon` in `ItemToolBar.svelte`), but surfacing the problem
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
		registration.resolvesWithoutGrant !== undefined &&
		typeof registration.resolvesWithoutGrant !== "boolean"
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "resolvesWithoutGrant" must be a boolean.`,
		);
	}
	if (
		registration.resolvesWithoutGrant &&
		!registration.requiresAuthoredContent
	) {
		// The flag only decides whether content is consulted without a grant, so on a
		// capability with no content dependency it reads as "granted to everyone" and
		// does nothing at all.
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "resolvesWithoutGrant" requires "requiresAuthoredContent".`,
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
	if (
		registration.isApplicableToContent !== undefined &&
		typeof registration.isApplicableToContent !== "function"
	) {
		throw new Error(
			`Invalid tool registration "${registration.toolId}": "isApplicableToContent" must be a function when present.`,
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
	private componentOverrides: ToolComponentOverrides = {};
	private watchedUndefinedToolElements = new Set<string>();
	private moduleLoaders = new Map<string, ToolModuleLoader>();
	private loadedToolModules = new Set<string>();
	private warnedLoaderReplacements = new Set<string>();
	private warnedUnregisteredAllowedTools = new Set<string>();
	private moduleLoadPromises = new Map<string, Promise<void>>();
	private changeListeners = new Set<ToolRegistryChangeListener>();

	private emitChange(event: ToolRegistryChangeEvent): void {
		for (const listener of this.changeListeners) {
			try {
				listener(event);
			} catch (error) {
				console.warn("[ToolRegistry] change listener failed:", error);
			}
		}
	}

	/**
	 * Observe successful registry mutations. Delivery is synchronous, listener
	 * failures are isolated, and the returned unsubscribe is idempotent.
	 */
	onRegistryChange(listener: ToolRegistryChangeListener): () => void {
		this.changeListeners.add(listener);
		let subscribed = true;
		return () => {
			if (!subscribed) return;
			subscribed = false;
			this.changeListeners.delete(listener);
		};
	}

	/**
	 * Normalize a single tool id (trims surrounding whitespace).
	 */
	normalizeToolId(toolId: string): string {
		return toolId.trim();
	}

	/**
	 * Normalize a list of tool ids (trims surrounding whitespace).
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
		this.emitChange({ kind: "register", toolIds: [registration.toolId] });
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

		this.tools.set(registration.toolId, registration);
		this.emitChange({ kind: "override", toolIds: [registration.toolId] });
	}

	/**
	 * Unregister a tool
	 *
	 * @param toolId - Tool ID to remove
	 */
	unregister(toolId: string): void {
		if (!this.tools.has(toolId)) return;
		this.tools.delete(toolId);
		this.emitChange({ kind: "unregister", toolIds: [toolId] });
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
	 * Support ids, which are tool ids, of the capabilities that need authored
	 * content.
	 *
	 * What a host filters a default grant list on: granting one of these
	 * wholesale grants an accommodation to learners with no documented need
	 * for it.
	 */
	getContentDependentSupportIds(): string[] {
		return this.getAllTools()
			.filter((tool) => tool.requiresAuthoredContent)
			.map((tool) => tool.toolId)
			.sort();
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
	 * Pass 2 of the three-pass model: Given a list of allowed tool IDs (from Pass 1),
	 * ask each tool if it's relevant in this context.
	 *
	 * @param allowedToolIds - Tool IDs that passed Pass 1 (orchestrator approval)
	 * @param context - Context to evaluate
	 * @param onFailure - Receives a relevance check's throw; the tool is then not
	 *   visible. Logs when omitted.
	 * @returns Array of visible tool registrations
	 */
	filterVisibleInContext(
		allowedToolIds: string[],
		context: ToolContext,
		onFailure: ToolCallbackFailureHandler = logToolCallbackFailure,
	): ToolRegistration[] {
		const visible: ToolRegistration[] = [];

		for (const toolId of allowedToolIds) {
			const tool = this.get(toolId);
			if (!tool) {
				// Toolbars filter on every render; one warning per id carries it.
				if (!this.warnedUnregisteredAllowedTools.has(toolId)) {
					this.warnedUnregisteredAllowedTools.add(toolId);
					console.warn(`Tool '${toolId}' is allowed but not registered`);
				}
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
				onFailure(toolId, "tool-visibility", error);
			}
		}

		return visible;
	}

	/**
	 * Whether a tool can act on any of the contexts it would be placed against.
	 * Unlike the relevance pass this is a veto: a `false` here removes the tool
	 * from a toolbar even when a grant protects it, so a tool answers `false`
	 * only where its controls provably do nothing.
	 *
	 * A tool that declares no applicability gate is applicable. So is one
	 * evaluated against no contexts — content that has not resolved yet cannot
	 * establish that a tool is useless.
	 *
	 * @param toolId - Tool to ask
	 * @param contexts - Every context the tool could act on at this placement
	 * @param onFailure - Receives the gate's throw; the tool then counts as
	 *   applicable. Logs when omitted.
	 */
	isApplicableToAnyContext(
		toolId: string,
		contexts: readonly ToolContext[],
		onFailure: ToolCallbackFailureHandler = logToolCallbackFailure,
	): boolean {
		const tool = this.get(toolId);
		if (!tool?.isApplicableToContent) return true;
		if (contexts.length === 0) return true;
		return contexts.some((context) => {
			try {
				return tool.isApplicableToContent?.(context) ?? true;
			} catch (error) {
				onFailure(toolId, "tool-applicability", error);
				// A gate that throws has not established that the tool is useless.
				return true;
			}
		});
	}

	/**
	 * Passes 2 and 3 over a policy decision's tools: the ids a surface at `level`
	 * shows against `contexts`, in decision order. This is the rule a toolbar
	 * applies, for a host that builds its own tool surface.
	 *
	 * - A tool that does not support `level` is dropped.
	 * - Relevance (`isVisibleInContext`) keeps a tool visible in any one context.
	 *   It does not run for a granted entry (`required` or `alwaysAvailable`),
	 *   at section level, whose relevance is item-dependent, or when `contexts`
	 *   is empty, since content that has not resolved cannot rule a tool out.
	 * - Applicability (`isApplicableToContent`) then removes a tool that can act
	 *   on none of `contexts`, granted or not. It does not run at section level.
	 *
	 * @param entries - The decision's surviving entries (Pass 1), such as
	 *   `ToolPolicyDecision.visibleTools`
	 * @param level - The level of the surface the tools render on
	 * @param contexts - Every context the tools could act on at that surface
	 * @param onFailure - Receives a relevance or applicability check's throw.
	 *   Logs when omitted.
	 */
	filterDecidedToolIds(
		entries: readonly Pick<
			ToolPolicyEntry,
			"toolId" | "required" | "alwaysAvailable"
		>[],
		level: ToolLevel,
		contexts: readonly ToolContext[],
		onFailure: ToolCallbackFailureHandler = logToolCallbackFailure,
	): string[] {
		const granted = new Set<string>();
		const decided: string[] = [];
		for (const entry of entries) {
			const toolId = this.normalizeToolId(entry.toolId);
			if (!toolId) continue;
			if (entry.required || entry.alwaysAvailable) granted.add(toolId);
			if (decided.includes(toolId)) continue;
			if (!this.get(toolId)?.supportedLevels.includes(level)) continue;
			decided.push(toolId);
		}
		if (level === "section") return decided;
		const relevant = new Set<string>(
			contexts.length === 0
				? decided
				: decided.filter((toolId) => granted.has(toolId)),
		);
		for (const context of contexts) {
			const ungranted = decided.filter((toolId) => !relevant.has(toolId));
			for (const tool of this.filterVisibleInContext(
				ungranted,
				context,
				onFailure,
			)) {
				relevant.add(tool.toolId);
			}
		}
		return decided.filter(
			(toolId) =>
				relevant.has(toolId) &&
				this.isApplicableToAnyContext(toolId, contexts, onFailure),
		);
	}

	/**
	 * Get tool metadata for building UIs
	 * Useful for building PNP configuration interfaces
	 *
	 * @returns Array of tool metadata (id, name, description, levels, activation)
	 */
	getToolMetadata(): Array<{
		toolId: string;
		name: string;
		description: string;
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
	 * Clear all registrations (useful for testing)
	 */
	clear(): void {
		const toolIds = this.getAllToolIds();
		if (toolIds.length === 0) return;
		this.tools.clear();
		this.emitChange({ kind: "clear", toolIds });
	}

	/**
	 * Configure global component overrides used by tool instance creation.
	 */
	setComponentOverrides(overrides: ToolComponentOverrides): void {
		if (this.componentOverrides === overrides) return;
		this.componentOverrides = overrides;
		this.emitChange({ kind: "component-overrides", toolIds: [] });
	}

	/**
	 * Register lazy module loaders by toolId.
	 * Toolbars call ensureToolModuleLoaded(toolId) before instance creation.
	 * A tool whose module has loaded, or is loading, keeps its loader: its
	 * elements are already defined, so a replacement could never take effect.
	 */
	setToolModuleLoaders(
		loaders: Partial<Record<string, ToolModuleLoader>>,
	): void {
		const entries = Object.entries(loaders).filter(
			(entry): entry is [string, ToolModuleLoader] => entry[1] !== undefined,
		);
		for (const [toolId, loader] of entries) {
			assertNonEmptyString(toolId, "tool module loader id");
			if (typeof loader !== "function") {
				throw new Error(
					`Invalid tool module loader for "${toolId}": expected a function.`,
				);
			}
		}

		const changedToolIds: string[] = [];
		for (const [toolId, loader] of entries) {
			if (this.moduleLoaders.get(toolId) === loader) continue;
			if (
				this.loadedToolModules.has(toolId) ||
				this.moduleLoadPromises.has(toolId)
			) {
				this.warnLoaderReplacedAfterLoad(toolId);
				continue;
			}
			this.moduleLoaders.set(toolId, loader);
			changedToolIds.push(toolId);
		}
		if (changedToolIds.length > 0) {
			this.emitChange({ kind: "module-loaders", toolIds: changedToolIds });
		}
	}

	private warnLoaderReplacedAfterLoad(toolId: string): void {
		if (this.warnedLoaderReplacements.has(toolId)) return;
		this.warnedLoaderReplacements.add(toolId);
		console.warn(
			`[ToolRegistry] Ignored a new module loader for "${toolId}": its module already loaded, so the elements it defines stay in place. Register loaders before the tool first renders.`,
		);
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
		if (!loader) {
			this.watchUndefinedToolElement(toolId);
			return;
		}

		const loadPromise = (async () => {
			await loader();
			this.loadedToolModules.add(toolId);
			this.warnIfLoadedToolElementUndefined(toolId);
		})();

		this.moduleLoadPromises.set(toolId, loadPromise);
		try {
			await loadPromise;
		} finally {
			this.moduleLoadPromises.delete(toolId);
		}
	}

	/**
	 * The undefined element tag a tool would render, or `null` when the tool is
	 * built by a component factory, its element is defined, or there is no DOM.
	 */
	private undefinedToolElementTag(toolId: string): string | null {
		if (typeof customElements === "undefined" || typeof document === "undefined") {
			return null;
		}
		const overrides = this.componentOverrides;
		if (overrides.toolComponentFactories?.[toolId]) return null;
		let tagName: string;
		try {
			tagName = resolveToolTag(toolId, overrides);
		} catch {
			// Element creation reports the missing tag mapping.
			return null;
		}
		return customElements.get(tagName) ? null : tagName;
	}

	/**
	 * Warn when a tool's module loader finished without defining the element the
	 * tag map points the tool at, as when a host remaps the tag but keeps a
	 * loader that defines the packaged element. The tool otherwise renders blank.
	 */
	private warnIfLoadedToolElementUndefined(toolId: string): void {
		const tagName = this.undefinedToolElementTag(toolId);
		if (!tagName) return;
		warnOncePerDocument(
			document,
			`loadedToolElementUndefined.${toolId}.${tagName}`,
			`[ToolRegistry] Tool "${toolId}" renders <${tagName}>, but its module loader finished without defining it, so the tool renders blank. The tag map and the loader disagree: map "${toolId}" to the tag its loader defines, or register a loader that defines <${tagName}>. Reported once per page.`,
		);
	}

	/**
	 * Warn when a tool with no module loader still has no element definition
	 * after the pending-input delay. A registry built without loaders otherwise
	 * renders the tool as an unknown element with no error.
	 */
	private watchUndefinedToolElement(toolId: string): void {
		if (this.watchedUndefinedToolElements.has(toolId)) return;
		const tagName = this.undefinedToolElementTag(toolId);
		if (!tagName) return;
		this.watchedUndefinedToolElements.add(toolId);
		const doc = document;
		const timer = setTimeout(() => {
			if (customElements.get(tagName)) return;
			warnOncePerDocument(
				doc,
				`undefinedToolElement.${toolId}`,
				`[ToolRegistry] Tool "${toolId}" renders <${tagName}>, which is still undefined after ${PENDING_INPUT_WARNING_DELAY_MS / 1000} s, and its registry has no module loader for it. Register one with setToolModuleLoaders or import the tool's package before it renders; a registry from createPackagedToolRegistry has the packaged loaders unless its toolModuleLoaders replaced them. Reported once per page.`,
			);
		}, PENDING_INPUT_WARNING_DELAY_MS);
		void customElements.whenDefined(tagName).then(() => clearTimeout(timer));
	}

	/**
	 * Load a set of tool modules, each to completion, and resolve with the error
	 * of every tool whose module failed, by tool id. One failure leaves the other
	 * tools loaded and usable. A failed tool is retried on the next call.
	 */
	async ensureToolModulesLoaded(
		toolIds: string[],
	): Promise<Map<string, unknown>> {
		const results = await Promise.allSettled(
			toolIds.map((toolId) => this.ensureToolModuleLoaded(toolId)),
		);
		const failures = new Map<string, unknown>();
		results.forEach((result, index) => {
			if (result.status === "rejected") failures.set(toolIds[index], result.reason);
		});
		return failures;
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
		context: ToolSurfaceRenderContext,
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
