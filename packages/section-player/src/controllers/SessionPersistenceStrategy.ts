import type {
	SectionControllerContext,
	SectionControllerPersistenceStrategy,
} from "./toolkit-section-contracts.js";

export interface SectionControllerSnapshot {
	testAttemptSession: unknown;
	currentItemIndex: number;
}

export class SessionPersistenceStrategy
	implements SectionControllerPersistenceStrategy
{
	private readonly storage: Storage | null;

	public constructor() {
		this.storage = this.getStorage();
	}

	private getStorage(): Storage | null {
		try {
			if (typeof window === "undefined") return null;
			return window.localStorage;
		} catch {
			return null;
		}
	}

	private getKey(context: SectionControllerContext): string {
		const { assessmentId, sectionId, attemptId } = context.key;
		return `pie:section-controller:v1:${assessmentId}:${sectionId}:${attemptId || "default"}`;
	}

	public async load(
		context: SectionControllerContext,
	): Promise<SectionControllerSnapshot | null> {
		if (!this.storage) return null;
		const value = this.storage.getItem(this.getKey(context));
		if (!value) return null;
		try {
			return JSON.parse(value) as SectionControllerSnapshot;
		} catch {
			return null;
		}
	}

	public async save(
		context: SectionControllerContext,
		snapshot: unknown,
	): Promise<void> {
		if (!this.storage) return;
		this.storage.setItem(this.getKey(context), JSON.stringify(snapshot));
	}

	public async clear(context: SectionControllerContext): Promise<void> {
		if (!this.storage) return;
		this.storage.removeItem(this.getKey(context));
	}
}
