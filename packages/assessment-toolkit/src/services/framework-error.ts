import type { ToolConfigDiagnostic } from "./tool-config-validation.js";

export type FrameworkErrorKind =
	| "tool-config"
	| "runtime-init"
	| "runtime-dispose"
	| "coordinator-init"
	| "provider-init"
	| "provider-register"
	| "tts-init"
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
