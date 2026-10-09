/**
 * Where a tool failed, as reported to the toolkit's tool failure policy.
 *
 * `tool-module-load` follows the start-failure policy: the tool degrades unless
 * policy grants it, in which case the failure is fatal. Every other phase keeps a
 * recovery at its report site and is recoverable:
 *
 * - `tool-request-open`: a toolbar threw opening a requested tool; the request
 *   reports that no toolbar claimed it.
 * - `tool-request-host-check`: a toolbar threw answering whether it hosts a tool,
 *   and is passed by.
 * - `tool-visibility`: a registration's relevance check threw; the tool is
 *   withheld unless a grant protects it.
 * - `tool-applicability`: a registration's applicability gate threw; the tool
 *   counts as applicable.
 * - `tool-state-load`, `tool-state-save`: a tool could not restore or keep its
 *   own learner state, as the annotation toolbar's highlights.
 * - `tool-playback`: a tool could not play, seek or change the rate of speech
 *   after speech started; a start failure is reported as `tts-init`.
 */
export type ToolFailurePhase =
	| "tool-module-load"
	| "tool-request-open"
	| "tool-request-host-check"
	| "tool-visibility"
	| "tool-applicability"
	| "tool-state-load"
	| "tool-state-save"
	| "tool-playback";

/** The coordinator surface a failing tool reports through. */
export interface ToolFailureReporter {
	reportToolFailure?(
		toolId: string,
		phase: ToolFailurePhase,
		error: unknown,
	): void;
}

/**
 * Report a tool failure to the coordinator in scope, or log it when there is
 * none, as for a tool mounted outside a toolkit.
 */
export function reportToolFailure(
	coordinator: ToolFailureReporter | null | undefined,
	toolId: string,
	phase: ToolFailurePhase,
	error: unknown,
): void {
	if (typeof coordinator?.reportToolFailure === "function") {
		coordinator.reportToolFailure(toolId, phase, error);
		return;
	}
	console.error(`[${toolId}] ${phase} failed:`, error);
}
