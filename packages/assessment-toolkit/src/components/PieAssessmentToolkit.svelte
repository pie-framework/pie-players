<svelte:options
	customElement={{
		tag: "pie-assessment-toolkit",
		shadow: "open",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			section: { attribute: "section", type: "Object" },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			view: { attribute: "view", type: "String" },
			env: { attribute: "env", type: "Object" },
			lazyInit: { attribute: "lazy-init", type: "Boolean" },
			toolConfigStrictness: { attribute: "tool-config-strictness", type: "String" },
			tools: { attribute: "tools", type: "Object" },
			toolRegistry: { type: "Object", reflect: false },
			accessibility: { attribute: "accessibility", type: "Object" },
			player: { attribute: "player", type: "Object" },
			playerType: { attribute: "player-type", type: "String" },
			coordinator: { type: "Object", reflect: false },
			createSectionController: { type: "Object", reflect: false },
			frameworkErrorHook: { type: "Object", reflect: false },
			onFrameworkError: { type: "Object", reflect: false },
			onframeworkerror: { type: "Object", reflect: false },
			errorRenderer: { type: "Object", reflect: false },
			isolation: { attribute: "isolation", type: "String" },
		},
	}}
/>

<script lang="ts">
	import {
		ContextProvider,
		ContextRoot,
		requestContext,
	} from "@pie-players/pie-context";
	import {
		attachInstrumentationEventBridge,
		resolveInstrumentationProvider,
		TOOLKIT_INSTRUMENTATION_EVENT_MAP,
	} from "@pie-players/pie-players-shared/pie";
	import { isInstrumentationProvider } from "@pie-players/pie-players-shared";
	import {
		assessmentToolkitHostRuntimeContext,
		assessmentToolkitRuntimeContext,
		type AssessmentToolkitHostRuntimeContext,
		type AssessmentToolkitRuntimeContext,
		type ItemPlayerConfig,
		type ItemPlayerType,
	} from "../context/assessment-toolkit-context.js";
	import { connectAssessmentToolkitHostRuntimeContext } from "../context/runtime-context-consumer.js";
	import { ToolkitCoordinator } from "../services/ToolkitCoordinator.js";
	import {
		formatFrameworkErrorForConsole,
		frameworkErrorFromUnknown,
		type FrameworkErrorModel,
	} from "../services/framework-error.js";
	import type { ToolRegistry } from "../services/ToolRegistry.js";
	import {
		normalizeAndValidateToolsConfig,
		type ToolConfigStrictness,
	} from "../services/tool-config-validation.js";
	import {
		PIE_INTERNAL_CONTENT_LOADED_EVENT,
		PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
		PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		type InternalContentLoadedDetail,
		type InternalItemSessionChangedDetail,
		type InternalItemPlayerErrorDetail,
		type RuntimeRegistrationDetail,
	} from "../runtime/registration-events.js";
	import { dispatchCrossBoundaryEvent } from "../runtime/tool-host-contract.js";
	import { SectionRuntimeEngine } from "../runtime/SectionRuntimeEngine.js";
	import {
		createRuntimeId,
	} from "../runtime/runtime-event-guards.js";
	import {
		createSessionEmitPolicyState,
		resetSessionEmitPolicyState,
		shouldEmitCanonicalSessionEvent,
	} from "../runtime/session-event-emitter-policy.js";

	type SessionChangedLike = {
		eventDetail?: unknown;
	};
	type UnknownRecord = Record<string, unknown>;
	type HostRuntimeEventName =
		| typeof PIE_REGISTER_EVENT
		| typeof PIE_UNREGISTER_EVENT
		| typeof PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT
		| typeof PIE_INTERNAL_CONTENT_LOADED_EVENT
		| typeof PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT;
	type HostRuntimeEventHandler = (event: Event) => void;

	interface CompositionSnapshot {
		sectionId: string;
		currentItemIndex: number;
		renderableSignature: string;
		itemSessionSignature: string;
	}

	interface CompositionRenderableSnapshot {
		id: string;
		version: string;
	}

	interface CompositionSessionSnapshot {
		itemId: string;
		sessionId: string;
		payloadSignature: string;
	}

	type HostItemPlayerInput = Partial<
	Pick<
		ItemPlayerConfig,
		"type" | "tagName" | "version" | "source" | "loaderConfig" | "loaderOptions"
	>
	> | null;

	const runtimeId = createRuntimeId("toolkit");
	const sectionEngine = new SectionRuntimeEngine();
const DEFAULT_ENV = {
	mode: "gather",
	role: "student",
} as const;
	const DEFAULT_ITEM_PLAYER_BY_TYPE: Record<ItemPlayerType, string> = {
		iife: "pie-item-player",
		esm: "pie-item-player",
	preloaded: "pie-item-player",
		custom: "",
	};

	let {
		assessmentId = "",
		section = null,
		sectionId = "",
		attemptId = "",
		view = "candidate",
		env = {},
		lazyInit = true,
		toolConfigStrictness = "error" as ToolConfigStrictness,
		tools = {},
		toolRegistry = null as ToolRegistry | null,
		accessibility = {},
		player = null as HostItemPlayerInput,
		playerType = "" as ItemPlayerType | "",
		coordinator = null as ToolkitCoordinator | null,
		createSectionController = null as null | (() => unknown),
		frameworkErrorHook: frameworkErrorCallback = null as null | ((errorModel: FrameworkErrorModel) => void),
		onFrameworkError = null as null | ((errorModel: FrameworkErrorModel) => void),
		onframeworkerror = null as null | ((errorModel: FrameworkErrorModel) => void),
		errorRenderer = null as
			| null
			| ((errorModel: FrameworkErrorModel) => {
					title?: string;
					details?: string[];
			  }),
		isolation = "inherit",
	} = $props();

	let anchor = $state<HTMLDivElement | null>(null);
	let ownedCoordinator = $state<ToolkitCoordinator | null>(null);
	let inheritedRuntime = $state<AssessmentToolkitHostRuntimeContext | null>(null);
	let lastOwnership = $state<"owned" | "inherited" | null>(null);
	let provider: ContextProvider<typeof assessmentToolkitRuntimeContext> | null = null;
	let contextRoot: ContextRoot | null = null;
	let hostRuntimeProvider: ContextProvider<
		typeof assessmentToolkitHostRuntimeContext
	> | null = null;
	let hostRuntimeRoot: ContextRoot | null = null;
	let compositionVersion = $state(0);
	let compositionModel = $state<unknown>(null);
	let runtimeError = $state<unknown>(null);
	let frameworkErrorModel = $state<FrameworkErrorModel | null>(null);
	let frameworkErrorTitle = $state("Unable to initialize assessment toolkit.");
	let frameworkErrorDetails = $state<string[]>([]);
	let deliveredFrameworkErrorKey = $state("");
	let lastOwnedBootstrapFailureKey = $state("");
	let lastCompositionRevisionKey = $state("");
	let pendingCompositionModel: unknown = null;
	let pendingCompositionEmit = false;
	let compositionEmitRaf: number | null = null;
	let pendingCrossBoundaryEvents: Array<{ name: string; detail: unknown }> = [];
	const sessionEmitPolicyState = createSessionEmitPolicyState();

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		const rootNode = anchor.getRootNode();
		if (rootNode && "host" in rootNode) {
			return (rootNode as ShadowRoot).host as HTMLElement;
		}
		return anchor.parentElement as HTMLElement | null;
	}
	const host = $derived.by(() => getHostElement());

	function emit(name: string, detail: unknown): void {
		if (!host) {
			pendingCrossBoundaryEvents = [...pendingCrossBoundaryEvents, { name, detail }];
			return;
		}
		dispatchCrossBoundaryEvent(host, name, detail);
	}

	$effect(() => {
		if (!host) return;
		if (pendingCrossBoundaryEvents.length === 0) return;
		const queued = pendingCrossBoundaryEvents;
		pendingCrossBoundaryEvents = [];
		queueMicrotask(() => {
			const resolvedHost = host;
			if (!resolvedHost) {
				pendingCrossBoundaryEvents = [...queued, ...pendingCrossBoundaryEvents];
				return;
			}
			for (const event of queued) {
				dispatchCrossBoundaryEvent(resolvedHost, event.name, event.detail);
			}
		});
	});

	function applyErrorRenderer(model: FrameworkErrorModel): {
		title: string;
		details: string[];
	} {
		if (!errorRenderer) {
			return {
				title: "Unable to initialize assessment toolkit.",
				details: model.details.length > 0 ? model.details : [model.message],
			};
		}
		try {
			const rendered = errorRenderer(model) || {};
			return {
				title:
					typeof rendered.title === "string" && rendered.title.trim().length > 0
						? rendered.title
						: "Unable to initialize assessment toolkit.",
				details:
					Array.isArray(rendered.details) && rendered.details.length > 0
						? rendered.details.map((detail) => String(detail))
						: model.details.length > 0
							? model.details
							: [model.message],
			};
		} catch (rendererError) {
			const message =
				rendererError instanceof Error && rendererError.message.trim().length > 0
					? rendererError.message
					: String(rendererError || "Unknown renderer error");
			return {
				title: "Unable to initialize assessment toolkit.",
				details: [
					...model.details,
					`Error renderer failed: ${message}`,
				],
			};
		}
	}

	function reportFrameworkError(args: {
		kind: FrameworkErrorModel["kind"];
		source: string;
		error: unknown;
		recoverable?: boolean;
	}): FrameworkErrorModel {
		const model = frameworkErrorFromUnknown({
			kind: args.kind,
			source: args.source,
			error: args.error,
			recoverable: args.recoverable,
		});
		console.error(formatFrameworkErrorForConsole(model), model.cause);
		const rendered = applyErrorRenderer(model);
		frameworkErrorModel = model;
		frameworkErrorTitle = rendered.title;
		frameworkErrorDetails = rendered.details;
		emit("framework-error", model);
		emit("runtime-error", {
			runtimeId,
			error: args.error,
			frameworkError: model,
		});
		const frameworkErrorHook =
			frameworkErrorCallback ?? onFrameworkError ?? onframeworkerror;
		if (frameworkErrorHook) {
			try {
				frameworkErrorHook(model);
				deliveredFrameworkErrorKey = `${model.kind}|${model.source}|${model.message}`;
			} catch (hookError) {
				console.error(
					`[pie-framework:runtime-init:pie-assessment-toolkit] framework error hook failed`,
					hookError,
				);
			}
		}
		return model;
	}

	$effect(() => {
		if (!frameworkErrorModel) {
			return;
		}
		const frameworkErrorKey = `${frameworkErrorModel.kind}|${frameworkErrorModel.source}|${frameworkErrorModel.message}`;
		if (deliveredFrameworkErrorKey === frameworkErrorKey) return;
		const frameworkErrorHook =
			frameworkErrorCallback ?? onFrameworkError ?? onframeworkerror;
		if (!frameworkErrorHook) return;
		try {
			frameworkErrorHook(frameworkErrorModel);
			deliveredFrameworkErrorKey = frameworkErrorKey;
		} catch (hookError) {
			console.error(
				`[pie-framework:runtime-init:pie-assessment-toolkit] framework error hook failed`,
				hookError,
			);
		}
	});

	function hashString(input: string): string {
		let hash = 5381;
		for (let index = 0; index < input.length; index += 1) {
			hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
		}
		return (hash >>> 0).toString(36);
	}

	function asRecord(value: unknown): UnknownRecord {
		return value && typeof value === "object" ? (value as UnknownRecord) : {};
	}

	function toSectionId(model: UnknownRecord): string {
		const section = asRecord(model.section);
		const sectionIdentifier =
			typeof section.identifier === "string" ? section.identifier : "";
		const sectionIdValue = typeof model.sectionId === "string" ? model.sectionId : "";
		return sectionIdentifier || sectionIdValue;
	}

	function toCurrentItemIndex(model: UnknownRecord): number {
		return typeof model.currentItemIndex === "number" ? model.currentItemIndex : -1;
	}

	function toRenderableSnapshots(model: UnknownRecord): CompositionRenderableSnapshot[] {
		const renderables = Array.isArray(model.renderables) ? model.renderables : [];
		return renderables.map((entry, index) => {
			const row = asRecord(entry);
			const entity = asRecord(row.entity);
			const entityId =
				(typeof entity.id === "string" && entity.id) || `renderable-${index}`;
			const entityConfig = asRecord(entity.config);
			const entityVersion =
				(typeof entity.version === "string" && entity.version) ||
				(typeof entity.version === "number" ? String(entity.version) : "") ||
				(typeof entityConfig.version === "string" ? entityConfig.version : "");
			return {
				id: entityId,
				version: entityVersion,
			};
		});
	}

	function toSessionSnapshots(model: UnknownRecord): CompositionSessionSnapshot[] {
		const sessionsByItem = asRecord(model.itemSessionsByItemId);
		return Object.keys(sessionsByItem)
			.sort((left, right) => left.localeCompare(right))
			.map((itemId) => {
				const session = asRecord(sessionsByItem[itemId]);
				const sessionId = typeof session.id === "string" ? session.id : "";
				const dataPayload = Array.isArray(session.data) ? session.data : [];
				let payloadSignature = "";
				try {
					payloadSignature = hashString(JSON.stringify(dataPayload));
				} catch {
					payloadSignature = String(dataPayload.length);
				}
				return {
					itemId,
					sessionId,
					payloadSignature,
				};
			});
	}

	function toCompositionSnapshot(model: unknown): CompositionSnapshot {
		const typed = asRecord(model);
		const renderableSignature = toRenderableSnapshots(typed)
			.map((entry) => `${entry.id}:${entry.version}`)
			.join("|");
		const itemSessionSignature = toSessionSnapshots(typed)
			.map((entry) => `${entry.itemId}:${entry.sessionId}:${entry.payloadSignature}`)
			.join("|");
		return {
			sectionId: toSectionId(typed),
			currentItemIndex: toCurrentItemIndex(typed),
			renderableSignature,
			itemSessionSignature,
		};
	}

	function getCompositionRevisionKey(model: unknown): string {
		const snapshot = toCompositionSnapshot(model);
		return `${snapshot.sectionId}|${snapshot.currentItemIndex}|${snapshot.renderableSignature}|${snapshot.itemSessionSignature}`;
	}

	function isKnownPlayerType(value: unknown): value is ItemPlayerType {
		return value === "iife" || value === "esm" || value === "preloaded" || value === "custom";
	}

	function normalizeItemPlayerConfig(
		hostPlayer: HostItemPlayerInput,
		hostPlayerType: ItemPlayerType | "",
	): ItemPlayerConfig {
		const typeFromConfig = hostPlayer?.type;
		const rawType = isKnownPlayerType(typeFromConfig)
			? typeFromConfig
			: isKnownPlayerType(hostPlayerType)
				? hostPlayerType
				: hostPlayer?.tagName
					? "custom"
					: "iife";
		const requestedTagName = hostPlayer?.tagName?.trim();
		if (rawType === "custom" && !requestedTagName) {
			return {
				type: "iife",
				tagName: DEFAULT_ITEM_PLAYER_BY_TYPE.iife,
				version: undefined,
				source: undefined,
				isDefault: true,
			};
		}
		return {
			type: rawType,
			tagName: requestedTagName || DEFAULT_ITEM_PLAYER_BY_TYPE[rawType],
			version: hostPlayer?.version,
			source: hostPlayer?.source,
			loaderConfig: hostPlayer?.loaderConfig,
			loaderOptions: hostPlayer?.loaderOptions,
			isDefault: !hostPlayer && !hostPlayerType,
		};
	}

	function normalizeEnv(input: unknown): { mode: string; role: string } {
		const envValue = ((input || {}) as Record<string, unknown>) || {};
		const mode =
			typeof envValue.mode === "string" && envValue.mode.trim()
				? envValue.mode.trim()
				: DEFAULT_ENV.mode;
		const role =
			typeof envValue.role === "string" && envValue.role.trim()
				? envValue.role.trim()
				: DEFAULT_ENV.role;
		return { mode, role };
	}

	function resolveSectionViewFromEnv(input: unknown): string {
		const resolvedEnv = normalizeEnv(input);
		if (resolvedEnv.mode === "author") return "author";
		if (resolvedEnv.role === "instructor") return "scorer";
		return "candidate";
	}

	async function createDefaultSectionController() {
		if (createSectionController) {
			return createSectionController() as any;
		}
		throw new Error(
			"pie-assessment-toolkit requires createSectionController when no coordinator hook provides one",
		);
	}

	function validateToolsConfigForBootstrap() {
		return normalizeAndValidateToolsConfig(tools as any, {
			strictness: toolConfigStrictness,
			source: "pie-assessment-toolkit.bootstrap",
			toolRegistry,
		}).config;
	}

	function getOwnedBootstrapFailureKey(): string {
		let toolsSignature = "";
		try {
			toolsSignature = JSON.stringify(tools || {});
		} catch {
			toolsSignature = "[unserializable-tools]";
		}
		return [
			assessmentId || "",
			String(toolConfigStrictness || "error"),
			toolsSignature,
		].join("|");
	}

	function buildOwnedCoordinator(validatedTools: unknown): ToolkitCoordinator {
		const fallbackAssessmentId =
			assessmentId ||
			(section as any)?.identifier ||
			`assessment-${Math.random().toString(16).slice(2)}`;
		return new ToolkitCoordinator({
			assessmentId: fallbackAssessmentId,
			lazyInit,
			toolConfigStrictness,
			deferToolConfigValidation: true,
			tools: validatedTools as any,
			toolRegistry,
			accessibility: accessibility as any,
		});
	}

	const effectiveCoordinator = $derived.by(() => {
		if (isolation !== "force" && inheritedRuntime?.coordinator) {
			return inheritedRuntime.coordinator as ToolkitCoordinator;
		}
		return coordinator || ownedCoordinator;
	});

	$effect(() => {
		if (!host) return;
		if (coordinator) {
			if (ownedCoordinator) {
				ownedCoordinator = null;
			}
			return;
		}
		if (isolation !== "force" && inheritedRuntime?.coordinator) {
			if (ownedCoordinator) {
				ownedCoordinator = null;
			}
			return;
		}
		if (!ownedCoordinator) {
			const failureKey = getOwnedBootstrapFailureKey();
			if (lastOwnedBootstrapFailureKey === failureKey) {
				return;
			}
			try {
				const validatedTools = validateToolsConfigForBootstrap();
				ownedCoordinator = buildOwnedCoordinator(validatedTools);
				lastOwnedBootstrapFailureKey = "";
				frameworkErrorModel = null;
				frameworkErrorTitle = "Unable to initialize assessment toolkit.";
				frameworkErrorDetails = [];
			} catch (error) {
				runtimeError = error;
				ownedCoordinator = null;
				lastOwnedBootstrapFailureKey = failureKey;
				reportFrameworkError({
					kind: "coordinator-init",
					source: "pie-assessment-toolkit",
					error,
				});
			}
		}
	});

	const effectiveAssessmentId = $derived(
		assessmentId || effectiveCoordinator?.assessmentId || "",
	);
	const effectiveSectionId = $derived(
		sectionId || (section as any)?.identifier || `section-${effectiveAssessmentId || "default"}`,
	);
	const effectiveEnv = $derived.by(() => normalizeEnv(env));
	const effectiveSectionView = $derived.by(() => resolveSectionViewFromEnv(effectiveEnv));
	const effectiveItemPlayer = $derived.by(() =>
		normalizeItemPlayerConfig(player, playerType),
	);
	const instrumentationProvider = $derived.by(
		() =>
			resolveInstrumentationProvider({
				player: effectiveItemPlayer,
				component: "pie-assessment-toolkit",
			}),
	);
	const runtimeContextValue = $derived.by((): AssessmentToolkitRuntimeContext | null => {
		if (!effectiveCoordinator) return null;
		const services = effectiveCoordinator.getServiceBundle();
		return {
			toolkitCoordinator: effectiveCoordinator,
			toolCoordinator: effectiveCoordinator.toolCoordinator,
			ttsService: services.ttsService,
			highlightCoordinator: services.highlightCoordinator,
			catalogResolver: services.catalogResolver,
			elementToolStateStore: services.elementToolStateStore,
			assessmentId: effectiveAssessmentId,
			sectionId: effectiveSectionId,
			itemPlayer: effectiveItemPlayer,
			reportSessionChanged: (itemId: string, detail: unknown) => {
				const result = sectionEngine.updateItemSession(itemId, detail);
				emitNormalizedSessionChanged({
					itemId,
					result,
					fallbackSession: detail,
				});
			},
		};
	});
	const hostRuntimeContextValue = $derived.by(
		(): AssessmentToolkitHostRuntimeContext | null => {
			if (!effectiveCoordinator) return null;
			return {
				runtimeId,
				coordinator: effectiveCoordinator,
			};
		},
	);

	function flushCompositionChanged(nextModel: unknown) {
		const nextRevisionKey = getCompositionRevisionKey(nextModel);
		if (nextRevisionKey === lastCompositionRevisionKey) {
			return;
		}
		lastCompositionRevisionKey = nextRevisionKey;
		compositionVersion += 1;
		compositionModel = nextModel;
		emit("composition-changed", {
			composition: compositionModel,
			version: compositionVersion,
		});
	}

	function emitCompositionChanged(nextModel?: unknown) {
		pendingCompositionModel = nextModel ?? sectionEngine.getCompositionModel();
		if (pendingCompositionEmit) return;
		pendingCompositionEmit = true;
		const flush = () => {
			pendingCompositionEmit = false;
			compositionEmitRaf = null;
			flushCompositionChanged(pendingCompositionModel);
		};
		if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
			compositionEmitRaf = window.requestAnimationFrame(flush);
			return;
		}
		queueMicrotask(flush);
	}

	function emitNormalizedSessionChanged(args: {
		itemId: string;
		canonicalItemId?: string;
		result: unknown;
		fallbackSession: unknown;
	}) {
		const normalized =
			(args.result as SessionChangedLike | null)?.eventDetail || args.fallbackSession;
		const payload = {
			...(normalized as Record<string, unknown>),
			itemId: args.itemId,
			canonicalItemId: args.canonicalItemId || args.itemId,
			sourceRuntimeId: runtimeId,
		} as Record<string, unknown>;
		if (
			!shouldEmitCanonicalSessionEvent({
				state: sessionEmitPolicyState,
				itemId: args.itemId,
				payload,
			})
		) {
			return;
		}
		emit("session-changed", payload);
	}

	function isLocalToCurrentRuntime(eventTarget: EventTarget | null): boolean {
		if (!(eventTarget instanceof HTMLElement)) return false;
		const sourceRuntime = requestContext(
			eventTarget,
			assessmentToolkitHostRuntimeContext,
		);
		return sourceRuntime?.runtimeId === runtimeId;
	}

	function getEventDetail<T>(event: Event): T | null {
		const detail = (event as CustomEvent<T>).detail;
		return detail ?? null;
	}

	function registerHostRuntimeListeners(
		hostElement: HTMLElement,
		bindings: Array<{
			name: HostRuntimeEventName;
			handler: HostRuntimeEventHandler;
		}>,
	): () => void {
		for (const binding of bindings) {
			hostElement.addEventListener(binding.name, binding.handler);
		}
		return () => {
			for (const binding of bindings) {
				hostElement.removeEventListener(binding.name, binding.handler);
			}
		};
	}

	$effect(() => {
		if (!host) return;
		if (isolation === "force") {
			inheritedRuntime = null;
			return;
		}
		return connectAssessmentToolkitHostRuntimeContext(host, (value) => {
			if (value.runtimeId === runtimeId) {
				return;
			}
			inheritedRuntime = value;
		});
	});

	$effect(() => {
		const parentRuntimeId =
			isolation !== "force" && inheritedRuntime ? inheritedRuntime.runtimeId : null;
		const ownership: "owned" | "inherited" = parentRuntimeId ? "inherited" : "owned";
		if (ownership !== lastOwnership) {
			lastOwnership = ownership;
			emit(ownership === "inherited" ? "runtime-inherited" : "runtime-owned", {
				runtimeId,
				parentRuntimeId,
			});
		}
	});

	$effect(() => {
		const currentSectionId = effectiveSectionId;
		const currentAttemptId = attemptId || "";
		void currentSectionId;
		void currentAttemptId;
		resetSessionEmitPolicyState(sessionEmitPolicyState);
	});

	$effect(() => {
		if (!host || !hostRuntimeContextValue) return;
		hostRuntimeProvider = new ContextProvider(host, {
			context: assessmentToolkitHostRuntimeContext,
			initialValue: hostRuntimeContextValue,
		});
		hostRuntimeProvider.connect();
		hostRuntimeRoot = new ContextRoot(host);
		hostRuntimeRoot.attach();

		return () => {
			hostRuntimeRoot?.detach();
			hostRuntimeRoot = null;
			hostRuntimeProvider?.disconnect();
			hostRuntimeProvider = null;
		};
	});

	$effect(() => {
		if (!hostRuntimeContextValue) return;
		hostRuntimeProvider?.setValue(hostRuntimeContextValue);
	});

	$effect(() => {
		if (!host) return;
		host.setAttribute("data-item-player-type", effectiveItemPlayer.type);
		host.setAttribute("data-item-player-tag", effectiveItemPlayer.tagName);
		host.setAttribute("data-env-mode", String((effectiveEnv as any)?.mode || ""));
		host.setAttribute("data-env-role", String((effectiveEnv as any)?.role || ""));
	});

	$effect(() => {
		if (!host || !runtimeContextValue) return;
		provider = new ContextProvider(host, {
			context: assessmentToolkitRuntimeContext,
			initialValue: runtimeContextValue,
		});
		provider.connect();
		contextRoot = new ContextRoot(host);
		contextRoot.attach();

		return () => {
			contextRoot?.detach();
			contextRoot = null;
			provider?.disconnect();
			provider = null;
		};
	});

	$effect(() => {
		if (runtimeContextValue) {
			provider?.setValue(runtimeContextValue);
		}
	});

	$effect(() => {
		if (!host) return;
		return attachInstrumentationEventBridge({
			host,
			instrumentationProvider,
			component: "pie-assessment-toolkit",
			eventMap: TOOLKIT_INSTRUMENTATION_EVENT_MAP,
			staticAttributes: {
				instrumentationLayer: "toolkit",
				assessmentId: effectiveAssessmentId,
				sectionId: effectiveSectionId,
				attemptId: attemptId || undefined,
			},
		});
	});

	$effect(() => {
		if (!effectiveCoordinator) return;
		return effectiveCoordinator.subscribeTelemetry(({ eventName, payload }) => {
			if (!isInstrumentationProvider(instrumentationProvider)) return;
			if (!instrumentationProvider.isReady()) return;
			const instrumentationEventName = eventName.startsWith("pie-")
				? eventName
				: `pie-toolkit-${eventName}`;
			const timestamp = new Date().toISOString();
			const attributes = {
				...(payload || {}),
				instrumentationLayer: "toolkit",
				assessmentId: effectiveAssessmentId,
				sectionId: effectiveSectionId,
				attemptId: attemptId || undefined,
				component: "pie-assessment-toolkit",
				sourceEventName: eventName,
				timestamp,
			} as Record<string, unknown>;
			instrumentationProvider.trackEvent(instrumentationEventName, attributes);
			const payloadErrorType =
				payload && typeof payload.errorType === "string"
					? payload.errorType
					: undefined;
			if (!eventName.endsWith("-error") && !payloadErrorType) return;
			const message =
				payload && typeof payload.message === "string"
					? payload.message
					: `Toolkit telemetry error: ${eventName}`;
			instrumentationProvider.trackError(new Error(message), {
				component: "pie-assessment-toolkit",
				errorType: payloadErrorType || "ToolkitTelemetryError",
				...attributes,
			});
		});
	});

	$effect(() => {
		if (!section || !effectiveCoordinator) return;
		let cancelled = false;

		void sectionEngine
			.initialize({
				coordinator: effectiveCoordinator,
				section,
				sectionId: effectiveSectionId,
				assessmentId: effectiveAssessmentId,
				attemptId: attemptId || undefined,
				view: effectiveSectionView,
				createDefaultController: createDefaultSectionController,
				onCompositionChanged: (nextComposition) => {
					if (cancelled) return;
					emitCompositionChanged(nextComposition);
				},
			})
			.then(() => {
				if (cancelled) return;
				emit("toolkit-ready", {
					runtimeId,
					assessmentId: effectiveAssessmentId,
					sectionId: effectiveSectionId,
					itemPlayer: effectiveItemPlayer,
					coordinator: effectiveCoordinator,
				});
				emit("section-ready", {
					sectionId: effectiveSectionId,
				});
			})
			.catch((error) => {
				runtimeError = error;
				sectionEngine.reportSectionError({
					source: "section-runtime",
					error,
					timestamp: Date.now(),
				});
				reportFrameworkError({
					kind: "runtime-init",
					source: "pie-assessment-toolkit",
					error,
				});
			});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!host) return;
		const localHost = host;
		const guardLocalRuntime = (event: Event): boolean =>
			isLocalToCurrentRuntime(event.target);
		const bindings: Array<{
			name: HostRuntimeEventName;
			handler: HostRuntimeEventHandler;
		}> = [
			{
				name: PIE_REGISTER_EVENT,
				handler: (event: Event) => {
					if (!guardLocalRuntime(event)) return;
					const detail = getEventDetail<RuntimeRegistrationDetail>(event);
					if (!detail?.element || !detail?.itemId) return;
					const changed = sectionEngine.register(detail);
					sectionEngine.handleContentRegistered(detail);
					if (changed) emitCompositionChanged();
				},
			},
			{
				name: PIE_UNREGISTER_EVENT,
				handler: (event: Event) => {
					if (!guardLocalRuntime(event)) return;
					const detail = getEventDetail<RuntimeRegistrationDetail>(event);
					if (!detail?.itemId) return;
					const changed = detail?.element
						? sectionEngine.unregister(detail.element)
						: false;
					sectionEngine.handleContentUnregistered(detail);
					if (changed) emitCompositionChanged();
				},
			},
			{
				name: PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
				handler: (event: Event) => {
					if (!guardLocalRuntime(event)) return;
					const detail = getEventDetail<InternalItemSessionChangedDetail>(event);
					if (!detail?.itemId) return;
					const result = sectionEngine.updateItemSession(detail.itemId, detail.session);
					emitNormalizedSessionChanged({
						itemId: detail.itemId,
						canonicalItemId: sectionEngine.getCanonicalItemId(detail.itemId),
						result,
						fallbackSession: detail.session,
					});
				},
			},
			{
				name: PIE_INTERNAL_CONTENT_LOADED_EVENT,
				handler: (event: Event) => {
					if (!guardLocalRuntime(event)) return;
					const detail = getEventDetail<InternalContentLoadedDetail>(event);
					if (!detail?.itemId) return;
					sectionEngine.handleContentLoaded({
						itemId: detail.itemId,
						canonicalItemId: detail.canonicalItemId,
						contentKind: detail.contentKind,
						detail: detail.detail,
						timestamp: Date.now(),
					});
				},
			},
			{
				name: PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
				handler: (event: Event) => {
					if (!guardLocalRuntime(event)) return;
					const detail = getEventDetail<InternalItemPlayerErrorDetail>(event);
					if (!detail?.itemId) return;
					sectionEngine.handleItemPlayerError({
						itemId: detail.itemId,
						canonicalItemId: detail.canonicalItemId,
						contentKind: detail.contentKind,
						error: detail.error,
						timestamp: Date.now(),
					});
				},
			},
		];
		return registerHostRuntimeListeners(localHost, bindings);
	});

	export async function waitUntilReady(): Promise<void> {
		if (!effectiveCoordinator) {
			throw new Error("Coordinator not initialized");
		}
		await effectiveCoordinator.waitUntilReady();
	}

	export function getServiceBundle() {
		if (!effectiveCoordinator) {
			throw new Error("Coordinator not initialized");
		}
		return effectiveCoordinator.getServiceBundle();
	}

	export function setHooks(hooks: Record<string, unknown>): void {
		if (!effectiveCoordinator) {
			throw new Error("Coordinator not initialized");
		}
		effectiveCoordinator.setHooks(hooks as any);
	}

	export function navigateToItem(index: number): unknown {
		return sectionEngine.navigateToItem(index);
	}

	export function getCompositionModel(): unknown {
		return sectionEngine.getCompositionModel();
	}

	export function getItemPlayerConfig(): ItemPlayerConfig {
		return effectiveItemPlayer;
	}

	export async function persist(): Promise<void> {
		await sectionEngine.persist();
	}

	export async function hydrate(): Promise<void> {
		await sectionEngine.hydrate();
	}

	$effect(() => {
		return () => {
			if (compositionEmitRaf !== null && typeof window !== "undefined") {
				window.cancelAnimationFrame(compositionEmitRaf);
				compositionEmitRaf = null;
			}
			pendingCompositionEmit = false;
			void sectionEngine.dispose().catch((error) => {
				runtimeError = error;
				reportFrameworkError({
					kind: "runtime-dispose",
					source: "pie-assessment-toolkit",
					error,
					recoverable: true,
				});
			});
		};
	});
</script>

<div bind:this={anchor} class="pie-assessment-toolkit-anchor" aria-hidden="true"></div>
{#if frameworkErrorModel && !frameworkErrorModel.recoverable}
	<div class="pie-assessment-toolkit-error" role="alert" aria-live="assertive">
		<div class="pie-assessment-toolkit-error-title">{frameworkErrorTitle}</div>
		<div class="pie-assessment-toolkit-error-message">{frameworkErrorModel.message}</div>
		<pre class="pie-assessment-toolkit-error-details">{frameworkErrorDetails.join("\n")}</pre>
	</div>
{:else}
	<slot></slot>
{/if}

<style>
	.pie-assessment-toolkit-anchor {
		display: none;
	}

	.pie-assessment-toolkit-error {
		margin: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, #dc2626 40%, transparent);
		background: color-mix(in srgb, #dc2626 12%, transparent);
		color: #7f1d1d;
		font-size: 0.9rem;
	}

	.pie-assessment-toolkit-error-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}

	.pie-assessment-toolkit-error-message {
		margin-bottom: 0.5rem;
	}

	.pie-assessment-toolkit-error-details {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
