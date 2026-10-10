/**
 * Section controller binding — the toolkit's side of a section runtime.
 *
 * `PieAssessmentToolkit` holds one per element. It resolves the section's
 * controller from the coordinator (`initialize`), keeps the registered item and
 * passage shells (`RuntimeRegistry`) and which of them have loaded, replays
 * both into each controller it resolves, and forwards shell events, session
 * updates and host commands to that controller.
 *
 * The registry outlives a section switch: the shells of the section being left
 * stay registered until they unmount. One membership rule routes every shell
 * event, in replay or live: an event goes to the controller of the section
 * whose composition renders the shell, which is the current controller or a
 * cached controller of a section this binding bound earlier, and is dropped
 * with a warning when no bound section renders it; see `controllerFor`. A
 * cached controller re-bound on a revisit first forgets the loads of shells
 * that are no longer registered, so its `section-loading-complete` waits for
 * the new shells.
 *
 * The section's stage chain is a separate object: the section player's layout
 * kernel drives a `SectionRuntimeEngine` from the readiness signals it derives.
 * The two share no state.
 */

import type { ToolkitCoordinator } from "../services/ToolkitCoordinator.js";
import type {
	SectionControllerEvent,
	SectionControllerHandle,
	SectionControllerSessionState,
} from "../services/section-controller-types.js";
import {
	createPieLogger,
	isGlobalDebugEnabled,
} from "@pie-players/pie-players-shared";
import type { MediaTimeSource } from "@pie-players/pie-players-shared/timed-media";
import type { RuntimeRegistrationDetail } from "./registration-events.js";
import { RuntimeRegistry } from "./RuntimeRegistry.js";

/**
 * Structural view of the resolved section controller, widened with the
 * extra methods the toolkit's runtime CE calls directly. Optional so
 * stub controllers used in tests do not need every entry point.
 */
interface RuntimeController extends SectionControllerHandle {
	getCompositionModel?: () => unknown;
	getCanonicalItemId?: (itemId: string) => string;
	handleContentLoaded?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
		timestamp?: number;
	}) => void;
	handleContentRegistered?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}) => void;
	handleContentUnregistered?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}) => void;
	handleItemPlayerError?: (args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
		timestamp?: number;
	}) => void;
	reportSectionError?: (args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}) => void;
	updateItemSession?: (
		itemId: string,
		sessionDetail: unknown,
	) => { eventDetail?: unknown } | null;
	subscribe?: (listener: (event: SectionControllerEvent) => void) => () => void;
	navigateToItem?: (index: number) => unknown;
	attachMediaTimeSource?: (
		source: MediaTimeSource,
		options?: {
			origin?: "native-adapter" | "host";
			renderableId?: string;
		},
	) => void;
	detachMediaTimeSource?: (options?: {
		origin?: "native-adapter" | "host";
	}) => void;
	pauseMediaForCompetingAudio?: () => boolean;
}

/** What a media-time-source registration reaching the binding has to say. */
export interface SectionRuntimeMediaTimeSourceAction {
	renderableId: string;
	action: "attach" | "detach";
	source?: MediaTimeSource;
	origin?: "native-adapter" | "host";
}

/** What a formative action reaching the binding has to say. */
export interface SectionRuntimeFormativeAction {
	itemId: string;
	canonicalItemId?: string;
	action: "check" | "retry";
	outcomes?: unknown[];
}

/**
 * Initialize args used by the toolkit CE to resolve the coordinator-backed
 * section controller.
 */
export interface SectionControllerBindingInitArgs {
	coordinator: ToolkitCoordinator;
	section: unknown;
	sectionId: string;
	assessmentId: string;
	view: string;
	attemptId?: string;
	/**
	 * A host-supplied session for this section, applied by the coordinator in
	 * place of `hydrate()` when it creates the controller. Absent, creation
	 * hydrates from the persistence strategy as before.
	 */
	initialSession?: SectionControllerSessionState | null;
	createDefaultController: () => Promise<RuntimeController> | RuntimeController;
	onCompositionChanged?: (composition: unknown) => void;
	/**
	 * The controller event that caused a republish, for the few events the toolkit
	 * has to act on rather than merely propagate — a timed-media policy that cannot
	 * be enforced becomes a framework warning, and malformed cue data becomes a
	 * framework error. Every other event reaches hosts through the composition
	 * republish and the coordinator's own subscriptions.
	 */
	onControllerEvent?: (event: SectionControllerEvent) => void;
}

const logger = createPieLogger("section-controller-binding", () =>
	isGlobalDebugEnabled(),
);

/**
 * The `entity.id` of each of a composition model's `renderables`: the ids its
 * item and passage shells register with. `null` when the model has no
 * `renderables` array.
 */
function readRenderableIds(model: unknown): ReadonlySet<string> | null {
	const renderables = (model as { renderables?: unknown } | null | undefined)
		?.renderables;
	if (!Array.isArray(renderables)) return null;
	const ids = new Set<string>();
	for (const renderable of renderables) {
		const id = (renderable as { entity?: { id?: unknown } } | null)?.entity
			?.id;
		if (typeof id === "string" && id) ids.add(id);
	}
	return ids;
}

export class SectionControllerBinding {
	private readonly registry = new RuntimeRegistry();
	private controller: RuntimeController | null = null;
	private coordinator: ToolkitCoordinator | null = null;
	private sectionId = "";
	private attemptId: string | undefined;
	private unsubscribeController: (() => void) | null = null;
	private activeInitToken = 0;

	/**
	 * Ids of the renderables in the current controller's composition model, read
	 * when `initialize` resolves it. `null` while no controller is resolved, and
	 * for a controller that publishes no `renderables`: its section cannot be
	 * told apart, so every shell reaches it.
	 */
	private sectionRenderableIds: ReadonlySet<string> | null = null;

	/**
	 * The renderable ids of every section this binding has bound, keyed by
	 * section and attempt, least recently bound first. `controllerFor` reads it
	 * to find the section that owns a shell outside the current one.
	 */
	private readonly boundSections = new Map<
		string,
		{
			sectionId: string;
			attemptId: string | undefined;
			renderableIds: ReadonlySet<string> | null;
		}
	>();

	/**
	 * Tracks which `(canonicalItemId, contentKind)` pairs have already
	 * fired `handleContentLoaded` on this binding, so a section handoff can
	 * replay the persistent shells' loaded state into the new controller; see
	 * `replayRegisteredShellsIntoController`.
	 *
	 * Records loads of every registered shell, in or out of the current
	 * section, so a shell registered ahead of its section's controller is
	 * replayed as loaded. A key is dropped when its last shell unregisters,
	 * and on `dispose`.
	 */
	private readonly loadedRenderableKeys = new Set<string>();

	async initialize(args: SectionControllerBindingInitArgs): Promise<void> {
		this.activeInitToken += 1;
		const token = this.activeInitToken;
		this.coordinator = args.coordinator;
		this.sectionId = args.sectionId;
		this.attemptId = args.attemptId;
		// Before the coordinator re-activates a cached controller and replays its
		// loaded state to subscribers.
		this.forgetUnregisteredLoads(
			args.coordinator.getSectionController({
				sectionId: args.sectionId,
				attemptId: args.attemptId,
			}) as RuntimeController | undefined,
		);

		let resolved: RuntimeController;
		try {
			resolved = (await args.coordinator.getOrCreateSectionController({
				sectionId: args.sectionId,
				attemptId: args.attemptId,
				input: {
					section: args.section,
					sectionId: args.sectionId,
					assessmentId: args.assessmentId,
					view: args.view,
				},
				updateExisting: true,
				initialSession: args.initialSession,
				createDefaultController: args.createDefaultController,
			})) as RuntimeController;
		} catch (error) {
			// The previous section's controller must not keep serving the
			// section that failed to start.
			if (token === this.activeInitToken) {
				this.unsubscribeController?.();
				this.unsubscribeController = null;
				this.controller = null;
			}
			throw error;
		}

		if (token !== this.activeInitToken) return;
		this.unsubscribeController?.();
		this.controller = resolved;
		this.sectionRenderableIds = readRenderableIds(
			resolved.getCompositionModel?.(),
		);
		const sectionKey = this.getSectionKey(args.sectionId, args.attemptId);
		this.boundSections.delete(sectionKey);
		this.boundSections.set(sectionKey, {
			sectionId: args.sectionId,
			attemptId: args.attemptId,
			renderableIds: this.sectionRenderableIds,
		});
		// Every initialize re-feeds the registered shells of the resolved
		// controller's section, a same-section `updateInput` included: the
		// controller's register and load are idempotent, so a re-feed of shells
		// it already tracks changes nothing.
		this.replayRegisteredShellsIntoController(resolved);
		args.onCompositionChanged?.(resolved.getCompositionModel?.());
		this.unsubscribeController =
			resolved.subscribe?.((event) => {
				// Isolated deliberately: the controller's emit loop catches per
				// listener, so a diagnostic handler that throws would take the
				// composition republish down with it and every cue and Try would stop
				// reaching the cards — a failure with no symptom except a warning.
				try {
					args.onControllerEvent?.(event);
				} catch (error) {
					logger.warn("onControllerEvent handler threw", error);
				}
				args.onCompositionChanged?.(resolved.getCompositionModel?.());
			}) || null;
	}

	/**
	 * Re-feed the binding's `RuntimeRegistry` and loaded-set into the
	 * resolved controller, limited to the shells of its section (see
	 * `isSectionRenderable`). Runs on every `initialize`.
	 *
	 * Two-pass order — register every shell in document order, then
	 * issue `handleContentLoaded` for each shell whose load already
	 * fired on this binding. The two-pass shape prevents
	 * `evaluateSectionLoadingState` from flapping
	 * `section-loading-complete` `false→true→false→…` while replay is
	 * mid-walk: any subscriber wired before the binding's own
	 * `controller.subscribe` (no such caller today, but cheap defense
	 * for future wiring) sees one clean `false→true` transition.
	 *
	 * Idempotent on the controller side: `handleContentRegistered` and
	 * `handleContentLoaded` return early on duplicates, so re-feeding shells
	 * the controller already tracks emits nothing.
	 */
	private replayRegisteredShellsIntoController(
		controller: RuntimeController,
	): void {
		if (!controller.handleContentRegistered) return;
		const shells = this.registry
			.getOrderedShells()
			.filter((shell) => this.isSectionRenderable(shell));
		if (shells.length === 0) return;
		for (const shell of shells) {
			const canonicalItemId = shell.canonicalItemId || shell.itemId;
			controller.handleContentRegistered({
				itemId: shell.itemId,
				canonicalItemId,
				contentKind: shell.contentKind || shell.kind,
			});
		}
		const now = Date.now();
		for (const shell of shells) {
			const canonicalItemId = shell.canonicalItemId || shell.itemId;
			const key = this.getLoadedKey(canonicalItemId, shell.contentKind);
			if (this.loadedRenderableKeys.has(key)) {
				controller.handleContentLoaded?.({
					itemId: shell.itemId,
					canonicalItemId,
					contentKind: shell.contentKind || shell.kind,
					timestamp: now,
				});
			}
		}
	}

	/**
	 * Stable key for the binding's `loadedRenderableKeys` set. Mirrors
	 * the `(canonicalItemId, contentKind)` shape `SectionController`
	 * uses internally (see `getRenderableKey`); we only need
	 * consistent add/check semantics on this side, not byte-identical
	 * normalization with the controller.
	 */
	private getLoadedKey(
		canonicalItemId: string,
		contentKind: string | undefined,
	): string {
		return `${contentKind ?? ""}:${canonicalItemId}`;
	}

	/**
	 * Whether a shell renders one of the current section's renderables: its
	 * runtime or canonical id is among the composition model's renderable ids.
	 * An item in two sections belongs to both, so its shell carries over a
	 * switch the way a persistent passage shell does.
	 */
	private isSectionRenderable(args: {
		itemId: string;
		canonicalItemId?: string;
	}): boolean {
		const ids = this.sectionRenderableIds;
		if (!ids) return true;
		return (
			ids.has(args.itemId) ||
			(!!args.canonicalItemId && ids.has(args.canonicalItemId))
		);
	}

	private getSectionKey(sectionId: string, attemptId: string | undefined) {
		return `${sectionId}\u0000${attemptId ?? ""}`;
	}

	/**
	 * The controller a shell event belongs to: the current controller when the
	 * shell renders one of its section's renderables, otherwise the cached
	 * controller of the most recently bound section that renders it — the
	 * section being left, for an outgoing shell's teardown. `null` when no bound
	 * section renders the shell or its controller is gone.
	 */
	private controllerFor(args: {
		itemId: string;
		canonicalItemId?: string;
	}): RuntimeController | null {
		if (this.isSectionRenderable(args)) return this.controller;
		const current = this.getSectionKey(this.sectionId, this.attemptId);
		const sections = [...this.boundSections.entries()].reverse();
		for (const [key, section] of sections) {
			if (key === current || !section.renderableIds) continue;
			if (
				!section.renderableIds.has(args.itemId) &&
				!(args.canonicalItemId && section.renderableIds.has(args.canonicalItemId))
			) {
				continue;
			}
			const owner = this.coordinator?.getSectionController({
				sectionId: section.sectionId,
				attemptId: section.attemptId,
			}) as RuntimeController | undefined;
			if (owner) return owner;
		}
		return null;
	}

	/** `controllerFor`, warning when the event has nowhere to go. */
	private requireControllerFor(
		args: { itemId: string; canonicalItemId?: string },
		what: string,
	): RuntimeController | null {
		const controller = this.controllerFor(args);
		if (!controller) {
			logger.warn(
				`Dropped ${what} for "${args.itemId}": no section this toolkit bound renders it.`,
			);
		}
		return controller;
	}

	/**
	 * Forget, on a cached controller about to be re-bound, every load whose
	 * shell is no longer registered. A shell that unmounted while its section
	 * was not current told that section's controller through `controllerFor`;
	 * this covers one whose unregister never arrived.
	 */
	private forgetUnregisteredLoads(cached: RuntimeController | undefined): void {
		if (!cached || cached === this.controller) return;
		const loaded = cached.getRuntimeState?.()?.loadedRenderables ?? [];
		if (loaded.length === 0) return;
		const live = new Set<string>();
		for (const shell of this.registry.getOrderedShells()) {
			live.add(shell.itemId);
			if (shell.canonicalItemId) live.add(shell.canonicalItemId);
		}
		for (const renderable of loaded) {
			if (live.has(renderable.canonicalItemId) || live.has(renderable.itemId)) {
				continue;
			}
			cached.handleContentUnregistered?.({
				itemId: renderable.itemId,
				canonicalItemId: renderable.canonicalItemId,
				contentKind: renderable.contentKind,
			});
		}
	}

	register(detail: RuntimeRegistrationDetail): boolean {
		return this.registry.register(detail);
	}

	unregister(element: HTMLElement): boolean {
		return this.registry.unregister(element);
	}

	getCompositionModel(): unknown {
		return this.controller?.getCompositionModel?.() ?? null;
	}

	getCanonicalItemId(itemId: string): string {
		const map = this.registry.getCanonicalIdMap();
		return (
			map[itemId] || this.controller?.getCanonicalItemId?.(itemId) || itemId
		);
	}

	handleContentRegistered(detail: RuntimeRegistrationDetail): void {
		if (!this.isSectionRenderable(detail)) return;
		this.controller?.handleContentRegistered?.({
			itemId: detail.itemId,
			canonicalItemId: detail.canonicalItemId || detail.itemId,
			contentKind: detail.contentKind || detail.kind,
		});
	}

	/**
	 * Called after `unregister` removed the shell from the registry. While
	 * another registered shell renders the same renderable — the next
	 * section's shell for an item both sections hold — the renderable stays
	 * registered and loaded.
	 */
	handleContentUnregistered(detail: RuntimeRegistrationDetail): void {
		const canonicalItemId = detail.canonicalItemId || detail.itemId;
		// Key the load-set delete with the same `contentKind`-only
		// shape that `handleContentLoaded` and
		// `replayRegisteredShellsIntoController` use, so add/check/
		// delete keys round-trip identically. The `|| detail.kind`
		// fallback is preserved for the controller-forwarded payload
		// because the controller normalizes via `toSectionContentKind`
		// and the `kind` field remains meaningful there.
		const key = this.getLoadedKey(canonicalItemId, detail.contentKind);
		const stillRendered = this.registry
			.getOrderedShells()
			.some(
				(shell) =>
					this.getLoadedKey(
						shell.canonicalItemId || shell.itemId,
						shell.contentKind,
					) === key,
			);
		if (stillRendered) return;
		this.loadedRenderableKeys.delete(key);
		this.controllerFor(detail)?.handleContentUnregistered?.({
			itemId: detail.itemId,
			canonicalItemId,
			contentKind: detail.contentKind || detail.kind,
		});
	}

	handleContentLoaded(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
		timestamp?: number;
	}): void {
		const canonicalItemId = args.canonicalItemId || args.itemId;
		this.loadedRenderableKeys.add(
			this.getLoadedKey(canonicalItemId, args.contentKind),
		);
		if (!this.isSectionRenderable(args)) return;
		this.controller?.handleContentLoaded?.(args);
	}

	handleItemPlayerError(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
		timestamp?: number;
	}): void {
		this.requireControllerFor(args, "an item player error")?.handleItemPlayerError?.(
			args,
		);
	}

	reportSectionError(args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}): void {
		const controller = args.itemId
			? this.requireControllerFor(
					{ itemId: args.itemId, canonicalItemId: args.canonicalItemId },
					"a section error",
				)
			: this.controller;
		controller?.reportSectionError?.(args);
	}

	updateItemSession(itemId: string, session: unknown): unknown {
		const canonicalId = this.getCanonicalItemId(itemId);
		const controller = this.requireControllerFor(
			{ itemId, canonicalItemId: canonicalId },
			"a session update",
		);
		return controller?.updateItemSession?.(canonicalId, session) ?? null;
	}

	navigateToItem(index: number): unknown {
		return this.controller?.navigateToItem?.(index) ?? null;
	}

	/**
	 * Route a learner's formative action to the controller.
	 *
	 * Canonicalized here for the same reason `updateItemSession` is: the runtime
	 * id a card dispatches with is not necessarily the identifier the controller
	 * keys state by. Both ids are kept, since the composition's renderables are
	 * keyed by the runtime one.
	 */
	handleFormativeAction(action: SectionRuntimeFormativeAction): void {
		if (!action?.itemId) return;
		const canonicalId =
			action.canonicalItemId || this.getCanonicalItemId(action.itemId);
		const controller = this.requireControllerFor(
			{ itemId: action.itemId, canonicalItemId: canonicalId },
			"a formative action",
		);
		if (action.action === "retry") {
			controller?.retryFormativeItem?.({ itemId: canonicalId });
			return;
		}
		controller?.recordFormativeTry?.({
			itemId: canonicalId,
			outcomes: action.outcomes,
		});
	}

	/**
	 * Bind or release the section's Media Time Source.
	 *
	 * A pass-through, like `handleFormativeAction`: the binding routes, the
	 * controller decides. `renderableId` travels with the attach because whether the
	 * registering renderable is the one `stimulusRef` names is the controller's call
	 * — it validated `stimulusRef` in the first place.
	 */
	handleMediaTimeSource(action: SectionRuntimeMediaTimeSourceAction): void {
		if (!action?.renderableId) return;
		const controller = this.requireControllerFor(
			{
				itemId: action.renderableId,
				canonicalItemId: this.getCanonicalItemId(action.renderableId),
			},
			"a media time source",
		);
		if (action.action === "detach") {
			controller?.detachMediaTimeSource?.({
				origin: action.origin ?? "host",
			});
			return;
		}
		if (!action.source) return;
		controller?.attachMediaTimeSource?.(action.source, {
			origin: action.origin ?? "host",
			renderableId: action.renderableId,
		});
	}

	/**
	 * Silence media audio because something else is about to speak.
	 *
	 * A pass-through like `handleMediaTimeSource`, and for the same reason: which
	 * source is authoritative and whether it reports `canPause` are the controller's
	 * to know. Returns whether media audio is now silent, or `true` where there is
	 * no timed-media controller to ask — nothing is playing.
	 */
	requestMediaPauseForCompetingAudio(): boolean {
		return this.controller?.pauseMediaForCompetingAudio?.() ?? true;
	}

	async persist(): Promise<void> {
		await this.controller?.persist?.();
	}

	async hydrate(): Promise<void> {
		await this.controller?.hydrate?.();
	}

	getRegistry(): RuntimeRegistry {
		return this.registry;
	}

	/**
	 * Releases the binding and disposes the controller of every section it
	 * bound, so a coordinator the host passes or an outer toolkit lends keeps
	 * none of this toolkit's sections, and a later mount of one restores it from
	 * its session. The coordinator itself stays with its owner.
	 */
	async dispose(): Promise<void> {
		this.activeInitToken += 1;
		this.unsubscribeController?.();
		this.unsubscribeController = null;
		const coordinator = this.coordinator;
		if (coordinator) {
			for (const section of this.boundSections.values()) {
				await coordinator.disposeSectionController({
					sectionId: section.sectionId,
					attemptId: section.attemptId,
				});
			}
		}
		this.registry.clear();
		this.loadedRenderableKeys.clear();
		this.boundSections.clear();
		this.controller = null;
		this.sectionRenderableIds = null;
		this.coordinator = null;
	}
}
