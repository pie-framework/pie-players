import type {
	FormativeFeedbackReveal,
	FormativeMasteryRollup,
	FormativeSectionProjection,
	FormativeTryOutcome,
} from "@pie-players/pie-players-shared/formative";
import type {
	MediaTimeSource,
	TimedMediaDegradation,
	TimedMediaSectionProjection,
	TimedMediaValidationError,
} from "@pie-players/pie-players-shared/timed-media";
import type { SectionControllerSessionState } from "@pie-players/pie-players-shared/types";

/**
 * Re-exported so every existing import site keeps its specifier. The shape is
 * canonical in `@pie-players/pie-players-shared/types`, beside
 * `AssessmentSection` and the delivery slices it carries.
 */
export type { SectionControllerSessionState };

export interface SectionControllerKey {
	assessmentId: string;
	sectionId: string;
	attemptId?: string;
}

export interface SectionControllerContext {
	key: SectionControllerKey;
	coordinator: unknown;
	input?: unknown;
}

export interface SectionSessionPersistenceStrategy {
	loadSession(
		context: SectionControllerContext,
	):
		| SectionControllerSessionState
		| null
		| Promise<SectionControllerSessionState | null>;
	saveSession(
		context: SectionControllerContext,
		session: SectionControllerSessionState | null,
	): void | Promise<void>;
	clearSession?(context: SectionControllerContext): void | Promise<void>;
}

export interface SectionSessionPersistenceConfig {
	context: SectionControllerContext;
	strategy: SectionSessionPersistenceStrategy;
}

export interface SectionControllerApplySessionOptions {
	/**
	 * applySession contract:
	 * - Preferred input is the output of getSession().
	 * - itemSessions may contain canonical attempt entries
	 *   ({ itemIdentifier, session, isCompleted }) or raw session payloads
	 *   ({ id, data, ... }); controller normalizes these before applying.
	 */
	mode?: "replace" | "merge";
}

export interface SectionControllerLoadedRenderable {
	itemId: string;
	canonicalItemId: string;
	contentKind: "item" | "passage" | "rubric" | "unknown";
}

export interface SectionControllerRuntimeState {
	sectionId: string;
	sectionIdentifier?: string;
	currentItemIndex: number;
	currentItemId: string;
	itemIdentifiers: string[];
	visitedItemIdentifiers: string[];
	itemSessions: Record<string, unknown>;
	loadingComplete: boolean;
	totalRegistered: number;
	totalLoaded: number;
	itemsComplete: boolean;
	completedCount: number;
	totalItems: number;
	/**
	 * Renderables (items, passages, rubrics) that have completed loading.
	 *
	 * Optional so synthetic test harnesses constructing a runtime state by
	 * hand can omit it; production `SectionController.getRuntimeState` always
	 * supplies it, which lets `ToolkitCoordinator` replay
	 * `content-loaded` events to subscribers that attach after a renderable
	 * has finished loading (e.g. cohort transitions in the assessment
	 * runtime).
	 *
	 * Order is registration order, matching the order in which `content-loaded`
	 * fires live; coordinator replay walks this list in-order so late
	 * subscribers observe the same sequence a live subscriber would have seen.
	 */
	loadedRenderables?: ReadonlyArray<SectionControllerLoadedRenderable>;
}

type SectionControllerEventBase = {
	timestamp: number;
};

export type SectionControllerItemSessionDataChangedEvent =
	SectionControllerEventBase & {
		type: "item-session-data-changed";
		itemId: string;
		canonicalItemId: string;
		session: unknown;
		intent?: string;
		complete?: boolean;
		component?: string;
		currentItemIndex: number;
	};

export type SectionControllerItemSessionMetaChangedEvent =
	SectionControllerEventBase & {
		type: "item-session-meta-changed";
		itemId: string;
		canonicalItemId: string;
		complete?: boolean;
		component?: string;
		currentItemIndex: number;
	};

export type SectionControllerItemSelectedEvent = SectionControllerEventBase & {
	type: "item-selected";
	previousItemId: string;
	currentItemId: string;
	itemIndex: number;
	totalItems: number;
	currentItemIndex: number;
};

export type SectionControllerSectionNavigationChangedEvent =
	SectionControllerEventBase & {
		type: "section-navigation-change";
		previousSectionId?: string;
		currentSectionId?: string;
		attemptId?: string;
		reason?: "input-change" | "runtime-transition";
	};

export type SectionControllerSectionSessionAppliedEvent =
	SectionControllerEventBase & {
		type: "section-session-applied";
		mode: "replace" | "merge";
		itemSessionCount: number;
		replay: boolean;
		currentItemIndex: number;
	};

export type SectionControllerContentLoadedEvent = SectionControllerEventBase & {
	type: "content-loaded";
	contentKind: "item" | "passage" | "rubric" | "unknown";
	itemId: string;
	canonicalItemId: string;
	detail?: unknown;
	currentItemIndex: number;
};

export type SectionControllerItemPlayerErrorEvent =
	SectionControllerEventBase & {
		type: "item-player-error";
		contentKind: "item" | "passage" | "rubric" | "unknown";
		itemId: string;
		canonicalItemId: string;
		error: unknown;
		currentItemIndex: number;
	};

export type SectionControllerItemCompleteChangedEvent =
	SectionControllerEventBase & {
		type: "item-complete-changed";
		itemId: string;
		canonicalItemId: string;
		complete: boolean;
		previousComplete: boolean;
		currentItemIndex: number;
	};

export type SectionControllerSectionLoadingCompleteEvent =
	SectionControllerEventBase & {
		type: "section-loading-complete";
		totalRegistered: number;
		totalLoaded: number;
		currentItemIndex: number;
	};

export type SectionControllerSectionItemsCompleteChangedEvent =
	SectionControllerEventBase & {
		type: "section-items-complete-changed";
		complete: boolean;
		completedCount: number;
		totalItems: number;
		currentItemIndex: number;
	};

export type SectionControllerSectionErrorEvent = SectionControllerEventBase & {
	type: "section-error";
	source: "item-player" | "section-runtime" | "toolkit" | "controller";
	error: unknown;
	itemId?: string;
	canonicalItemId?: string;
	contentKind?: "item" | "passage" | "rubric" | "unknown";
	currentItemIndex: number;
};

export type SectionControllerFormativeTryRecordedEvent =
	SectionControllerEventBase & {
		type: "formative-try-recorded";
		itemId: string;
		canonicalItemId: string;
		tryCount: number;
		outcome: FormativeTryOutcome;
		/** Whether feedback is now on screen for this item. */
		revealed: boolean;
		currentItemIndex: number;
	};

/**
 * The reveal state changed without a Try being recorded: a learner dismissed
 * feedback to edit again, or a host forced a reveal or withdrew one.
 *
 * A Try that reveals reports through `formative-try-recorded`, which carries its
 * own `revealed`. This event is for every other transition.
 */
export type SectionControllerFormativeRevealChangedEvent =
	SectionControllerEventBase & {
		type: "formative-reveal-changed";
		itemId: string;
		canonicalItemId: string;
		revealed: boolean;
		/** Reveal level in force, when a host overrode the policy's. */
		feedback?: FormativeFeedbackReveal;
		/** Tries already spent; none of these transitions consume one. */
		tryCount: number;
		source: "learner" | "host";
		currentItemIndex: number;
	};

export type SectionControllerSectionMasteryChangedEvent =
	SectionControllerEventBase & {
		type: "section-mastery-changed";
		mastery: FormativeMasteryRollup;
		currentItemIndex: number;
	};

/**
 * Cue state changed: a cue activated, a gate released, or the section's
 * aggregate completion flipped.
 *
 * Deliberately not emitted for media position. A `timeupdate` fires about four
 * times a second and moves nothing a layout renders — the media element draws its
 * own clock — so position is recorded in the session slice and reported here only
 * through the cue transitions it caused.
 */
export type SectionControllerTimedMediaCueChangedEvent =
	SectionControllerEventBase & {
		type: "timed-media-cue-changed";
		/** The cue that activated in this transition, where one did. */
		activatedCueIdentifier?: string;
		/** The gate that released in this transition, where one did. */
		releasedCueIdentifier?: string;
		activeCueIdentifier?: string;
		visitedCueIdentifiers: string[];
		completedCueIdentifiers: string[];
		/** Canonical ids of every item a visited cue has revealed. */
		revealedItemIds: string[];
		/** The gate holding playback, or `null`. */
		gateCueIdentifier: string | null;
		mediaCompleted: boolean;
		aggregateComplete: boolean;
		currentItemIndex: number;
	};

/**
 * A playback policy the attached media time source cannot carry out, reported so
 * the gap is visible rather than silent. Cues still fire and state is still
 * recorded; only enforcement is lost.
 */
export type SectionControllerTimedMediaPolicyDegradedEvent =
	SectionControllerEventBase & {
		type: "timed-media-policy-degraded";
		degradations: TimedMediaDegradation[];
		currentItemIndex: number;
	};

/**
 * Authored `timedMedia` this section cannot deliver — an unresolvable
 * `stimulusRef`, a cue naming an item the section does not hold, a gate on
 * correctness with no `onUnknownCorrectness`. The section still renders, as an
 * ordinary section with every item visible, because cues that silently never fire
 * is the failure mode this contract exists to avoid.
 */
export type SectionControllerTimedMediaInvalidEvent =
	SectionControllerEventBase & {
		type: "timed-media-invalid";
		errors: TimedMediaValidationError[];
		currentItemIndex: number;
	};

export type SectionControllerEvent =
	| SectionControllerItemSessionDataChangedEvent
	| SectionControllerItemSessionMetaChangedEvent
	| SectionControllerItemSelectedEvent
	| SectionControllerSectionNavigationChangedEvent
	| SectionControllerSectionSessionAppliedEvent
	| SectionControllerContentLoadedEvent
	| SectionControllerItemPlayerErrorEvent
	| SectionControllerItemCompleteChangedEvent
	| SectionControllerSectionLoadingCompleteEvent
	| SectionControllerSectionItemsCompleteChangedEvent
	| SectionControllerSectionErrorEvent
	| SectionControllerFormativeTryRecordedEvent
	| SectionControllerFormativeRevealChangedEvent
	| SectionControllerSectionMasteryChangedEvent
	| SectionControllerTimedMediaCueChangedEvent
	| SectionControllerTimedMediaPolicyDegradedEvent
	| SectionControllerTimedMediaInvalidEvent;

export type SectionControllerEventType = SectionControllerEvent["type"];

/**
 * Host-facing controller for a single section cohort.
 *
 * `SectionControllerHandle` is the primary API surface a host application
 * uses after the toolkit signals readiness (typically the `toolkit-ready`
 * DOM event followed by the first
 * `coordinator.getOrCreateSectionController(...)` resolve, or the convenience
 * `host.waitForSectionController(timeoutMs)` helper exposed by
 * `<pie-section-player*>`).
 *
 * The interface is the contract; the production implementation lives in
 * `packages/section-player/src/controllers/SectionController.ts`. Every
 * member is optional so the toolkit can call into older or partial
 * implementations defensively, but the production controller implements
 * all of them.
 *
 * Typical lifecycle for a host:
 *
 * ```ts
 * const controller = await host.waitForSectionController(5000);
 * controller?.configureSessionPersistence?.({ context, strategy });
 * await controller?.hydrate?.();
 * const unsubscribe = controller?.subscribe?.(handleEvent);
 * // ...later, on save / unload:
 * await controller?.persist?.();
 * unsubscribe?.();
 * ```
 */
export interface SectionControllerHandle {
	/**
	 * Bootstrap the controller from composition input (section, view,
	 * adapter item refs, etc.).
	 *
	 * Called by the section runtime when the section first mounts. Hosts
	 * normally do not call this directly — the section player owns the
	 * input shape and forwards it.
	 */
	initialize?(input?: unknown): void | Promise<void>;
	/**
	 * Refresh composition input on a same-cohort change (PnP toggle,
	 * prompt edit, accommodation flip, etc.) without resetting in-memory
	 * session state.
	 *
	 * Treated as same-cohort when the section identity (`sectionId` /
	 * `section.identifier`) is unchanged; cross-cohort changes are
	 * handled by the coordinator creating a new controller instead.
	 */
	updateInput?(input?: unknown): void | Promise<void>;
	/**
	 * Load and apply a previously persisted session via the strategy
	 * registered through `configureSessionPersistence(...)`.
	 *
	 * No-op if no persistence strategy is configured or the strategy
	 * returns no snapshot. Internally calls `applySession(snapshot,
	 * { mode: "replace" })`.
	 */
	hydrate?(): void | Promise<void>;
	/**
	 * Save the current session via the registered persistence strategy.
	 *
	 * Hosts call this on whatever cadence they choose (debounced on
	 * change, on visibility change, on submit, etc.). No-op if no
	 * strategy is configured.
	 */
	persist?(): void | Promise<void>;
	/**
	 * Release listeners and lifecycle tracking. Called by the coordinator
	 * when the controller's section cohort is being torn down. Hosts
	 * usually do not call this directly.
	 */
	dispose?(): void | Promise<void>;
	/**
	 * Subscribe to the controller's typed event stream
	 * (`SectionControllerEvent` discriminated union: `item-selected`,
	 * `item-session-data-changed`, `content-loaded`,
	 * `section-loading-complete`, `section-navigation-change`, etc.).
	 *
	 * Returns a disposer. The coordinator's
	 * `subscribeSectionEvents` / `subscribeItemEvents` /
	 * `subscribeSectionLifecycleEvents` helpers wrap this with
	 * cohort-aware filtering and event-type defaults; hosts typically
	 * use those instead of subscribing directly.
	 */
	subscribe?(listener: (event: SectionControllerEvent) => void): () => void;
	/**
	 * Return a live snapshot of section-scoped runtime state — current
	 * item, visited items, item sessions, loading + completion progress,
	 * loaded renderables.
	 *
	 * Intended for runtime introspection (debug panels, diagnostics).
	 * Use `getSession()` for the host-facing persistence shape.
	 */
	getRuntimeState?(): SectionControllerRuntimeState | null;
	/**
	 * Return the host-facing persistence snapshot
	 * (`SectionControllerSessionState`).
	 *
	 * This is the compact shape designed for serializing / restoring
	 * across reloads — `currentItemIndex`, `visitedItemIdentifiers`, and
	 * the item sessions map. The same shape is what
	 * `SectionSessionPersistenceStrategy.saveSession` receives.
	 */
	getSession?(): SectionControllerSessionState | null;
	/**
	 * Restore session state into the controller, replacing or merging
	 * the in-memory state.
	 *
	 * - `mode: "replace"` (default for `hydrate()`): clear and apply.
	 * - `mode: "merge"`: overlay onto existing state per item.
	 *
	 * Accepts the output of `getSession()` directly. Item sessions may
	 * be canonical attempt entries or raw session payloads — the
	 * controller normalizes both.
	 */
	applySession?(
		session: SectionControllerSessionState | null,
		options?: SectionControllerApplySessionOptions,
	): void | Promise<void>;
	/**
	 * Apply a single item's session detail into the in-memory section
	 * session, emitting the appropriate item-session event
	 * (`item-session-data-changed` for response data,
	 * `item-session-meta-changed` for metadata-only updates) so other
	 * subscribers and the persistence strategy (on the next `persist()`)
	 * see the update.
	 *
	 * Used for fine-grained host updates that should not require a full
	 * `applySession(...)` round-trip.
	 */
	updateItemSession?(
		itemId: string,
		sessionDetail: unknown,
	): unknown | Promise<unknown>;
	/**
	 * Register the persistence context and strategy used by `hydrate()`
	 * and `persist()`.
	 *
	 * Hosts typically call this once, immediately after obtaining the
	 * handle, before invoking `hydrate()`. The same
	 * `SectionControllerSessionState` shape returned by `getSession()`
	 * is what the strategy load/save methods exchange.
	 */
	configureSessionPersistence?(
		config: SectionSessionPersistenceConfig,
	): void | Promise<void>;
	/**
	 * Record one Try for an item: derive correctness from the element outcomes,
	 * increment the Try count, and reveal feedback if the item's resolved
	 * formative policy says so.
	 *
	 * `outcomes` is what `pie-item-player.provideScore()` returned. The caller
	 * does not interpret it — correctness derivation belongs to the controller so
	 * one aggregation policy applies everywhere.
	 *
	 * No-op when the item's policy is disabled, when feedback is already
	 * revealed, or when Tries are spent, which makes a double submit safe.
	 */
	recordFormativeTry?(args: { itemId: string; outcomes?: unknown[] }): void;
	/**
	 * Dismiss a revealed item's feedback and reopen it for editing. Withdrawing
	 * the reveal is what withdraws the `mode: "evaluate"` projection.
	 *
	 * The learner action, so it respects the Try budget: no-op when nothing is
	 * revealed or Tries are spent. Use `hideFormativeItem` for host authority.
	 */
	retryFormativeItem?(args: { itemId: string }): void;
	/**
	 * Reveal an item on host authority — a teacher-driven "show the answer".
	 *
	 * Spends no Try and ignores the Try budget and `revealOn`, none of which bound
	 * a decision the host has already taken. Works on an item with no Try yet.
	 *
	 * `feedback` is stated rather than taken from the policy, because a reveal
	 * under `feedback: "none"` would project nothing.
	 */
	revealFormativeItem?(args: {
		itemId: string;
		feedback: "correctness" | "solution";
	}): void;
	/**
	 * Withdraw a reveal on host authority. Unlike `retryFormativeItem` this
	 * ignores the Try budget, so a host that revealed a spent item can put it
	 * back.
	 */
	hideFormativeItem?(args: { itemId: string }): void;
	/**
	 * The section's formative projection — resolved policies, per-item state, and
	 * the mastery rollup.
	 *
	 * `null` when no item in the section delivers formatively. The same
	 * projection rides on the composition model, so layouts normally read it from
	 * there rather than calling this.
	 */
	getFormativeProjection?(): FormativeSectionProjection | null;
	/**
	 * Bind the section's Media Time Source — the only way it reaches media.
	 *
	 * Called by the stimulus card once it has a media element to adapt, and
	 * callable directly by a host that supplies its own port: a third-party embed,
	 * a remote-controlled player, anything that can report time. That is the point
	 * of the port. Attaching replaces any previous source.
	 *
	 * The port declares `canPause` / `canRestrictSeeking`; where a capability is
	 * missing the matching policy degrades to advisory and the controller emits
	 * `timed-media-policy-degraded` rather than appearing to enforce.
	 *
	 * No-op on a section that carries no valid `timedMedia`.
	 */
	attachMediaTimeSource?(
		source: MediaTimeSource,
		options?: {
			/**
			 * `"native-adapter"` marks the stimulus card's own discovery, which never
			 * displaces a source a host attached explicitly.
			 */
			origin?: "native-adapter" | "host";
			/**
			 * The renderable the source was found in. Checked against the renderable
			 * `stimulusRef` resolved to, so a second video passage's adapter cannot
			 * drive the timeline. Omitted by a host attaching its own port, which names
			 * no renderable and is taken at its word.
			 */
			renderableId?: string;
		},
	): void;
	/**
	 * Release the current source. Cue state is kept; nothing advances it.
	 *
	 * A `"native-adapter"` detach is ignored while a host-attached source is live:
	 * the stimulus card tears its adapter down whenever its content re-renders, and
	 * that must not take a host's own player with it.
	 */
	detachMediaTimeSource?(options?: {
		origin?: "native-adapter" | "host";
	}): void;
	/**
	 * The section's timed-media projection — cues, enforcement, revealed items and
	 * the gate currently holding playback.
	 *
	 * `null` when the section is not timed media or its `timedMedia` failed
	 * validation. The same projection rides on the composition model, so layouts
	 * read it from there rather than calling this.
	 */
	getTimedMediaProjection?(): TimedMediaSectionProjection | null;
}

export interface SectionControllerFactoryDefaults {
	createDefaultController: () =>
		| SectionControllerHandle
		| Promise<SectionControllerHandle>;
}

export interface SectionPersistenceFactoryDefaults {
	createDefaultPersistence: () =>
		| SectionSessionPersistenceStrategy
		| Promise<SectionSessionPersistenceStrategy>;
}
