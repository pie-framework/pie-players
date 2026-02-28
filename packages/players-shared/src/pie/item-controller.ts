import {
	MemoryItemSessionStorage,
	type ItemSessionContainer,
	type ItemSessionStorageStrategy,
} from "./item-controller-storage.js";

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

function toSessionContainer(
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

function hasResponseValue(value: unknown): boolean {
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

export class ItemController {
	private storage: ItemSessionStorageStrategy;
	private session: ItemSessionContainer;
	private storageKey: string;
	private sessionId: string;

	constructor(options: ItemControllerOptions) {
		this.storage = options.storage ?? new MemoryItemSessionStorage();
		this.storageKey = options.storageKey ?? `pie:item-controller:v1:${options.itemId}`;
		this.sessionId = options.sessionId ?? DEFAULT_SESSION_ID;
		this.session = toSessionContainer(options.initialSession, this.sessionId);
	}

	async hydrate(): Promise<ItemSessionContainer> {
		const loaded = await this.storage.load(this.storageKey);
		if (loaded) {
			this.session = toSessionContainer(loaded, this.sessionId);
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

	setSession(input: unknown, options: SetSessionOptions = {}): ItemSessionContainer {
		const next = toSessionContainer(input, this.sessionId);
		const allowMetadataOverwrite = options.allowMetadataOverwrite ?? false;
		if (
			!allowMetadataOverwrite &&
			hasResponseValue(this.session) &&
			!hasResponseValue(next)
		) {
			return this.getSession();
		}
		this.session = next;
		if (options.persist !== false) {
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

export const normalizeItemSessionContainer = toSessionContainer;
