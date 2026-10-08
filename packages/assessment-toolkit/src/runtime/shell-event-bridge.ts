import {
	commitPendingSessions,
	createPieLogger,
	normalizeItemSessionChange,
} from "@pie-players/pie-players-shared";
import type { ShellContextKind } from "../context/assessment-toolkit-context.js";
import {
	type InternalContentLoadedDetail,
	type InternalItemPlayerErrorDetail,
	type InternalItemSessionChangedDetail,
	type ItemSessionChangedDetail,
	PIE_INTERNAL_CONTENT_LOADED_EVENT,
	PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT,
	PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT,
	PIE_ITEM_SESSION_CHANGED_EVENT,
} from "./registration-events.js";
import { dispatchCrossBoundaryEvent } from "./tool-host-contract.js";

/**
 * `section`: the shell is its content's only channel to the section. The
 * player's `session-changed`, `load-complete` and `player-error` stop at the
 * shell and travel on as the runtime's internal events, with an item's
 * response changes also announced as `item-session-changed`.
 *
 * `plain`: the host owns the player and listens to it, so the player's events
 * pass through untouched. The runtime still hears that the content loaded or
 * failed, which a section bound later replays; sessions stay with the host.
 */
export type ShellEventBridgeMode = "section" | "plain";

export interface ShellEventBridgeIdentity {
	itemId: string;
	canonicalItemId?: string;
	contentKind?: string;
}

export interface ShellEventBridgeOptions {
	/** The shell element, where the player's events arrive and leave from. */
	host: HTMLElement;
	kind: ShellContextKind;
	/** Read as each event arrives, so a prop change needs no rebinding. */
	identity: () => ShellEventBridgeIdentity;
	/** Read as each event arrives. */
	mode: () => ShellEventBridgeMode;
	/** Sends an event addressed to the shell's runtime. */
	send: (type: string, detail: object) => void;
}

export interface ShellEventBridge {
	/**
	 * Gives an item's pending session one last chance to reach the section, then
	 * stops listening. The commit runs while the subtree is still attached, so its
	 * `session-changed` arrives at the bridge before it is unbound.
	 */
	disconnect: () => void;
}

/**
 * Elements repeat themselves, a `complete` echo most often, so a session event
 * is forwarded only when it differs from the last one, apart from when and
 * through which runtime it was stamped.
 */
function sessionEventFingerprint(detail: unknown): string {
	const semanticDetail =
		detail && typeof detail === "object"
			? { ...(detail as Record<string, unknown>) }
			: detail;
	if (semanticDetail && typeof semanticDetail === "object") {
		delete (semanticDetail as Record<string, unknown>).timestamp;
		delete (semanticDetail as Record<string, unknown>).sourceRuntimeId;
	}
	try {
		return JSON.stringify(semanticDetail);
	} catch {
		return String(semanticDetail);
	}
}

const isCommit = (detail: unknown): boolean =>
	Boolean(
		detail &&
			typeof detail === "object" &&
			(detail as Record<string, unknown>).sessionCommitReason,
	);

/**
 * A shell's translation of its player's events into the runtime's, shared by
 * `<pie-item-shell>`, `<pie-passage-shell>` and `<pie-item-scope>`. The dedupe
 * state lives as long as the bridge, so a prop change does not forget what was
 * forwarded.
 */
export function createShellEventBridge(
	options: ShellEventBridgeOptions,
): ShellEventBridge {
	const { host, kind, identity, mode, send } = options;
	const logger = createPieLogger(host.localName || "pie-shell", () => false);
	let lastForwardedFingerprint = "";

	const forwardSession = (detail: unknown): void => {
		const { itemId, canonicalItemId } = identity();
		if (!itemId) return;
		const internal: InternalItemSessionChangedDetail = {
			itemId,
			session: detail,
		};
		// The runtime keeps item state in step from every change; the public
		// stream carries responses only.
		send(PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT, internal);
		const normalized = normalizeItemSessionChange({
			itemId,
			sessionDetail: detail,
		});
		if (normalized.intent === "metadata-only" || !normalized.session) return;
		const payload: ItemSessionChangedDetail = {
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			session: normalized.session,
			...(normalized.sessionCommitReason
				? { sessionCommitReason: normalized.sessionCommitReason }
				: {}),
		};
		dispatchCrossBoundaryEvent(host, PIE_ITEM_SESSION_CHANGED_EVENT, payload);
	};

	const onSessionChanged = (event: Event) => {
		if (mode() !== "section") return;
		event.stopPropagation();
		// A passage carries no response: a passage id on the section's session
		// stream names no item a host has.
		if (kind !== "item") return;
		const detail = (event as CustomEvent).detail;
		const fingerprint = sessionEventFingerprint(detail);
		// A commit is the response's last chance to reach the section.
		if (!isCommit(detail) && fingerprint === lastForwardedFingerprint) return;
		lastForwardedFingerprint = fingerprint;
		forwardSession(detail);
	};
	const onLoadComplete = (event: Event) => {
		if (mode() === "section") event.stopPropagation();
		const { itemId, canonicalItemId, contentKind } = identity();
		if (!itemId) return;
		const detail: InternalContentLoadedDetail = {
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			contentKind,
			detail: (event as CustomEvent).detail,
		};
		send(PIE_INTERNAL_CONTENT_LOADED_EVENT, detail);
	};
	const onPlayerError = (event: Event) => {
		if (mode() === "section") event.stopPropagation();
		const { itemId, canonicalItemId, contentKind } = identity();
		if (!itemId) return;
		const detail: InternalItemPlayerErrorDetail = {
			itemId,
			canonicalItemId: canonicalItemId || itemId,
			contentKind,
			error: (event as CustomEvent).detail,
		};
		send(PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT, detail);
	};

	host.addEventListener("session-changed", onSessionChanged);
	host.addEventListener("load-complete", onLoadComplete);
	host.addEventListener("player-error", onPlayerError);

	return {
		disconnect: () => {
			// An escape from the commit must not strand the listeners it needed, so
			// the unbinding runs either way. A plain player commits its own.
			try {
				if (kind === "item" && mode() === "section") {
					commitPendingSessions(host, { reason: "teardown", logger });
				}
			} finally {
				host.removeEventListener("session-changed", onSessionChanged);
				host.removeEventListener("load-complete", onLoadComplete);
				host.removeEventListener("player-error", onPlayerError);
			}
		},
	};
}
