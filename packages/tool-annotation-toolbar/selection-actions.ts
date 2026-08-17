/**
 * Validation for host-supplied selection actions.
 *
 * Pure so the shape rules are testable without a DOM, the same reason
 * `selection-keyboard.ts` is separate from the component.
 *
 * The strip renders whatever it is handed, which means a malformed entry would
 * otherwise reach the template and throw during render — taking the highlight
 * controls down with it. Each entry is checked and a bad one dropped, so a
 * composer's mistake costs its own action and nothing else.
 */

import type { ToolSelectionAction } from '@pie-players/pie-assessment-toolkit';

/** Longest label the strip renders; past this the button crowds out the swatches. */
export const MAX_SELECTION_ACTION_LABEL = 40;

/**
 * Whether `value` is a usable action.
 *
 * `isAvailable` is not called here — that is a question about the current state of
 * the assessment, not about the shape of the object, and it is asked per selection.
 */
export function isSelectionActionShape(
	value: unknown,
): value is ToolSelectionAction {
	if (!value || typeof value !== 'object') return false;
	const action = value as Partial<ToolSelectionAction>;
	if (typeof action.id !== 'string' || action.id.trim().length === 0)
		return false;
	if (typeof action.label !== 'string' || action.label.trim().length === 0)
		return false;
	if (action.label.length > MAX_SELECTION_ACTION_LABEL) return false;
	if (typeof action.run !== 'function') return false;
	if (action.iconSvg !== undefined && typeof action.iconSvg !== 'string')
		return false;
	if (action.tooltip !== undefined && typeof action.tooltip !== 'string')
		return false;
	if (action.isAvailable !== undefined && typeof action.isAvailable !== 'function')
		return false;
	return true;
}

/**
 * Whether an action wants to be offered right now.
 *
 * A throwing `isAvailable` answers no. A composer's predicate reaches into policy,
 * and the strip is mid-render on a live selection: dropping the one action is the
 * only outcome that leaves the learner with the rest of the strip.
 */
export function isSelectionActionAvailable(action: ToolSelectionAction): boolean {
	if (typeof action.isAvailable !== 'function') return true;
	try {
		return action.isAvailable() !== false;
	} catch (error) {
		console.warn(
			`[AnnotationToolbar] Selection action "${action.id}" failed its availability check:`,
			error,
		);
		return false;
	}
}

/**
 * The actions to render, in the order given, with duplicate ids dropped.
 *
 * Ids are the button keys and land in `data-pie-selection-action`, so a duplicate
 * would make two buttons indistinguishable to a test and to anything a host
 * queries the strip with.
 */
export function usableSelectionActions(
	value: unknown,
): ToolSelectionAction[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const usable: ToolSelectionAction[] = [];
	value.forEach((entry, index) => {
		if (!isSelectionActionShape(entry)) {
			console.warn(
				`[AnnotationToolbar] Ignoring invalid selection action at index ${index}. Expected { id, label, run } with valid types.`,
			);
			return;
		}
		if (seen.has(entry.id)) {
			console.warn(
				`[AnnotationToolbar] Ignoring duplicate selection action id "${entry.id}".`,
			);
			return;
		}
		if (!isSelectionActionAvailable(entry)) return;
		seen.add(entry.id);
		usable.push(entry);
	});
	return usable;
}
