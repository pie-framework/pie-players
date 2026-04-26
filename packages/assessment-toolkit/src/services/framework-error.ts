import type { ToolConfigDiagnostic } from "./tool-config-validation.js";

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
	| "unknown";

export type FrameworkErrorSeverity = "warning" | "error";

export interface FrameworkErrorModel {
	kind: FrameworkErrorKind;
	severity: FrameworkErrorSeverity;
	source: string;
	message: string;
	details: string[];
	recoverable: boolean;
	cause?: unknown;
}

export function toFrameworkErrorModel(args: {
	kind: FrameworkErrorKind;
	severity?: FrameworkErrorSeverity;
	source: string;
	message: string;
	details?: string[];
	recoverable?: boolean;
	cause?: unknown;
}): FrameworkErrorModel {
	return {
		kind: args.kind,
		severity: args.severity ?? "error",
		source: args.source,
		message: args.message,
		details: [...(args.details || [])],
		recoverable: args.recoverable === true,
		cause: args.cause,
	};
}

export function frameworkErrorFromUnknown(args: {
	kind: FrameworkErrorKind;
	source: string;
	error: unknown;
	recoverable?: boolean;
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
		| "section-controller-dispose";
	providerId?: string;
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
};

/**
 * Build a {@link FrameworkErrorModel} from a coordinator-side error +
 * context pair.
 *
 * Maps `context.phase` to the canonical {@link FrameworkErrorKind} and
 * synthesizes a `source` from `context.providerId` when present
 * (`pie-toolkit-coordinator/<providerId>`); falls back to a phase-tagged
 * source (`pie-toolkit-coordinator:<phase>`) otherwise. Forwards the
 * original `error` as `cause` so hosts that care about the underlying
 * `Error` keep getting it.
 *
 * Recoverable defaults to `false` (most coordinator-phase failures are
 * not auto-recovered today). Override with `recoverable: true` for the
 * phases where the coordinator continues operating after the failure.
 */
export function frameworkErrorFromCoordinatorContext(args: {
	error: unknown;
	context: FrameworkErrorCoordinatorContext;
	recoverable?: boolean;
}): FrameworkErrorModel {
	const kind = COORDINATOR_PHASE_TO_KIND[args.context.phase];
	const source = args.context.providerId
		? `pie-toolkit-coordinator/${args.context.providerId}`
		: `pie-toolkit-coordinator:${args.context.phase}`;
	return frameworkErrorFromUnknown({
		kind,
		source,
		error: args.error,
		recoverable: args.recoverable,
	});
}

export function frameworkErrorFromToolConfigDiagnostics(args: {
	source: string;
	diagnostics: ToolConfigDiagnostic[];
	recoverable?: boolean;
}): FrameworkErrorModel {
	const details = args.diagnostics.map(
		(diagnostic) => `${diagnostic.path}: ${diagnostic.message}`,
	);
	const message =
		details.length > 0
			? "Invalid tools config."
			: "Invalid tools config (no diagnostics details were provided).";
	return toFrameworkErrorModel({
		kind: "tool-config",
		source: args.source,
		message,
		details,
		recoverable: args.recoverable,
	});
}

export function formatFrameworkErrorForConsole(error: FrameworkErrorModel): string {
	const prefix = `[pie-framework:${error.kind}:${error.source}]`;
	if (error.details.length === 0) return `${prefix} ${error.message}`;
	return `${prefix} ${error.message}\n- ${error.details.join("\n- ")}`;
}
