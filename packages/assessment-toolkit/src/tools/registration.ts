/**
 * Tool registration — the stable entry for tool authors: writing and rendering a
 * `ToolRegistration`, and the runtime contract a tool element is written against.
 *
 * A capability package writes a registration with it: the registration contract,
 * the context predicates a tool answers `isVisibleInContext` with, scoped ids,
 * element creation, the toolbar button and overlay helpers, the provider contract
 * a descriptor creates, and the TTS provider with its config resolution. A
 * renderer puts registrations on screen with it: `createToolSurfaceHost` mounts
 * and reconciles surfaces, and `resolveContentCapabilities` asks the
 * grant-and-content question without a coordinator. A tool element connects to
 * the runtime with it: the runtime, shell and region-scope contexts, the services
 * they carry, coordinator registration, the reading scope of the content it reads
 * or annotates, and read-aloud coordination.
 *
 * The composition layer (`@pie-players/pie-default-tool-loaders`), the packaged
 * tools and the section player's tool panels are written against it, so a host's
 * own tool uses the mechanism ours use. Its values are complete, so a tool
 * package never imports the root entry, which carries what hosts and players
 * import. A name the root also carries appears here only where a package imports
 * it from here.
 */

// Registration contract.
export type {
	HostedToolContext,
	HostedToolSize,
	ToolContentDependencyContext,
	ToolModuleLoader,
	ToolProviderDescriptor,
	ToolRegistration,
	ToolRenderElement,
	ToolSurfaceRenderContext,
	ToolSurfaceRenderResult,
	ToolSurfaceServices,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../services/ToolRegistry.js";
export { ToolRegistry } from "../services/ToolRegistry.js";
// A registration's own display name in the interface locale. A tool window's
// title is the registration's name, so the shell needs the same `nameKey`-then-
// `name` precedence the toolbar uses rather than the raw English field.
export { resolveToolRegistrationName } from "../services/ToolRegistry.js";
// A tool's own failures, reported to the toolkit's tool failure policy.
export type { ToolFailurePhase } from "../services/tool-failure.js";
export { reportToolFailure } from "../services/tool-failure.js";
export type { CatalogOwnerSnapshot } from "../services/AccessibilityCatalogResolver.js";

// Handing a selection to a tool the requesting surface does not mount: the action
// shape a selection gateway renders.
export type {
	ToolSelectionAction,
	ToolSelectionContext,
} from "../services/selection-action.js";
// So a gateway button and the toolbar button for the same tool draw one icon.
export { resolveFallbackToolIcon } from "../services/tool-icons.js";

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
// Section-player drives its overlay, card and media surfaces through this, so
// discovery, lazy loading, DOM reconciliation and registry observation have one
// implementation rather than one per surface.
export type {
	ToolSurfaceHost,
	ToolSurfaceHostInput,
	ToolSurfaceHostOptions,
	ToolSurfaceHostSnapshot,
	ToolSurfaceScope,
} from "./tool-surface-host.js";
export { createToolSurfaceHost } from "./tool-surface-host.js";

// Context a registration reads to answer `isVisibleInContext`.
export type { ToolContext } from "../services/tool-context.js";
export {
	hasChoiceInteraction,
	hasMathContent,
	hasReadableText,
	hasSpokenContent,
	hasScienceContent,
} from "../services/tool-context.js";

// Scoped tool instance ids, so two placements of one tool do not share state.
export type { ParsedToolInstanceId } from "../services/tool-instance-id.js";
export {
	createScopedToolId,
	parseScopedToolId,
} from "../services/tool-instance-id.js";

// Element creation and tag resolution. `resolveToolTag` reads only the overrides
// it is given — the packaged tag map lives in the composition layer.
export type {
	ToolComponentFactory,
	ToolComponentFactoryMap,
	ToolComponentOverrides,
	ToolTagMap,
} from "./tool-tag-map.js";
export { createToolElement, resolveToolTag } from "./tool-tag-map.js";

// Toolbar button/overlay wiring shared by every toolbar-toggle registration.
export {
	applyOverlaySurface,
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "./registrations/toolbar-registration-helpers.js";

// The coordinator a registration reaches through its render context, and the
// services a tool element reaches through the runtime context.
export type {
	HighlightCoordinatorApi,
	ToolCoordinatorApi,
	ToolkitCoordinatorApi,
	TtsServiceApi,
} from "../services/interfaces.js";

// The runtime contexts a tool element connects to: the toolkit runtime, the shell
// (item or passage) it is mounted in, and the content region it targets. A tool
// that floats above the content registers with the coordinator for z-order.
export type {
	AssessmentToolkitRegionScopeContext,
	AssessmentToolkitRuntimeContext,
	AssessmentToolkitShellContext,
} from "../context/assessment-toolkit-context.js";
export {
	connectToolRegionScopeContext,
	connectToolRuntimeContext,
	connectToolShellContext,
	createToolCoordinatorRegistration,
	type ToolCoordinatorRegistration,
} from "../runtime/tool-host-contract.js";
export { ZIndexLayer } from "../services/ToolCoordinator.js";
export {
	HighlightColor,
	HighlightCoordinator,
} from "../services/HighlightCoordinator.js";

// Reading scope for a tool that reads or annotates a shell's content: its content
// region, the language and catalog context of the content at a point in it, and
// the composed-tree helpers that reach content rendered into open shadow roots.
export type { CatalogLookupContext } from "../services/AccessibilityCatalogResolver.js";
export {
	catalogContextForShell,
	catalogContextHolding,
	type CatalogRuntimeScope,
} from "../runtime/catalog-context.js";
export {
	findShellScopeHost,
	resolveContentRegion,
} from "../runtime/content-region.js";
export {
	composedClosest,
	composedContains,
	flatTextContent,
	isShadowRootNode,
	retargetToTree,
} from "../services/tts/flat-tree.js";

// Placement levels a tool resolves its placement against.
export type { ToolPlacementLevel } from "../services/tools-config-normalizer.js";

// Canonical tools config shapes a provider descriptor validates against.
export type {
	CalculatorToolProviderConfig,
	TextToSpeechToolProviderConfig,
	ToolProviderConfig,
} from "../services/tools-config-normalizer.js";

// The contract a descriptor's `createProvider` returns, for a package writing its
// own provider. The calculator adapters are written against it in the composition
// layer, which owns their engine imports.
export type {
	ToolProviderApi,
	ToolProviderCapabilities,
} from "../services/tool-providers/ToolProviderApi.js";
// The TTS provider stays here because it is written against the `pie-tts`
// contract package, which the toolkit's own `TTSService` also depends on.
export { TTSToolProvider } from "../services/tool-providers/index.js";

// TTS runtime config resolution, used by the TTS registration to turn host
// config into element props, and by a TTS settings surface to read and write
// speed options.
export type {
	NormalizedTTSSpeedOption,
	TTSLayoutMode,
	TTSSpeedOption,
} from "../services/tts-runtime-config.js";
export {
	buildRuntimeTTSConfig,
	formatTTSSpeedOptionsAsText,
	normalizeTTSLayoutMode,
	normalizeTTSSpeedControlOptions,
	parseTTSSpeedOptionsFromText,
	resolveTTSHostToolbarLayout,
	resolveTTSLayoutMode,
	resolveTTSRuntimeSettings,
} from "../services/tts-runtime-config.js";

// Read-aloud coordination for a tool that plays or controls speech: the control
// handoff event between TTS surfaces, pausing speech while a media element plays,
// recognising a start failure the TTS service reports, and choosing a browser
// voice for a language once the browser has published its voices.
export { PIE_TTS_CONTROL_HANDOFF_EVENT } from "../services/tts-control-events.js";
export {
	bindTtsAudioHandoff,
	pauseTtsForMediaAudio,
} from "../services/audio-handoff.js";
export { isTTSStartFailure } from "../services/tts/start-failure.js";
export {
	browserVoiceMatchesLanguage,
	findBrowserVoice,
	waitForBrowserVoices,
} from "../services/tts/browser-provider.js";
