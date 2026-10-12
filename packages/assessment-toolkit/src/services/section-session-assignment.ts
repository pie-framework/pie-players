/**
 * A host-assigned section session, resolved against the session a live
 * controller already holds.
 *
 * The rules are the ones `ItemController.setSession` applies to one item:
 * - a value whose content equals the current session is a no-op, so echoing a
 *   snapshot back into the `session` property applies nothing;
 * - an item session with neither a response value nor a response field leaves
 *   an item session that holds responses in place. The embedded item player
 *   applies the same rule when the section hands the session down, so applying
 *   it at section level keeps the controller and its item players from
 *   diverging.
 *
 * A controller that holds no session yet takes the value as assigned.
 */

import {
	hasResponseField,
	hasResponseValue,
} from "@pie-players/pie-players-shared/pie";
import type { SectionControllerSessionState } from "@pie-players/pie-players-shared/types";
import { structurallyEqual } from "../utils/structural-equality.js";
import { isPlainRecord } from "@pie-players/pie-players-shared/object";

/** An entry is canonical (`{ itemIdentifier, session, ... }`) or the raw item session. */
function itemSessionOf(entry: unknown): unknown {
	return isPlainRecord(entry) && isPlainRecord(entry.session) ? entry.session : entry;
}

function sameItemSessions(next: unknown, current: unknown): boolean {
	const nextSessions = isPlainRecord(next) ? next : {};
	const currentSessions = isPlainRecord(current) ? current : {};
	const itemIds = new Set([
		...Object.keys(nextSessions),
		...Object.keys(currentSessions),
	]);
	for (const itemId of itemIds) {
		if (
			!structurallyEqual(
				itemSessionOf(nextSessions[itemId]),
				itemSessionOf(currentSessions[itemId]),
			)
		) {
			return false;
		}
	}
	return true;
}

/**
 * Whether applying `next` would leave `current` as it is. A field `next` leaves
 * out is unchanged, and item sessions compare by their session payload, so a
 * raw `{ id, data }` matches the canonical entry the controller stored for it.
 */
function sameSessionContent(
	next: SectionControllerSessionState,
	current: SectionControllerSessionState,
): boolean {
	for (const [key, value] of Object.entries(next)) {
		if (value === undefined) continue;
		if (key === "itemSessions") {
			if (!sameItemSessions(value, current.itemSessions)) return false;
			continue;
		}
		if (!structurallyEqual(value, (current as unknown as Record<string, unknown>)[key])) {
			return false;
		}
	}
	return true;
}

/**
 * The session to apply in replace mode, or `null` when applying `next` would
 * change nothing.
 */
export function resolveSectionSessionAssignment(
	current: SectionControllerSessionState | null | undefined,
	next: SectionControllerSessionState,
): SectionControllerSessionState | null {
	if (!current) return next;
	const itemSessions: Record<string, unknown> = isPlainRecord(next.itemSessions)
		? { ...next.itemSessions }
		: {};
	const currentItemSessions = isPlainRecord(current.itemSessions)
		? current.itemSessions
		: {};
	for (const [itemId, currentEntry] of Object.entries(currentItemSessions)) {
		if (!hasResponseValue(itemSessionOf(currentEntry))) continue;
		const assigned = itemSessionOf(itemSessions[itemId]);
		if (hasResponseValue(assigned) || hasResponseField(assigned)) continue;
		itemSessions[itemId] = currentEntry;
	}
	const resolved: SectionControllerSessionState = { ...next, itemSessions };
	return sameSessionContent(resolved, current) ? null : resolved;
}
