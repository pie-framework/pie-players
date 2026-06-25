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
	if (typeof sessionDetail.component === "string") return sessionDetail.component;
	if (typeof candidate?.component === "string") return candidate.component;
	return undefined;
}

function getMetadataComplete(
	sessionDetail: Record<string, unknown>,
	candidate?: Record<string, unknown>,
): boolean | undefined {
	if (typeof sessionDetail.complete === "boolean") return sessionDetail.complete;
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
		if (
			metadataWithSessionOnly &&
			previousNormalized &&
			areSessionContainersEqual(normalizedCandidate, previousNormalized)
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

	const component = getMetadataComponent(sessionDetail, candidate) ?? "response";
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
