export type SessionEmitPolicyState = {
	lastSessionEventSignatureByItemId: Map<string, string>;
	lastMetadataSignatureByItemId: Map<string, string>;
};

export function createSessionEmitPolicyState(): SessionEmitPolicyState {
	return {
		lastSessionEventSignatureByItemId: new Map<string, string>(),
		lastMetadataSignatureByItemId: new Map<string, string>(),
	};
}

export function resetSessionEmitPolicyState(state: SessionEmitPolicyState): void {
	state.lastSessionEventSignatureByItemId.clear();
	state.lastMetadataSignatureByItemId.clear();
}

export function shouldEmitCanonicalSessionEvent(args: {
	state: SessionEmitPolicyState;
	itemId: string;
	payload: Record<string, unknown>;
}): boolean {
	const { state, itemId, payload } = args;
	if (isMetadataOnlyEvent(payload)) {
		const metadataSignature = getMetadataOnlySignature(payload);
		const previousMetadataSignature = state.lastMetadataSignatureByItemId.get(itemId);
		if (previousMetadataSignature === metadataSignature) {
			return false;
		}
		state.lastMetadataSignatureByItemId.set(itemId, metadataSignature);
	}
	const signature = getSessionEventSemanticSignature(payload);
	const previousSignature = state.lastSessionEventSignatureByItemId.get(itemId);
	if (previousSignature === signature) {
		return false;
	}
	state.lastSessionEventSignatureByItemId.set(itemId, signature);
	return true;
}

function getSessionEventSemanticSignature(payload: Record<string, unknown>): string {
	const semanticPayload = { ...payload };
	delete semanticPayload.timestamp;
	delete semanticPayload.sourceRuntimeId;
	try {
		return JSON.stringify(semanticPayload);
	} catch {
		return String(semanticPayload.itemId || "");
	}
}

function isMetadataOnlyEvent(payload: Record<string, unknown>): boolean {
	return payload.intent === "metadata-only";
}

function getMetadataOnlySignature(payload: Record<string, unknown>): string {
	try {
		return JSON.stringify({
			itemId: payload.itemId,
			canonicalItemId: payload.canonicalItemId,
			intent: payload.intent,
			complete: payload.complete ?? null,
			component: payload.component ?? null,
		});
	} catch {
		return String(payload.itemId || "");
	}
}
