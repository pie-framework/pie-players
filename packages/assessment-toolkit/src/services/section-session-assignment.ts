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

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** An entry is canonical (`{ itemIdentifier, session, ... }`) or the raw item session. */
function itemSessionOf(entry: unknown): unknown {
	return isRecord(entry) && isRecord(entry.session) ? entry.session : entry;
}

function contentEquals(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
			return false;
		}
		return a.every((entry, index) => contentEquals(entry, b[index]));
	}
	if (!isRecord(a) || !isRecord(b)) return false;
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const key of keys) {
		if (!contentEquals(a[key], b[key])) return false;
	}
	return true;
}

function sameItemSessions(next: unknown, current: unknown): boolean {
	const nextSessions = isRecord(next) ? next : {};
	const currentSessions = isRecord(current) ? current : {};
	const itemIds = new Set([
		...Object.keys(nextSessions),
		...Object.keys(currentSessions),
	]);
	for (const itemId of itemIds) {
		if (
			!contentEquals(
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
		if (!contentEquals(value, (current as unknown as Record<string, unknown>)[key])) {
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
	const itemSessions: Record<string, unknown> = isRecord(next.itemSessions)
		? { ...next.itemSessions }
		: {};
	const currentItemSessions = isRecord(current.itemSessions)
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
