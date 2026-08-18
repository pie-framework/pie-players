import type {
	BackendAuthConfig,
	BackendAuthoringConfig,
	BackendAuthoringIdentity,
	BackendAuthoringLoadResult,
	BackendAuthoringReleaseContext,
	BackendAuthoringReleaseOptions,
	BackendAuthoringSaveContext,
	BackendAuthoringSaveOptions,
	BackendConfig,
} from "./types.js";

export type SaveContentToAuthoringBackendContext = BackendAuthoringIdentity & {
	config: unknown;
	env: unknown;
	options?: BackendAuthoringSaveOptions;
};

export type ReleaseContentFromAuthoringBackendContext = BackendAuthoringIdentity & {
	env: unknown;
	options?: BackendAuthoringReleaseOptions;
};

export function getAuthoringBackend(
	backend: BackendConfig | null | undefined,
): BackendAuthoringConfig | null {
	const authoring = backend?.authoring;
	if (!authoring || authoring.enabled === false) return null;
	return authoring;
}

export function getAuthoringBackendAuth(
	backend: BackendConfig | null | undefined,
): BackendAuthConfig | undefined {
	return getAuthoringBackend(backend)?.auth ?? backend?.auth;
}

export function getAuthoringBackendLoadSignature(
	backend: BackendConfig | null | undefined,
): string {
	const authoring = getAuthoringBackend(backend);
	if (!authoring) return "";
	return JSON.stringify({
		provider: authoring.provider ?? (authoring.client ? "custom" : "pie-api"),
		baseUrl: authoring.baseUrl ?? "",
		contentId: authoring.contentId ?? "",
		collectionId: authoring.collectionId ?? "",
		hasClientLoad: typeof authoring.client?.load === "function",
		endpoint: authoring.endpoints?.load ?? null,
	});
}

function resolveIdentity(
	authoring: BackendAuthoringConfig,
	override?: BackendAuthoringIdentity,
): BackendAuthoringIdentity {
	return {
		contentId: override?.contentId ?? authoring.contentId,
		collectionId: override?.collectionId ?? authoring.collectionId,
	};
}

function usesCustomAuthoringClient(authoring: BackendAuthoringConfig): boolean {
	return (
		authoring.provider === "custom" ||
		(!!authoring.client && authoring.provider !== "pie-api")
	);
}

export async function loadFromAuthoringBackend(
	backend: BackendConfig,
	env: unknown,
): Promise<BackendAuthoringLoadResult> {
	const authoring = getAuthoringBackend(backend);
	if (!authoring) {
		throw new Error("Authoring backend is not configured.");
	}
	if (typeof authoring.client?.load === "function") {
		return authoring.client.load({
			...resolveIdentity(authoring),
			env,
		});
	}
	if (usesCustomAuthoringClient(authoring)) {
		throw new Error("backend.authoring.client.load is not configured.");
	}
	const { callPieApiAuthoringLoad } = await import("./pie-api-client.js");
	return callPieApiAuthoringLoad(authoring, backend.auth, {
		...resolveIdentity(authoring),
		env,
	});
}

export async function saveContentToAuthoringBackend(
	backend: BackendConfig,
	context: SaveContentToAuthoringBackendContext,
): Promise<{ contentId: string }> {
	const authoring = getAuthoringBackend(backend);
	if (!authoring) {
		throw new Error("Authoring backend is not configured.");
	}
	const saveContext: BackendAuthoringSaveContext = {
		...resolveIdentity(authoring, context),
		config: context.config,
		env: context.env,
		options: context.options,
	};
	if (typeof authoring.client?.saveContent === "function") {
		return authoring.client.saveContent(saveContext);
	}
	if (usesCustomAuthoringClient(authoring)) {
		throw new Error("backend.authoring.client.saveContent is not configured.");
	}
	const { callPieApiAuthoringSaveContent } = await import(
		"./pie-api-client.js"
	);
	return callPieApiAuthoringSaveContent(authoring, backend.auth, saveContext);
}

export async function releaseContentFromAuthoringBackend(
	backend: BackendConfig,
	context: ReleaseContentFromAuthoringBackendContext,
): Promise<{ contentId: string }> {
	const authoring = getAuthoringBackend(backend);
	if (!authoring) {
		throw new Error("Authoring backend is not configured.");
	}
	const releaseContext: BackendAuthoringReleaseContext = {
		...resolveIdentity(authoring, context),
		env: context.env,
		options: context.options,
	};
	if (typeof authoring.client?.releaseContent === "function") {
		return authoring.client.releaseContent(releaseContext);
	}
	if (usesCustomAuthoringClient(authoring)) {
		throw new Error(
			"backend.authoring.client.releaseContent is not configured.",
		);
	}
	const { callPieApiAuthoringReleaseContent } = await import(
		"./pie-api-client.js"
	);
	return callPieApiAuthoringReleaseContent(
		authoring,
		backend.auth,
		releaseContext,
	);
}
