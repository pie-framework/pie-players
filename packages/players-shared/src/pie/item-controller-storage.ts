export type ItemSessionContainer = {
	id: string;
	data: any[];
};

export interface ItemSessionStorageStrategy {
	load(key: string): ItemSessionContainer | null | Promise<ItemSessionContainer | null>;
	save(
		key: string,
		session: ItemSessionContainer,
	): void | Promise<void>;
	clear?(key: string): void | Promise<void>;
}

export class MemoryItemSessionStorage implements ItemSessionStorageStrategy {
	private store = new Map<string, ItemSessionContainer>();

	load(key: string): ItemSessionContainer | null {
		return this.store.get(key) ?? null;
	}

	save(key: string, session: ItemSessionContainer): void {
		this.store.set(key, session);
	}

	clear(key: string): void {
		this.store.delete(key);
	}
}

export class SessionStorageItemSessionStorage
	implements ItemSessionStorageStrategy
{
	load(key: string): ItemSessionContainer | null {
		if (typeof window === "undefined") return null;
		try {
			const raw = window.sessionStorage.getItem(key);
			if (!raw) return null;
			return JSON.parse(raw) as ItemSessionContainer;
		} catch {
			return null;
		}
	}

	save(key: string, session: ItemSessionContainer): void {
		if (typeof window === "undefined") return;
		try {
			window.sessionStorage.setItem(key, JSON.stringify(session));
		} catch {}
	}

	clear(key: string): void {
		if (typeof window === "undefined") return;
		try {
			window.sessionStorage.removeItem(key);
		} catch {}
	}
}
