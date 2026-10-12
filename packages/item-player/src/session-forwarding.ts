import {
	hasLearnerResponse,
	hasResponseValue,
	normalizeItemSessionChange,
	type CanonicalItemSessionContainer,
	type SessionCommitReason,
} from "@pie-players/pie-players-shared";
import { isPlainRecord } from "@pie-players/pie-players-shared/object";

export type SessionChangedForwardingResult =
	| { action: "ignore" }
	| {
			action: "forward";
			changed: boolean;
			detail: Record<string, unknown>;
			metadataOnly: boolean;
			session: CanonicalItemSessionContainer;
			signature: string;
	  };

function hasExplicitResponseField(value: unknown): boolean {
	if (value == null) return false;
	if (Array.isArray(value)) {
		return value.some((entry) => hasExplicitResponseField(entry));
	}
	if (!isPlainRecord(value)) return false;
	for (const [key, nested] of Object.entries(value)) {
		if (key === "value") return true;
		if (hasExplicitResponseField(nested)) return true;
	}
	return false;
}

function keepPreviousSessionId(
	session: CanonicalItemSessionContainer,
	previousSession: CanonicalItemSessionContainer,
): CanonicalItemSessionContainer {
	if (session.id || !previousSession.id) return session;
	return {
		...session,
		id: previousSession.id,
	};
}

/**
 * Fill in the session a committed event does not carry.
 *
 * The PIE element contract puts `complete` and `component` in the detail and
 * leaves the response on `element.session`; the renderer's own listener is what
 * merges the two before the player sees it. A commit swept at teardown reaches
 * the player directly, so the session is read off the element that dispatched -
 * without it the detail has no response field and forwarding ignores it, which
 * is the response loss this whole seam exists to prevent.
 *
 * Deliberately not exported. Enriching without marking produced a commit the
 * host could not identify, so `asCommittedDetail` below is the only way to build
 * a replay detail and the two steps cannot be separated again.
 */
function withCommittedSession(
	detail: unknown,
	target: EventTarget | null | undefined,
): unknown {
	if (!isPlainRecord(detail) || "session" in detail) return detail;
	let session: unknown;
	try {
		session = (target as { session?: unknown } | null | undefined)?.session;
	} catch {
		// A getter that throws leaves the detail as it came.
		return detail;
	}
	if (!isPlainRecord(session)) return detail;
	let copy: unknown;
	try {
		copy = JSON.parse(JSON.stringify(session));
	} catch {
		return detail;
	}
	return { ...detail, session: copy };
}

/**
 * The detail a teardown commit replays: the element's session filled in, and the
 * event marked as a commit.
 *
 * The marker cannot be left to `commitPendingSessions`'s own capture listener.
 * That listener stamps the event's `detail` object, while the enrichment above
 * returns a *copy* whenever the detail carries no `session` key - which is
 * exactly the element-owned path, where the element dispatches
 * `{ complete, component }` and the sweep has nothing to stamp for it. Both
 * listeners sit on the same node, so the snapshot is taken before the stamp and
 * the reason lands on the object the snapshot was cloned from.
 *
 * So whoever snapshots a detail mid-sweep owns the completeness of that
 * snapshot. Applying the reason here also keeps a frozen detail out of the path:
 * the copy is ours to write, the element's own detail is not.
 */
export function asCommittedDetail(
	detail: unknown,
	target: EventTarget | null | undefined,
	reason: SessionCommitReason,
): unknown {
	const enriched = withCommittedSession(detail, target);
	// A synthesized commit builds its own reason in; only the element-owned path
	// arrives without one.
	if (!isPlainRecord(enriched) || "sessionCommitReason" in enriched) return enriched;
	return { ...enriched, sessionCommitReason: reason };
}

export function resolveSessionChangedForwarding(args: {
	currentSession: CanonicalItemSessionContainer;
	currentSignature: string;
	detail: unknown;
	itemId: string;
}): SessionChangedForwardingResult {
	const detailObj = isPlainRecord(args.detail) ? args.detail : null;
	if (!detailObj) return { action: "ignore" };
	if (
		!("session" in detailObj) &&
		!hasResponseValue(detailObj) &&
		!hasExplicitResponseField(detailObj)
	) {
		return { action: "ignore" };
	}

	const normalized = normalizeItemSessionChange({
		itemId: args.itemId,
		sessionDetail: detailObj,
		previousItemSession: args.currentSession,
	});
	const metadataOnly = normalized.intent === "metadata-only";
	const session = keepPreviousSessionId(
		normalized.session ?? args.currentSession,
		args.currentSession,
	);
	const signature = JSON.stringify(session);
	const changed = signature !== args.currentSignature;
	if (!changed && !metadataOnly) return { action: "ignore" };
	// A commit read off the element carries its record, and the record's id.
	const identified =
		normalized.elementId && !("elementId" in detailObj)
			? { ...detailObj, elementId: normalized.elementId }
			: detailObj;

	return {
		action: "forward",
		changed,
		detail:
			metadataOnly && !changed
				? { ...identified, intent: "metadata-only", session: null }
				: { ...identified, session },
		metadataOnly,
		session,
		signature,
	};
}

function elementEntry(
	session: CanonicalItemSessionContainer | null | undefined,
	elementId: unknown,
): Record<string, unknown> | undefined {
	if (!session || !Array.isArray(session.data)) return undefined;
	const entries = session.data.filter(isPlainRecord);
	if (typeof elementId === "string" && elementId) {
		return entries.find((entry) => entry.id === elementId);
	}
	return entries.length === 1 ? entries[0] : undefined;
}

/**
 * Every canonical `session-changed` carries `component` and `complete`.
 *
 * An element's own event has both. A synthesized commit and a correct-response
 * population have neither of the element's, so `component` comes from the
 * element's session record or its model, and `complete` is whether the
 * element's record holds a response: the one reading a player can make without
 * element knowledge, and the one that keeps a host gating on `complete` from
 * treating a committed response as unanswered.
 */
export function withContractMetadata(
	detail: Record<string, unknown>,
	session: CanonicalItemSessionContainer | null | undefined,
	componentForElement: (elementId: string | undefined) => string | undefined,
): Record<string, unknown> {
	const hasComponent = typeof detail.component === "string";
	const hasComplete = typeof detail.complete === "boolean";
	if (hasComponent && hasComplete) return detail;
	const elementId =
		typeof detail.elementId === "string" && detail.elementId
			? detail.elementId
			: undefined;
	const entry = elementEntry(session, elementId);
	const entryId = typeof entry?.id === "string" ? entry.id : elementId;
	return {
		...detail,
		...(hasComponent
			? {}
			: {
					component:
						(typeof entry?.element === "string" && entry.element) ||
						componentForElement(entryId) ||
						"",
				}),
		...(hasComplete
			? {}
			: { complete: hasLearnerResponse(entry ?? session?.data ?? null) }),
	};
}
