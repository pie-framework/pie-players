import type { BackendConfig } from "@pie-players/pie-item-player";
import type {
	PlayerOverrides,
	RuntimeConfig,
} from "@pie-players/pie-assessment-toolkit/runtime/engine";
import type { ItemEntity } from "@pie-players/pie-players-shared/types";
import { isPlainRecord } from "@pie-players/pie-players-shared/object";
import type { SessionSnapshotConfig } from "@pie-players/pie-players-shared/pie";
import type { ItemMarkupSanitizer } from "@pie-players/pie-players-shared/security";

type DeliveryConfig = NonNullable<BackendConfig["delivery"]>;
type AuthoringConfig = NonNullable<BackendConfig["authoring"]>;
type EndpointMap = NonNullable<DeliveryConfig["endpoints"]>;

/** The item a per-item `runtime.player` callback is called for. */
export type SectionPlayerItemContext = {
	itemId: string;
	canonicalItemId: string;
	item: ItemEntity;
	itemIndex: number;
	itemSession?: Record<string, unknown>;
	sectionId?: string;
	env: Record<string, unknown>;
};

export type SectionPlayerBackendResolverContext = SectionPlayerItemContext & {
	baseBackend: BackendConfig;
};

export type SectionPlayerBackendResolver = (
	context: SectionPlayerBackendResolverContext,
	baseBackend: BackendConfig,
) => BackendConfig | null | undefined;

/**
 * The `<pie-item-player>` properties a host sets on a section's item players,
 * each with the item player's meaning. `baseHeadingLevel` and
 * `includeSrHeading` override the card's heading context.
 */
export type SectionPlayerItemPlayerProps = Omit<
	PlayerOverrides,
	"backend"
> & {
	backend?: BackendConfig | null;
	addCorrectResponse?: boolean;
	idleSaveDelayMs?: number;
	sessionSnapshot?: SessionSnapshotConfig | null;
	showBottomBorder?: boolean;
	debug?: string | boolean;
	customClassName?: string;
	containerClass?: string;
	externalStyleUrls?: string;
	allowedStyleOrigins?: string;
	allowedResize?: boolean;
	autoplayAudioEnabled?: boolean;
	trustMarkup?: boolean;
	sanitizeMarkup?: ItemMarkupSanitizer | null;
	baseHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
	includeSrHeading?: boolean;
};

/**
 * Props for one item's player, over the section-wide ones. A `backend` here is
 * that item's base backend, which `resolveBackend` still refines; `null` gives
 * the item none.
 */
export type SectionPlayerItemPropsResolver = (
	context: SectionPlayerItemContext,
) => SectionPlayerItemPlayerProps | null | undefined;

export type SectionPlayerRuntimePlayerConfig = SectionPlayerItemPlayerProps & {
	resolveBackend?: SectionPlayerBackendResolver;
	resolveItemProps?: SectionPlayerItemPropsResolver;
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

/**
 * An empty `overrides` map is dropped: pie-api-aws answers 401 to any
 * `overrides` value from a token without the `overrides` scope.
 */
function mergeRequestOptions(
	base: DeliveryConfig["options"],
	override: DeliveryConfig["options"],
): DeliveryConfig["options"] {
	if (!base && !override) return undefined;
	const { overrides: _base, ...baseRest } = base || {};
	const { overrides: _override, ...overrideRest } = override || {};
	const overrides = {
		...(base?.overrides || {}),
		...(override?.overrides || {}),
	};
	return {
		...baseRest,
		...overrideRest,
		...(Object.keys(overrides).length > 0 ? { overrides } : {}),
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
		options: mergeRequestOptions(base.options, override.options),
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
		backend: sectionBackend,
		resolveBackend,
		resolveItemProps,
		...sectionProps
	} = args.resolvedPlayerProps as SectionPlayerRuntimePlayerConfig;

	const itemId = String(args.item?.id || "");
	const itemContext: SectionPlayerItemContext = {
		itemId,
		canonicalItemId: args.canonicalItemId,
		item: args.item,
		itemIndex: args.itemIndex ?? 0,
		itemSession: args.itemSession,
		sectionId: args.sectionId,
		env: args.env,
	};
	const {
		backend: itemBackend,
		...itemProps
	} = readItemProps(resolveItemProps, itemContext);
	const forwardedProps = { ...sectionProps, ...itemProps };
	const rawBackend = itemBackend === undefined ? sectionBackend : itemBackend;

	if (!rawBackend || !isPlainRecord(rawBackend)) {
		return forwardedProps;
	}

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
			{ ...itemContext, baseBackend: resolverBase },
			resolverBase,
		);
		if (resolved && isPlainRecord(resolved)) {
			backend = mergeBackendConfig(baseBackend, resolved);
		}
	}

	return {
		...forwardedProps,
		backend,
	};
}

/**
 * A `resolveItemProps` result without the keys it cannot set: the callbacks,
 * which are section-wide, and the inputs the section derives.
 */
function readItemProps(
	resolveItemProps: SectionPlayerItemPropsResolver | undefined,
	context: SectionPlayerItemContext,
): Record<string, unknown> {
	if (typeof resolveItemProps !== "function") return {};
	const resolved = resolveItemProps(context);
	if (!resolved || !isPlainRecord(resolved)) return {};
	const {
		resolveBackend: _resolveBackend,
		resolveItemProps: _resolveItemProps,
		config: _config,
		env: _env,
		session: _session,
		...props
	} = resolved as Record<string, unknown>;
	return props;
}

export function stripItemDeliveryBackendProps(
	resolvedPlayerProps: Record<string, unknown>,
): Record<string, unknown> {
	const {
		backend: rawBackend,
		resolveBackend: _resolveBackend,
		resolveItemProps: _resolveItemProps,
		...forwardedProps
	} = resolvedPlayerProps as SectionPlayerRuntimePlayerConfig;
	if (!rawBackend || !isPlainRecord(rawBackend)) {
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
