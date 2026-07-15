export type AuthoringBackendMode = "demo" | "required";

import type {
	DeleteDone,
	Env,
	ImageHandler,
	ItemConfig,
	ItemSession,
	SoundHandler,
} from "@pie-players/pie-players-shared/types";
import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type { PieModel } from "@pie-players/pie-players-shared/types";
import type {
	BackendConfig,
	BackendAuthoringReleaseOptions,
	BackendSaveContentOptions,
	BackendScoreOptions,
} from "./backend/types.js";
import type { ElementPackagePolicy } from "@pie-players/pie-players-shared";

export type { DeleteDone, ImageHandler, SoundHandler };
export type * from "./backend/types.js";

export type AuthoringValidationResult = {
	hasErrors: boolean;
	validatedModels: any[];
};

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
	baseHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
	passageContainerClass?: string;
	customClassName?: string;
	customClassname?: string;
	bundleHost?: string;
	bundleEndpoints?: Record<string, unknown>;
	disableBundler?: boolean;
	reFetchBundle?: boolean;
	onInsertImage?: (handler: ImageHandler) => void;
	onDeleteImage?: (src: string, done: DeleteDone) => void;
	onInsertSound?: (handler: SoundHandler) => void;
	onDeleteSound?: (src: string, done: DeleteDone) => void;
	loaderOptions?: PieItemPlayerLoaderOptions;
	loaderConfig?: LoaderConfig;
	/** Legacy-compatible local browser scoring; returns one result slot per scored model. */
	provideScore(): Promise<false | Array<Record<string, unknown> | undefined>>;
	/** Legacy-compatible preview update for a single loaded PIE model. */
	updateElementModel(update: Partial<PieModel> & { id: string }): Promise<void>;
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
}

export interface PieItemSessionDebuggerElement extends HTMLElement {
	itemName?: string;
	itemId?: string;
	config?: unknown;
	session?: unknown;
	env?: unknown;
	score?: unknown;
}
