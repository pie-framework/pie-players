/**
 * Which capabilities appear as actions on the learner's current selection.
 *
 * The one place that pairs a selection gateway to the tools it can open. The gateway
 * renders what it is handed and names nothing; the tools know nothing about
 * selections. Composition is the only layer allowed to know both, which is why this
 * list lives here rather than in either of them.
 *
 * A selection is a shortcut, never the only way in. Chromium does not extend a
 * selection with Shift+Arrow in non-editable content unless caret browsing is on —
 * an OS toggle that does not exist on mobile — so a sighted keyboard-only learner
 * cannot originate one at all. Every tool named here also opens from the toolbar and
 * carries its own term field.
 */

import type {
	ToolSelectionAction,
	ToolSelectionContext,
	ToolSurfaceServices,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { resolveFallbackToolIcon } from "@pie-players/pie-assessment-toolkit/tools/internal";

/**
 * Minimum this composer needs from a coordinator to offer an action at all.
 *
 * Structural rather than the full API: a host may hand the gateway a coordinator
 * predating the request seam, and offering an action it cannot service would put a
 * dead button in front of a learner.
 */
type RequestCapableCoordinator = {
	canRequestTool: (toolId: string) => boolean;
	requestTool: (request: {
		toolId: string;
		params?: Record<string, unknown>;
	}) => boolean;
};

function asRequestCapable(
	coordinator: ToolSurfaceServices["toolkitCoordinator"],
): RequestCapableCoordinator | null {
	const candidate = coordinator as RequestCapableCoordinator | null;
	if (typeof candidate?.canRequestTool !== "function") return null;
	if (typeof candidate.requestTool !== "function") return null;
	return candidate;
}

interface SelectionActionSpec {
	toolId: string;
	/** Accessible name. Names the selection, as the gateway's own controls do. */
	label: string;
	tooltip: string;
	/** Resolved through the toolkit's map, so this button and the tool's toolbar
	 *  button draw the same shape. */
	icon: string;
}

const SELECTION_ACTION_SPECS: readonly SelectionActionSpec[] = [
	{
		toolId: "dictionary",
		label: "Look up selected text in dictionary",
		tooltip: "Look up",
		icon: "book-open",
	},
	{
		toolId: "pictureDictionary",
		label: "Show pictures for selected text",
		tooltip: "Show pictures",
		icon: "photo",
	},
];

/**
 * Actions for the gateway to render, given the services it was handed.
 *
 * Rebuilt on every sync rather than captured once: a host calling
 * `updateAssessment` mid-session swaps the coordinator without remounting the
 * gateway, and an action closing over the previous one would open a tool in a
 * session the learner has left.
 */
export function buildSelectionActions(
	services: ToolSurfaceServices,
): ToolSelectionAction[] {
	const coordinator = asRequestCapable(services.toolkitCoordinator);
	if (!coordinator) return [];
	return SELECTION_ACTION_SPECS.map((spec): ToolSelectionAction => {
		const iconSvg = resolveFallbackToolIcon(spec.icon) ?? undefined;
		return {
			id: spec.toolId,
			label: spec.label,
			tooltip: spec.tooltip,
			iconSvg,
			// Asked per selection. A tool the PNP does not grant, or that no toolbar in
			// this section hosts, is absent rather than present and inert.
			isAvailable: () => coordinator.canRequestTool(spec.toolId),
			run: (selection: ToolSelectionContext) => {
				const term = selection.text.trim();
				if (!term) return;
				// Both panels read the selected text from `term`. No level is named, so the
				// request takes whichever toolbar hosts the tool, preferring section scope.
				coordinator.requestTool({
					toolId: spec.toolId,
					params: { term },
				});
			},
		};
	});
}
