import type {
	RuntimeRegistrationDetail,
	RuntimeRegistrationKind,
} from "./registration-events.js";

export interface RegisteredShell extends RuntimeRegistrationDetail {
	sortKey: number;
}

function compareDocumentOrder(a: HTMLElement, b: HTMLElement): number {
	if (a === b) return 0;
	const position = a.compareDocumentPosition(b);
	if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
	if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
	return 0;
}

export class RuntimeRegistry {
	private readonly shellsByElement = new Map<HTMLElement, RegisteredShell>();

	register(detail: RuntimeRegistrationDetail): boolean {
		const existing = this.shellsByElement.get(detail.element);
		const nextRecord: RegisteredShell = {
			...detail,
			sortKey: Date.now(),
		};

		// Idempotent no-op for identical registrations.
		if (
			existing &&
			existing.kind === nextRecord.kind &&
			existing.itemId === nextRecord.itemId &&
			existing.canonicalItemId === nextRecord.canonicalItemId
		) {
			return false;
		}

		this.shellsByElement.set(detail.element, nextRecord);
		return true;
	}

	unregister(element: HTMLElement): boolean {
		return this.shellsByElement.delete(element);
	}

	getOrderedShells(kind?: RuntimeRegistrationKind): RegisteredShell[] {
		const records = Array.from(this.shellsByElement.values()).filter(
			(entry) => !kind || entry.kind === kind,
		);
		records.sort((a, b) => compareDocumentOrder(a.element, b.element));
		return records;
	}

	getCanonicalIdMap(): Record<string, string> {
		const map: Record<string, string> = {};
		for (const entry of this.getOrderedShells("item")) {
			if (!entry.itemId) continue;
			map[entry.itemId] = entry.canonicalItemId || entry.itemId;
		}
		return map;
	}

	clear(): void {
		this.shellsByElement.clear();
	}
}
