import type { SectionPlayerRuntimeConfig } from "@pie-players/pie-section-player";
import type { AssessmentPlayerRuntimeConfig } from "../types.js";

type PlayerConfig = NonNullable<SectionPlayerRuntimeConfig["player"]>;
type BackendConfig = NonNullable<PlayerConfig["backend"]>;
type DeliveryConfig = NonNullable<BackendConfig["delivery"]>;
type EndpointMap = NonNullable<DeliveryConfig["endpoints"]>;

export type ResolveAssessmentSectionPlayerRuntimeArgs = {
	sectionPlayerRuntime?: AssessmentPlayerRuntimeConfig["sectionPlayerRuntime"];
	playerType: "iife" | "esm" | "preloaded";
	attemptId?: string;
	env?: Record<string, unknown> | null;
	coordinator?: unknown;
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

function cloneBackendConfig(
	backend: BackendConfig | null | undefined,
): BackendConfig | undefined {
	if (!backend) return undefined;
	return {
		...backend,
		auth: cloneAuth(backend.auth),
		delivery: cloneDelivery(backend.delivery),
		authoring: backend.authoring
			? {
					...backend.authoring,
					auth: cloneAuth(backend.authoring.auth),
					endpoints: cloneEndpoints(backend.authoring.endpoints),
					request: backend.authoring.request
						? {
								...backend.authoring.request,
								headers: backend.authoring.request.headers
									? { ...backend.authoring.request.headers }
									: undefined,
							}
						: undefined,
					media: backend.authoring.media
						? { ...backend.authoring.media }
						: undefined,
					client: backend.authoring.client
						? { ...backend.authoring.client }
						: undefined,
				}
			: undefined,
	};
}

function withDefaultAssignmentId(
	backend: BackendConfig | undefined,
	attemptId: string | undefined,
): BackendConfig | undefined {
	if (!backend?.delivery || backend.delivery.enabled === false || !attemptId) {
		return backend;
	}
	if (backend.delivery.assignmentId !== undefined) {
		return backend;
	}
	return {
		...backend,
		delivery: {
			...backend.delivery,
			assignmentId: attemptId,
		},
	};
}

export function resolveAssessmentSectionPlayerRuntime(
	args: ResolveAssessmentSectionPlayerRuntimeArgs,
): SectionPlayerRuntimeConfig {
	const { sectionPlayerRuntime, playerType, attemptId, env, coordinator } =
		args;
	const player =
		sectionPlayerRuntime?.player &&
		typeof sectionPlayerRuntime.player === "object"
			? {
					...sectionPlayerRuntime.player,
					backend: withDefaultAssignmentId(
						cloneBackendConfig(sectionPlayerRuntime.player.backend),
						attemptId,
					),
				}
			: sectionPlayerRuntime?.player;
	return {
		playerType,
		...(env ? { env } : {}),
		...(coordinator ? { coordinator } : {}),
		...(sectionPlayerRuntime || {}),
		...(player !== undefined ? { player } : {}),
	};
}
