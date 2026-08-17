import type { TestAttemptSession } from "@pie-players/pie-assessment-toolkit";
import { toItemSessionsRecord } from "@pie-players/pie-assessment-toolkit";
import {
	createPieLogger,
	isGlobalDebugEnabled,
} from "@pie-players/pie-players-shared";
import {
	aggregateFormativeOutcome,
	isFormativeSectionEnabled,
	normalizeFormativeSectionSlice,
	recordFormativeTry,
	resolveFormativePolicies,
	retryFormativeItem,
	revealFormativeItem,
	hideFormativeItem,
	rollupFormativeMastery,
	toFormativeSectionSlice,
	type FormativeCorrectness,
	type FormativeItemState,
	type FormativeMasteryRollup,
	type FormativeScoredOutcome,
	type FormativeSectionProjection,
	type ResolvedFormativePolicy,
} from "@pie-players/pie-players-shared/formative";
import {
	createTimedMediaState,
	normalizeTimedMediaSectionData,
	normalizeTimedMediaSectionSlice,
	reduceTimedMediaState,
	resolveTimedMediaProjection,
	toTimedMediaSectionSlice,
	type MediaTimeSource,
	type ResolvedTimedMediaSectionData,
	type TimedMediaEffects,
	type TimedMediaDeliveryState,
	type TimedMediaSectionProjection,
	type TimedMediaSectionSessionSlice,
	type TimedMediaValidationError,
} from "@pie-players/pie-players-shared/timed-media";
import type {
	SectionControllerHandle,
	SectionSessionPersistenceConfig,
} from "./toolkit-section-contracts.js";
import type { ItemEntity } from "@pie-players/pie-players-shared";
import { SectionContentService } from "./SectionContentService.js";
import { SectionItemNavigationService } from "./SectionItemNavigationService.js";
import { SectionSessionService } from "./SectionSessionService.js";
import type {
	ContentLoadedEvent,
	TimedMediaCueChangedEvent,
	TimedMediaInvalidEvent,
	TimedMediaPolicyDegradedEvent,
	FormativeRevealChangedEvent,
	FormativeTryRecordedEvent,
	SectionMasteryChangedEvent,
	ItemCompleteChangedEvent,
	ItemPlayerErrorEvent,
	ItemSelectedEvent,
	ItemSessionDataChangedEvent,
	ItemSessionMetaChangedEvent,
	NavigationResult,
	SectionContentKind,
	SectionCanonicalItemViewModel,
	SectionControllerChangeEvent,
	SectionControllerChangeListener,
	SectionCompositionModel,
	SectionNavigationChangeEvent,
	SectionAttemptSessionSlice,
	SectionControllerInput,
	SectionNavigationState,
	SectionErrorEvent,
	SectionItemsCompleteChangedEvent,
	SectionLoadingCompleteEvent,
	SectionSessionAppliedEvent,
	SectionViewModel,
	SessionChangedResult,
} from "./types.js";
import type {
	SectionControllerRuntimeState,
	SectionControllerSessionState,
} from "./toolkit-section-contracts.js";

interface SectionControllerState {
	input: SectionControllerInput | null;
	viewModel: SectionViewModel;
	testAttemptSession: TestAttemptSession | null;
}

interface TrackedRenderable {
	itemId: string;
	canonicalItemId: string;
	contentKind: SectionContentKind;
}

interface PendingApplyReplay {
	revision: number;
	mode: "replace" | "merge";
	session: SectionControllerSessionState;
}

interface NormalizedApplySession {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: TestAttemptSession["itemSessions"];
	itemSessionCount: number;
	/**
	 * `null` when the incoming snapshot carried no readable formative slice —
	 * absent, or a version this build rejects. Distinguished from an empty record
	 * so `replace` can clear state while `merge` leaves it alone.
	 */
	formativeStates: Record<string, FormativeItemState> | null;
	/**
	 * `null` when the snapshot carried no readable timed-media slice. Same
	 * replace-clears / merge-leaves-alone distinction as `formativeStates`.
	 */
	timedMediaState: TimedMediaSectionSessionSlice | null;
}

const logger = createPieLogger("section-controller", () =>
	isGlobalDebugEnabled(),
);

export class SectionController implements SectionControllerHandle {
	// SectionController intentionally owns aggregate section state only.
	// Item-level controllers may share contracts, but are not composed here.
	private readonly contentService = new SectionContentService();
	private readonly sessionService = new SectionSessionService();
	private readonly itemNavigationService = new SectionItemNavigationService();
	private sessionPersistence: SectionSessionPersistenceConfig | null = null;
	private state: SectionControllerState = {
		input: null,
		viewModel: {
			passages: [],
			items: [],
			rubricBlocks: [],
			instructions: [],
			renderables: [],
			adapterItemRefs: [],
			stimulusRenderableIdsByRef: {},
			currentItemIndex: 0,
			isPageMode: false,
		},
		testAttemptSession: null,
	};
	private readonly listeners = new Set<SectionControllerChangeListener>();
	private readonly trackedRenderables = new Map<string, TrackedRenderable>();
	private readonly loadedRenderableKeys = new Set<string>();
	private readonly itemCompletionByCanonicalId = new Map<string, boolean>();
	private sectionLoadingComplete = false;
	private totalRegistered = 0;
	private totalLoaded = 0;
	private sectionItemsComplete = false;
	private completedCount = 0;
	private totalItems = 0;
	private nextApplyRevision = 0;
	private lastReplayedApplyRevision = 0;
	private pendingApplyReplay: PendingApplyReplay | null = null;
	// Formative delivery. Both maps are keyed by canonical item id, the same key
	// `itemSessions` and `itemCompletionByCanonicalId` use, so one id addresses an
	// item's responses, its completion and its Try state.
	private formativePolicies: Record<string, ResolvedFormativePolicy> = {};
	private formativeStates: Record<string, FormativeItemState> = {};
	private formativeEnabled = false;
	private lastMasterySignature = "";
	// Timed media. `timedMediaData` is null for a section that is not timed media
	// and for one whose authored `timedMedia` failed validation — both deliver as
	// an ordinary section, and the second reports why.
	private timedMediaData: ResolvedTimedMediaSectionData | null = null;
	private timedMediaState: TimedMediaSectionSessionSlice = createTimedMediaState();
	private mediaTimeSource: MediaTimeSource | null = null;
	private mediaTimeSourceOrigin: "native-adapter" | "host" = "native-adapter";
	private unsubscribeMediaTimeSource: (() => void) | null = null;
	private lastTimedMediaSignature = "";
	private lastTimedMediaInvalidSignature = "";
	private reportedDegradationKeys = new Set<string>();

	private emitChange(event: SectionControllerChangeEvent): void {
		for (const listener of Array.from(this.listeners)) {
			try {
				listener(event);
			} catch (error) {
				logger.warn("listener failed", error);
			}
		}
	}

	public subscribe(listener: SectionControllerChangeListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	public async initialize(input?: unknown): Promise<void> {
		const typedInput = input as SectionControllerInput | undefined;
		if (!typedInput) return;
		const previousSectionId =
			this.state.input?.section?.identifier ||
			this.state.input?.sectionId ||
			undefined;

		const content = this.contentService.build(
			typedInput.section,
			typedInput.view,
		);
		const sessionState = this.sessionService.resolve({
			...typedInput,
			adapterItemRefs: content.adapterItemRefs,
		});
		const currentItemIndex =
			sessionState.testAttemptSession?.navigationState?.currentItemIndex ?? 0;

		this.state = {
			input: typedInput,
			viewModel: {
				...content,
				currentItemIndex,
				isPageMode:
					!!typedInput.section &&
					"keepTogether" in typedInput.section &&
					typedInput.section.keepTogether === true,
			},
			testAttemptSession: sessionState.testAttemptSession,
		};
		const currentSectionId =
			typedInput.section?.identifier || typedInput.sectionId || undefined;
		const sectionIdentityChanged = previousSectionId !== currentSectionId;
		// PIE-512 Phase C: only wipe lifecycle tracking when the section
		// identity actually changes. Same-cohort `updateInput` (the engine
		// always passes `updateExisting: true` and the coordinator always
		// forwards it on `resolveExistingSectionController`) refreshes
		// content + session state but must preserve already-tracked
		// renderables and the `loadedRenderableKeys` set — otherwise any
		// subscriber that attaches between the wipe and the engine's
		// shell replay sees an empty `runtimeState.loadedRenderables`
		// snapshot and zero replayed events. `bootstrapCompletionFromSessions`
		// still runs unconditionally because it just refreshes the
		// completion view from the latest session, which is exactly what
		// `updateInput` is for.
		//
		// Trade-off: if a same-section `updateInput` arrives with mutated
		// `assessmentItemRefs` (items added or removed under an unchanged
		// section identifier), `trackedRenderables` retains entries for
		// items no longer in the section until their DOM shells fire
		// `pie-unregister` and the engine forwards
		// `handleContentUnregistered`. That is the documented Phase C
		// stance: prefer momentarily-stale-but-non-empty over wrongly-empty
		// tracking, because a same-section `updateInput` is overwhelmingly
		// a content / session refresh (PnP toggle, prompt edit) rather than
		// a structural mutation.
		if (sectionIdentityChanged) {
			this.resetLifecycleTracking();
		}
		// Rebuilt on every initialize, including same-cohort `updateInput`: an
		// authoring edit or a host policy change should reach delivery, and Try
		// state survives it because it lives in a separate map.
		this.rebuildFormativePolicies();
		this.rebuildTimedMedia();
		this.bootstrapCompletionFromSessions();
		if (sectionIdentityChanged) {
			const sectionNavigationEvent: SectionNavigationChangeEvent = {
				type: "section-navigation-change",
				previousSectionId,
				currentSectionId,
				reason: "input-change",
				timestamp: Date.now(),
			};
			this.emitChange(sectionNavigationEvent);
		}
	}

	public async updateInput(input?: unknown): Promise<void> {
		const previousSession = this.getSession();
		await this.initialize(input);
		if (previousSession) {
			await this.applySession(previousSession, { mode: "replace" });
		}
	}

	public configureSessionPersistence(
		config: SectionSessionPersistenceConfig,
	): void {
		this.sessionPersistence = config;
	}

	public async hydrate(): Promise<void> {
		if (!this.sessionPersistence) return;
		const snapshot = await this.sessionPersistence.strategy.loadSession(
			this.sessionPersistence.context,
		);
		if (!snapshot) return;
		await this.applySession(snapshot, { mode: "replace" });
	}

	public async persist(): Promise<void> {
		if (!this.sessionPersistence) return;
		await this.sessionPersistence.strategy.saveSession(
			this.sessionPersistence.context,
			this.getSession(),
		);
	}

	public dispose(): void {
		this.detachMediaTimeSource();
		this.listeners.clear();
		this.resetLifecycleTracking();
		this.pendingApplyReplay = null;
		this.nextApplyRevision = 0;
		this.lastReplayedApplyRevision = 0;
	}

	public getViewModel(): SectionViewModel {
		return this.cloneForRead(this.state.viewModel);
	}

	public getCompositionModel(): SectionCompositionModel {
		const itemViewModels = this.getItemViewModels();
		return {
			section: this.state.input?.section || null,
			assessmentItemRefs: this.state.input?.section?.assessmentItemRefs || [],
			passages: this.state.viewModel.passages,
			items: this.state.viewModel.items,
			rubricBlocks: this.state.viewModel.rubricBlocks,
			instructions: this.state.viewModel.instructions,
			renderables: this.state.viewModel.renderables,
			currentItemIndex: this.state.viewModel.currentItemIndex,
			currentItem: this.getCurrentItem(),
			isPageMode: this.state.viewModel.isPageMode,
			itemSessionsByItemId: this.getItemSessionsByItemId(),
			testAttemptSession: this.getResolvedTestAttemptSession(),
			itemViewModels,
			formative: this.getFormativeProjection(),
			timedMedia: this.getTimedMediaProjection(),
		};
	}

	public getInstructions() {
		return this.cloneForRead(this.state.viewModel.instructions);
	}

	public getSectionLoadedEventDetail(): {
		sectionId: string;
		itemCount: number;
		passageCount: number;
		isPageMode: boolean;
	} {
		return {
			sectionId:
				this.state.input?.section?.identifier ||
				this.state.input?.sectionId ||
				"",
			itemCount: this.state.viewModel.items.length,
			passageCount: this.state.viewModel.passages.length,
			isPageMode: this.state.viewModel.isPageMode,
		};
	}

	public getResolvedItemSessions(): Record<string, any> {
		if (!this.state.testAttemptSession) return {};
		return toItemSessionsRecord(this.state.testAttemptSession) as Record<
			string,
			any
		>;
	}

	public getResolvedTestAttemptSession(): TestAttemptSession | null {
		return this.cloneForRead(this.state.testAttemptSession);
	}

	public getCanonicalItemId(itemId: string): string {
		if (!itemId) return itemId;
		const adapterMatch = this.state.viewModel.adapterItemRefs.find(
			(itemRef) => itemRef.item?.id === itemId,
		);
		return adapterMatch?.identifier || itemId;
	}

	private getItemViewModels(): SectionCanonicalItemViewModel[] {
		const itemSessionsByItemId = this.getItemSessionsByItemId();
		return this.state.viewModel.items.map((item, index) => {
			const itemId = item.id || "";
			const canonicalItemId = this.getCanonicalItemId(itemId);
			return {
				item,
				itemId,
				canonicalItemId,
				index,
				isCurrent: index === this.state.viewModel.currentItemIndex,
				session:
					itemSessionsByItemId[itemId] ?? itemSessionsByItemId[canonicalItemId],
			};
		});
	}

	public getItemSessionsByItemId(): Record<string, any> {
		const resolvedItemSessions = this.getResolvedItemSessions();
		const mapped = Object.fromEntries(
			this.state.viewModel.adapterItemRefs
				.map((itemRef) => {
					const itemId = itemRef.item?.id;
					if (!itemId) return null;
					const canonicalId = itemRef.identifier || itemId;
					return [
						itemId,
						resolvedItemSessions[canonicalId] ?? resolvedItemSessions[itemId],
					] as const;
				})
				.filter(
					(entry): entry is readonly [string, any] =>
						!!entry && typeof entry[0] === "string" && !!entry[0],
				),
		) as Record<string, any>;
		for (const [key, value] of Object.entries(resolvedItemSessions)) {
			if (!(key in mapped)) {
				mapped[key] = value;
			}
		}
		return mapped;
	}

	/**
	 * Host-facing persistence shape.
	 * Use this for serializing/restoring section session state across reloads.
	 * This is intentionally compact and not a full runtime diagnostics view.
	 */
	public getSession(): SectionControllerSessionState | null {
		if (!this.state.testAttemptSession) return null;
		const base = this.sessionService.toSessionState(
			this.state.testAttemptSession,
		);
		// Each slice is omitted entirely where its feature is off, so a section that
		// uses neither produces snapshots byte-identical to what this controller
		// produced before either contract.
		const withFormative = this.formativeEnabled
			? { ...base, formative: toFormativeSectionSlice(this.formativeStates) }
			: base;
		if (!this.timedMediaData) return withFormative;
		return {
			...withFormative,
			timedMedia: toTimedMediaSectionSlice(this.timedMediaState),
		};
	}

	// ------------------------------------------------------------------
	// Formative delivery
	// ------------------------------------------------------------------

	private rebuildFormativePolicies(): void {
		const sectionPolicy = this.state.input?.section?.formative ?? null;
		const items = this.state.viewModel.adapterItemRefs
			.map((itemRef) => ({
				identifier: itemRef.identifier || itemRef.item?.id || "",
				policy: itemRef.formative ?? null,
			}))
			.filter((entry) => !!entry.identifier);
		this.formativePolicies = resolveFormativePolicies({
			sectionPolicy,
			items,
		});
		this.formativeEnabled = isFormativeSectionEnabled(this.formativePolicies);
	}

	private computeMastery(): FormativeMasteryRollup {
		return rollupFormativeMastery({
			itemIdentifiers: this.getSectionItemIdentifiers(),
			states: this.formativeStates,
		});
	}

	public getFormativeProjection(): FormativeSectionProjection | null {
		if (!this.formativeEnabled) return null;
		return this.cloneForRead({
			version: 1 as const,
			enabled: true,
			policies: this.formativePolicies,
			states: this.formativeStates,
			mastery: this.computeMastery(),
		});
	}

	/**
	 * Record one Try from element outcomes.
	 *
	 * Correctness derivation lives here rather than at the call site so one
	 * aggregation policy applies to every caller. The reducer is a no-op when the
	 * item cannot currently be checked, which is what makes a double submit safe
	 * — a second click landing before the composition republishes is dropped
	 * rather than spending a Try.
	 */
	public recordFormativeTry(args: {
		itemId: string;
		outcomes?: unknown[];
	}): void {
		const canonicalItemId = this.getCanonicalItemId(args.itemId);
		const policy = this.formativePolicies[canonicalItemId];
		if (!policy?.enabled) return;
		const outcome = aggregateFormativeOutcome(
			(args.outcomes ?? []) as Array<FormativeScoredOutcome | undefined>,
		);
		const previous = this.formativeStates[canonicalItemId];
		const next = recordFormativeTry({
			state: previous,
			itemIdentifier: canonicalItemId,
			policy,
			outcome,
		});
		if (next === previous) return;
		this.formativeStates = { ...this.formativeStates, [canonicalItemId]: next };
		const timestamp = Date.now();
		const event: FormativeTryRecordedEvent = {
			type: "formative-try-recorded",
			itemId: args.itemId,
			canonicalItemId,
			tryCount: next.tryCount,
			outcome,
			revealed: next.revealed,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(event);
		this.emitMasteryIfChanged(timestamp);
		// A Try is one of the two things a cue gate reads, so a recorded Try is a
		// gate-release candidate.
		this.notifyTimedMediaDeliveryChanged();
	}

	/** Dismiss a reveal and reopen the item, withdrawing its env projection. */
	public retryFormativeItem(args: { itemId: string }): void {
		const canonicalItemId = this.getCanonicalItemId(args.itemId);
		const policy = this.formativePolicies[canonicalItemId];
		if (!policy?.enabled) return;
		const previous = this.formativeStates[canonicalItemId];
		const next = retryFormativeItem({ state: previous, policy });
		if (!next || next === previous) return;
		this.commitFormativeReveal({
			itemId: args.itemId,
			canonicalItemId,
			next,
			source: "learner",
		});
	}

	/**
	 * Reveal on host authority — a teacher-driven "show the answer". Spends no
	 * Try and ignores the Try budget.
	 */
	public revealFormativeItem(args: {
		itemId: string;
		feedback: "correctness" | "solution";
	}): void {
		const canonicalItemId = this.getCanonicalItemId(args.itemId);
		const policy = this.formativePolicies[canonicalItemId];
		if (!policy?.enabled) return;
		if (args.feedback !== "correctness" && args.feedback !== "solution") return;
		const previous = this.formativeStates[canonicalItemId];
		const next = revealFormativeItem({
			state: previous,
			itemIdentifier: canonicalItemId,
			policy,
			feedback: args.feedback,
		});
		if (next === previous) return;
		this.commitFormativeReveal({
			itemId: args.itemId,
			canonicalItemId,
			next,
			source: "host",
		});
	}

	/** Withdraw a reveal on host authority, Try budget notwithstanding. */
	public hideFormativeItem(args: { itemId: string }): void {
		const canonicalItemId = this.getCanonicalItemId(args.itemId);
		const policy = this.formativePolicies[canonicalItemId];
		if (!policy?.enabled) return;
		const previous = this.formativeStates[canonicalItemId];
		const next = hideFormativeItem({ state: previous, policy });
		if (!next || next === previous) return;
		this.commitFormativeReveal({
			itemId: args.itemId,
			canonicalItemId,
			next,
			source: "host",
		});
	}

	/**
	 * Store a reveal transition and announce it. Shared by the three callers so
	 * one event describes every reveal change a Try did not cause.
	 */
	private commitFormativeReveal(args: {
		itemId: string;
		canonicalItemId: string;
		next: FormativeItemState;
		source: "learner" | "host";
	}): void {
		this.formativeStates = {
			...this.formativeStates,
			[args.canonicalItemId]: args.next,
		};
		const event: FormativeRevealChangedEvent = {
			type: "formative-reveal-changed",
			itemId: args.itemId,
			canonicalItemId: args.canonicalItemId,
			revealed: args.next.revealed,
			feedback: args.next.revealOverride,
			tryCount: args.next.tryCount,
			source: args.source,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: Date.now(),
		};
		this.emitChange(event);
		// A host reveal or a learner retry does not change correctness, but a
		// released gate stays released, so this only ever re-checks — it cannot
		// re-trap a learner.
		this.notifyTimedMediaDeliveryChanged();
	}

	/**
	 * Emit only on a rollup change, matching how
	 * `section-items-complete-changed` gates on the aggregate rather than on
	 * every intermediate count.
	 */
	private emitMasteryIfChanged(timestamp: number): void {
		if (!this.formativeEnabled) return;
		const mastery = this.computeMastery();
		const signature = JSON.stringify(mastery);
		if (signature === this.lastMasterySignature) return;
		this.lastMasterySignature = signature;
		const event: SectionMasteryChangedEvent = {
			type: "section-mastery-changed",
			mastery,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(event);
	}

	private getSectionItemIdentifiers(): string[] {
		const fromRefs = this.state.viewModel.adapterItemRefs
			.map((itemRef) => itemRef.identifier || itemRef.item?.id)
			.filter((id): id is string => typeof id === "string" && !!id);
		if (fromRefs.length > 0) return fromRefs;
		return this.state.viewModel.items
			.map((item) => item.id)
			.filter((id): id is string => typeof id === "string" && !!id);
	}

	// ------------------------------------------------------------------
	// Timed media
	// ------------------------------------------------------------------
	//
	// Cue policy itself is a pure reduction in
	// `@pie-players/pie-players-shared/timed-media`. What lives here is the live
	// state and the port: the same split formative delivery uses, and for the same
	// reason — one rollup over one item set belongs in one place, and a section
	// that already owns item sessions and completion is that place.

	private rebuildTimedMedia(): void {
		const section = this.state.input?.section ?? null;
		if (!section || section.sectionType !== "timed-media") {
			this.timedMediaData = null;
			this.lastTimedMediaInvalidSignature = "";
			return;
		}
		const result = normalizeTimedMediaSectionData({
			timedMedia: section.timedMedia,
			itemIdentifiers: this.getSectionItemIdentifiers(),
			resolveStimulusRenderableId: (stimulusRef) =>
				this.state.viewModel.stimulusRenderableIdsByRef?.[stimulusRef],
			// Resolved formative policies are already rebuilt at this point in
			// `initialize`, which is what lets validation refuse a correctness gate
			// that a learner could never pass.
			resolveItemTryBudget: (itemIdentifier) => {
				const policy = this.formativePolicies[itemIdentifier];
				if (!policy?.enabled) return "not-formative";
				return policy.maxTries === "unlimited" ? "unlimited" : "finite";
			},
		});
		this.timedMediaData = result.data;
		if (result.data) {
			this.lastTimedMediaInvalidSignature = "";
			return;
		}
		this.reportTimedMediaInvalid(result.errors);
	}

	/**
	 * Report malformed authored data once per distinct failure.
	 *
	 * `initialize` runs again on every same-cohort `updateInput`, and a PnP toggle
	 * must not re-report a section's authoring defect each time.
	 */
	private reportTimedMediaInvalid(errors: TimedMediaValidationError[]): void {
		const signature = JSON.stringify(errors);
		if (signature === this.lastTimedMediaInvalidSignature) return;
		this.lastTimedMediaInvalidSignature = signature;
		const event: TimedMediaInvalidEvent = {
			type: "timed-media-invalid",
			errors,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: Date.now(),
		};
		this.emitChange(event);
	}

	public getTimedMediaProjection(): TimedMediaSectionProjection | null {
		if (!this.timedMediaData) return null;
		return this.cloneForRead(
			resolveTimedMediaProjection({
				data: this.timedMediaData,
				state: this.timedMediaState,
				delivery: this.getTimedMediaDeliveryState(),
				capabilities: this.mediaTimeSource?.capabilities ?? null,
			}),
		);
	}

	/**
	 * The delivery state cue gates read, assembled from state this controller
	 * already keeps: completion answers `"responded"`, and the last Try's
	 * correctness answers the correctness conditions. A gate on `"responded"`
	 * therefore works in a section that does not deliver formatively at all.
	 */
	private getTimedMediaDeliveryState(): TimedMediaDeliveryState {
		const respondedByItemId: Record<string, boolean> = {};
		for (const [itemId, complete] of this.itemCompletionByCanonicalId) {
			respondedByItemId[itemId] = complete === true;
		}
		const correctnessByItemId: Record<string, FormativeCorrectness> = {};
		for (const [itemId, state] of Object.entries(this.formativeStates)) {
			const correctness = state.lastOutcome?.correctness;
			if (correctness) correctnessByItemId[itemId] = correctness;
		}
		return {
			respondedByItemId,
			correctnessByItemId,
			itemsComplete: this.sectionItemsComplete,
		};
	}

	/**
	 * Bind the Media Time Source. Called by the stimulus card with a native adapter,
	 * and directly by a host supplying its own port — which is what lets a host
	 * deliver timed media without shipping a PIE element.
	 */
	public attachMediaTimeSource(
		source: MediaTimeSource,
		options?: { origin?: "native-adapter" | "host" },
	): void {
		if (!source || typeof source.subscribe !== "function") return;
		if (this.mediaTimeSource === source) return;
		const origin = options?.origin ?? "host";
		// The stimulus card re-runs its discovery whenever its content changes, so a
		// host that wired its own player must outrank it — otherwise the native
		// element quietly takes over mid-session and the capabilities flip back with
		// it, which is the "appears to enforce" failure this contract refuses.
		if (
			origin === "native-adapter" &&
			this.mediaTimeSource &&
			this.mediaTimeSourceOrigin === "host"
		) {
			return;
		}
		this.detachMediaTimeSource();
		this.mediaTimeSource = source;
		this.mediaTimeSourceOrigin = origin;
		if (!this.timedMediaData) return;
		this.unsubscribeMediaTimeSource = source.subscribe((notification) => {
			switch (notification.type) {
				case "time":
					this.advanceTimedMedia({
						kind: "time",
						currentTimeSeconds: notification.currentTime,
					});
					return;
				case "seek":
					this.advanceTimedMedia({
						kind: "seek",
						currentTimeSeconds: notification.currentTime,
					});
					return;
				case "ended":
					this.advanceTimedMedia({
						kind: "ended",
						currentTimeSeconds: notification.currentTime,
					});
					return;
				case "play":
					// A learner pressing play under a held gate is the moment enforcement
					// is actually tested; re-deriving from the current position produces
					// the pause effect again.
					this.advanceTimedMedia({
						kind: "time",
						currentTimeSeconds: notification.currentTime,
					});
					return;
				default:
					return;
			}
		});
		this.reportTimedMediaDegradations();
		// A restored session may be ahead of a freshly mounted element.
		this.syncMediaPositionFromState();
		this.advanceTimedMedia({
			kind: "time",
			currentTimeSeconds: source.currentTime,
		});
	}

	public detachMediaTimeSource(options?: {
		origin?: "native-adapter" | "host";
	}): void {
		// The card tears its adapter down whenever the stimulus re-renders. Letting
		// that clear a host-attached port would hand the section straight back to the
		// native element on the next discovery pass, which is the same silent takeover
		// the attach guard refuses.
		if (
			options?.origin === "native-adapter" &&
			this.mediaTimeSource &&
			this.mediaTimeSourceOrigin === "host"
		) {
			return;
		}
		this.unsubscribeMediaTimeSource?.();
		this.unsubscribeMediaTimeSource = null;
		this.mediaTimeSource = null;
	}

	/**
	 * Move a freshly attached source up to the restored position, forward only so it
	 * never fights a learner who has already scrubbed — the same rule the signing
	 * region applies when it seeks a fragment on `loadedmetadata`.
	 */
	private syncMediaPositionFromState(): void {
		const source = this.mediaTimeSource;
		if (!source) return;
		const target = this.timedMediaState.mediaCurrentTime;
		if (!(target > 0)) return;
		if (source.currentTime >= target - 0.5) return;
		try {
			source.seekTo(target);
		} catch (error) {
			logger.warn("media time source rejected a resume seek", error);
		}
	}

	/**
	 * One step of the cue reduction: fold the input into cue state, drive the port
	 * with whatever the reduction asked for, and emit only when cue state moved.
	 */
	private advanceTimedMedia(input: Parameters<typeof reduceTimedMediaState>[0]["input"]): void {
		const data = this.timedMediaData;
		if (!data) return;
		const reduction = reduceTimedMediaState({
			state: this.timedMediaState,
			data,
			delivery: this.getTimedMediaDeliveryState(),
			input,
		});
		this.timedMediaState = reduction.state;
		this.applyTimedMediaEffects(reduction.effects);
		this.emitTimedMediaIfChanged(reduction.effects);
	}

	/**
	 * Carry out an effect only where the port reports the capability for it.
	 *
	 * Skipping silently is the failure this contract names: the skip is already
	 * reported once per attach by `reportTimedMediaDegradations`, and the projection
	 * carries `enforcement: "advisory"` for as long as the gap lasts.
	 */
	private applyTimedMediaEffects(effects: TimedMediaEffects): void {
		const source = this.mediaTimeSource;
		if (!source) return;
		if (
			effects.seekToSeconds !== undefined &&
			source.capabilities.canRestrictSeeking
		) {
			try {
				source.seekTo(effects.seekToSeconds);
			} catch (error) {
				logger.warn("media time source rejected a seek clamp", error);
			}
		}
		if (effects.pause && source.capabilities.canPause && !source.paused) {
			try {
				source.pause();
			} catch (error) {
				logger.warn("media time source rejected a pause", error);
			}
		}
	}

	/** Report a capability gap once per attached source. */
	private reportTimedMediaDegradations(): void {
		const projection = this.getTimedMediaProjection();
		const degradations = (projection?.degradations ?? []).filter(
			(entry) => !this.reportedDegradationKeys.has(entry.policy),
		);
		if (degradations.length === 0) return;
		for (const entry of degradations) {
			this.reportedDegradationKeys.add(entry.policy);
		}
		const event: TimedMediaPolicyDegradedEvent = {
			type: "timed-media-policy-degraded",
			degradations,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: Date.now(),
		};
		this.emitChange(event);
	}

	/**
	 * Emit on cue state, never on the clock.
	 *
	 * The signature deliberately omits `mediaCurrentTime`: at four `timeupdate`
	 * events a second, folding position in would republish the composition — and
	 * re-diff every mounted item player — for a change nothing renders.
	 */
	private emitTimedMediaIfChanged(effects: TimedMediaEffects): void {
		const projection = this.getTimedMediaProjection();
		if (!projection) return;
		const signature = JSON.stringify([
			projection.visitedCueIdentifiers,
			projection.completedCueIdentifiers,
			projection.revealedItemIds,
			projection.activeCueIdentifier ?? "",
			projection.gate?.cueIdentifier ?? "",
			projection.gate?.holding === true,
			projection.mediaCompleted,
			projection.aggregateComplete,
			projection.enforcement,
			projection.mediaAttached,
		]);
		if (signature === this.lastTimedMediaSignature) return;
		this.lastTimedMediaSignature = signature;
		const event: TimedMediaCueChangedEvent = {
			type: "timed-media-cue-changed",
			activatedCueIdentifier: effects.activatedCueIdentifier,
			releasedCueIdentifier: effects.releasedCueIdentifier,
			activeCueIdentifier: projection.activeCueIdentifier,
			visitedCueIdentifiers: projection.visitedCueIdentifiers,
			completedCueIdentifiers: projection.completedCueIdentifiers,
			revealedItemIds: projection.revealedItemIds,
			gateCueIdentifier: projection.gate?.cueIdentifier ?? null,
			mediaCompleted: projection.mediaCompleted,
			aggregateComplete: projection.aggregateComplete,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: Date.now(),
		};
		this.emitChange(event);
	}

	/** Re-evaluate gates after the state a gate condition reads has changed. */
	private notifyTimedMediaDeliveryChanged(): void {
		if (!this.timedMediaData) return;
		this.advanceTimedMedia({ kind: "delivery-changed" });
	}

	/**
	 * Runtime/debugger shape scoped to the current section.
	 * Use this for widgets that need a section-scoped live snapshot (debug panels, diagnostics).
	 * Unlike getSession(), this is optimized for runtime introspection, not host persistence.
	 */
	public getRuntimeState(): SectionControllerRuntimeState | null {
		if (!this.state.testAttemptSession) return null;
		const itemIdentifiers = this.getSectionItemIdentifiers();
		const currentItemId =
			itemIdentifiers[this.state.viewModel.currentItemIndex] || "";
		const visitedSet = new Set(
			this.state.testAttemptSession.navigationState.visitedItemIdentifiers ||
				[],
		);
		const visitedItemIdentifiers = itemIdentifiers.filter((id) =>
			visitedSet.has(id),
		);
		const itemSessions: Record<string, unknown> = {};
		for (const itemRef of this.state.viewModel.adapterItemRefs) {
			const canonicalId = itemRef.identifier || itemRef.item?.id;
			const runtimeItemId = itemRef.item?.id;
			if (!canonicalId) continue;
			const sessionValue =
				this.state.testAttemptSession?.itemSessions?.[canonicalId]?.session ??
				(runtimeItemId
					? this.state.testAttemptSession?.itemSessions?.[runtimeItemId]
							?.session
					: undefined);
			if (!sessionValue) continue;
			itemSessions[canonicalId] = sessionValue;
		}

		const loadedRenderables: SectionAttemptSessionSlice["loadedRenderables"] =
			this.collectLoadedRenderableSnapshot();

		const runtimeState: SectionAttemptSessionSlice = {
			sectionId: this.state.input?.sectionId || "",
			sectionIdentifier:
				this.state.input?.section?.identifier ||
				this.state.input?.sectionId ||
				undefined,
			currentItemIndex: this.state.viewModel.currentItemIndex,
			currentItemId,
			itemIdentifiers,
			visitedItemIdentifiers,
			itemSessions,
			loadingComplete: this.sectionLoadingComplete,
			totalRegistered: this.totalRegistered,
			totalLoaded: this.totalLoaded,
			itemsComplete: this.sectionItemsComplete,
			completedCount: this.completedCount,
			totalItems: this.totalItems,
			loadedRenderables,
		};
		return runtimeState;
	}

	/**
	 * Snapshot of currently-loaded renderables in registration order.
	 *
	 * Walks `trackedRenderables` (preserves insertion order) and emits an entry
	 * for each entry whose key is in `loadedRenderableKeys`. Used by the
	 * coordinator to replay `content-loaded` events to subscribers that
	 * attach after a renderable has finished loading.
	 */
	private collectLoadedRenderableSnapshot(): ReadonlyArray<{
		itemId: string;
		canonicalItemId: string;
		contentKind: "item" | "passage" | "rubric" | "unknown";
	}> {
		if (this.loadedRenderableKeys.size === 0) return [];
		const snapshot: Array<{
			itemId: string;
			canonicalItemId: string;
			contentKind: "item" | "passage" | "rubric" | "unknown";
		}> = [];
		for (const [key, tracked] of this.trackedRenderables) {
			if (!this.loadedRenderableKeys.has(key)) continue;
			snapshot.push({
				itemId: tracked.itemId,
				canonicalItemId: tracked.canonicalItemId,
				contentKind: tracked.contentKind,
			});
		}
		return snapshot;
	}

	public getCurrentItem(): ItemEntity | null {
		return (
			this.state.viewModel.items[this.state.viewModel.currentItemIndex] || null
		);
	}

	public getCurrentItemSession(): unknown {
		const currentItem = this.getCurrentItem();
		if (!currentItem?.id) return undefined;
		return this.getItemSessionsByItemId()[currentItem.id];
	}

	public getNavigationState(isLoading = false): SectionNavigationState {
		const currentIndex = this.state.viewModel.currentItemIndex;
		const totalItems = this.state.viewModel.items.length;
		return {
			currentIndex,
			totalItems,
			canNext: currentIndex < totalItems - 1,
			canPrevious: currentIndex > 0,
			isLoading,
		};
	}

	public updateItemSession(
		itemId: string,
		sessionDetail: any,
	): SessionChangedResult | null {
		if (!this.state.testAttemptSession) return null;
		const itemSessions = this.getResolvedItemSessions();
		const result = this.sessionService.applyItemSessionChanged({
			itemId,
			sessionDetail,
			testAttemptSession: this.state.testAttemptSession,
			itemSessions,
		});
		this.state.testAttemptSession = result.testAttemptSession;
		const canonicalItemId = this.getCanonicalItemId(result.eventDetail.itemId);
		const timestamp = result.eventDetail.timestamp;
		const intent = result.eventDetail.intent;
		const completeFromEvent =
			typeof result.eventDetail.complete === "boolean"
				? result.eventDetail.complete
				: this.readCompleteFromSession(result.eventDetail.session);

		if (intent === "metadata-only") {
			const metaEvent: ItemSessionMetaChangedEvent = {
				type: "item-session-meta-changed",
				itemId: result.eventDetail.itemId,
				canonicalItemId,
				complete: result.eventDetail.complete,
				component: result.eventDetail.component,
				currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
				timestamp,
			};
			this.emitChange(metaEvent);
		} else {
			const dataEvent: ItemSessionDataChangedEvent = {
				type: "item-session-data-changed",
				itemId: result.eventDetail.itemId,
				canonicalItemId,
				session: result.eventDetail.session,
				intent: result.eventDetail.intent,
				complete: result.eventDetail.complete,
				component: result.eventDetail.component,
				currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
				timestamp,
			};
			this.emitChange(dataEvent);
		}

		if (typeof completeFromEvent === "boolean") {
			this.updateItemCompleteState({
				itemId: result.eventDetail.itemId,
				canonicalItemId,
				complete: completeFromEvent,
				timestamp,
			});
		}
		return result;
	}

	public async applySession(
		session: SectionControllerSessionState | null,
		options?: { mode?: "replace" | "merge" },
	): Promise<void> {
		if (!this.state.testAttemptSession || !session) return;
		const mode = options?.mode || "replace";
		const normalized = this.normalizeApplySession(session);
		this.applyNormalizedSessionToState(normalized, mode);
		this.bootstrapCompletionFromSessions();
		// Hydration restores Try state, so a subscriber that attaches after
		// `hydrate()` still sees the rollup it is restoring into.
		this.emitMasteryIfChanged(Date.now());
		// Same for cue state, and an already-attached source is moved up to the
		// restored position rather than left at zero.
		this.syncMediaPositionFromState();
		this.notifyTimedMediaDeliveryChanged();
		const applyRevision = ++this.nextApplyRevision;
		if (!this.sectionLoadingComplete) {
			this.pendingApplyReplay = {
				revision: applyRevision,
				mode,
				session: this.cloneForRead(session),
			};
		}
		const event: SectionSessionAppliedEvent = {
			type: "section-session-applied",
			mode,
			itemSessionCount: normalized.itemSessionCount,
			replay: false,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: Date.now(),
		};
		this.emitChange(event);
	}

	/**
	 * Move between items inside the current section only.
	 * Cross-section navigation belongs to the higher-level assessment player.
	 */
	public navigateToItem(index: number): NavigationResult | null {
		if (!this.state.testAttemptSession) return null;
		const result = this.itemNavigationService.navigate({
			index,
			items: this.state.viewModel.items,
			currentItemIndex: this.state.viewModel.currentItemIndex,
			sectionIdentifier:
				this.state.input?.section?.identifier || this.state.input?.sectionId,
			testAttemptSession: this.state.testAttemptSession,
		});
		if (!result) return null;

		this.state.viewModel.currentItemIndex = result.nextIndex;
		this.state.testAttemptSession = result.testAttemptSession;
		const selectedEvent: ItemSelectedEvent = {
			type: "item-selected",
			previousItemId: result.eventDetail.previousItemId,
			currentItemId: result.eventDetail.currentItemId,
			itemIndex: result.eventDetail.itemIndex,
			totalItems: result.eventDetail.totalItems,
			itemLabel: result.eventDetail.itemLabel,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: result.eventDetail.timestamp,
		};
		this.emitChange(selectedEvent);
		return result;
	}

	public handleContentRegistered(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}): void {
		const canonicalItemId = this.getCanonicalItemId(
			args.canonicalItemId || args.itemId,
		);
		const key = this.getRenderableKey(canonicalItemId, args.contentKind);
		const contentKind = this.toSectionContentKind(args.contentKind);
		// PIE-512 Phase C: register is idempotent. If the same renderable
		// is already tracked under the same `(itemId, canonicalItemId,
		// contentKind)` key we skip the `evaluateSectionLoadingState`
		// call — totals haven't changed and re-running the evaluator
		// could spuriously re-emit `section-loading-complete` to a
		// freshly-attached subscriber. The engine's cohort-handoff
		// replay relies on this idempotence to safely re-feed the
		// registry into a same-cohort `updateInput`-resolved controller.
		const existing = this.trackedRenderables.get(key);
		if (
			existing &&
			existing.itemId === args.itemId &&
			existing.canonicalItemId === canonicalItemId &&
			existing.contentKind === contentKind
		) {
			return;
		}
		this.trackedRenderables.set(key, {
			itemId: args.itemId,
			canonicalItemId,
			contentKind,
		});
		this.evaluateSectionLoadingState(Date.now());
	}

	public handleContentUnregistered(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
	}): void {
		const canonicalItemId = this.getCanonicalItemId(
			args.canonicalItemId || args.itemId,
		);
		const key = this.getRenderableKey(canonicalItemId, args.contentKind);
		this.trackedRenderables.delete(key);
		this.loadedRenderableKeys.delete(key);
		this.evaluateSectionLoadingState(Date.now());
	}

	public handleContentLoaded(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		detail?: unknown;
		timestamp?: number;
	}): void {
		const timestamp = args.timestamp ?? Date.now();
		const canonicalItemId = this.getCanonicalItemId(
			args.canonicalItemId || args.itemId,
		);
		const contentKind = this.toSectionContentKind(args.contentKind);
		const key = this.getRenderableKey(canonicalItemId, contentKind);
		// PIE-512 Phase C: load is idempotent. If the renderable is
		// already in `loadedRenderableKeys` we drop the duplicate — no
		// re-emit of `content-loaded` (subscribers see a single
		// authoritative load per renderable) and no re-evaluation of
		// `section-loading-complete` (totals haven't changed). This
		// keeps the engine's cohort-handoff replay safe to re-run on
		// same-cohort `updateInput` flips because the controller's
		// `loadedRenderableKeys` is preserved.
		if (this.loadedRenderableKeys.has(key)) {
			return;
		}
		this.loadedRenderableKeys.add(key);
		const event: ContentLoadedEvent = {
			type: "content-loaded",
			contentKind,
			itemId: args.itemId,
			canonicalItemId,
			detail: args.detail,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(event);
		this.evaluateSectionLoadingState(timestamp);
	}

	public handleItemPlayerError(args: {
		itemId: string;
		canonicalItemId?: string;
		contentKind?: string;
		error: unknown;
		timestamp?: number;
	}): void {
		const timestamp = args.timestamp ?? Date.now();
		const canonicalItemId = this.getCanonicalItemId(
			args.canonicalItemId || args.itemId,
		);
		const contentKind = this.toSectionContentKind(args.contentKind);
		const itemErrorEvent: ItemPlayerErrorEvent = {
			type: "item-player-error",
			contentKind,
			itemId: args.itemId,
			canonicalItemId,
			error: args.error,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(itemErrorEvent);
		this.reportSectionError({
			source: "item-player",
			error: args.error,
			itemId: args.itemId,
			canonicalItemId,
			contentKind,
			timestamp,
		});
	}

	public reportSectionError(args: {
		source: "item-player" | "section-runtime" | "toolkit" | "controller";
		error: unknown;
		itemId?: string;
		canonicalItemId?: string;
		contentKind?: string;
		timestamp?: number;
	}): void {
		const event: SectionErrorEvent = {
			type: "section-error",
			source: args.source,
			error: args.error,
			itemId: args.itemId,
			canonicalItemId: args.canonicalItemId,
			contentKind: args.contentKind
				? this.toSectionContentKind(args.contentKind)
				: undefined,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: args.timestamp ?? Date.now(),
		};
		this.emitChange(event);
	}

	private resetLifecycleTracking(): void {
		this.trackedRenderables.clear();
		this.loadedRenderableKeys.clear();
		this.itemCompletionByCanonicalId.clear();
		this.sectionLoadingComplete = false;
		this.totalRegistered = 0;
		this.totalLoaded = 0;
		this.sectionItemsComplete = false;
		this.completedCount = 0;
		this.totalItems = 0;
		this.formativeStates = {};
		this.lastMasterySignature = "";
		this.timedMediaState = createTimedMediaState();
		this.lastTimedMediaSignature = "";
		this.reportedDegradationKeys.clear();
	}

	private toSectionContentKind(raw?: string): SectionContentKind {
		const value = String(raw || "").toLowerCase();
		if (value === "item" || value.includes("assessment-item")) return "item";
		if (value === "passage") return "passage";
		if (value === "rubric" || value.includes("rubric")) return "rubric";
		return value ? "unknown" : "unknown";
	}

	private getRenderableKey(
		canonicalItemId: string,
		contentKind?: string | SectionContentKind,
	): string {
		return `${this.toSectionContentKind(contentKind)}:${canonicalItemId}`;
	}

	private readCompleteFromSession(session: unknown): boolean | undefined {
		if (!session || typeof session !== "object") return undefined;
		const value = (session as Record<string, unknown>).complete;
		return typeof value === "boolean" ? value : undefined;
	}

	private bootstrapCompletionFromSessions(): void {
		const items = this.getItemViewModels();
		for (const item of items) {
			const complete = this.readCompleteFromSession(item.session);
			if (typeof complete === "boolean") {
				this.itemCompletionByCanonicalId.set(item.canonicalItemId, complete);
			} else if (!this.itemCompletionByCanonicalId.has(item.canonicalItemId)) {
				this.itemCompletionByCanonicalId.set(item.canonicalItemId, false);
			}
		}
		this.emitSectionItemsCompleteIfChanged(Date.now());
		this.notifyTimedMediaDeliveryChanged();
	}

	private updateItemCompleteState(args: {
		itemId: string;
		canonicalItemId: string;
		complete: boolean;
		timestamp: number;
	}): void {
		const previousComplete =
			this.itemCompletionByCanonicalId.get(args.canonicalItemId) ?? false;
		if (previousComplete === args.complete) {
			this.emitSectionItemsCompleteIfChanged(args.timestamp);
			return;
		}
		this.itemCompletionByCanonicalId.set(args.canonicalItemId, args.complete);
		const event: ItemCompleteChangedEvent = {
			type: "item-complete-changed",
			itemId: args.itemId,
			canonicalItemId: args.canonicalItemId,
			complete: args.complete,
			previousComplete,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: args.timestamp,
		};
		this.emitChange(event);
		this.emitSectionItemsCompleteIfChanged(args.timestamp);
		// Completion answers the `"responded"` gate condition and feeds aggregate
		// completion, so both are re-derived here.
		this.notifyTimedMediaDeliveryChanged();
	}

	private emitSectionItemsCompleteIfChanged(timestamp: number): void {
		const itemViewModels = this.getItemViewModels();
		const totalItems = itemViewModels.length;
		this.totalItems = totalItems;
		if (totalItems === 0) {
			this.completedCount = 0;
			this.sectionItemsComplete = false;
			return;
		}
		let completedCount = 0;
		for (const item of itemViewModels) {
			const complete = this.itemCompletionByCanonicalId.get(
				item.canonicalItemId,
			);
			if (complete === true) {
				completedCount += 1;
			}
		}
		const complete = completedCount === totalItems;
		this.completedCount = completedCount;
		// Emit only when aggregate completion state flips (false<->true), not
		// for intermediate count changes while state remains the same.
		if (this.sectionItemsComplete === complete) {
			return;
		}
		this.sectionItemsComplete = complete;
		const event: SectionItemsCompleteChangedEvent = {
			type: "section-items-complete-changed",
			complete,
			completedCount,
			totalItems,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(event);
	}

	private evaluateSectionLoadingState(timestamp: number): void {
		const totalRegistered = this.trackedRenderables.size;
		const totalLoaded = this.loadedRenderableKeys.size;
		this.totalRegistered = totalRegistered;
		this.totalLoaded = totalLoaded;
		const nextLoaded = totalRegistered > 0 && totalLoaded >= totalRegistered;
		if (nextLoaded === this.sectionLoadingComplete) return;
		this.sectionLoadingComplete = nextLoaded;
		if (!nextLoaded) return;
		const event: SectionLoadingCompleteEvent = {
			type: "section-loading-complete",
			totalRegistered,
			totalLoaded,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp,
		};
		this.emitChange(event);
		void this.replayPendingAppliedSession();
	}

	private async replayPendingAppliedSession(): Promise<void> {
		const pending = this.pendingApplyReplay;
		if (!pending) return;
		if (pending.revision <= this.lastReplayedApplyRevision) return;
		if (!this.sectionLoadingComplete) return;
		const normalized = this.normalizeApplySession(pending.session);
		if (!this.state.testAttemptSession) return;
		this.applyNormalizedSessionToState(normalized, pending.mode);
		this.bootstrapCompletionFromSessions();
		this.lastReplayedApplyRevision = pending.revision;
		const replayEvent: SectionSessionAppliedEvent = {
			type: "section-session-applied",
			mode: pending.mode,
			itemSessionCount: normalized.itemSessionCount,
			replay: true,
			currentItemIndex: this.state.viewModel.currentItemIndex ?? 0,
			timestamp: Date.now(),
		};
		this.emitChange(replayEvent);
	}

	private normalizeApplySession(
		session: SectionControllerSessionState,
	): NormalizedApplySession {
		const nextItemSessionsInput =
			session.itemSessions && typeof session.itemSessions === "object"
				? (session.itemSessions as Record<string, unknown>)
				: {};
		const allowedCanonicalIds = new Set<string>(
			this.state.viewModel.adapterItemRefs
				.map((itemRef) =>
					this.getCanonicalItemId(itemRef.identifier || itemRef.item?.id || ""),
				)
				.filter((id): id is string => typeof id === "string" && !!id),
		);
		const normalizedItemSessions: TestAttemptSession["itemSessions"] = {};
		for (const [rawItemId, rawEntry] of Object.entries(nextItemSessionsInput)) {
			const canonicalItemId = this.getCanonicalItemId(rawItemId);
			if (!allowedCanonicalIds.has(canonicalItemId)) {
				continue;
			}
			const normalizedEntry = this.normalizeItemSessionEntry(
				canonicalItemId,
				rawEntry,
			);
			if (!normalizedEntry) continue;
			normalizedItemSessions[canonicalItemId] = normalizedEntry;
		}
		const visited = Array.isArray(session.visitedItemIdentifiers)
			? Array.from(
					new Set(
						session.visitedItemIdentifiers
							.map((id) => this.getCanonicalItemId(id))
							.filter((id): id is string => allowedCanonicalIds.has(id)),
					),
				)
			: undefined;
		const maxIndex = Math.max(0, this.state.viewModel.items.length - 1);
		const nextCurrentItemIndex =
			typeof session.currentItemIndex === "number" &&
			Number.isFinite(session.currentItemIndex)
				? Math.min(Math.max(0, session.currentItemIndex), maxIndex)
				: undefined;
		return {
			currentItemIndex: nextCurrentItemIndex,
			visitedItemIdentifiers: visited,
			itemSessions: normalizedItemSessions,
			itemSessionCount: Object.keys(normalizedItemSessions).length,
			formativeStates: normalizeFormativeSectionSlice({
				slice: session.formative,
				allowedItemIdentifiers: Array.from(allowedCanonicalIds),
			}),
			timedMediaState: normalizeTimedMediaSectionSlice({
				slice: session.timedMedia,
				data: this.timedMediaData,
			}),
		};
	}

	private normalizeItemSessionEntry(
		itemIdentifier: string,
		entry: unknown,
	): TestAttemptSession["itemSessions"][string] | null {
		if (!entry || typeof entry !== "object") return null;
		const candidate = entry as Record<string, unknown>;
		const typedCandidate = candidate as {
			itemIdentifier?: unknown;
			attemptCount?: unknown;
			isCompleted?: unknown;
			session?: unknown;
			complete?: unknown;
		};
		const hasCanonicalShape =
			typeof typedCandidate.itemIdentifier === "string" &&
			typedCandidate.session &&
			typeof typedCandidate.session === "object";
		if (hasCanonicalShape) {
			return {
				itemIdentifier,
				attemptCount:
					typeof typedCandidate.attemptCount === "number" &&
					Number.isFinite(typedCandidate.attemptCount)
						? typedCandidate.attemptCount
						: 1,
				isCompleted: Boolean(typedCandidate.isCompleted),
				session: typedCandidate.session as Record<string, unknown>,
			};
		}
		const rawSession =
			typedCandidate.session && typeof typedCandidate.session === "object"
				? (typedCandidate.session as Record<string, unknown>)
				: candidate;
		return {
			itemIdentifier,
			attemptCount: 1,
			isCompleted:
				typeof typedCandidate.complete === "boolean"
					? typedCandidate.complete
					: Boolean((rawSession as { complete?: unknown }).complete),
			session: rawSession,
		};
	}

	private applyNormalizedSessionToState(
		normalized: NormalizedApplySession,
		mode: "replace" | "merge",
	): void {
		if (!this.state.testAttemptSession) return;
		if (mode === "merge") {
			this.state.testAttemptSession.itemSessions = {
				...this.state.testAttemptSession.itemSessions,
				...normalized.itemSessions,
			};
		} else {
			this.state.testAttemptSession.itemSessions = normalized.itemSessions;
		}
		if (Array.isArray(normalized.visitedItemIdentifiers)) {
			this.state.testAttemptSession.navigationState.visitedItemIdentifiers =
				normalized.visitedItemIdentifiers;
		} else if (mode === "replace") {
			this.state.testAttemptSession.navigationState.visitedItemIdentifiers = [];
		}
		if (typeof normalized.currentItemIndex === "number") {
			this.state.testAttemptSession.navigationState.currentItemIndex =
				normalized.currentItemIndex;
			this.state.viewModel.currentItemIndex = normalized.currentItemIndex;
		} else if (mode === "replace") {
			this.state.testAttemptSession.navigationState.currentItemIndex = 0;
			this.state.viewModel.currentItemIndex = 0;
		}
		if (normalized.formativeStates) {
			this.formativeStates =
				mode === "merge"
					? { ...this.formativeStates, ...normalized.formativeStates }
					: normalized.formativeStates;
		} else if (mode === "replace") {
			// A replace with no readable slice clears formative state, the same way
			// it clears visited items. A rejected slice therefore restarts Tries
			// while item sessions in the same snapshot are applied untouched.
			this.formativeStates = {};
		}
		if (normalized.timedMediaState) {
			// No merge case: cue state is section-scoped, so there are no per-key
			// entries to overlay. A merge that carried a slice would have to decide
			// between two whole timelines, and the incoming one is the more recent.
			this.timedMediaState = normalized.timedMediaState;
		} else if (mode === "replace" && this.timedMediaData) {
			this.timedMediaState = createTimedMediaState();
		}
		this.lastMasterySignature = "";
		this.lastTimedMediaSignature = "";
	}

	private cloneForRead<T>(value: T): T {
		if (value === null || value === undefined) return value;
		try {
			return structuredClone(value);
		} catch {
			try {
				return JSON.parse(JSON.stringify(value)) as T;
			} catch {
				return value;
			}
		}
	}
}
