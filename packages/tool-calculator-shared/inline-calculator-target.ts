import {
	type AssessmentToolkitShellContext,
	createScopedToolId,
	parseScopedToolId,
	type ToolCoordinatorApi,
	type ToolkitCoordinatorApi,
	type ToolPlacementLevel,
} from "@pie-players/pie-assessment-toolkit";

/**
 * The toolbar an inline calculator button opens the calculator through, as the
 * level and scope a tool request names.
 */
export interface InlineCalculatorTarget {
	toolId: string;
	level: ToolPlacementLevel;
	scopeId: string;
}

const CALCULATOR_TOOL_ID = "calculator";
const PLACEMENT_LEVELS: readonly string[] = ["section", "item", "passage"];

/**
 * The enclosing item's toolbar, the scope ItemToolBar derives from the same
 * shell, unless `targetToolId` names another toolbar's calculator by its scoped
 * id. `null` when neither resolves.
 */
export function resolveInlineCalculatorTarget(
	targetToolId: string,
	shell: Pick<
		AssessmentToolkitShellContext,
		"kind" | "itemId" | "canonicalItemId"
	> | null,
): InlineCalculatorTarget | null {
	if (targetToolId) {
		const parsed = parseScopedToolId(targetToolId);
		if (!parsed || !PLACEMENT_LEVELS.includes(parsed.scopeLevel)) return null;
		return {
			toolId: parsed.baseToolId,
			level: parsed.scopeLevel as ToolPlacementLevel,
			scopeId: parsed.scopeId,
		};
	}
	if (shell?.kind !== "item") return null;
	const scopeId = shell.canonicalItemId || shell.itemId;
	return scopeId ? { toolId: CALCULATOR_TOOL_ID, level: "item", scopeId } : null;
}

/** The instance id the target toolbar shows the calculator under. */
export function inlineCalculatorInstanceId(
	target: InlineCalculatorTarget,
): string {
	return createScopedToolId(target.toolId, target.level, target.scopeId);
}

/**
 * Whether the target toolbar renders the calculator under its policy, which is
 * when the button is enabled.
 */
export function canOpenInlineCalculator(
	toolkitCoordinator: Pick<ToolkitCoordinatorApi, "canRequestTool">,
	target: InlineCalculatorTarget,
): boolean {
	return (
		toolkitCoordinator.canRequestTool?.(
			target.toolId,
			target.level,
			target.scopeId,
		) === true
	);
}

/**
 * Hide the calculator when it is open; otherwise ask the target toolbar to open
 * it. `"unavailable"` when no toolbar claimed the request.
 */
export function toggleInlineCalculator(
	toolCoordinator: Pick<ToolCoordinatorApi, "isToolVisible" | "hideTool">,
	toolkitCoordinator: Pick<ToolkitCoordinatorApi, "requestTool">,
	target: InlineCalculatorTarget,
): "opened" | "closed" | "unavailable" {
	const instanceId = inlineCalculatorInstanceId(target);
	if (toolCoordinator.isToolVisible(instanceId)) {
		toolCoordinator.hideTool(instanceId);
		return "closed";
	}
	return toolkitCoordinator.requestTool?.(target) === true
		? "opened"
		: "unavailable";
}
