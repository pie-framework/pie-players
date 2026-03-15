export type AuthoringBackendMode = "demo" | "required";

import type {
	DeleteDone,
	ImageHandler,
	SoundHandler,
} from "@pie-players/pie-players-shared/types";

export type { DeleteDone, ImageHandler, SoundHandler };

export interface PieItemPlayerElement extends HTMLElement {
	config: unknown;
	session: unknown;
	env: unknown;
	strategy: "iife" | "esm" | "preloaded";
	mode?: "view" | "author";
	configuration?: Record<string, unknown>;
	authoringBackend?: AuthoringBackendMode;
	onInsertImage?: (handler: ImageHandler) => void;
	onDeleteImage?: (src: string, done: DeleteDone) => void;
	onInsertSound?: (handler: SoundHandler) => void;
	onDeleteSound?: (src: string, done: DeleteDone) => void;
	loaderOptions?: Record<string, unknown>;
}

export interface PieItemSessionDebuggerElement extends HTMLElement {
	itemName?: string;
	itemId?: string;
	config?: unknown;
	session?: unknown;
	env?: unknown;
	score?: unknown;
}
