import type { TestAttemptSession } from "@pie-players/pie-assessment-toolkit";
import type { ItemSessionUpdateIntent } from "@pie-players/pie-players-shared";
import type {
	AssessmentItemRef,
	AssessmentSection,
	ItemEntity,
	PassageEntity,
	RubricBlock,
} from "@pie-players/pie-players-shared";
import type { ConfigContainerEntity } from "@pie-players/pie-players-shared/types";
import type {
	FormativeFeedbackReveal,
	FormativeItemPolicy,
	FormativeMasteryRollup,
	FormativeSectionProjection,
	FormativeSectionSlice,
	FormativeTryOutcome,
} from "@pie-players/pie-players-shared/formative";
import type {
	TimedMediaDegradation,
	TimedMediaSectionProjection,
	TimedMediaSectionSessionSlice,
	TimedMediaValidationError,
} from "@pie-players/pie-players-shared/timed-media";

export type SectionView =
	| "candidate"
	| "scorer"
	| "author"
	| "proctor"
	| "testConstructor"
	| "tutor";

export interface SectionContentModel {
	passages: PassageEntity[];
	items: ItemEntity[];
	rubricBlocks: RubricBlock[];
	instructions: RubricBlock[];
	renderables: SectionRenderable[];
	adapterItemRefs: Array<{
		identifier: string;
		item: {
			id?: string;
			identifier?: string;
		};
		/**
		 * The item ref's formative override, carried through because this
		 * projection is where the canonical identifier is decided. Resolving
		 * policy from the raw `assessmentItemRefs` instead would mean recomputing
		 * that identifier, and two implementations of one mapping.
		 */
		formative?: FormativeItemPolicy;
	}>;
	/**
	 * How an authored `timedMedia.stimulusRef` resolves to a renderable.
	 *
	 * Keyed by every spelling a section may reference the stimulus under — the
	 * rubric block identifier, the authored passage id, and the normalized id —
	 * mapping to the normalized passage id the renderables carry. Empty for a
	 * section with no stimulus rubric block, which is what makes an unresolvable
	 * `stimulusRef` detectable rather than silently cue-less.
	 */
	stimulusRenderableIdsByRef: Record<string, string>;
}

export type SectionRenderableFlavor = "item" | "passage" | "rubric";

export interface SectionRenderable {
	flavor: SectionRenderableFlavor;
	entity: ConfigContainerEntity;
}

export interface SectionControllerInput {
	section: AssessmentSection | null;
	view: SectionView;
	assessmentId: string;
	sectionId: string;
}

export interface SectionSessionState {
	/**
	 * Persistence payload for section controller host APIs.
	 * This shape is produced by getSession() and should be preferred for applySession().
	 */
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
	formative?: FormativeSectionSlice;
	timedMedia?: TimedMediaSectionSessionSlice;
}

export interface SectionViewModel extends SectionContentModel {
	currentItemIndex: number;
	/**
	 * Rendering/pagination hint derived from the QTI 3
	 * `qti-assessment-section@keep-together` property. When `true`, a section's
	 * items are intended to be rendered together (not split across pages).
	 *
	 * This is a PURE rendering hint: it does NOT disable item-level navigation,
	 * current-item tracking, or `item-selected` events. Layouts MAY branch on
	 * this to enable page-mode-only affordances (e.g., scroll-current-into-view),
	 * but the controller continues to surface `currentItem`, `canNext`,
	 * `canPrevious`, and navigation events exactly as in paginated mode.
	 */
	isPageMode: boolean;
}

export interface SectionCompositionModel {
	section: AssessmentSection | null;
	assessmentItemRefs: AssessmentItemRef[];
	passages: PassageEntity[];
	items: ItemEntity[];
	rubricBlocks: RubricBlock[];
	instructions: RubricBlock[];
	renderables: SectionRenderable[];
	currentItemIndex: number;
	currentItem: ItemEntity | null;
	/**
	 * Rendering/pagination hint derived from `keepTogether`. Purely informational
	 * for composition snapshots — see `SectionViewModel.isPageMode` for the full
	 * contract.
	 */
	isPageMode: boolean;
	itemSessionsByItemId: Record<string, unknown>;
	testAttemptSession: TestAttemptSession | null;
	itemViewModels: SectionCanonicalItemViewModel[];
	/**
	 * Formative delivery projection, keyed by canonical item id. Absent reads
	 * exactly as `null`: no item in the section delivers formatively, which is
	 * every section authored without a `formative` policy. Optional so anything
	 * else assembling this model — a host layout, a test double — omits the
	 * field instead of declaring a feature it does not use.
	 *
	 * Layouts read it from here rather than calling the controller: the runtime
	 * republishes the composition model on every controller event, so a recorded
	 * Try reaches the cards through the channel that already exists.
	 */
	formative?: FormativeSectionProjection | null;
	/**
	 * Timed-media projection: cues, enforcement, which items a cue has revealed,
	 * and the gate holding playback. `null` for every section that is not timed
	 * media, and for one whose `timedMedia` failed validation — a layout that reads
	 * `null` renders exactly as it does today, which is what keeps the addition
	 * invisible to existing content.
	 */
	timedMedia?: TimedMediaSectionProjection | null;
}

export interface SectionCanonicalItemViewModel {
	item: ItemEntity;
	itemId: string;
	canonicalItemId: string;
	index: number;
	isCurrent: boolean;
	session: unknown;
}

export interface SectionCanonicalSectionViewModel {
	sectionId: string;
	currentItemIndex: number;
	items: SectionCanonicalItemViewModel[];
}

export interface SectionCanonicalSessionViewModel {
	currentItemIndex: number;
	itemSessionsByCanonicalId: Record<string, unknown>;
}

export interface SectionAttemptSessionSliceLoadedRenderable {
	itemId: string;
	canonicalItemId: string;
	contentKind: SectionContentKind;
}

export interface SectionAttemptSessionSlice {
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
	loadedRenderables?: ReadonlyArray<SectionAttemptSessionSliceLoadedRenderable>;
}

export interface SessionChangedResult {
	testAttemptSession: TestAttemptSession;
	itemSessions: Record<string, any>;
	sessionState: SectionSessionState;
	eventDetail: {
		itemId: string;
		session: unknown;
		intent?: ItemSessionUpdateIntent;
		complete?: boolean;
		component?: string;
		timestamp: number;
	};
}

export interface NavigationResult {
	nextIndex: number;
	// Intra-section item navigation event detail (not section-to-section routing).
	eventDetail: {
		previousItemId: string;
		currentItemId: string;
		itemIndex: number;
		totalItems: number;
		timestamp: number;
		/** Human-readable label for the destination item, derived from item.title. Used by aria-live announcements and host focus policies. */
		itemLabel?: string;
	};
	testAttemptSession: TestAttemptSession;
}

export interface SectionNavigationState {
	currentIndex: number;
	totalItems: number;
	canNext: boolean;
	canPrevious: boolean;
	isLoading: boolean;
}

export type SectionContentKind = "item" | "passage" | "rubric" | "unknown";

interface SectionControllerEventBase {
	type:
		| "item-session-data-changed"
		| "item-session-meta-changed"
		| "item-selected"
		| "section-navigation-change"
		| "section-session-applied"
		| "content-loaded"
		| "item-player-error"
		| "item-complete-changed"
		| "section-loading-complete"
		| "section-items-complete-changed"
		| "section-error"
		| "formative-try-recorded"
		| "formative-reveal-changed"
		| "section-mastery-changed"
		| "timed-media-cue-changed"
		| "timed-media-audio-started"
		| "timed-media-policy-degraded"
		| "timed-media-invalid";
	timestamp: number;
}

interface ItemScopedControllerEventBase extends SectionControllerEventBase {
	currentItemIndex: number;
}

export interface ItemSessionDataChangedEvent
	extends ItemScopedControllerEventBase {
	type: "item-session-data-changed";
	itemId: string;
	canonicalItemId: string;
	session: unknown;
	intent?: ItemSessionUpdateIntent;
	complete?: boolean;
	component?: string;
}

export interface ItemSessionMetaChangedEvent
	extends ItemScopedControllerEventBase {
	type: "item-session-meta-changed";
	itemId: string;
	canonicalItemId: string;
	complete?: boolean;
	component?: string;
}

export interface ItemSelectedEvent extends ItemScopedControllerEventBase {
	type: "item-selected";
	previousItemId: string;
	currentItemId: string;
	itemIndex: number;
	totalItems: number;
	/** Human-readable label for the destination item, derived from item.title. Used by aria-live announcements and host focus policies. */
	itemLabel?: string;
}

export interface SectionNavigationChangeEvent
	extends SectionControllerEventBase {
	type: "section-navigation-change";
	previousSectionId?: string;
	currentSectionId?: string;
	attemptId?: string;
	reason?: "input-change" | "runtime-transition";
}

export interface SectionSessionAppliedEvent extends SectionControllerEventBase {
	type: "section-session-applied";
	mode: "replace" | "merge";
	itemSessionCount: number;
	replay: boolean;
	currentItemIndex: number;
}

export interface ContentLoadedEvent extends ItemScopedControllerEventBase {
	type: "content-loaded";
	contentKind: SectionContentKind;
	itemId: string;
	canonicalItemId: string;
	detail?: unknown;
}

export interface ItemPlayerErrorEvent extends ItemScopedControllerEventBase {
	type: "item-player-error";
	contentKind: SectionContentKind;
	itemId: string;
	canonicalItemId: string;
	error: unknown;
}

export interface ItemCompleteChangedEvent
	extends ItemScopedControllerEventBase {
	type: "item-complete-changed";
	itemId: string;
	canonicalItemId: string;
	complete: boolean;
	previousComplete: boolean;
}

export interface SectionLoadingCompleteEvent
	extends ItemScopedControllerEventBase {
	type: "section-loading-complete";
	totalRegistered: number;
	totalLoaded: number;
}

export interface SectionItemsCompleteChangedEvent
	extends ItemScopedControllerEventBase {
	type: "section-items-complete-changed";
	complete: boolean;
	completedCount: number;
	totalItems: number;
}

export interface SectionErrorEvent extends ItemScopedControllerEventBase {
	type: "section-error";
	source: "item-player" | "section-runtime" | "toolkit" | "controller";
	error: unknown;
	itemId?: string;
	canonicalItemId?: string;
	contentKind?: SectionContentKind;
}

export interface FormativeTryRecordedEvent
	extends ItemScopedControllerEventBase {
	type: "formative-try-recorded";
	itemId: string;
	canonicalItemId: string;
	tryCount: number;
	outcome: FormativeTryOutcome;
	revealed: boolean;
}

/**
 * The reveal state changed without a Try being recorded: a learner dismissed
 * feedback to edit again, or a host forced a reveal or withdrew one. A Try that
 * reveals reports through `formative-try-recorded`.
 */
export interface FormativeRevealChangedEvent
	extends ItemScopedControllerEventBase {
	type: "formative-reveal-changed";
	itemId: string;
	canonicalItemId: string;
	revealed: boolean;
	/** Reveal level in force, when a host overrode the policy's. */
	feedback?: FormativeFeedbackReveal;
	/** Tries already spent; none of these transitions consume one. */
	tryCount: number;
	source: "learner" | "host";
}

export interface SectionMasteryChangedEvent
	extends ItemScopedControllerEventBase {
	type: "section-mastery-changed";
	mastery: FormativeMasteryRollup;
}

/**
 * Cue state changed: a cue activated, a gate released, or aggregate completion
 * flipped.
 *
 * Media position is deliberately not an event. `timeupdate` fires about four
 * times a second and changes nothing a layout renders — the media element draws
 * its own clock — so position lives in the session slice and surfaces here only
 * through the cue transitions it caused. Emitting per tick would republish the
 * composition four times a second for no visible change.
 */
export interface TimedMediaCueChangedEvent extends ItemScopedControllerEventBase {
	type: "timed-media-cue-changed";
	/** The cue that activated in this transition, where one did. */
	activatedCueIdentifier?: string;
	/** The gate that released in this transition, where one did. */
	releasedCueIdentifier?: string;
	activeCueIdentifier?: string;
	visitedCueIdentifiers: string[];
	completedCueIdentifiers: string[];
	revealedItemIds: string[];
	gateCueIdentifier: string | null;
	mediaCompleted: boolean;
	aggregateComplete: boolean;
}

/**
 * Media audio is now running, so any other audio owner must yield.
 *
 * The section owns no audio but the port, and no policy over read-aloud, so this
 * announces rather than decides: the toolkit holds both capabilities and arbitrates
 * between them. Emitted only where playback actually stood — a gate that re-paused
 * on the same `play` produced no audio, and silencing read-aloud for it would take
 * an accommodation away for nothing.
 *
 * Carries no payload. "Media audio started" is the whole fact; position and cue
 * state travel on `timed-media-cue-changed`.
 */
export interface TimedMediaAudioStartedEvent
	extends ItemScopedControllerEventBase {
	type: "timed-media-audio-started";
}

/**
 * A playback policy the attached media time source cannot carry out. Cues still
 * fire and state is still recorded; enforcement is what degrades, and it says so
 * rather than appearing to hold.
 */
export interface TimedMediaPolicyDegradedEvent
	extends ItemScopedControllerEventBase {
	type: "timed-media-policy-degraded";
	degradations: TimedMediaDegradation[];
}

/**
 * Authored `timedMedia` this section cannot deliver. The section still renders as
 * an ordinary section with every item visible; cues that silently never fire is
 * the outcome this reports instead of producing.
 */
export interface TimedMediaInvalidEvent extends ItemScopedControllerEventBase {
	type: "timed-media-invalid";
	errors: TimedMediaValidationError[];
}

export type SectionControllerChangeEvent =
	| ItemSessionDataChangedEvent
	| ItemSessionMetaChangedEvent
	| ItemSelectedEvent
	| SectionNavigationChangeEvent
	| SectionSessionAppliedEvent
	| ContentLoadedEvent
	| ItemPlayerErrorEvent
	| ItemCompleteChangedEvent
	| SectionLoadingCompleteEvent
	| SectionItemsCompleteChangedEvent
	| SectionErrorEvent
	| FormativeTryRecordedEvent
	| FormativeRevealChangedEvent
	| SectionMasteryChangedEvent
	| TimedMediaCueChangedEvent
	| TimedMediaAudioStartedEvent
	| TimedMediaPolicyDegradedEvent
	| TimedMediaInvalidEvent;

export type SectionControllerChangeListener = (
	event: SectionControllerChangeEvent,
) => void;
