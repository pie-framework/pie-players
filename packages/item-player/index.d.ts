export type AuthoringBackendMode = "demo" | "required";

export type DeleteDone = (err?: Error) => void;
export type BackendScope = "delivery" | "authoring";
export type BackendProvider = "custom" | "pie-api";
export type BackendEndpoint =
	| string
	| {
			method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
			path: string;
	  };
export type BackendAuthConfig = {
	token?: string;
	getToken?: () => string | Promise<string | null | undefined>;
};
export type BackendRequestConfig = {
	headers?: Record<string, string>;
	timeoutMs?: number;
};
export type BackendScoreOptions = {
	disablePartialScoring?: boolean;
	[key: string]: unknown;
};
export type BackendSaveContentOptions = {
	preReleaseType?: string | null;
	[key: string]: unknown;
};
export type BackendDeliveryConfig = {
	enabled?: boolean;
	provider?: BackendProvider;
	itemId?: string;
	sessionId?: string;
	assignmentId?: string;
	baseUrl?: string;
	endpoints?: {
		load?: BackendEndpoint;
		saveSession?: BackendEndpoint;
		model?: BackendEndpoint;
		score?: BackendEndpoint;
	};
	request?: BackendRequestConfig;
	auth?: BackendAuthConfig;
	autosave?:
		| boolean
		| {
				enabled?: boolean;
				debounceMs?: number;
		  };
	client?: {
		load?: (context: Record<string, unknown>) => Promise<Record<string, unknown>>;
		saveSession?: (context: Record<string, unknown>) => Promise<unknown>;
		model?: (context: Record<string, unknown>) => Promise<unknown>;
		score?: (context: Record<string, unknown>) => Promise<unknown>;
	};
};
export type BackendAuthoringConfig = {
	enabled?: boolean;
	provider?: BackendProvider;
	baseUrl?: string;
	contentId?: string;
	collectionId?: string;
	request?: BackendRequestConfig;
	auth?: BackendAuthConfig;
	media?: Record<string, unknown>;
	client?: Record<string, unknown>;
};
export type BackendConfig = {
	auth?: BackendAuthConfig;
	delivery?: BackendDeliveryConfig;
	authoring?: BackendAuthoringConfig;
};

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
	backend?: BackendConfig;
	onInsertImage?: (handler: ImageHandler) => void;
	onDeleteImage?: (src: string, done: DeleteDone) => void;
	onInsertSound?: (handler: SoundHandler) => void;
	onDeleteSound?: (src: string, done: DeleteDone) => void;
	loaderOptions?: Record<string, unknown>;
	provideScore(): Promise<false | Array<Record<string, unknown> | undefined>>;
	updateElementModel(update: Record<string, unknown> & { id: string }): Promise<void>;
	validateModels(): Promise<{ hasErrors: boolean; validatedModels: unknown[] }>;
	loadFromBackend(scope?: BackendScope): Promise<void>;
	saveSession(): Promise<void>;
	score(options?: BackendScoreOptions): Promise<unknown>;
	saveContent(options?: BackendSaveContentOptions): Promise<string>;
	releaseContent(): Promise<string>;
}

export declare function definePieItemPlayer(tagName?: string): void;
export declare function ensureItemPlayerMathRenderingReady(): Promise<void>;
