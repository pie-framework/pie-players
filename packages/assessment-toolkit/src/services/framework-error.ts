import type { ToolFailurePhase } from "./tool-failure.js";

export type FrameworkErrorKind =
	| "tool-config"
	| "runtime-init"
	| "runtime-dispose"
	| "coordinator-init"
	| "provider-init"
	| "provider-register"
	| "tts-init"
	| "tool-state-load"
	| "tool-state-save"
	| "section-controller-init"
	| "section-controller-dispose"
	| "tool-surface"
	/**
	 * A toolbar could not load a tool's module. Recoverable unless policy grants
	 * the tool: the toolbar withholds the tool and the assessment goes on.
	 */
	| "tool-module-load"
	/**
	 * A toolbar threw opening a requested tool or answering whether it hosts one.
	 * Recoverable: the request goes unclaimed or passes the toolbar by.
	 */
	| "tool-request"
	/**
	 * A tool registration's relevance check or applicability gate threw.
	 * Recoverable: the toolbar applies the answer a missing check would give.
	 */
	| "tool-registration"
	/**
	 * A tool could not play, seek or change the rate of speech after it started.
	 * Recoverable: the tool stays available and the learner can retry.
	 */
	| "tool-playback"
	/**
	 * A timed-media section could not deliver a policy as authored: a media time
	 * source missing `canPause` / `canRestrictSeeking` (recoverable — cues still
	 * fire and state is still recorded, only enforcement is lost), or authored
	 * `timedMedia` that failed validation (not recoverable — the section delivers
	 * as an ordinary section instead).
	 */
	| "timed-media"
	/**
	 * An interface-locale catalog failed to load. Recoverable by construction: every
	 * key still resolves through the English fallback chain, so the player renders
	 * — in the wrong language, which a host wants to know about.
	 */
	| "i18n-locale-load"
	/**
	 * A section player could not register the elements its items need before
	 * mounting them: a renderable failed the config contract, an element bundle
	 * or module failed to load, or a `preloaded` page lacks a registration the
	 * content names. Not recoverable — the section's items stay unmounted.
	 */
	| "element-preload"
	| "unknown";

export type FrameworkErrorSeverity = "warning" | "error";

/**
 * What a non-recoverable error takes down. `cohort`: the section it was reported
 * for, so the section player's readiness recovers when the learner moves to
 * another section. `runtime`: the coordinator or one of its tools, which every
 * later section runs on, so readiness stays failed. Set by the report site.
 */
export type FrameworkErrorScope = "cohort" | "runtime";

/**
 * The section a `cohort`-scoped error was reported for. A section can fail after
 * the learner has left it, so a reader holding another section ignores the error.
 */
export interface FrameworkErrorCohort {
	sectionId: string;
	attemptId?: string;
}

export interface FrameworkErrorModel {
	kind: FrameworkErrorKind;
	severity: FrameworkErrorSeverity;
	source: string;
	message: string;
	details: string[];
	recoverable: boolean;
	scope: FrameworkErrorScope;
	/** Set on a `cohort`-scoped error whose report site knows its section. */
	cohort?: FrameworkErrorCohort;
	cause?: unknown;
}

export function toFrameworkErrorModel(args: {
	kind: FrameworkErrorKind;
	severity?: FrameworkErrorSeverity;
	source: string;
	message: string;
	details?: string[];
	recoverable?: boolean;
	/** Defaults to `runtime`. */
	scope?: FrameworkErrorScope;
	cohort?: FrameworkErrorCohort;
	cause?: unknown;
}): FrameworkErrorModel {
	return {
		kind: args.kind,
		severity: args.severity ?? "error",
		source: args.source,
		message: args.message,
		details: [...(args.details || [])],
		recoverable: args.recoverable === true,
		scope: args.scope ?? "runtime",
		...(args.cohort ? { cohort: { ...args.cohort } } : {}),
		cause: args.cause,
	};
}

export function frameworkErrorFromUnknown(args: {
	kind: FrameworkErrorKind;
	source: string;
	error: unknown;
	recoverable?: boolean;
	scope?: FrameworkErrorScope;
	cohort?: FrameworkErrorCohort;
}): FrameworkErrorModel {
	const message =
		args.error instanceof Error && args.error.message.trim().length > 0
			? args.error.message
			: String(args.error || "Unknown framework error");
	return toFrameworkErrorModel({
		kind: args.kind,
		source: args.source,
		message,
		recoverable: args.recoverable,
		scope: args.scope,
		cohort: args.cohort,
		cause: args.error,
	});
}

/**
 * Coordinator-side error context shape consumed by
 * {@link frameworkErrorFromCoordinatorContext}.
 *
 * This is a deliberately small, structural mirror of
 * `ToolkitErrorContext` from `ToolkitCoordinator.ts`. It lives here (and not
 * in `ToolkitCoordinator.ts`) to keep `framework-error.ts` free of a cycle
 * back to the coordinator. `ToolkitErrorContext` remains the source of
 * truth for coordinator code; values of that type satisfy this shape.
 */
export interface FrameworkErrorCoordinatorContext {
	phase:
		| "coordinator-ready"
		| "state-load"
		| "state-save"
		| "provider-register"
		| "provider-init"
		| "tts-init"
		| "section-controller-init"
		| "section-controller-dispose"
		| ToolFailurePhase;
	toolId?: string;
	details?: Record<string, unknown>;
}

const COORDINATOR_PHASE_TO_KIND: Record<
	FrameworkErrorCoordinatorContext["phase"],
	FrameworkErrorKind
> = {
	"coordinator-ready": "coordinator-init",
	"state-load": "tool-state-load",
	"state-save": "tool-state-save",
	"provider-register": "provider-register",
	"provider-init": "provider-init",
	"tts-init": "tts-init",
	"section-controller-init": "section-controller-init",
	"section-controller-dispose": "section-controller-dispose",
	"tool-module-load": "tool-module-load",
	"tool-request-open": "tool-request",
	"tool-request-host-check": "tool-request",
	"tool-visibility": "tool-registration",
	"tool-applicability": "tool-registration",
	"tool-state-load": "tool-state-load",
	"tool-state-save": "tool-state-save",
	"tool-playback": "tool-playback",
};

/**
 * Build a {@link FrameworkErrorModel} from a coordinator-side error +
 * context pair.
 *
 * Maps `context.phase` to the canonical {@link FrameworkErrorKind} and
 * synthesizes a `source` from `context.toolId` when present
 * (`pie-toolkit-coordinator/<toolId>`); falls back to a phase-tagged
 * source (`pie-toolkit-coordinator:<phase>`) otherwise. Forwards the
 * original `error` as `cause` so hosts that care about the underlying
 * `Error` keep getting it.
 *
 * `recoverable` defaults to `false` and `scope` to `runtime`.
 */
export function frameworkErrorFromCoordinatorContext(args: {
	error: unknown;
	context: FrameworkErrorCoordinatorContext;
	recoverable?: boolean;
	scope?: FrameworkErrorScope;
	cohort?: FrameworkErrorCohort;
}): FrameworkErrorModel {
	const kind = COORDINATOR_PHASE_TO_KIND[args.context.phase];
	const source = args.context.toolId
		? `pie-toolkit-coordinator/${args.context.toolId}`
		: `pie-toolkit-coordinator:${args.context.phase}`;
	return frameworkErrorFromUnknown({
		kind,
		source,
		error: args.error,
		recoverable: args.recoverable,
		scope: args.scope,
		cohort: args.cohort,
	});
}

export function formatFrameworkErrorForConsole(
	error: FrameworkErrorModel,
): string {
	const prefix = `[pie-framework:${error.kind}:${error.source}]`;
	if (error.details.length === 0) return `${prefix} ${error.message}`;
	return `${prefix} ${error.message}\n- ${error.details.join("\n- ")}`;
}
