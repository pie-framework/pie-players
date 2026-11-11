import type {
	DeleteDone,
	Env,
	ImageHandler,
	ItemConfig,
	ItemSession,
	PieItemPlayerErrorDetail,
	SoundHandler,
} from "@pie-players/pie-players-shared/types";
import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type {
	BackendConfig,
	BackendAuthoringReleaseOptions,
	BackendSaveContentOptions,
	BackendScoreOptions,
} from "./backend/types.js";
import type {
	AuthoringValidationResult,
	ElementPackagePolicy,
} from "@pie-players/pie-players-shared";

export type AuthoringBackendMode = "demo" | "required";

export type { DeleteDone, ImageHandler, PieItemPlayerErrorDetail, SoundHandler };
export type * from "./backend/types.js";

/**
 * Owned by `players-shared`, which types `validateModels`' implementation with
 * it; a local redeclaration drifts from what the implementation returns.
 */
export type { AuthoringValidationResult };

/** Optional loader settings; unknown host extensions remain supported. */
export interface PieItemPlayerLoaderOptions extends Record<string, unknown> {
	/** Apply when `config.elements` is not fully trusted host input. */
	elementPackagePolicy?: ElementPackagePolicy;
}

export interface PieItemPlayerElement extends HTMLElement {
	config: ItemConfig;
	session: ItemSession;
	env: Env;
	strategy?: "iife" | "esm" | "preloaded";
	mode?: "view" | "author";
	configuration?: Record<string, unknown>;
	authoringBackend?: AuthoringBackendMode;
	backend?: BackendConfig;
	renderStimulus?: boolean;
	allowedResize?: boolean;
	passageLayout?: "vertical" | "splitpane";
	baseHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
	includeSrHeading?: boolean;
	passageContainerClass?: string;
	customClassName?: string;
	onInsertImage?: (handler: ImageHandler) => void;
	onDeleteImage?: (src: string, done: DeleteDone) => void;
	onInsertSound?: (handler: SoundHandler) => void;
	onDeleteSound?: (src: string, done: DeleteDone) => void;
	loaderOptions?: PieItemPlayerLoaderOptions;
	loaderConfig?: LoaderConfig;
	/** Local browser scoring; returns one result slot per scored model. */
	provideScore(): Promise<false | Array<Record<string, unknown> | undefined>>;
	/** Authoring-mode validation for rendered configure elements. */
	validateModels(): Promise<AuthoringValidationResult>;
	/** Load configured backend data into the existing config/session pipeline. */
	loadFromBackend(scope?: "delivery" | "authoring"): Promise<void>;
	/** Persist the current session through `backend.delivery`. */
	saveSession(): Promise<void>;
	/** Server-backed scoring through `backend.delivery`; distinct from local `provideScore()`. */
	score(options?: BackendScoreOptions): Promise<unknown>;
	/** Persist authoring content through `backend.authoring` when configured. */
	saveContent(options?: BackendSaveContentOptions): Promise<string>;
	/** Release authoring content through `backend.authoring` when configured. */
	releaseContent(options?: BackendAuthoringReleaseOptions): Promise<string>;
	/**
	 * Focus the first input of the rendered item; resolves whether focus moved.
	 *
	 * Each element is asked in document order through its `focusFirstInput()`
	 * hook, and one without the hook gets its first tabbable descendant; the
	 * passage is skipped. An item with no input leaves focus where it is. A call
	 * made while the item loads waits for `load-complete`, then focuses only if
	 * focus has not moved since the call. Call it on an explicit learner action,
	 * such as Enter or a Next button, not on load or as an answer is typed.
	 */
	focus(options?: FocusOptions): Promise<boolean>;
}

export interface PieItemSessionDebuggerElement extends HTMLElement {
	itemId?: string;
	config?: unknown;
	session?: unknown;
	env?: unknown;
	score?: unknown;
	/** The player's `hosted`: the panel runs no controller over a hosted player's models. */
	hosted?: boolean;
}
