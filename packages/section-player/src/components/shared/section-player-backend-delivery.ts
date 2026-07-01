import type { BackendConfig } from "@pie-players/pie-item-player";
import type {
	PlayerOverrides,
	RuntimeConfig,
} from "@pie-players/pie-assessment-toolkit/runtime/internal";
import type { ItemEntity } from "@pie-players/pie-players-shared/types";

type DeliveryConfig = NonNullable<BackendConfig["delivery"]>;
type AuthoringConfig = NonNullable<BackendConfig["authoring"]>;
type EndpointMap = NonNullable<DeliveryConfig["endpoints"]>;

export type SectionPlayerBackendResolverContext = {
	itemId: string;
	canonicalItemId: string;
	item: ItemEntity;
	itemIndex: number;
	itemSession?: Record<string, unknown>;
	sectionId?: string;
	env: Record<string, unknown>;
	baseBackend: BackendConfig;
};

export type SectionPlayerBackendResolver = (
	context: SectionPlayerBackendResolverContext,
	baseBackend: BackendConfig,
) => BackendConfig | null | undefined;

export type SectionPlayerRuntimePlayerConfig = Omit<
	PlayerOverrides,
	"backend" | "resolveBackend"
> & {
	backend?: BackendConfig | null;
	resolveBackend?: SectionPlayerBackendResolver;
};

export type SectionPlayerRuntimeConfig = Omit<RuntimeConfig, "player"> & {
	player?: SectionPlayerRuntimePlayerConfig | null;
};

export type ResolveItemPlayerBackendPropsArgs = {
	resolvedPlayerProps: Record<string, unknown>;
	item: ItemEntity;
	canonicalItemId: string;
	itemSession?: Record<string, unknown>;
	itemIndex?: number;
	sectionId?: string;
	env: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneAuth<T extends Record<string, unknown> | undefined>(auth: T): T {
	return auth ? ({ ...auth } as T) : auth;
}

function cloneEndpointValue<T>(endpoint: T): T {
	if (endpoint && typeof endpoint === "object" && !Array.isArray(endpoint)) {
		return { ...endpoint } as T;
	}
	return endpoint;
}

function cloneEndpoints<T extends EndpointMap | undefined>(endpoints: T): T {
	if (!endpoints) return endpoints;
	return Object.fromEntries(
		Object.entries(endpoints).map(([key, value]) => [
			key,
			cloneEndpointValue(value),
		]),
	) as T;
}

function cloneDelivery(
	delivery: DeliveryConfig | undefined,
): DeliveryConfig | undefined {
	if (!delivery) return undefined;
	return {
		...delivery,
		auth: cloneAuth(delivery.auth),
		endpoints: cloneEndpoints(delivery.endpoints),
		request: delivery.request
			? {
					...delivery.request,
					headers: delivery.request.headers
						? { ...delivery.request.headers }
						: undefined,
				}
			: undefined,
		options: delivery.options
			? {
					...delivery.options,
					overrides: delivery.options.overrides
						? { ...delivery.options.overrides }
						: undefined,
				}
			: undefined,
		autosave:
			delivery.autosave && typeof delivery.autosave === "object"
				? { ...delivery.autosave }
				: delivery.autosave,
		client: delivery.client ? { ...delivery.client } : undefined,
	};
}

function cloneAuthoring(
	authoring: AuthoringConfig | undefined,
): AuthoringConfig | undefined {
	if (!authoring) return undefined;
	return {
		...authoring,
		auth: cloneAuth(authoring.auth),
		endpoints: cloneEndpoints(authoring.endpoints),
		request: authoring.request
			? {
					...authoring.request,
					headers: authoring.request.headers
						? { ...authoring.request.headers }
						: undefined,
				}
			: undefined,
		media: authoring.media ? { ...authoring.media } : undefined,
		client: authoring.client ? { ...authoring.client } : undefined,
	};
}

function cloneBackendConfig(backend: BackendConfig): BackendConfig {
	return {
		...backend,
		auth: cloneAuth(backend.auth),
		delivery: cloneDelivery(backend.delivery),
		authoring: cloneAuthoring(backend.authoring),
	};
}

function mergeDeliveryConfig(
	base: DeliveryConfig | undefined,
	override: DeliveryConfig | undefined,
): DeliveryConfig | undefined {
	if (!base) return cloneDelivery(override);
	if (!override) return cloneDelivery(base);
	const baseClient = base.client;
	const overrideClient = override.client;
	const client =
		baseClient || overrideClient
			? {
					...(baseClient || {}),
					...(overrideClient || {}),
				}
			: undefined;
	return {
		...cloneDelivery(base),
		...cloneDelivery(override),
		auth: override.auth ? cloneAuth(override.auth) : cloneAuth(base.auth),
		endpoints: {
			...(cloneEndpoints(base.endpoints) || {}),
			...(cloneEndpoints(override.endpoints) || {}),
		},
		request:
			base.request || override.request
				? {
						...(base.request || {}),
						...(override.request || {}),
						headers: {
							...(base.request?.headers || {}),
							...(override.request?.headers || {}),
						},
					}
				: undefined,
		options:
			base.options || override.options
				? {
						...(base.options || {}),
						...(override.options || {}),
						overrides: {
							...(base.options?.overrides || {}),
							...(override.options?.overrides || {}),
						},
					}
				: undefined,
		autosave:
			override.autosave !== undefined
				? cloneDelivery({ autosave: override.autosave } as DeliveryConfig)
						?.autosave
				: cloneDelivery({ autosave: base.autosave } as DeliveryConfig)
						?.autosave,
		client,
	};
}

function mergeAuthoringConfig(
	base: AuthoringConfig | undefined,
	override: AuthoringConfig | undefined,
): AuthoringConfig | undefined {
	if (!base) return cloneAuthoring(override);
	if (!override) return cloneAuthoring(base);
	return {
		...cloneAuthoring(base),
		...cloneAuthoring(override),
		auth: override.auth ? cloneAuth(override.auth) : cloneAuth(base.auth),
		endpoints: {
			...(cloneEndpoints(base.endpoints) || {}),
			...(cloneEndpoints(override.endpoints) || {}),
		},
		request:
			base.request || override.request
				? {
						...(base.request || {}),
						...(override.request || {}),
						headers: {
							...(base.request?.headers || {}),
							...(override.request?.headers || {}),
						},
					}
				: undefined,
		media:
			base.media || override.media
				? {
						...(base.media || {}),
						...(override.media || {}),
					}
				: undefined,
		client:
			base.client || override.client
				? {
						...(base.client || {}),
						...(override.client || {}),
					}
				: undefined,
	};
}

function mergeBackendConfig(
	base: BackendConfig,
	override: BackendConfig,
): BackendConfig {
	return {
		...cloneBackendConfig(base),
		...cloneBackendConfig(override),
		auth: override.auth ? cloneAuth(override.auth) : cloneAuth(base.auth),
		delivery: mergeDeliveryConfig(base.delivery, override.delivery),
		authoring: mergeAuthoringConfig(base.authoring, override.authoring),
	};
}

function withDefaultDeliveryIdentity(args: {
	backend: BackendConfig;
	itemId: string;
	canonicalItemId: string;
	itemSession?: Record<string, unknown>;
}): BackendConfig {
	const backend = cloneBackendConfig(args.backend);
	if (!backend.delivery || backend.delivery.enabled === false) return backend;
	const delivery = cloneDelivery(backend.delivery) as DeliveryConfig;
	delivery.itemId = args.canonicalItemId || args.itemId;
	const sessionId = args.itemSession?.id;
	if (typeof sessionId === "string" && sessionId) {
		delivery.sessionId = sessionId;
	} else {
		delete delivery.sessionId;
	}
	backend.delivery = delivery;
	return backend;
}

export function resolveItemPlayerPropsWithBackend(
	args: ResolveItemPlayerBackendPropsArgs,
): Record<string, unknown> {
	const {
		backend: rawBackend,
		resolveBackend,
		...forwardedProps
	} = args.resolvedPlayerProps as SectionPlayerRuntimePlayerConfig;

	if (!rawBackend || !isRecord(rawBackend)) {
		return forwardedProps;
	}

	const itemId = String(args.item?.id || "");
	const baseBackend = withDefaultDeliveryIdentity({
		backend: rawBackend,
		itemId,
		canonicalItemId: args.canonicalItemId,
		itemSession: args.itemSession,
	});
	let backend = baseBackend;

	if (typeof resolveBackend === "function") {
		const resolverBase = cloneBackendConfig(baseBackend);
		const resolved = resolveBackend(
			{
				itemId,
				canonicalItemId: args.canonicalItemId,
				item: args.item,
				itemIndex: args.itemIndex ?? 0,
				itemSession: args.itemSession,
				sectionId: args.sectionId,
				env: args.env,
				baseBackend: resolverBase,
			},
			resolverBase,
		);
		if (resolved && isRecord(resolved)) {
			backend = mergeBackendConfig(baseBackend, resolved);
		}
	}

	return {
		...forwardedProps,
		backend,
	};
}

export function stripItemDeliveryBackendProps(
	resolvedPlayerProps: Record<string, unknown>,
): Record<string, unknown> {
	const {
		backend: rawBackend,
		resolveBackend: _resolveBackend,
		...forwardedProps
	} = resolvedPlayerProps as SectionPlayerRuntimePlayerConfig;
	if (!rawBackend || !isRecord(rawBackend)) {
		return forwardedProps;
	}
	const { delivery: _delivery, ...passageBackend } =
		cloneBackendConfig(rawBackend);
	if (Object.keys(passageBackend).length === 0) {
		return forwardedProps;
	}
	return {
		...forwardedProps,
		backend: passageBackend,
	};
}
