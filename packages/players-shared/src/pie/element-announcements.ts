/**
 * Which delivery-element `session-changed` announcements a renderer forwards.
 *
 * Every update pass hands each element its session again, and an element that
 * announces from its `session` setter announces on every pass, with its own
 * unchanged `complete`. Forwarded, those echoes follow every learner response
 * and let the last element to announce set the item's completion for a host.
 */

/**
 * JSON with object keys in sorted order, so a session entry rebuilt with its
 * keys in another order signs the same. An object met a second time is written
 * as `"[Circular]"`. `null` when the value cannot be serialized.
 */
export function sessionSignature(value: unknown): string | null {
	try {
		const seen = new WeakSet<object>();
		const json = JSON.stringify(value, (_key, nested: unknown) => {
			if (!nested || typeof nested !== "object" || Array.isArray(nested)) {
				return nested;
			}
			if (seen.has(nested)) return "[Circular]";
			seen.add(nested);
			const record = nested as Record<string, unknown>;
			const sorted: Record<string, unknown> = {};
			for (const key of Object.keys(record).sort()) sorted[key] = record[key];
			return sorted;
		});
		return json ?? "undefined";
	} catch {
		return null;
	}
}

export interface ElementAnnouncement {
	/** The element that dispatched. */
	element: EventTarget | null;
	/** `complete` from the event detail. */
	complete: unknown;
	/** The session the element holds. */
	session: unknown;
	/** A commit at a teardown, navigation or page-hidden seam. */
	commit: boolean;
}

/**
 * Admits an announcement when it is the element's first, or when its `complete`
 * or the element's session differs from the last announcement admitted from
 * that element. A commit is always admitted. Keyed by the element instance:
 * `component` repeats across two elements of one type.
 */
export function createElementAnnouncementFilter(): (
	announcement: ElementAnnouncement,
) => boolean {
	const admitted = new WeakMap<object, string>();
	return ({ element, complete, session, commit }) => {
		if (!element || typeof element !== "object") return true;
		const signature = sessionSignature({ complete, session });
		if (signature === null) return true;
		if (!commit && admitted.get(element) === signature) return false;
		admitted.set(element, signature);
		return true;
	};
}

/**
 * Whether an element holds a session other than its entry of the item's
 * session, by identity and by content. Before the renderer's update pass, that
 * is the placeholder its first initialization pass handed it, and a `complete`
 * it announces describes the placeholder. An element with no readable session
 * holds none.
 */
export function holdsPlaceholderSession(
	held: unknown,
	entry: unknown,
): boolean {
	if (held === undefined || held === entry) return false;
	return sessionSignature(held) !== sessionSignature(entry);
}
