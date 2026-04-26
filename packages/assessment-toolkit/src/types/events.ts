/**
 * PIE Assessment Toolkit - Event Types
 *
 * Type-safe event definitions for the assessment toolkit event system.
 * Uses discriminated unions for type safety across event bus.
 *
 * @deprecated The colon-namespaced `AssessmentToolkitEvents` map and its
 * member interfaces below are aspirational and are not emitted from any
 * production path in the toolkit. They will be removed in the next major
 * release of `@pie-players/*`. Use the documented production surfaces
 * instead:
 * - DOM `CustomEvent`s on `<pie-assessment-toolkit>` and the
 *   `<pie-section-player-*>` layout custom elements (see
 *   `packages/section-player/src/contracts/public-events.ts` and the
 *   instrumentation event map).
 * - `ToolkitCoordinator.subscribe*` helpers for tool / coordinator
 *   lifecycle and section-controller events.
 * - The framework-error contract on `<pie-assessment-toolkit>` (M3 of the
 *   Coherent Options Surface review will land the canonical surface).
 *
 * The generic `TypedEventBus<T>` itself is NOT deprecated — it is a small,
 * standards-based helper that hosts and downstream packages may still
 * use. Only the unused colon-namespaced contract layer is going away.
 */

// ============================================================================
// PIE Player Events (forwarded from IIFE player)
// ============================================================================

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface SessionChangedEvent {
	itemId: string;
	component: string;
	complete: boolean;
	session: {
		id: string;
		data: any[];
	};
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface LoadCompleteEvent {
	itemId: string;
	loadTime: number;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface PlayerErrorEvent {
	itemId: string;
	error: string;
	timestamp: number;
}

// ============================================================================
// Tool Events
// ============================================================================

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface ToolActivatedEvent {
	toolId: string;
	toolType: string;
	itemId?: string;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface ToolDeactivatedEvent {
	toolId: string;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface ToolStateChangedEvent {
	toolId: string;
	state: any;
	timestamp: number;
}

// ============================================================================
// Navigation Events
// ============================================================================

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface NavigationRequestEvent {
	direction: "next" | "previous" | "index";
	targetIndex?: number;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface ItemChangedEvent {
	previousItemId: string | null;
	currentItemId: string;
	itemIndex: number;
	totalItems: number;
	metadata?: ItemMetadata;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface CanNavigateChangedEvent {
	canNext: boolean;
	canPrevious: boolean;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface ItemMetadata {
	timeLimit?: number;
	isLastItem: boolean;
	hasPassage: boolean;
	questionNumber?: number;
}

// ============================================================================
// Assessment Lifecycle Events
// ============================================================================

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface AssessmentStartedEvent {
	assessmentId: string;
	studentId: string;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface AssessmentPausedEvent {
	assessmentId: string;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface AssessmentResumedEvent {
	assessmentId: string;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface AssessmentCompletedEvent {
	assessmentId: string;
	totalTime: number;
	itemsCompleted: number;
	timestamp: number;
}

// ============================================================================
// State Events
// ============================================================================

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface StateSavedEvent {
	type: "session" | "tool" | "assessment";
	itemId?: string;
	toolId?: string;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface StateRestoredEvent {
	type: "session" | "tool" | "assessment";
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface SyncFailedEvent {
	type: "session" | "tool" | "assessment";
	itemId?: string;
	toolId?: string;
	error: string;
	timestamp: number;
}

// ============================================================================
// Interaction Tracking Events
// ============================================================================

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export type InteractionType =
	| "response-changed"
	| "tool-activated"
	| "tool-deactivated"
	| "item-viewed"
	| "navigation-attempted"
	| "navigation-blocked"
	| "focus-lost"
	| "focus-gained"
	| "copy-attempted"
	| "paste-attempted"
	| "fullscreen-exited";

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface InteractionEvent {
	type: InteractionType;
	timestamp: number;
	itemId?: string;
	toolId?: string;
	metadata?: Record<string, any>;
}

// ============================================================================
// I18n Events
// ============================================================================

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface LocaleChangedEvent {
	locale: string;
	previousLocale: string;
	direction: "ltr" | "rtl";
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface LocaleLoadingStartEvent {
	locale: string;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface LocaleLoadingCompleteEvent {
	locale: string;
	success: boolean;
	timestamp: number;
}

/** @deprecated Member of the deprecated `AssessmentToolkitEvents` map. */
export interface LocaleLoadingErrorEvent {
	locale: string;
	error: string;
	timestamp: number;
}

// ============================================================================
// Event Map (for TypedEventBus)
// ============================================================================

/**
 * @deprecated Aspirational event map; not emitted from production paths.
 * Will be removed in the next major release of `@pie-players/*`. See the
 * file-level deprecation note for canonical replacement surfaces.
 */
export interface AssessmentToolkitEvents {
	// PIE Player events
	"player:session-changed": SessionChangedEvent;
	"player:load-complete": LoadCompleteEvent;
	"player:error": PlayerErrorEvent;

	// Tool events
	"tool:activated": ToolActivatedEvent;
	"tool:deactivated": ToolDeactivatedEvent;
	"tool:state-changed": ToolStateChangedEvent;

	// Navigation events
	"nav:next-requested": NavigationRequestEvent;
	"nav:previous-requested": NavigationRequestEvent;
	"nav:item-changed": ItemChangedEvent;
	"nav:can-navigate-changed": CanNavigateChangedEvent;

	// Assessment events
	"assessment:started": AssessmentStartedEvent;
	"assessment:paused": AssessmentPausedEvent;
	"assessment:resumed": AssessmentResumedEvent;
	"assessment:completed": AssessmentCompletedEvent;

	// State events
	"state:saved": StateSavedEvent;
	"state:restored": StateRestoredEvent;
	"state:sync-failed": SyncFailedEvent;

	// Interaction tracking
	"interaction:tracked": InteractionEvent;

	// I18n events
	"i18n:locale-changed": LocaleChangedEvent;
	"i18n:loading-start": LocaleLoadingStartEvent;
	"i18n:loading-complete": LocaleLoadingCompleteEvent;
	"i18n:loading-error": LocaleLoadingErrorEvent;
}
