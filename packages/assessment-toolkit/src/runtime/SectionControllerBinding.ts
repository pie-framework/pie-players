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
 * stay registered until they unmount, and a removed shell's `pie-unregister`
 * does not reach the toolkit. A controller therefore hears about a shell, in
 * replay or live, only when the shell renders one of its section's
 * renderables; see `isSectionRenderable`.
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
	 * Tracks which `(canonicalItemId, contentKind)` pairs have already
	 * fired `handleContentLoaded` on this binding. Mirrored alongside
	 * `RuntimeRegistry`'s registered set so a cohort handoff can
	 * replay the persistent shells' loaded state into the new
	 * controller — see `replayRegisteredShellsIntoController` and the
	 * PIE-512 Phase B regression test.
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

		const resolved = (await args.coordinator.getOrCreateSectionController({
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

		if (token !== this.activeInitToken) return;
		this.unsubscribeController?.();
		this.controller = resolved;
		this.sectionRenderableIds = readRenderableIds(
			resolved.getCompositionModel?.(),
		);
		// PIE-512 Phase C: always re-feed the registry's currently
		// registered shells (and their loaded state) into the resolved
		// controller. We do NOT gate on `resolved !== previousController`
		// any more.
		//
		// Why the gate had to go:
		//   - Cohort flip resolving to a fresh controller — replay seeds
		//     the new controller, which is the original Phase B fix.
		//   - Same-cohort `updateInput` resolving to the existing
		//     controller — the coordinator's
		//     `resolveExistingSectionController` calls
		//     `existingController.updateInput(input)` (the binding always
		//     passes `updateExisting: true`), and pre-Phase-C
		//     `SectionController.initialize` wiped lifecycle tracking
		//     unconditionally. A subscriber attaching between the wipe
		//     and the next live event saw an empty
		//     `loadedRenderables` snapshot.
		//
		// Phase C makes this re-feed safe by combining (a) the
		// section-identity gate around `resetLifecycleTracking()` in
		// `SectionController.initialize` (so same-cohort `updateInput`
		// preserves tracking) with (b) idempotent
		// `handleContentRegistered` / `handleContentLoaded` on the
		// controller (so re-feeding the same registry entries is a
		// no-op if the controller already knows about them, but
		// re-seeds the controller in the post-`updateInput`-wipe case
		// that pre-Phase-C used to encounter).
		//
		// The replay carries only the shells of the resolved controller's
		// section. On a switch the registry still holds the previous section's
		// shells, and replaying them reported that section's items as loaded
		// in the new one.
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
	 * `isSectionRenderable`). Call site: `initialize(...)` — runs on
	 * EVERY initialize, both cohort-flip-resolves-fresh-controller
	 * and same-cohort-resolves-existing-controller cases. Phase C
	 * dropped the `resolved !== previousController` gate; see the
	 * comment at the call site for why.
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
	 * Idempotent on the controller side — Phase C makes
	 * `SectionController.handleContentRegistered` and
	 * `handleContentLoaded` early-return on duplicates so re-feeding
	 * the same shells into a controller that already tracks them is
	 * a true no-op (no spurious re-emits, no re-evaluation of
	 * `section-loading-complete`). At the call site no listener is
	 * attached during the replay window, so `emitChange` side effects
	 * fire into a void on this pass anyway, but the controller-side
	 * idempotence is what makes the replay safe to run on every
	 * initialize regardless of whether the controller is fresh.
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
		if (!this.isSectionRenderable(detail)) return;
		this.controller?.handleContentUnregistered?.({
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
		this.controller?.handleItemPlayerError?.(args);
	}

	reportSectionError(args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}): void {
		this.controller?.reportSectionError?.(args);
	}

	updateItemSession(itemId: string, session: unknown): unknown {
		const canonicalId = this.getCanonicalItemId(itemId);
		return this.controller?.updateItemSession?.(canonicalId, session) ?? null;
	}

	navigateToItem(index: number): unknown {
		return this.controller?.navigateToItem?.(index) ?? null;
	}

	/**
	 * Route a learner's formative action to the controller.
	 *
	 * Canonicalized here for the same reason `updateItemSession` is: the runtime
	 * id a card dispatches with is not necessarily the identifier the controller
	 * keys state by.
	 */
	handleFormativeAction(action: SectionRuntimeFormativeAction): void {
		if (!action?.itemId) return;
		const canonicalId = this.getCanonicalItemId(action.itemId);
		if (action.action === "retry") {
			this.controller?.retryFormativeItem?.({ itemId: canonicalId });
			return;
		}
		this.controller?.recordFormativeTry?.({
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
		if (action?.action === "detach") {
			this.controller?.detachMediaTimeSource?.({
				origin: action.origin ?? "host",
			});
			return;
		}
		if (!action?.source) return;
		this.controller?.attachMediaTimeSource?.(action.source, {
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

	async dispose(): Promise<void> {
		this.activeInitToken += 1;
		this.unsubscribeController?.();
		this.unsubscribeController = null;
		if (this.coordinator && this.sectionId) {
			await this.coordinator.disposeSectionController({
				sectionId: this.sectionId,
				attemptId: this.attemptId,
			});
		}
		this.registry.clear();
		this.loadedRenderableKeys.clear();
		this.controller = null;
		this.sectionRenderableIds = null;
		this.coordinator = null;
	}
}
