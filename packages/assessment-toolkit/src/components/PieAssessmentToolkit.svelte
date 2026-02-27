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
			tools: { attribute: "tools", type: "Object" },
			accessibility: { attribute: "accessibility", type: "Object" },
			player: { attribute: "player", type: "Object" },
			playerType: { attribute: "player-type", type: "String" },
			coordinator: { type: "Object", reflect: false },
			createSectionController: { type: "Object", reflect: false },
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
		PIE_ITEM_SESSION_CHANGED_EVENT,
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		type ItemSessionChangedDetail,
		type RuntimeRegistrationDetail,
	} from "../runtime/registration-events.js";
	import { dispatchCrossBoundaryEvent } from "../runtime/tool-host-contract.js";
	import { SectionRuntimeEngine } from "../runtime/SectionRuntimeEngine.js";
	import {
		createRuntimeId,
		shouldHandleBySourceRuntime,
	} from "../runtime/runtime-event-guards.js";

	type SessionChangedLike = {
		eventDetail?: unknown;
	};

	type HostItemPlayerInput = Partial<
		Pick<ItemPlayerConfig, "type" | "tagName" | "version" | "source">
	> | null;

	const runtimeId = createRuntimeId("toolkit");
	const sectionEngine = new SectionRuntimeEngine();
	const DEFAULT_ITEM_PLAYER_BY_TYPE: Record<ItemPlayerType, string> = {
		iife: "pie-iife-player",
		esm: "pie-esm-player",
		fixed: "pie-fixed-player",
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
		tools = {},
		accessibility = {},
		player = null as HostItemPlayerInput,
		playerType = "" as ItemPlayerType | "",
		coordinator = null as ToolkitCoordinator | null,
		createSectionController = null as null | (() => unknown),
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
	let lastCompositionSignature = $state<string>("");

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
		if (!host) return;
		dispatchCrossBoundaryEvent(host, name, detail);
	}

	function isKnownPlayerType(value: unknown): value is ItemPlayerType {
		return value === "iife" || value === "esm" || value === "fixed" || value === "custom";
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
			isDefault: !hostPlayer && !hostPlayerType,
		};
	}

	async function createDefaultSectionController() {
		if (createSectionController) {
			return createSectionController() as any;
		}
		throw new Error(
			"pie-assessment-toolkit requires createSectionController when no coordinator hook provides one",
		);
	}

	function buildOwnedCoordinator(): ToolkitCoordinator {
		const fallbackAssessmentId =
			assessmentId ||
			(section as any)?.identifier ||
			`assessment-${Math.random().toString(16).slice(2)}`;
		return new ToolkitCoordinator({
			assessmentId: fallbackAssessmentId,
			lazyInit,
			tools: tools as any,
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
			ownedCoordinator = buildOwnedCoordinator();
		}
	});

	const effectiveAssessmentId = $derived(
		assessmentId || effectiveCoordinator?.assessmentId || "",
	);
	const effectiveSectionId = $derived(
		sectionId || (section as any)?.identifier || `section-${effectiveAssessmentId || "default"}`,
	);
	const effectiveItemPlayer = $derived.by(() =>
		normalizeItemPlayerConfig(player, playerType),
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
				const result = sectionEngine.handleItemSessionChanged(itemId, detail);
				const normalized = (result as SessionChangedLike | null)?.eventDetail || detail;
				emit("session-changed", {
					...(normalized as Record<string, unknown>),
					sourceRuntimeId: runtimeId,
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

	function getCompositionSignature(model: unknown): string {
		const typed = model as any;
		const itemIds = Array.isArray(typed?.items)
			? typed.items.map((item: any) => item?.id || "")
			: [];
		const passageIds = Array.isArray(typed?.passages)
			? typed.passages.map((item: any) => item?.id || "")
			: [];
		const sessionByItem = typed?.itemSessionsByItemId
			? Object.entries(typed.itemSessionsByItemId)
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([itemId, session]) => [itemId, JSON.stringify(session ?? null)])
			: [];
		return JSON.stringify({
			sectionId: typed?.section?.identifier || typed?.sectionId || "",
			currentItemIndex: typed?.currentItemIndex ?? -1,
			itemIds,
			passageIds,
			sessionByItem,
		});
	}

	function emitCompositionChanged() {
		const nextModel = sectionEngine.getCompositionModel();
		const signature = getCompositionSignature(nextModel);
		if (signature === lastCompositionSignature) {
			return;
		}
		lastCompositionSignature = signature;
		compositionVersion += 1;
		compositionModel = nextModel;
		emit("composition-changed", {
			composition: compositionModel,
			version: compositionVersion,
		});
	}

	function isLocalToCurrentRuntime(eventTarget: EventTarget | null): boolean {
		if (!(eventTarget instanceof HTMLElement)) return false;
		const sourceRuntime = requestContext(
			eventTarget,
			assessmentToolkitHostRuntimeContext,
		);
		return sourceRuntime?.runtimeId === runtimeId;
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
		host.setAttribute("data-env-mode", String((env as any)?.mode || ""));
		host.setAttribute("data-env-role", String((env as any)?.role || ""));
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
		if (!section || !effectiveCoordinator) return;
		let cancelled = false;

		void sectionEngine
			.initialize({
				coordinator: effectiveCoordinator,
				section,
				sectionId: effectiveSectionId,
				assessmentId: effectiveAssessmentId,
				attemptId: attemptId || undefined,
				view,
				createDefaultController: createDefaultSectionController,
				onCompositionChanged: (nextComposition) => {
					if (cancelled) return;
					compositionModel = nextComposition;
					emitCompositionChanged();
				},
			})
			.then(() => {
				if (cancelled) return;
				emit("toolkit-ready", {
					runtimeId,
					assessmentId: effectiveAssessmentId,
					sectionId: effectiveSectionId,
					itemPlayer: effectiveItemPlayer,
				});
				emit("section-ready", {
					sectionId: effectiveSectionId,
				});
			})
			.catch((error) => {
				runtimeError = error;
				emit("runtime-error", {
					runtimeId,
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

		const onRegister = (event: Event) => {
			if (!isLocalToCurrentRuntime(event.target)) return;
			const detail = (event as CustomEvent<RuntimeRegistrationDetail>).detail;
			if (!detail?.element || !detail?.itemId) return;
			const changed = sectionEngine.register(detail);
			if (changed) emitCompositionChanged();
		};

		const onUnregister = (event: Event) => {
			if (!isLocalToCurrentRuntime(event.target)) return;
			const detail = (event as CustomEvent<RuntimeRegistrationDetail>).detail;
			const changed = detail?.element
				? sectionEngine.unregister(detail.element)
				: false;
			if (changed) emitCompositionChanged();
		};

		const onItemSessionChanged = (event: Event) => {
			if (!isLocalToCurrentRuntime(event.target)) return;
			const detail = (event as CustomEvent<ItemSessionChangedDetail>).detail;
			if (!detail?.itemId) return;
			if (!shouldHandleBySourceRuntime(detail.sourceRuntimeId, runtimeId)) return;
			const result = sectionEngine.handleItemSessionChanged(detail.itemId, detail.session);
			const normalized = (result as SessionChangedLike | null)?.eventDetail || detail.session;
			emit("session-changed", {
				...(normalized as Record<string, unknown>),
				itemId: detail.itemId,
				canonicalItemId: detail.canonicalItemId || detail.itemId,
				sourceRuntimeId: runtimeId,
			});
		};

		localHost.addEventListener(PIE_REGISTER_EVENT, onRegister);
		localHost.addEventListener(PIE_UNREGISTER_EVENT, onUnregister);
		localHost.addEventListener(PIE_ITEM_SESSION_CHANGED_EVENT, onItemSessionChanged);
		return () => {
			localHost.removeEventListener(PIE_REGISTER_EVENT, onRegister);
			localHost.removeEventListener(PIE_UNREGISTER_EVENT, onUnregister);
			localHost.removeEventListener(PIE_ITEM_SESSION_CHANGED_EVENT, onItemSessionChanged);
		};
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
			void sectionEngine.dispose().catch((error) => {
				runtimeError = error;
			});
		};
	});
</script>

<div bind:this={anchor} class="pie-assessment-toolkit-anchor" aria-hidden="true"></div>
<slot></slot>

<style>
	.pie-assessment-toolkit-anchor {
		display: none;
	}
</style>
