/**
 * Device-local snapshot of a committed session.
 *
 * A crash or an OS kill fires no lifecycle event, so the only state that
 * survives it is state already written. The snapshot writes each committed
 * session to device storage and offers it back on the next load.
 *
 * It is offered, never applied. School devices are shared, and a player cannot
 * tell a legitimate recovery from a previous student's draft, so the host
 * decides.
 *
 * `sessionStorage` is the default, matching the annotation toolbar's existing
 * use of it for learner annotations: it is tab-scoped and cleared when the tab
 * closes, so a response does not outlive the sitting, and browser session
 * restore brings it back after a crash. A host that wants recovery across a
 * full browser restart injects a `localStorage`-backed store and owns the
 * retention consequences.
 */

export interface SessionSnapshotStore {
	read(key: string): string | null;
	write(key: string, value: string): void;
	clear(key: string): void;
}

export type SessionSnapshotConfig =
	| boolean
	| {
			enabled?: boolean;
			/** Defaults to `sessionStorage`. */
			store?: SessionSnapshotStore;
			/** Defaults to a key derived from the delivery identity. */
			key?: string;
	  };

export interface SessionSnapshotRecord {
	key: string;
	session: unknown;
	/** `Date.now()` at the time of the write. */
	timestamp: number;
}

export interface SessionSnapshot {
	readonly key: string;
	write(session: unknown): void;
	read(): SessionSnapshotRecord | null;
	clear(): void;
}

export type SessionSnapshotIdentity = {
	itemId?: string;
	sessionId?: string;
	assignmentId?: string;
};

const KEY_PREFIX = "pie-session-snapshot";

/**
 * Whether an identity names one sitting.
 *
 * `sessionId` is the only field that distinguishes one learner's attempt from
 * another's. Keyed on the item alone, a shared device offers the previous
 * student's draft to the next one - and the offer is itself a disclosure, before
 * the host ever decides whether to apply it. So without a `sessionId` there is
 * no snapshot, and a host driving the player by props alone opts in by passing
 * an explicit `key`.
 */
export function isSnapshotIdentitySpecific(
	identity: SessionSnapshotIdentity,
): boolean {
	return Boolean(identity.sessionId);
}

/**
 * Key built from the delivery identity, so a snapshot is only offered back to
 * the sitting that wrote it.
 */
export function sessionSnapshotKey(identity: SessionSnapshotIdentity): string {
	const parts = [
		identity.assignmentId || "",
		identity.sessionId || "",
		identity.itemId || "",
	];
	return `${KEY_PREFIX}:${parts.join("|")}`;
}

/**
 * `sessionStorage`-backed store. Every access is guarded: private mode and
 * blocked site data make the accessor throw, and a player must keep working
 * without a snapshot rather than fail.
 */
export function sessionStorageSnapshotStore(): SessionSnapshotStore {
	return {
		read(key) {
			try {
				if (typeof sessionStorage === "undefined") return null;
				return sessionStorage.getItem(key);
			} catch {
				return null;
			}
		},
		write(key, value) {
			try {
				if (typeof sessionStorage === "undefined") return;
				sessionStorage.setItem(key, value);
			} catch {
				// Quota, private mode, blocked site data: no snapshot this sitting.
			}
		},
		clear(key) {
			try {
				if (typeof sessionStorage === "undefined") return;
				sessionStorage.removeItem(key);
			} catch {
				// ignore
			}
		},
	};
}

export function isSessionSnapshotEnabled(
	config: SessionSnapshotConfig | null | undefined,
): boolean {
	if (typeof config === "boolean") return config;
	if (!config) return false;
	return config.enabled !== false;
}

/**
 * Returns `null` when the host has not enabled a snapshot, and when the
 * identity does not name one sitting. PIE writes learner responses to the
 * device only on an explicit opt-in, and only under a key no other learner
 * shares.
 */
export function createSessionSnapshot(args: {
	config: SessionSnapshotConfig | null | undefined;
	identity: SessionSnapshotIdentity;
}): SessionSnapshot | null {
	if (!isSessionSnapshotEnabled(args.config)) return null;

	const settings =
		typeof args.config === "object" && args.config ? args.config : {};
	if (!settings.key && !isSnapshotIdentitySpecific(args.identity)) return null;
	const key = settings.key || sessionSnapshotKey(args.identity);
	const store = settings.store || sessionStorageSnapshotStore();

	// A host-injected store is guarded the same way the default one is: a player
	// keeps working without a snapshot rather than failing on storage.
	const safeRead = (): string | null => {
		try {
			return store.read(key);
		} catch {
			return null;
		}
	};
	const safeWrite = (value: string): void => {
		try {
			store.write(key, value);
		} catch {
			// no snapshot this sitting
		}
	};
	const safeClear = (): void => {
		try {
			store.clear(key);
		} catch {
			// no snapshot this sitting
		}
	};

	return {
		key,
		write(session) {
			let payload: string;
			try {
				payload = JSON.stringify({ session, timestamp: Date.now() });
			} catch {
				return;
			}
			safeWrite(payload);
		},
		read() {
			const raw = safeRead();
			if (!raw) return null;
			try {
				const parsed = JSON.parse(raw) as {
					session?: unknown;
					timestamp?: unknown;
				};
				if (!parsed || typeof parsed !== "object" || !("session" in parsed)) {
					return null;
				}
				return {
					key,
					session: parsed.session,
					timestamp:
						typeof parsed.timestamp === "number" ? parsed.timestamp : 0,
				};
			} catch {
				return null;
			}
		},
		clear() {
			safeClear();
		},
	};
}
