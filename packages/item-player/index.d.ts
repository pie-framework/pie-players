export type AuthoringBackendMode = "demo" | "required";

export type DeleteDone = (err?: Error) => void;

export interface ImageHandler {
	isPasted?: boolean;
	cancel: () => void;
	done: (err?: Error, src?: string) => void;
	fileChosen: (file: File) => void;
	progress: (percent: number, bytes: number, total: number) => void;
}

export interface SoundHandler {
	cancel: () => void;
	done: (err?: Error, src?: string) => void;
	fileChosen: File;
	progress: (percent: number, bytes: number, total: number) => void;
}

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

export declare function definePieItemPlayer(tagName?: string): void;
