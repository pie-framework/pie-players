<svelte:options
	customElement={{
		tag: "pie-assessment-toolkit",
		shadow: "none",
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
	import { ContextProvider, ContextRoot } from "@pie-players/pie-context";
	import {
		assessmentToolkitRuntimeContext,
		type AssessmentToolkitRuntimeContext,
		type ItemPlayerConfig,
		type ItemPlayerType,
	} from "../context/assessment-toolkit-context.js";
	import { ToolkitCoordinator } from "../services/ToolkitCoordinator.js";
	import { findParentToolkitRuntime } from "../runtime/findParentToolkitRuntime.js";
	import {
		PIE_ITEM_SESSION_CHANGED_EVENT,
		PIE_REGISTER_EVENT,
		PIE_UNREGISTER_EVENT,
		type ItemSessionChangedDetail,
		type RuntimeRegistrationDetail,
	} from "../runtime/registration-events.js";
	import { SectionRuntimeEngine } from "../runtime/SectionRuntimeEngine.js";
	import {
		createRuntimeId,
		shouldHandleBySourceRuntime,
	} from "../runtime/runtime-event-guards.js";
	import { clearCachedParentRuntime } from "../runtime/runtime-binding-cache.js";

	type ToolkitRuntimeHandle = {
		runtimeId: string;
		coordinator: ToolkitCoordinator;
	};

	type RuntimeHostElement = HTMLElement & {
		__pieToolkitRuntime?: ToolkitRuntimeHandle;
	};

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
	let inheritedCoordinator = $state<ToolkitCoordinator | null>(null);
	let lastOwnership = $state<"owned" | "inherited" | null>(null);
	let provider: ContextProvider<typeof assessmentToolkitRuntimeContext> | null = null;
	let contextRoot: ContextRoot | null = null;
	let compositionVersion = $state(0);
	let compositionModel = $state<unknown>(null);
	let runtimeError = $state<unknown>(null);
	let lastCompositionSignature = $state<string>("");

	function getHostElement(): RuntimeHostElement | null {
		if (!anchor) return null;
		return (anchor.closest("pie-assessment-toolkit") as RuntimeHostElement | null) ?? null;
	}
	const host = $derived.by(() => getHostElement());

	function emit(name: string, detail: unknown): void {
		if (!host) return;
		host.dispatchEvent(
			new CustomEvent(name, {
				detail,
				bubbles: true,
				composed: true,
			}),
		);
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
		if (isolation !== "force" && inheritedCoordinator) {
			return inheritedCoordinator;
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
		if (isolation !== "force" && inheritedCoordinator) {
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

	function getCompositionSignature(model: unknown): string {
		const typed = model as any;
		const itemIds = Array.isArray(typed?.items)
			? typed.items.map((item: any) => item?.id || "")
			: [];
		const passageIds = Array.isArray(typed?.passages)
			? typed.passages.map((item: any) => item?.id || "")
			: [];
		const sessionKeys = typed?.itemSessionsByItemId
			? Object.keys(typed.itemSessionsByItemId).sort()
			: [];
		return JSON.stringify({
			sectionId: typed?.section?.identifier || typed?.sectionId || "",
			currentItemIndex: typed?.currentItemIndex ?? -1,
			itemIds,
			passageIds,
			sessionKeys,
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
		if (!host || !(eventTarget instanceof HTMLElement)) return false;
		return eventTarget.closest("pie-assessment-toolkit") === host;
	}

	$effect(() => {
		if (!host) return;
		const localHost = host;
		const parent = isolation === "force" ? null : findParentToolkitRuntime(localHost);
		const inherited = (parent as RuntimeHostElement | null)?.__pieToolkitRuntime?.coordinator;
		const nextInherited = inherited || null;
		if (inheritedCoordinator !== nextInherited) {
			inheritedCoordinator = nextInherited;
		}
		const ownership: "owned" | "inherited" =
			nextInherited && isolation !== "force" ? "inherited" : "owned";
		if (ownership !== lastOwnership) {
			lastOwnership = ownership;
			emit(ownership === "inherited" ? "runtime-inherited" : "runtime-owned", {
				runtimeId,
				parentRuntimeId:
					(parent as RuntimeHostElement | null)?.__pieToolkitRuntime?.runtimeId || null,
			});
		}

		return () => {
			clearCachedParentRuntime(localHost);
		};
	});

	$effect(() => {
		if (!host || !effectiveCoordinator) return;
		const localHost = host;
		localHost.__pieToolkitRuntime = {
			runtimeId,
			coordinator: effectiveCoordinator,
		};

		return () => {
			delete localHost.__pieToolkitRuntime;
		};
	});

	$effect(() => {
		if (!host) return;
		host.setAttribute("data-item-player-type", effectiveItemPlayer.type);
		host.setAttribute("data-item-player-tag", effectiveItemPlayer.tagName);
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

<style>
	.pie-assessment-toolkit-anchor {
		display: none;
	}
</style>
