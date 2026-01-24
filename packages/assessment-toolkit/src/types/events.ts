/**
 * PIE Assessment Toolkit - Event Types
 *
 * Type-safe event definitions for the assessment toolkit event system.
 * Uses discriminated unions for type safety across event bus.
 *
 * These events are standard contracts between toolkit services,
 * PIE players, tools, and product implementations.
 */

// ============================================================================
// PIE Player Events (forwarded from IIFE player)
// ============================================================================

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

export interface LoadCompleteEvent {
	itemId: string;
	loadTime: number;
	timestamp: number;
}

export interface PlayerErrorEvent {
	itemId: string;
	error: string;
	timestamp: number;
}

// ============================================================================
// Tool Events
// ============================================================================

export interface ToolActivatedEvent {
	toolId: string;
	toolType: string;
	itemId?: string;
	timestamp: number;
}

export interface ToolDeactivatedEvent {
	toolId: string;
	timestamp: number;
}

export interface ToolStateChangedEvent {
	toolId: string;
	state: any;
	timestamp: number;
}

// ============================================================================
// Navigation Events
// ============================================================================

export interface NavigationRequestEvent {
	direction: "next" | "previous" | "index";
	targetIndex?: number;
	timestamp: number;
}

export interface ItemChangedEvent {
	previousItemId: string | null;
	currentItemId: string;
	itemIndex: number;
	totalItems: number;
	metadata?: ItemMetadata;
	timestamp: number;
}

export interface CanNavigateChangedEvent {
	canNext: boolean;
	canPrevious: boolean;
	timestamp: number;
}

export interface ItemMetadata {
	timeLimit?: number;
	isLastItem: boolean;
	hasPassage: boolean;
	questionNumber?: number;
}

// ============================================================================
// Assessment Lifecycle Events
// ============================================================================

export interface AssessmentStartedEvent {
	assessmentId: string;
	studentId: string;
	timestamp: number;
}

export interface AssessmentPausedEvent {
	assessmentId: string;
	timestamp: number;
}

export interface AssessmentResumedEvent {
	assessmentId: string;
	timestamp: number;
}

export interface AssessmentCompletedEvent {
	assessmentId: string;
	totalTime: number;
	itemsCompleted: number;
	timestamp: number;
}

// ============================================================================
// State Events
// ============================================================================

export interface StateSavedEvent {
	type: "session" | "tool" | "assessment";
	itemId?: string;
	toolId?: string;
	timestamp: number;
}

export interface StateRestoredEvent {
	type: "session" | "tool" | "assessment";
	timestamp: number;
}

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

export interface LocaleChangedEvent {
	locale: string;
	previousLocale: string;
	direction: "ltr" | "rtl";
	timestamp: number;
}

export interface LocaleLoadingStartEvent {
	locale: string;
	timestamp: number;
}

export interface LocaleLoadingCompleteEvent {
	locale: string;
	success: boolean;
	timestamp: number;
}

export interface LocaleLoadingErrorEvent {
	locale: string;
	error: string;
	timestamp: number;
}

// ============================================================================
// Event Map (for TypedEventBus)
// ============================================================================

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
