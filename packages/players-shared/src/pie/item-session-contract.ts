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

export function normalizeItemSessionContainer(
	input: unknown,
	fallbackSessionId: string = DEFAULT_SESSION_ID,
): ItemSessionContainer {
	if (input && typeof input === "object") {
		const candidate = input as Record<string, unknown>;
		if (Array.isArray(candidate.data)) {
			return {
				id:
					typeof candidate.id === "string"
						? candidate.id
						: fallbackSessionId,
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
	if (Array.isArray(value)) return value.some((entry) => hasResponseValue(entry));
	if (typeof value !== "object") return false;
	for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
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

function mergeElementIntoSession(
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
				? { ...(existing as Record<string, unknown>), ...entry }
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
		sessionDetail && typeof sessionDetail === "object" && "session" in sessionDetail
			? sessionDetail.session
			: args.sessionDetail;

	const safeItemId =
		typeof args.itemId === "string" && args.itemId
			? args.itemId
			: typeof (actualSession as Record<string, unknown> | null)?.id === "string"
				? String((actualSession as Record<string, unknown>).id)
				: "";

	if (!actualSession || typeof actualSession !== "object") {
		return {
			itemId: safeItemId,
			session: null,
			intent: "metadata-only",
			component:
				typeof sessionDetail.component === "string" ? sessionDetail.component : undefined,
			complete:
				typeof sessionDetail.complete === "boolean" ? sessionDetail.complete : undefined,
		};
	}

	const candidate = actualSession as Record<string, unknown>;
	if (Array.isArray(candidate.data)) {
		return {
			itemId: safeItemId,
			session: normalizeItemSessionContainer(candidate, safeItemId),
			intent: "replace-item-session",
			component:
				typeof sessionDetail.component === "string" ? sessionDetail.component : undefined,
			complete:
				typeof sessionDetail.complete === "boolean" ? sessionDetail.complete : undefined,
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
			component:
				typeof sessionDetail.component === "string" ? sessionDetail.component : undefined,
			complete:
				typeof sessionDetail.complete === "boolean" ? sessionDetail.complete : undefined,
		};
	}

	const component =
		typeof sessionDetail.component === "string"
			? sessionDetail.component
			: typeof candidate.component === "string"
				? candidate.component
				: "response";
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
		complete:
			typeof sessionDetail.complete === "boolean" ? sessionDetail.complete : undefined,
	};
}
