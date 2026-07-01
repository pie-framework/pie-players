import {
	hasResponseValue,
	normalizeItemSessionChange,
	type CanonicalItemSessionContainer,
} from "@pie-players/pie-players-shared";

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

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasExplicitResponseField(value: unknown): boolean {
	if (value == null) return false;
	if (Array.isArray(value)) {
		return value.some((entry) => hasExplicitResponseField(entry));
	}
	if (!isRecord(value)) return false;
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

export function resolveSessionChangedForwarding(args: {
	currentSession: CanonicalItemSessionContainer;
	currentSignature: string;
	detail: unknown;
	itemId: string;
}): SessionChangedForwardingResult {
	const detailObj = isRecord(args.detail) ? args.detail : null;
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

	return {
		action: "forward",
		changed,
		detail: metadataOnly && !changed ? detailObj : { ...detailObj, session },
		metadataOnly,
		session,
		signature,
	};
}
