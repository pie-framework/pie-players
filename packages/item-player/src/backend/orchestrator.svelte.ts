/**
 * Backend delivery and authoring orchestration for `<pie-item-player>`.
 *
 * The component renders; this module owns the state machine that talks to a
 * host's backend. It holds the config and session overrides a backend load
 * produces, the signature bookkeeping that decides when to load, refresh models
 * or autosave, and the request tokens that drop late responses.
 *
 * Boundary: inputs are getters over the component's props, configs and session,
 * plus three callbacks — run the element-load pipeline, dispatch a player event,
 * and apply refreshed models to the rendered elements. Outputs are the two
 * overrides with their session-replacement revision, and the imperative methods
 * the custom element re-exports. Nothing here imports the renderer, the element
 * loader or the style scoping, so the component keeps sole ownership of the DOM.
 *
 * The config selectors stay statically imported. They are pure reads over the
 * backend config object, called from the `$derived`/`$effect` signature
 * computations below, so they cannot become async; only the pie-api transport
 * behind them is loaded on demand.
 */

import type { ConfigEntity } from "@pie-players/pie-players-shared";
import { tick, untrack } from "svelte";
import { stableStringifyForKey } from "../utils/stable-stringify.js";
import {
	getAuthoringBackend,
	getAuthoringBackendLoadSignature,
	loadFromAuthoringBackend,
	releaseContentFromAuthoringBackend,
	saveContentToAuthoringBackend,
} from "./authoring.js";
import {
	getDeliveryAutosaveOptions,
	getDeliveryBackend,
	getDeliveryBackendLoadSignature,
	getDeliveryBackendModelSignature,
	isDeliveryBackendEnabled,
	loadFromDeliveryBackend,
	modelFromDeliveryBackend,
	saveToDeliveryBackend,
	scoreWithDeliveryBackend,
} from "./delivery.js";
import type { DeliveryModelRefreshConfigResult } from "./model-refresh.js";
import { applyDeliveryModelResultToConfigs } from "./model-refresh.js";
import type {
	BackendAuthoringIdentity,
	BackendAuthoringMediaConfig,
	BackendAuthoringReleaseOptions,
	BackendConfig,
	BackendDeliveryModelIdentity,
	BackendDeliveryModelResult,
	BackendSaveContentOptions,
	BackendScoreOptions,
} from "./types.js";

export type BackendSessionContainer = { id: string; data: unknown[] };

export type BackendOrchestratorDeps = {
	/** Live read of the `backend` prop; re-read after every await, never captured. */
	getBackend: () => BackendConfig | null;
	getItemConfig: () => ConfigEntity | null;
	getPassageConfig: () => ConfigEntity | null;
	/** Parsed `env` prop. */
	getEnv: () => unknown;
	/** The authoritative session, controller-owned once one exists. */
	getSessionContainer: () => BackendSessionContainer;
	/** The component's element-load pipeline; resolves false when it did not commit. */
	loadPlayerConfig: (config: unknown) => Promise<boolean>;
	/** Re-dispatches from the custom-element host. */
	dispatchPlayerEvent: (event: CustomEvent) => void;
	/**
	 * Commits refreshed models to the rendered elements: assign the configs, let
	 * them render, then push the changed ones into the live PIE elements.
	 */
	applyRefreshedConfigs: (
		refresh: DeliveryModelRefreshConfigResult,
	) => Promise<void>;
};

export type BackendOrchestrator = {
	/** Config a backend load supplied, or null when the `config` prop still wins. */
	readonly configOverride: unknown | null;
	/** Session a backend load supplied, or null when the `session` prop still wins. */
	readonly sessionOverride: unknown | null;
	/** `backend.authoring.media`, the fallback for the media callback props. */
	readonly authoringMedia: BackendAuthoringMediaConfig | null;
	/**
	 * Whether a backend-supplied session is waiting to overwrite controller
	 * metadata. Reads reactively: call it from the tracked part of an effect.
	 */
	hasPendingSessionReplacement: () => boolean;
	markSessionReplacementApplied: () => void;
	/**
	 * Signals that the player replaced its config, so an in-flight model refresh
	 * knows its result is stale.
	 */
	noteConfigChanged: () => void;
	load: (scope?: "delivery" | "authoring") => Promise<void>;
	saveSession: () => Promise<void>;
	score: (options?: BackendScoreOptions) => Promise<unknown>;
	saveContent: (options?: BackendSaveContentOptions) => Promise<string>;
	releaseContent: (
		options?: BackendAuthoringReleaseOptions,
	) => Promise<string>;
	/** Debounced session save, when `backend.delivery.autosave` asks for one. */
	scheduleAutosave: () => void;
};

/** Deep copy for handing config to a backend without leaking the Svelte proxy. */
export function cloneForBackend<T>(value: T): T {
	if (typeof structuredClone === "function") {
		try {
			return structuredClone(value);
		} catch {
			// Svelte proxy-backed config objects may not be structured-cloneable.
		}
	}
	return JSON.parse(JSON.stringify(value)) as T;
}

const callbackKeyIds = new WeakMap<Function, number>();
let nextCallbackKeyId = 0;

/**
 * Stable per-function token, so a renderer key can change when a media callback
 * is swapped for a different function and stay put when it is the same one.
 */
export function callbackIdentityForKey(value: unknown): string {
	if (typeof value !== "function") return "none";
	let id = callbackKeyIds.get(value);
	if (!id) {
		id = (nextCallbackKeyId += 1);
		callbackKeyIds.set(value, id);
	}
	return `fn:${id}`;
}

export function createBackendOrchestrator(
	deps: BackendOrchestratorDeps,
): BackendOrchestrator {
	let configOverride: unknown | null = $state(null);
	let sessionOverride: unknown | null = $state(null);
	let sessionReplacementRevision = $state(0);
	let lastAppliedSessionReplacementRevision = 0;
	let loadSignature = "";
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let saveQueue: Promise<void> = Promise.resolve();
	let configGeneration = 0;
	let modelRefreshSignature = "";
	let configOverrideScope: "delivery" | "authoring" | null = null;
	let activeAuthoringIdentitySignature = "";
	let activeAuthoringContentId: string | null = null;

	let latestModelRefreshRequestToken = 0;
	let latestAuthoringLoadRequestToken = 0;
	let latestAuthoringMutationRequestToken = 0;

	function beginModelRefreshRequest(): number {
		latestModelRefreshRequestToken += 1;
		return latestModelRefreshRequestToken;
	}

	function isCurrentModelRefreshRequest(requestToken: number): boolean {
		return requestToken === latestModelRefreshRequestToken;
	}

	function beginAuthoringLoadRequest(): number {
		latestAuthoringLoadRequestToken += 1;
		return latestAuthoringLoadRequestToken;
	}

	function isCurrentAuthoringLoadRequest(requestToken: number): boolean {
		return requestToken === latestAuthoringLoadRequestToken;
	}

	function beginAuthoringMutationRequest(): number {
		latestAuthoringMutationRequestToken += 1;
		return latestAuthoringMutationRequestToken;
	}

	function isCurrentAuthoringMutationRequest(requestToken: number): boolean {
		return requestToken === latestAuthoringMutationRequestToken;
	}

	function sessionContainerFor(
		fallbackSessionId?: string,
	): BackendSessionContainer {
		const current = deps.getSessionContainer();
		if (current.id || !fallbackSessionId) return current;
		return {
			...current,
			id: fallbackSessionId,
		};
	}

	function modelIdentitiesFor(
		configEntity: ConfigEntity | null,
	): BackendDeliveryModelIdentity[] | undefined {
		const models = configEntity?.models
			?.filter(
				(model): model is typeof model & { id: string; element: string } =>
					typeof model.id === "string" && typeof model.element === "string",
			)
			.map((model) => ({ id: model.id, element: model.element }));
		return models && models.length > 0 ? models : undefined;
	}

	function dispatchBackendEvent(
		type: string,
		detail: Record<string, unknown>,
	) {
		deps.dispatchPlayerEvent(
			new CustomEvent(type, {
				detail,
			}),
		);
	}

	function reportBackendError(operation: string, errorValue: unknown) {
		const message =
			errorValue instanceof Error ? errorValue.message : String(errorValue);
		dispatchBackendEvent("backend-error", {
			scope: "delivery",
			operation,
			message,
			error: errorValue,
		});
	}

	function getBackendAuthoringMedia(): BackendAuthoringMediaConfig | null {
		return getAuthoringBackend(deps.getBackend())?.media ?? null;
	}

	function currentAuthoringIdentityOverride(
		signature = getAuthoringBackendLoadSignature(deps.getBackend()),
	): BackendAuthoringIdentity {
		if (
			activeAuthoringContentId &&
			activeAuthoringIdentitySignature === signature
		) {
			return { contentId: activeAuthoringContentId };
		}
		return {};
	}

	async function performBackendLoad(
		scope: "delivery" | "authoring",
		expectedSignature: string,
	): Promise<void> {
		if (scope === "authoring") {
			const backend = deps.getBackend();
			if (!backend || !getAuthoringBackend(backend)) {
				throw new Error("backend.authoring is not configured.");
			}
			const requestToken = beginAuthoringLoadRequest();
			const result = await loadFromAuthoringBackend(backend, deps.getEnv());
			if (!isCurrentAuthoringLoadRequest(requestToken)) return;
			if (
				expectedSignature &&
				getAuthoringBackendLoadSignature(deps.getBackend()) !==
					expectedSignature
			) {
				return;
			}
			const identitySignature = getAuthoringBackendLoadSignature(
				deps.getBackend(),
			);
			configOverride = result.config;
			configOverrideScope = "authoring";
			sessionOverride = { id: "", data: [] };
			sessionReplacementRevision += 1;
			const loaded = await deps.loadPlayerConfig(result.config);
			await tick();
			if (!isCurrentAuthoringLoadRequest(requestToken)) return;
			if (
				expectedSignature &&
				getAuthoringBackendLoadSignature(deps.getBackend()) !==
					expectedSignature
			) {
				return;
			}
			if (!loaded) {
				throw new Error("Authoring backend config failed to load.");
			}
			activeAuthoringIdentitySignature = identitySignature;
			activeAuthoringContentId =
				typeof result.contentId === "string" ? result.contentId : null;
			dispatchBackendEvent("backend-load-complete", {
				scope: "authoring",
				operation: "load",
				contentId: result.contentId,
				metadata: result.metadata ?? {},
				config: result.config,
			});
			return;
		}
		const backend = deps.getBackend();
		if (!backend || !isDeliveryBackendEnabled(backend)) {
			throw new Error("backend.delivery is not configured.");
		}
		const envAtLoadStart = deps.getEnv();
		const modelSignatureAtLoadStart = getDeliveryBackendModelSignature(
			backend,
			envAtLoadStart,
		);
		const result = await loadFromDeliveryBackend(backend, envAtLoadStart);
		if (
			expectedSignature &&
			getDeliveryBackendLoadSignature(deps.getBackend()) !== expectedSignature
		) {
			return;
		}
		if (configOverrideScope === "authoring") return;
		configOverride = result.config;
		configOverrideScope = "delivery";
		sessionOverride = result.session;
		sessionReplacementRevision += 1;
		modelRefreshSignature = modelSignatureAtLoadStart;
		dispatchBackendEvent("backend-load-complete", {
			scope: "delivery",
			operation: "load",
			metadata: result.metadata ?? {},
			session: result.session,
		});
	}

	async function refreshModelsFromDeliveryBackend(
		expectedSignature: string,
		expectedConfigGeneration: number,
		requestToken: number,
	): Promise<void> {
		const backend = deps.getBackend();
		if (!backend || !getDeliveryBackend(backend) || !deps.getItemConfig())
			return;
		if (configOverrideScope === "authoring") return;
		const delivery = getDeliveryBackend(backend)!;
		const envAtStart = deps.getEnv();
		const sessionContainer = sessionContainerFor(delivery.sessionId);
		const sessionSignatureAtStart = stableStringifyForKey(sessionContainer);
		let result: BackendDeliveryModelResult;
		try {
			result = await modelFromDeliveryBackend(backend, {
				itemId: delivery.itemId,
				sessionId: delivery.sessionId,
				assignmentId: delivery.assignmentId,
				session: sessionContainer,
				env: envAtStart,
				models: modelIdentitiesFor(deps.getItemConfig()),
				passageModels: modelIdentitiesFor(deps.getPassageConfig()),
			});
		} catch (errorValue) {
			if (!isCurrentModelRefreshRequest(requestToken)) return;
			throw errorValue;
		}
		if (!isCurrentModelRefreshRequest(requestToken)) return;
		if (
			expectedSignature &&
			getDeliveryBackendModelSignature(deps.getBackend(), deps.getEnv()) !==
				expectedSignature
		) {
			return;
		}
		if (expectedConfigGeneration !== configGeneration) return;
		if (
			stableStringifyForKey(sessionContainerFor(delivery.sessionId)) !==
			sessionSignatureAtStart
		) {
			return;
		}
		const applied = applyDeliveryModelResultToConfigs({
			itemConfig: deps.getItemConfig(),
			passageConfig: deps.getPassageConfig(),
			result,
		});
		modelRefreshSignature = expectedSignature;
		if (applied.changed) {
			configGeneration += 1;
			await deps.applyRefreshedConfigs(applied);
		}
		dispatchBackendEvent("backend-model-complete", {
			scope: "delivery",
			operation: "model",
			metadata: applied.metadata ?? {},
		});
	}

	async function persistCurrentSession(): Promise<void> {
		const backend = deps.getBackend();
		if (!backend || !getDeliveryBackend(backend)) {
			throw new Error("backend.delivery is not configured.");
		}
		const delivery = getDeliveryBackend(backend)!;
		const sessionContainer = sessionContainerFor(delivery.sessionId);
		await saveToDeliveryBackend(backend, {
			itemId: delivery.itemId,
			sessionId: delivery.sessionId,
			assignmentId: delivery.assignmentId,
			session: sessionContainer,
			env: deps.getEnv(),
		});
		dispatchBackendEvent("backend-session-saved", {
			scope: "delivery",
			operation: "saveSession",
			sessionId: sessionContainer.id,
			session: sessionContainer,
		});
	}

	async function saveSession(): Promise<void> {
		const nextSave = saveQueue
			.catch(() => undefined)
			.then(() => persistCurrentSession());
		saveQueue = nextSave;
		return nextSave;
	}

	async function score(options?: BackendScoreOptions): Promise<unknown> {
		const backend = deps.getBackend();
		if (!backend || !getDeliveryBackend(backend)) {
			throw new Error("backend.delivery is not configured.");
		}
		const delivery = getDeliveryBackend(backend)!;
		const sessionContainer = sessionContainerFor(delivery.sessionId);
		const result = await scoreWithDeliveryBackend(
			backend,
			{
				itemId: delivery.itemId,
				sessionId: delivery.sessionId,
				assignmentId: delivery.assignmentId,
				session: sessionContainer,
				env: deps.getEnv(),
			},
			options,
		);
		dispatchBackendEvent("backend-score-complete", {
			scope: "delivery",
			operation: "score",
			sessionId: sessionContainer.id,
			score: result,
		});
		return result;
	}

	async function saveContent(
		options?: BackendSaveContentOptions,
	): Promise<string> {
		const itemConfig = deps.getItemConfig();
		if (!itemConfig) {
			throw new Error("Cannot save content before the item config has loaded.");
		}
		const backendAtStart = deps.getBackend() ?? {};
		const signatureAtStart = getAuthoringBackendLoadSignature(backendAtStart);
		const requestToken = beginAuthoringMutationRequest();
		const authoringIdentity = currentAuthoringIdentityOverride(signatureAtStart);
		const result = await saveContentToAuthoringBackend(backendAtStart, {
			...authoringIdentity,
			config: cloneForBackend(itemConfig),
			env: deps.getEnv(),
			options,
		});
		if (
			typeof result.contentId === "string" &&
			isCurrentAuthoringMutationRequest(requestToken) &&
			signatureAtStart ===
				getAuthoringBackendLoadSignature(deps.getBackend())
		) {
			activeAuthoringContentId = result.contentId;
			activeAuthoringIdentitySignature = signatureAtStart;
		}
		dispatchBackendEvent("backend-content-saved", {
			scope: "authoring",
			operation: "saveContent",
			contentId: result.contentId,
		});
		return result.contentId;
	}

	async function releaseContent(
		options?: BackendAuthoringReleaseOptions,
	): Promise<string> {
		const backendAtStart = deps.getBackend() ?? {};
		const signatureAtStart = getAuthoringBackendLoadSignature(backendAtStart);
		const requestToken = beginAuthoringMutationRequest();
		const authoringIdentity = currentAuthoringIdentityOverride(signatureAtStart);
		const result = await releaseContentFromAuthoringBackend(backendAtStart, {
			...authoringIdentity,
			env: deps.getEnv(),
			options,
		});
		if (
			typeof result.contentId === "string" &&
			isCurrentAuthoringMutationRequest(requestToken) &&
			signatureAtStart ===
				getAuthoringBackendLoadSignature(deps.getBackend())
		) {
			activeAuthoringContentId = result.contentId;
			activeAuthoringIdentitySignature = signatureAtStart;
		}
		dispatchBackendEvent("backend-content-released", {
			scope: "authoring",
			operation: "releaseContent",
			contentId: result.contentId,
		});
		return result.contentId;
	}

	function scheduleAutosave() {
		const backend = deps.getBackend();
		if (!backend) return;
		const delivery = getDeliveryBackend(backend);
		if (!delivery) return;
		const autosave = getDeliveryAutosaveOptions(delivery.autosave);
		if (!autosave.enabled) return;
		if (saveTimer) {
			clearTimeout(saveTimer);
		}
		const saveSignature = getDeliveryBackendLoadSignature(backend);
		saveTimer = setTimeout(() => {
			saveTimer = null;
			if (
				saveSignature !== getDeliveryBackendLoadSignature(deps.getBackend())
			) {
				return;
			}
			void saveSession().catch((errorValue) => {
				reportBackendError("saveSession", errorValue);
			});
		}, autosave.debounceMs);
	}

	$effect(() => {
		const signature = getDeliveryBackendLoadSignature(deps.getBackend());
		if (!signature) {
			queueMicrotask(() => {
				untrack(() => {
					if (saveTimer) {
						clearTimeout(saveTimer);
						saveTimer = null;
					}
					loadSignature = "";
					if (configOverrideScope !== "authoring") {
						configOverride = null;
						configOverrideScope = null;
						sessionOverride = null;
					}
				});
			});
			return;
		}
		if (signature === loadSignature) return;
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		loadSignature = signature;
		queueMicrotask(() => {
			untrack(() => {
				void performBackendLoad("delivery", signature).catch((errorValue) => {
					reportBackendError("load", errorValue);
				});
			});
		});
	});

	$effect(() => {
		const signature = getAuthoringBackendLoadSignature(deps.getBackend());
		if (
			!signature ||
			(activeAuthoringIdentitySignature &&
				activeAuthoringIdentitySignature !== signature)
		) {
			queueMicrotask(() => {
				untrack(() => {
					activeAuthoringIdentitySignature = "";
					activeAuthoringContentId = null;
					if (configOverrideScope === "authoring" && !signature) {
						configOverride = null;
						configOverrideScope = null;
						sessionOverride = null;
					}
				});
			});
		}
	});

	$effect(() => {
		const backend = deps.getBackend();
		const env = deps.getEnv();
		const currentItemConfig = deps.getItemConfig();
		const signature = getDeliveryBackendModelSignature(backend, env);
		if (!signature || !currentItemConfig) {
			modelRefreshSignature = "";
			beginModelRefreshRequest();
			return;
		}
		if (signature === modelRefreshSignature) {
			beginModelRefreshRequest();
			return;
		}
		const expectedConfigGeneration = configGeneration;
		const requestToken = beginModelRefreshRequest();
		queueMicrotask(() => {
			untrack(() => {
				void refreshModelsFromDeliveryBackend(
					signature,
					expectedConfigGeneration,
					requestToken,
				).catch((errorValue) => {
					reportBackendError("model", errorValue);
				});
			});
		});
	});

	$effect(() => {
		return () => {
			if (saveTimer) {
				clearTimeout(saveTimer);
				saveTimer = null;
			}
		};
	});

	return {
		get configOverride() {
			return configOverride;
		},
		get sessionOverride() {
			return sessionOverride;
		},
		get authoringMedia() {
			return getBackendAuthoringMedia();
		},
		hasPendingSessionReplacement() {
			return (
				sessionReplacementRevision !== lastAppliedSessionReplacementRevision
			);
		},
		markSessionReplacementApplied() {
			lastAppliedSessionReplacementRevision = sessionReplacementRevision;
		},
		noteConfigChanged() {
			configGeneration += 1;
		},
		load(scope: "delivery" | "authoring" = "delivery") {
			return performBackendLoad(
				scope,
				scope === "authoring"
					? getAuthoringBackendLoadSignature(deps.getBackend())
					: getDeliveryBackendLoadSignature(deps.getBackend()),
			);
		},
		saveSession,
		score,
		saveContent,
		releaseContent,
		scheduleAutosave,
	};
}
