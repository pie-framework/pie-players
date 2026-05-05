export type AuthoringBackendMode = "demo" | "required";

import type {
	DeleteDone,
	ImageHandler,
	SoundHandler,
} from "@pie-players/pie-players-shared/types";
import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type { PieModel } from "@pie-players/pie-players-shared/types";

export type { DeleteDone, ImageHandler, SoundHandler };

export interface PieItemPlayerElement extends HTMLElement {
	config: unknown;
	session: unknown;
	env: unknown;
	strategy?: "iife" | "esm" | "preloaded";
	mode?: "view" | "author";
	configuration?: Record<string, unknown>;
	authoringBackend?: AuthoringBackendMode;
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
	loaderOptions?: Record<string, unknown>;
	loaderConfig?: LoaderConfig;
	/** Focus first tabbable / interactive control inside the item (open shadow only). */
	focusFirst(): boolean;
	/** Legacy-compatible local browser scoring; returns one result slot per scored model. */
	provideScore(): Promise<false | Array<Record<string, unknown> | undefined>>;
	/** Legacy-compatible preview update for a single loaded PIE model. */
	updateElementModel(update: Partial<PieModel> & { id: string }): Promise<void>;
}

export interface PieItemSessionDebuggerElement extends HTMLElement {
	itemName?: string;
	itemId?: string;
	config?: unknown;
	session?: unknown;
	env?: unknown;
	score?: unknown;
}
