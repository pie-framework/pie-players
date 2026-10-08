/**
 * Tool registration — the stable entry for writing and rendering a
 * `ToolRegistration`.
 *
 * A capability package writes a registration with it: the registration contract,
 * the context predicates a tool answers `isVisibleInContext` with, scoped ids,
 * element creation, the toolbar button and overlay helpers, the provider contract
 * a descriptor creates, and the TTS provider with its config resolution. A
 * renderer puts registrations on screen with it: `createToolSurfaceHost` mounts
 * and reconciles surfaces, and `resolveContentCapabilities` asks the
 * grant-and-content question without a coordinator.
 *
 * The composition layer (`@pie-players/pie-default-tool-loaders`) and
 * `@pie-players/pie-tool-sign-language` are written against it, so a host's own
 * capability package uses the mechanism ours use. Its values are complete, so a
 * capability package never imports the root entry. A name the root also carries
 * appears here only where a package imports it from here.
 */

// Registration contract.
export type {
	HostedToolContext,
	HostedToolSize,
	ToolContentDependencyContext,
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
export {
	resolveToolProviderId,
	ToolRegistry,
} from "../services/ToolRegistry.js";
// A registration's own display name in the interface locale. A tool window's
// title is the registration's name, so the shell needs the same `nameKey`-then-
// `name` precedence the toolbar uses rather than the raw English field.
export { resolveToolRegistrationName } from "../services/ToolRegistry.js";
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
export { createToolElement, resolveToolTag } from "./tool-tag-map.js";

// Toolbar button/overlay wiring shared by every toolbar-toggle registration.
export {
	applyOverlaySurface,
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "./registrations/toolbar-registration-helpers.js";

// The coordinator a registration reaches through its render context.
export type { ToolCoordinatorApi } from "../services/interfaces.js";

// Canonical tools config shapes a provider descriptor validates against.
export type {
	CalculatorToolProviderConfig,
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
