import { createContext } from "@pie-players/pie-context";
import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type {
	AccessibilityCatalogResolverApi,
	ElementToolStateStoreApi,
	HighlightCoordinatorApi,
	ToolCoordinatorApi,
	ToolkitCoordinatorApi,
	TtsServiceApi,
} from "../services/interfaces.js";
import type { TTSHighlightTargetResolver } from "../services/tts/highlight-target-resolver.js";

export type ItemPlayerType = "iife" | "esm" | "preloaded" | "custom";

export interface ItemPlayerConfig {
	type: ItemPlayerType;
	tagName: string;
	version?: string;
	source?: string;
	loaderConfig?: LoaderConfig;
	loaderOptions?: Record<string, unknown>;
	isDefault: boolean;
}

export interface AssessmentToolkitRuntimeContext {
	toolkitCoordinator: ToolkitCoordinatorApi;
	toolCoordinator: ToolCoordinatorApi;
	ttsService: TtsServiceApi;
	highlightCoordinator: HighlightCoordinatorApi;
	catalogResolver: AccessibilityCatalogResolverApi;
	elementToolStateStore: ElementToolStateStoreApi;
	assessmentId: string;
	sectionId: string;
	itemPlayer: ItemPlayerConfig;
	/**
	 * Opt-in flag: context consumers render the vendored `<nds-icon-button>`
	 * only when this is `true`; otherwise (unset/`false`, the default) they
	 * render plain `<button>` controls. Sourced from the host's
	 * `runtime.ndsIcons` (or the `nds-icons` attribute on the toolkit).
	 */
	ndsIcons?: boolean;
	/**
	 * Interface locale: the language this deployment renders its *own* UI in —
	 * toolbar labels, tool panels, `aria-label`s. Not the language of the
	 * authored content, which is a fact about the item and travels on `env`.
	 *
	 * A composition context in the sense of `composition-context.md`: the
	 * deployment knows it and no tool can. Sourced from the host's
	 * `runtime.locale` (or the `locale` attribute on the toolkit), defaulting to
	 * `en-US` with no host input — never `navigator.language`, because a
	 * rendered-string change reaches a host's live delivery on their next install
	 * with no build signal on their side.
	 */
	locale?: string;
	/**
	 * The provider resolving {@link locale} to strings.
	 *
	 * Published here rather than constructed per tool so one catalog load serves
	 * every capability on the page, and so a host that supplies its own
	 * `I18nProvider` implementation reaches all of them. A tool that finds no
	 * context falls back to `getDefaultI18n()`, which is English-only and needs no
	 * publisher — the graceful default the pull pattern requires.
	 *
	 * The change signal is this context's own republish: the value re-derives when
	 * `locale` moves, so resolvers re-read instead of pinning the first provider
	 * they saw.
	 */
	i18n?: I18nProvider;
	reportSessionChanged?: (itemId: string, detail: unknown) => void;
}

export const assessmentToolkitRuntimeContext =
	createContext<AssessmentToolkitRuntimeContext>(
		Symbol.for("pie.assessmentToolkit.runtimeContext"),
	);

export interface AssessmentToolkitHostRuntimeContext {
	runtimeId: string;
	coordinator: ToolkitCoordinatorApi;
}

export const assessmentToolkitHostRuntimeContext =
	createContext<AssessmentToolkitHostRuntimeContext>(
		Symbol.for("pie.assessmentToolkit.hostRuntimeContext"),
	);

export type ShellContextKind = "item" | "passage";

export interface AssessmentToolkitShellContext {
	kind: ShellContextKind;
	itemId: string;
	canonicalItemId: string;
	contentKind: string;
	regionPolicy: string;
	scopeElement: HTMLElement | null;
	item: unknown;
	contextVersion: number;
}

export const assessmentToolkitShellContext =
	createContext<AssessmentToolkitShellContext>(
		Symbol.for("pie.assessmentToolkit.shellContext"),
	);

export interface AssessmentToolkitRegionScopeContext {
	scopeElement: HTMLElement | null;
	ttsHighlightTargetResolver?: TTSHighlightTargetResolver | null;
}

export const assessmentToolkitRegionScopeContext =
	createContext<AssessmentToolkitRegionScopeContext>(
		Symbol.for("pie.assessmentToolkit.regionScopeContext"),
	);
