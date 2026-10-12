import type { ToolPolicyDecision } from "../policy/core/decision-types.js";
import { structurallyEqual } from "../utils/structural-equality.js";

/** What a toolbar renders from in a policy decision, per visible tool. */
export interface DecidedToolbarTool {
	toolId: string;
	required: boolean;
	alwaysAvailable: boolean;
	parameters?: Record<string, unknown>;
}

/**
 * A toolbar's decided tools across re-decisions. The tracker returns its
 * previous list while `renderVersion` is unchanged and the decision shows the
 * same tools, so a re-decision that changes nothing the toolbar renders from
 * keeps the rendered tools: rendering swaps in fresh tool elements, whose state
 * starts over. A new `renderVersion` always yields a new list.
 */
export function createDecidedToolsTracker(): (
	decision: ToolPolicyDecision | null,
	renderVersion: number,
) => readonly DecidedToolbarTool[] | null {
	let last: {
		renderVersion: number;
		tools: readonly DecidedToolbarTool[];
	} | null = null;
	return (decision, renderVersion) => {
		if (!decision) {
			last = null;
			return null;
		}
		const tools = decision.visibleTools.map((entry) => ({
			toolId: entry.toolId,
			required: entry.required,
			alwaysAvailable: entry.alwaysAvailable,
			parameters: entry.parameters,
		}));
		if (
			last?.renderVersion === renderVersion &&
			structurallyEqual(last.tools, tools)
		) {
			return last.tools;
		}
		last = { renderVersion, tools };
		return tools;
	};
}
