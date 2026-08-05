import type { InstrumentationDebugRecord } from "@pie-players/pie-players-shared";

export type RecordKind = InstrumentationDebugRecord["kind"];
export type RecordLimitOverrides = Partial<Record<RecordKind, number>>;

export type RecordLimits = {
	maxRecords?: number;
	maxRecordsByKind?: RecordLimitOverrides;
};

/**
 * A record as held by the panel list.
 *
 * `id` is assigned by whoever emitted the record, and the panel reads records
 * off a window `CustomEvent` stream that anyone can dispatch into: hosts, demo
 * pages and tests inject synthetic records with hand-written ids that collide
 * with the ids the provider stream hands out, and a record can arrive with no
 * id at all. `panelKey` is assigned on ingest and is unique for the lifetime of
 * the panel, which is what a keyed `{#each}` requires — a duplicate key throws
 * `each_key_duplicate` and leaves the list frozen for the rest of the session.
 */
export type PanelRecord = InstrumentationDebugRecord & { panelKey: number };

const MIN_CAP = 20;
const MAX_CAP = 2000;
export const DEFAULT_MAX_RECORDS = 250;

/**
 * Stamps ingested records with a monotonic per-panel key. Each panel instance
 * gets its own counter; keys never repeat, including across `clear`.
 */
export function createPanelRecordIngest(): (
	record: InstrumentationDebugRecord,
) => PanelRecord {
	let sequence = 0;
	return (record) => {
		sequence += 1;
		return { ...record, panelKey: sequence };
	};
}

export function resolveCap(rawCap: unknown, fallback: number): number {
	const parsed = Number(rawCap);
	if (!Number.isFinite(parsed))
		return Math.max(MIN_CAP, Math.min(MAX_CAP, fallback));
	return Math.max(MIN_CAP, Math.min(MAX_CAP, parsed));
}

export function getCapForKind(kind: RecordKind, limits: RecordLimits): number {
	const globalCap = resolveCap(
		limits.maxRecords || DEFAULT_MAX_RECORDS,
		DEFAULT_MAX_RECORDS,
	);
	return resolveCap(limits.maxRecordsByKind?.[kind], globalCap);
}

export function toTimestampValue(timestamp: string): number {
	const parsed = Date.parse(timestamp);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Newest first, then per-kind caps applied to the sorted list. Records that
 * share a timestamp fall back to ingest order rather than `id`, so injected
 * records with arbitrary ids cannot reorder the list.
 */
export function pruneAndSortRecords(
	nextRecords: PanelRecord[],
	limits: RecordLimits,
): PanelRecord[] {
	const sorted = [...nextRecords].sort((left, right) => {
		const leftTs = toTimestampValue(left.timestamp);
		const rightTs = toTimestampValue(right.timestamp);
		if (leftTs === rightTs) {
			return right.panelKey - left.panelKey;
		}
		return rightTs - leftTs;
	});
	const countByKind = new Map<string, number>();
	const pruned: PanelRecord[] = [];
	for (const record of sorted) {
		const kindCap = getCapForKind(record.kind, limits);
		const kindCount = countByKind.get(record.kind) ?? 0;
		if (kindCount >= kindCap) continue;
		pruned.push(record);
		countByKind.set(record.kind, kindCount + 1);
	}
	return pruned;
}

export function haveSamePanelKeys(
	left: PanelRecord[],
	right: PanelRecord[],
): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		if (left[index]?.panelKey !== right[index]?.panelKey) return false;
	}
	return true;
}
