/**
 * Registration-authoring surface.
 *
 * What a package outside this one needs to write a `ToolRegistration`: the
 * registration types, the context predicates a tool answers `isVisibleInContext`
 * with, scoped-id and element-creation helpers, the toolbar button/overlay
 * helpers, and the provider descriptors for the two capabilities that ship a
 * provider.
 *
 * A separate entry point rather than additions to `.` for the same reason
 * `runtime/internal` and `policy/internal` exist: this is a surface for sibling
 * packages in this repo, not a contract offered to hosts. Widening `.` with two
 * dozen registration-authoring helpers would make every one of them something a
 * host could reasonably expect us to keep.
 *
 * It exists because the packaged registrations moved out to the composition layer
 * (`@pie-players/pie-default-tool-loaders`) so core stops naming capabilities.
 * A host writing its own capability package imports from here too, which is the
 * point — the mechanism is the same one our own registrations use.
 */

// Registration contract.
export type {
	HostedToolContext,
	HostedToolSize,
	ResolvedToolContext,
	ToolActivation,
	ToolContentDependency,
	ToolContentDependencyContext,
	ToolModuleLoader,
	ToolProviderDescriptor,
	ToolRegistration,
	ToolRenderElement,
	ToolSingletonScope,
	ToolSurfaceRenderContext,
	ToolSurfaceRenderResult,
	ToolSurfaceServices,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolWindowShellConfig,
	ToolbarContext,
} from "../services/ToolRegistry.js";
export { ToolRegistry } from "../services/ToolRegistry.js";
export type {
	CatalogOwnerCard,
	CatalogOwnerSnapshot,
} from "../services/AccessibilityCatalogResolver.js";

// Handing a selection to a tool the requesting surface does not mount. A
// registration composing a selection gateway needs both halves: the action shape
// the gateway renders, and the request the action makes.
export type {
	ToolSelectionAction,
	ToolSelectionContext,
} from "../services/selection-action.js";
export type {
	ToolOpenRequest,
	ToolRequestTarget,
} from "../services/tool-request.js";
// So a gateway button and the toolbar button for the same tool draw one icon.
export {
	resolveFallbackToolIcon,
	TOOL_FALLBACK_ICONS,
} from "../services/tool-icons.js";

// The grant-AND-content rule, for a package that renders content capabilities
// into its own surfaces. Data-only, so a renderer with no coordinator — print —
// asks the same question the section player asks continuously.
export type {
	ContentCapabilityPhase,
	ContentCapabilityPolicy,
	ResolveContentCapabilitiesArgs,
	ResolvedContentCapability,
} from "./content-capability-resolution.js";
export { resolveContentCapabilities } from "./content-capability-resolution.js";

// The mount/reconcile half of the same rule, for a renderer that opens a surface.
// Section-player and the annotation toolbar both drive surfaces through this, so
// discovery, lazy loading, DOM reconciliation and registry observation have one
// implementation rather than one per renderer.
export type {
	ToolSurfaceHost,
	ToolSurfaceHostInput,
	ToolSurfaceHostOptions,
	ToolSurfaceHostSnapshot,
	ToolSurfaceScope,
} from "./tool-surface-host.js";
export { createToolSurfaceHost } from "./tool-surface-host.js";

// Context a registration reads to answer `isVisibleInContext`.
export type { ToolContext, ToolLevel } from "../services/tool-context.js";
export {
	hasChoiceInteraction,
	hasMathContent,
	hasReadableText,
	hasScienceContent,
} from "../services/tool-context.js";

// Scoped tool instance ids, so two placements of one tool do not share state.
export { createScopedToolId } from "../services/tool-instance-id.js";

// Element creation and tag resolution. `resolveToolTag` reads only the overrides
// it is given — the packaged tag map lives in the composition layer.
export type {
	ToolComponentFactory,
	ToolComponentFactoryMap,
	ToolComponentOverrides,
	ToolTagMap,
} from "./tool-tag-map.js";
export {
	createToolElement,
	resolveToolTag,
	toToolIdFromTag,
} from "./tool-tag-map.js";

// Toolbar button/overlay wiring shared by every toolbar-toggle registration.
export {
	applyOverlaySurface,
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "./registrations/toolbar-registration-helpers.js";

// Services a registration reaches through its render context.
export type {
	ElementToolStateStoreApi,
	ToolCoordinatorApi,
	ToolkitCoordinatorApi,
	TtsServiceApi,
} from "../services/interfaces.js";

// Canonical tools config shapes a provider descriptor validates against.
export type {
	ToolPlacementConfig,
	ToolProviderConfig,
} from "../services/tools-config-normalizer.js";
export type { ToolConfigDiagnostic } from "../services/tool-config-validation.js";

// Provider descriptors for the two packaged capabilities that ship one. These
// stay here rather than moving with the registrations because they are written
// against the `pie-calculator` and `pie-tts` contract packages, which the
// toolkit's own `TTSService` and provider registry also depend on.
export {
	DesmosToolProvider,
	TTSToolProvider,
} from "../services/tool-providers/index.js";

// TTS runtime config resolution, used by the TTS registration to turn host
// config into element props.
export type { NormalizedTTSSpeedOption } from "../services/tts-runtime-config.js";
export {
	buildRuntimeTTSConfig,
	normalizeTTSLayoutMode,
	normalizeTTSSpeedControlOptions,
	resolveRuntimeProvider,
	resolveTTSBackend,
	resolveTTSHostToolbarLayout,
	resolveTTSLayoutMode,
	resolveTTSRuntimeSettings,
	resolveTransportMode,
} from "../services/tts-runtime-config.js";
