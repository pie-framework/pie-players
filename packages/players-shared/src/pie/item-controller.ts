import {
	MemoryItemSessionStorage,
	type ItemSessionContainer,
	type ItemSessionStorageStrategy,
} from "./item-controller-storage.js";
import {
	hasResponseField,
	hasResponseValue,
	mergeElementIntoSession,
	normalizeItemSessionContainer as normalizeSessionContainer,
} from "./item-session-contract.js";

export type ItemControllerOptions = {
	itemId: string;
	storageKey?: string;
	sessionId?: string;
	initialSession?: unknown;
	storage?: ItemSessionStorageStrategy;
};

type SetSessionOptions = {
	persist?: boolean;
	allowMetadataOverwrite?: boolean;
};

const DEFAULT_SESSION_ID = "";

function cloneSession(session: ItemSessionContainer): ItemSessionContainer {
	try {
		return structuredClone(session);
	} catch {
		return {
			id: session.id,
			data: JSON.parse(JSON.stringify(session.data ?? [])),
		};
	}
}

export class ItemController {
	private storage: ItemSessionStorageStrategy;
	private session: ItemSessionContainer;
	private storageKey: string;
	private sessionId: string;

	constructor(options: ItemControllerOptions) {
		this.storage = options.storage ?? new MemoryItemSessionStorage();
		this.storageKey =
			options.storageKey ?? `pie:item-controller:v1:${options.itemId}`;
		this.sessionId = options.sessionId ?? DEFAULT_SESSION_ID;
		this.session = normalizeSessionContainer(
			options.initialSession,
			this.sessionId,
		);
	}

	async hydrate(): Promise<ItemSessionContainer> {
		const loaded = await this.storage.load(this.storageKey);
		if (loaded) {
			this.session = normalizeSessionContainer(loaded, this.sessionId);
		}
		return this.getSession();
	}

	async persist(): Promise<void> {
		await this.storage.save(this.storageKey, this.session);
	}

	async clearPersisted(): Promise<void> {
		await this.storage.clear?.(this.storageKey);
	}

	getSession(): ItemSessionContainer {
		return cloneSession(this.session);
	}

	setSession(
		input: unknown,
		options: SetSessionOptions = {},
	): ItemSessionContainer {
		const next = normalizeSessionContainer(input, this.sessionId);
		const allowMetadataOverwrite = options.allowMetadataOverwrite ?? false;
		if (
			!allowMetadataOverwrite &&
			hasResponseValue(this.session) &&
			!hasResponseValue(next) &&
			!hasResponseField(next)
		) {
			return this.getSession();
		}
		this.session = next;
		if (options.persist !== false) {
			void this.persist();
		}
		return this.getSession();
	}

	/**
	 * Merge derived, non-response element state (e.g. a controller's persisted
	 * shuffle order) into the authoritative session for a single element entry.
	 *
	 * Unlike {@link setSession}, this deliberately bypasses the response-protection
	 * guard: the merged `properties` are element-derived metadata (no `value`), so
	 * they must never be blocked by, nor mistaken for, a student response. The
	 * shallow merge preserves any existing response on the entry.
	 *
	 * Defaults to `persist: false` — shuffle order rides along with the next genuine
	 * response save rather than triggering its own persistence.
	 */
	mergeElementSession(
		elementId: string,
		properties: Record<string, unknown>,
		options: { persist?: boolean } = {},
	): ItemSessionContainer {
		this.session = mergeElementIntoSession(
			this.session.id || this.sessionId,
			this.session,
			elementId,
			{ id: elementId, ...properties },
		);
		if (options.persist === true) {
			void this.persist();
		}
		return this.getSession();
	}

	updateFromEventDetail(
		detail: unknown,
		options: SetSessionOptions = {},
	): ItemSessionContainer {
		const payload = (detail as any)?.session ?? detail;
		return this.setSession(payload, options);
	}
}

export const normalizeItemSessionContainer = normalizeSessionContainer;
