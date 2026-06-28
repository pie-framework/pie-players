export type AuthoringBackendMode = "demo" | "required";

import type {
	Env,
	ItemConfig,
	ItemSession,
} from "@pie-players/pie-players-shared/types";

export type DeleteDone = (err?: Error) => void;
export type BackendScope = "delivery" | "authoring";
export type BackendProvider = "custom" | "pie-api";
export type BackendMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type BackendEndpoint =
	| string
	| {
			method?: BackendMethod;
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
export type BackendRequestOptions = {
	overrides?: Record<string, string>;
};
export type BackendAutosaveConfig =
	| boolean
	| {
			enabled?: boolean;
			debounceMs?: number;
	  };
export type BackendDeliveryIdentity = {
	itemId?: string;
	sessionId?: string;
	assignmentId?: string;
};
export type BackendDeliveryEndpoints = {
	load?: BackendEndpoint;
	saveSession?: BackendEndpoint;
	model?: BackendEndpoint;
	score?: BackendEndpoint;
};
export type BackendDeliveryLoadContext = BackendDeliveryIdentity & {
	env: unknown;
	requestOptions?: BackendRequestOptions;
};
export type BackendDeliverySessionContext = BackendDeliveryIdentity & {
	session: { id: string; data: unknown[] };
	env: unknown;
	requestOptions?: BackendRequestOptions;
};
export type BackendScoreOptions = {
	disablePartialScoring?: boolean;
	[key: string]: unknown;
};
export type BackendAuthoringIdentity = {
	contentId?: string;
	collectionId?: string;
};
export type BackendAuthoringSaveOptions = {
	preReleaseType?: string | null;
	[key: string]: unknown;
};
export type BackendSaveContentOptions = BackendAuthoringSaveOptions;
export type BackendAuthoringReleaseOptions = {
	releaseType?: string | null;
	[key: string]: unknown;
};
export type BackendAuthoringEndpoints = {
	load?: BackendEndpoint;
	saveContent?: BackendEndpoint;
	releaseContent?: BackendEndpoint;
};
export type BackendAuthoringLoadResult = {
	contentId?: string;
	config: unknown;
	metadata?: Record<string, unknown>;
};
export type BackendAuthoringSaveContext = BackendAuthoringIdentity & {
	config: unknown;
	env: unknown;
	options?: BackendAuthoringSaveOptions;
};
export type BackendAuthoringReleaseContext = BackendAuthoringIdentity & {
	env: unknown;
	options?: BackendAuthoringReleaseOptions;
};
export type BackendAuthoringClient = {
	load?: (
		context: BackendAuthoringIdentity & { env: unknown },
	) => Promise<BackendAuthoringLoadResult>;
	saveContent?: (
		context: BackendAuthoringSaveContext,
	) => Promise<{ contentId: string }>;
	releaseContent?: (
		context: BackendAuthoringReleaseContext,
	) => Promise<{ contentId: string }>;
};
export type BackendDeliveryScoreContext = BackendDeliverySessionContext & {
	options?: BackendScoreOptions;
};
export type BackendDeliveryLoadResult = {
	config?: unknown;
	item?: unknown;
	session?: unknown;
	metadata?: Record<string, unknown>;
};
export type BackendDeliveryModelResult =
	| Array<Record<string, unknown>>
	| {
			models?: Array<Record<string, unknown>>;
			passageModels?: Array<Record<string, unknown>>;
			metadata?: Record<string, unknown>;
	  };
export type BackendDeliveryClient = {
	load?: (
		context: BackendDeliveryLoadContext,
	) => Promise<BackendDeliveryLoadResult>;
	saveSession?: (context: BackendDeliverySessionContext) => Promise<unknown>;
	model?: (
		context: BackendDeliverySessionContext,
	) => Promise<BackendDeliveryModelResult>;
	score?: (context: BackendDeliveryScoreContext) => Promise<unknown>;
};
export type BackendDeliveryConfig = BackendDeliveryIdentity & {
	enabled?: boolean;
	provider?: BackendProvider;
	baseUrl?: string;
	endpoints?: BackendDeliveryEndpoints;
	options?: BackendRequestOptions;
	request?: BackendRequestConfig;
	auth?: BackendAuthConfig;
	autosave?: BackendAutosaveConfig;
	client?: BackendDeliveryClient;
};
export type BackendAuthoringConfig = BackendAuthoringIdentity & {
	enabled?: boolean;
	provider?: BackendProvider;
	baseUrl?: string;
	endpoints?: BackendAuthoringEndpoints;
	request?: BackendRequestConfig;
	auth?: BackendAuthConfig;
	media?: Record<string, unknown>;
	client?: BackendAuthoringClient;
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
	config: ItemConfig;
	session: ItemSession;
	env: Env;
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
	updateElementModel(
		update: Record<string, unknown> & { id: string },
	): Promise<void>;
	validateModels(): Promise<{ hasErrors: boolean; validatedModels: unknown[] }>;
	loadFromBackend(scope?: BackendScope): Promise<void>;
	saveSession(): Promise<void>;
	score(options?: BackendScoreOptions): Promise<unknown>;
	saveContent(options?: BackendSaveContentOptions): Promise<string>;
	releaseContent(options?: BackendAuthoringReleaseOptions): Promise<string>;
}

export declare function definePieItemPlayer(tagName?: string): void;
export declare function ensureItemPlayerMathRenderingReady(): Promise<void>;
