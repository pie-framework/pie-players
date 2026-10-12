import type {
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

export function getAuthoringBackendLoadSignature(
	backend: BackendConfig | null | undefined,
): string {
	const authoring = getAuthoringBackend(backend);
	if (!authoring) return "";
	return JSON.stringify({
		contentId: authoring.contentId ?? "",
		collectionId: authoring.collectionId ?? "",
		hasClientLoad: typeof authoring.client?.load === "function",
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

export async function loadFromAuthoringBackend(
	backend: BackendConfig,
	env: unknown,
): Promise<BackendAuthoringLoadResult> {
	const authoring = getAuthoringBackend(backend);
	if (!authoring) {
		throw new Error("Authoring backend is not configured.");
	}
	if (typeof authoring.client?.load !== "function") {
		throw new Error("backend.authoring.client.load is not configured.");
	}
	return authoring.client.load({
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
	if (typeof authoring.client?.saveContent !== "function") {
		throw new Error("backend.authoring.client.saveContent is not configured.");
	}
	return authoring.client.saveContent(saveContext);
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
	if (typeof authoring.client?.releaseContent !== "function") {
		throw new Error(
			"backend.authoring.client.releaseContent is not configured.",
		);
	}
	return authoring.client.releaseContent(releaseContext);
}
