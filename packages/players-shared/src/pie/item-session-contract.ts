export type ItemSessionContainer = {
	id: string;
	data: unknown[];
};

export type ItemSessionUpdateIntent =
	| "replace-item-session"
	| "merge-element-session"
	| "metadata-only";

export type NormalizedItemSessionChange = {
	itemId: string;
	session: ItemSessionContainer | null;
	intent: ItemSessionUpdateIntent;
	component?: string;
	complete?: boolean;
};

const DEFAULT_SESSION_ID = "";
const METADATA_ONLY_SESSION_KEYS = new Set([
	"complete",
	"component",
	"timestamp",
	"sourceRuntimeId",
]);
const ELEMENT_IDENTITY_SESSION_KEYS = new Set([
	"id",
	"element",
	...METADATA_ONLY_SESSION_KEYS,
]);

function areSessionContainersEqual(
	left: ItemSessionContainer | null,
	right: ItemSessionContainer | null,
): boolean {
	if (!left && !right) return true;
	if (!left || !right) return false;
	if ((left.id || "") !== (right.id || "")) return false;
	try {
		return JSON.stringify(left.data || []) === JSON.stringify(right.data || []);
	} catch {
		return false;
	}
}

function alignPreviousSessionIdForRendererSnapshot(
	candidate: ItemSessionContainer,
	previous: ItemSessionContainer | null,
): ItemSessionContainer | null {
	if (!previous || candidate.id !== "") return previous;
	return {
		...previous,
		id: "",
	};
}

export function normalizeItemSessionContainer(
	input: unknown,
	fallbackSessionId: string = DEFAULT_SESSION_ID,
): ItemSessionContainer {
	if (input && typeof input === "object") {
		const candidate = input as Record<string, unknown>;
		if (Array.isArray(candidate.data)) {
			return {
				id: typeof candidate.id === "string" ? candidate.id : fallbackSessionId,
				data: candidate.data,
			};
		}
		if (Array.isArray(input)) {
			return { id: fallbackSessionId, data: input };
		}
		return { id: fallbackSessionId, data: [input] };
	}
	if (Array.isArray(input)) {
		return { id: fallbackSessionId, data: input };
	}
	return { id: fallbackSessionId, data: [] };
}

export function hasResponseValue(value: unknown): boolean {
	if (value == null) return false;
	if (Array.isArray(value))
		return value.some((entry) => hasResponseValue(entry));
	if (typeof value !== "object") return false;
	for (const [key, nested] of Object.entries(
		value as Record<string, unknown>,
	)) {
		if (
			key === "value" &&
			nested !== undefined &&
			nested !== null &&
			!(typeof nested === "string" && nested.trim() === "") &&
			!(Array.isArray(nested) && nested.length === 0)
		) {
			return true;
		}
		if (hasResponseValue(nested)) return true;
	}
	return false;
}

/**
 * Keys a delivery element carries on its session that are never learner input:
 * element identity, the dispatch metadata the event contract defines, and
 * presentation state a controller writes at load (choice shuffle order).
 */
const NON_RESPONSE_SESSION_KEYS = new Set([
	"id",
	"element",
	"complete",
	"component",
	"timestamp",
	"sourceRuntimeId",
	"shuffledValues",
]);

/**
 * `id` inside an array entry is the response - which hotspot, which choice.
 * `id` inside an object property that repeats the property's own name is
 * structure, which is how `explicit-constructed-response` and `ebsr` key their
 * parts. Distinguishing the two by container is what keeps an unanswered
 * `{ value: { partA: { id: "partA" } } }` from reading as a response.
 */
function carriesContent(value: unknown, owningKey?: string): boolean {
	if (value == null) return false;
	if (typeof value === "string") return value.trim() !== "";
	if (typeof value === "number" || typeof value === "boolean") return true;
	if (Array.isArray(value)) return value.some((entry) => carriesContent(entry));
	if (typeof value !== "object") return false;
	return Object.entries(value as Record<string, unknown>).some(
		([key, nested]) => {
			if (key === "id" && owningKey !== undefined && nested === owningKey) {
				return false;
			}
			return carriesContent(nested, key);
		},
	);
}

/**
 * Whether an element session holds anything the learner put there.
 *
 * Shape-agnostic by necessity: `value` is one element's answer key, and
 * `response`, `selectedTokens`, `answers`, `answer`, `drawables` are others.
 * Anything outside the non-response key set with content in it counts, so an
 * element this function has never heard of is handled by default.
 *
 * This is the fallback discriminant for the session commit. The primary one is
 * a comparison against the session the player last observed, which needs no
 * schema knowledge at all; see `session-commit.ts`.
 */
export function hasLearnerResponse(session: unknown): boolean {
	if (!session || typeof session !== "object") return false;
	if (Array.isArray(session)) return session.some(hasLearnerResponse);
	return Object.entries(session as Record<string, unknown>).some(
		([key, value]) =>
			!NON_RESPONSE_SESSION_KEYS.has(key) && carriesContent(value, key),
	);
}

export function hasResponseField(value: unknown): boolean {
	if (value == null) return false;
	if (Array.isArray(value))
		return value.some((entry) => hasResponseField(entry));
	if (typeof value !== "object") return false;
	for (const [key, nested] of Object.entries(
		value as Record<string, unknown>,
	)) {
		if (key === "value") {
			return true;
		}
		if (hasResponseField(nested)) return true;
	}
	return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getMetadataComponent(
	sessionDetail: Record<string, unknown>,
	candidate?: Record<string, unknown>,
): string | undefined {
	if (typeof sessionDetail.component === "string")
		return sessionDetail.component;
	if (typeof candidate?.component === "string") return candidate.component;
	return undefined;
}

function getMetadataComplete(
	sessionDetail: Record<string, unknown>,
	candidate?: Record<string, unknown>,
): boolean | undefined {
	if (typeof sessionDetail.complete === "boolean")
		return sessionDetail.complete;
	if (typeof candidate?.complete === "boolean") return candidate.complete;
	return undefined;
}

function isElementIdentityOnlyPayload(
	candidate: Record<string, unknown>,
): boolean {
	const candidateKeys = Object.keys(candidate);
	const hasIdentityKey = "id" in candidate || "element" in candidate;
	return (
		hasIdentityKey &&
		!hasResponseField(candidate) &&
		candidateKeys.every((key) => ELEMENT_IDENTITY_SESSION_KEYS.has(key))
	);
}

function isWrappedIdentityOnlyElementEcho(
	candidate: ItemSessionContainer,
): boolean {
	return (
		candidate.data.length > 0 &&
		candidate.data.every(
			(entry) =>
				entry &&
				typeof entry === "object" &&
				!Array.isArray(entry) &&
				isElementIdentityOnlyPayload(entry as Record<string, unknown>),
		)
	);
}

function mergeSessionEntry(
	existing: Record<string, unknown>,
	incoming: Record<string, unknown>,
): Record<string, unknown> {
	const merged = { ...existing };
	for (const [key, value] of Object.entries(incoming)) {
		const previous = merged[key];
		merged[key] =
			isPlainObject(previous) && isPlainObject(value)
				? mergeSessionEntry(previous, value)
				: value;
	}
	return merged;
}

export function mergeElementIntoSession(
	itemId: string,
	previousItemSession: unknown,
	entryId: string,
	entry: Record<string, unknown>,
): ItemSessionContainer {
	const previous = normalizeItemSessionContainer(previousItemSession, itemId);
	const nextData = [...previous.data];
	const existingIndex = nextData.findIndex((candidate) => {
		if (!candidate || typeof candidate !== "object") return false;
		return (candidate as Record<string, unknown>).id === entryId;
	});
	if (existingIndex >= 0) {
		const existing = nextData[existingIndex];
		nextData[existingIndex] =
			existing && typeof existing === "object"
				? mergeSessionEntry(existing as Record<string, unknown>, entry)
				: entry;
	} else {
		nextData.push(entry);
	}
	return {
		id: previous.id || itemId,
		data: nextData,
	};
}

export function normalizeItemSessionChange(args: {
	itemId: string;
	sessionDetail: unknown;
	previousItemSession?: unknown;
}): NormalizedItemSessionChange {
	const sessionDetail = (args.sessionDetail || {}) as Record<string, unknown>;
	const actualSession =
		sessionDetail &&
		typeof sessionDetail === "object" &&
		"session" in sessionDetail
			? sessionDetail.session
			: args.sessionDetail;

	const safeItemId =
		typeof args.itemId === "string" && args.itemId
			? args.itemId
			: typeof (actualSession as Record<string, unknown> | null)?.id ===
					"string"
				? String((actualSession as Record<string, unknown>).id)
				: "";

	if (!actualSession || typeof actualSession !== "object") {
		return {
			itemId: safeItemId,
			session: null,
			intent: "metadata-only",
			component: getMetadataComponent(sessionDetail),
			complete: getMetadataComplete(sessionDetail),
		};
	}

	const candidate = actualSession as Record<string, unknown>;
	if (Array.isArray(candidate.data)) {
		const normalizedCandidate = normalizeItemSessionContainer(
			candidate,
			safeItemId,
		);
		const previousNormalized =
			args.previousItemSession !== undefined
				? normalizeItemSessionContainer(args.previousItemSession, safeItemId)
				: null;
		const previousForMetadataComparison =
			alignPreviousSessionIdForRendererSnapshot(
				normalizedCandidate,
				previousNormalized,
			);
		const sessionDetailKeys = Object.keys(sessionDetail);
		const metadataWithSessionOnly =
			sessionDetailKeys.length > 0 &&
			sessionDetailKeys.every(
				(key) =>
					key === "session" ||
					key === "complete" ||
					key === "component" ||
					key === "timestamp" ||
					key === "sourceRuntimeId",
			);
		const hasMetadataBeyondSession = sessionDetailKeys.some(
			(key) => key !== "session",
		);
		if (
			metadataWithSessionOnly &&
			hasMetadataBeyondSession &&
			previousForMetadataComparison &&
			areSessionContainersEqual(
				normalizedCandidate,
				previousForMetadataComparison,
			)
		) {
			return {
				itemId: safeItemId,
				session: null,
				intent: "metadata-only",
				component: getMetadataComponent(sessionDetail),
				complete: getMetadataComplete(sessionDetail),
			};
		}
		if (
			metadataWithSessionOnly &&
			isWrappedIdentityOnlyElementEcho(normalizedCandidate)
		) {
			return {
				itemId: safeItemId,
				session: null,
				intent: "metadata-only",
				component: getMetadataComponent(sessionDetail),
				complete: getMetadataComplete(sessionDetail),
			};
		}
		return {
			itemId: safeItemId,
			session: normalizedCandidate,
			intent: "replace-item-session",
			component: getMetadataComponent(sessionDetail),
			complete: getMetadataComplete(sessionDetail),
		};
	}

	const candidateKeys = Object.keys(candidate);
	const isMetadataOnlyPayload =
		candidateKeys.length > 0 &&
		candidateKeys.every(
			(key) =>
				key === "complete" ||
				key === "component" ||
				key === "timestamp" ||
				key === "sourceRuntimeId",
		);
	if (isMetadataOnlyPayload) {
		return {
			itemId: safeItemId,
			session: null,
			intent: "metadata-only",
			component: getMetadataComponent(sessionDetail, candidate),
			complete: getMetadataComplete(sessionDetail, candidate),
		};
	}
	if (isElementIdentityOnlyPayload(candidate)) {
		return {
			itemId: safeItemId,
			session: null,
			intent: "metadata-only",
			component: getMetadataComponent(sessionDetail, candidate),
			complete: getMetadataComplete(sessionDetail, candidate),
		};
	}

	const component =
		getMetadataComponent(sessionDetail, candidate) ?? "response";
	const elementEntryId =
		typeof candidate.id === "string" && candidate.id ? candidate.id : component;
	const merged = mergeElementIntoSession(
		safeItemId,
		args.previousItemSession,
		elementEntryId,
		{ id: elementEntryId, ...candidate },
	);
	return {
		itemId: safeItemId,
		session: merged,
		intent: "merge-element-session",
		component,
		complete: getMetadataComplete(sessionDetail, candidate),
	};
}

function hostContainerEntries(hostContainer: unknown): unknown[] | null {
	if (!isPlainObject(hostContainer)) {
		return null;
	}
	// A frozen container is not a live view of anything, and a shared immutable
	// default (one object handed to every item) must never take one item's
	// entries. Both say the same thing: do not project here.
	if (Object.isFrozen(hostContainer)) {
		return null;
	}
	const existing = hostContainer.data;
	if (Array.isArray(existing)) {
		return Object.isFrozen(existing) ? null : existing;
	}
	if (existing === undefined || existing === null) {
		const created: unknown[] = [];
		hostContainer.data = created;
		return created;
	}
	return null;
}

function sessionEntryId(value: unknown): string | null {
	if (!isPlainObject(value)) {
		return null;
	}
	const id = value.id;
	return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Create the bare `{ id }` entry `<pie-player>` created at render time, for each
 * element the item declares. A host that indexes `data[0]` before the learner
 * has answered finds an entry instead of `undefined`.
 *
 * Only the host's container gets these. The authoritative session stays empty
 * until an element reports something, so an untouched item still saves nothing.
 */
export function ensureHostSessionEntries(
	hostContainer: unknown,
	entryIds: Iterable<string>,
): boolean {
	const entries = hostContainerEntries(hostContainer);
	if (!entries) {
		return false;
	}
	let wrote = false;
	for (const id of entryIds) {
		if (typeof id !== "string" || id.length === 0) {
			continue;
		}
		if (entries.some((entry) => sessionEntryId(entry) === id)) {
			continue;
		}
		entries.push({ id });
		wrote = true;
	}
	return wrote;
}

/**
 * Keep the container a host handed in as a live view of the session, the
 * contract `<pie-player>` had: `findOrAddSession` pushed an entry per element
 * into the host's own `data` array and the element mutated that entry in place,
 * so a host read the response off its own object. `ItemController` owns the
 * session here, so this runs one way and never reads the container back.
 *
 * The array and the entry objects keep their identity, for a host holding a
 * reference into `data`. Entries this player did not produce are left alone: in
 * a section the host's container spans every item and an item player sees one.
 *
 * Inside an entry the player's own session wins, and a key it does not carry is
 * removed - a cleared response has to clear here too, and the entry belongs to
 * the element, as it did under `<pie-player>`. A host keeping its own
 * annotations on an entry keeps them beside it, not inside it.
 */
export function projectSessionIntoHostContainer(
	hostContainer: unknown,
	liveSession: unknown,
): boolean {
	const entries = hostContainerEntries(hostContainer);
	if (!entries || !isPlainObject(hostContainer)) {
		return false;
	}
	const live = normalizeItemSessionContainer(liveSession);
	let wrote = false;
	// The host owns the container id; fill it only when there is nothing there.
	if (typeof hostContainer.id !== "string") {
		hostContainer.id = live.id;
		wrote = true;
	}
	for (const nextEntry of live.data) {
		const id = sessionEntryId(nextEntry);
		if (!id || !isPlainObject(nextEntry)) {
			continue;
		}
		const target = entries.find((entry) => sessionEntryId(entry) === id);
		if (!isPlainObject(target)) {
			entries.push({ ...nextEntry });
			wrote = true;
			continue;
		}
		for (const key of Object.keys(target)) {
			if (!(key in nextEntry)) {
				delete target[key];
				wrote = true;
			}
		}
		for (const [key, value] of Object.entries(nextEntry)) {
			if (target[key] !== value) {
				target[key] = value;
				wrote = true;
			}
		}
	}
	return wrote;
}
