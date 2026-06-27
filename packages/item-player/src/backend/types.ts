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

export type BackendSaveContentOptions = {
	preReleaseType?: string | null;
	[key: string]: unknown;
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

export type BackendDeliveryClient = {
	load?: (
		context: BackendDeliveryLoadContext,
	) => Promise<BackendDeliveryLoadResult>;
	saveSession?: (context: BackendDeliverySessionContext) => Promise<unknown>;
	model?: (context: BackendDeliverySessionContext) => Promise<unknown>;
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

export type BackendLoadResult = {
	config: unknown;
	session: unknown;
	metadata?: Record<string, unknown>;
};

export type BackendEventDetail = {
	scope: BackendScope;
	operation: string;
	message?: string;
	error?: unknown;
	[key: string]: unknown;
};
