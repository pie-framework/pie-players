import { describe, expect, test } from "bun:test";
import type { InstrumentationDebugRecord } from "@pie-players/pie-players-shared";
import {
	createPanelRecordIngest,
	getCapForKind,
	haveSamePanelKeys,
	pruneAndSortRecords,
	resolveCap,
	type PanelRecord,
} from "../panel-records.js";

function makeRecord(
	overrides: Partial<InstrumentationDebugRecord> = {},
): InstrumentationDebugRecord {
	return {
		id: 1,
		kind: "event",
		providerId: "debug-panel",
		providerName: "Debug Panel",
		timestamp: "2026-08-03T10:00:00.000Z",
		name: "demo.event",
		...overrides,
	};
}

function ingestAll(records: InstrumentationDebugRecord[]): PanelRecord[] {
	const ingest = createPanelRecordIngest();
	return records.map((record) => ingest(record));
}

describe("createPanelRecordIngest", () => {
	test("assigns distinct keys to records that share an id", () => {
		// The panel reads an open window CustomEvent stream: hosts, demo pages and
		// tests inject synthetic records whose hand-written ids collide with the
		// provider stream's ids. Keying the list on `id` threw each_key_duplicate.
		const [first, second] = ingestAll([
			makeRecord({ id: 1, name: "metric:demo.bootstrap" }),
			makeRecord({ id: 1, name: "pie-item-test-event" }),
		]);
		expect(first?.panelKey).not.toBe(second?.panelKey);
		expect(new Set([first?.panelKey, second?.panelKey]).size).toBe(2);
	});

	test("assigns distinct keys to records with no id at all", () => {
		const withoutId = {
			...makeRecord(),
		} as Partial<InstrumentationDebugRecord>;
		delete withoutId.id;
		const ingested = ingestAll([
			withoutId as InstrumentationDebugRecord,
			withoutId as InstrumentationDebugRecord,
			withoutId as InstrumentationDebugRecord,
		]);
		expect(new Set(ingested.map((record) => record.panelKey)).size).toBe(3);
	});

	test("keeps keys unique across a cleared list", () => {
		const ingest = createPanelRecordIngest();
		const before = ingest(makeRecord({ id: 7 }));
		// `clear` empties the panel list but must not reset the key counter,
		// otherwise post-clear records collide with anything still rendering.
		const after = ingest(makeRecord({ id: 7 }));
		expect(after.panelKey).toBeGreaterThan(before.panelKey);
	});

	test("keeps every other record field intact", () => {
		const [ingested] = ingestAll([
			makeRecord({ id: 42, kind: "metric", value: 3, attributes: { a: 1 } }),
		]);
		expect(ingested).toMatchObject({
			id: 42,
			kind: "metric",
			value: 3,
			attributes: { a: 1 },
			name: "demo.event",
		});
	});
});

describe("pruneAndSortRecords", () => {
	test("orders newest first", () => {
		const records = ingestAll([
			makeRecord({
				id: 1,
				name: "older",
				timestamp: "2026-08-03T10:00:00.000Z",
			}),
			makeRecord({
				id: 2,
				name: "newer",
				timestamp: "2026-08-03T10:00:05.000Z",
			}),
		]);
		expect(
			pruneAndSortRecords(records, {}).map((record) => record.name),
		).toEqual(["newer", "older"]);
	});

	test("breaks timestamp ties by ingest order, not by id", () => {
		// An injected record can carry any id, so ids cannot decide ordering.
		const records = ingestAll([
			makeRecord({ id: 900, name: "arrived-first" }),
			makeRecord({ id: 1, name: "arrived-second" }),
		]);
		expect(
			pruneAndSortRecords(records, {}).map((record) => record.name),
		).toEqual(["arrived-second", "arrived-first"]);
	});

	test("retains both records when ids collide", () => {
		const records = ingestAll([
			makeRecord({ id: 1, name: "first" }),
			makeRecord({ id: 1, name: "second" }),
		]);
		const pruned = pruneAndSortRecords(records, {});
		expect(pruned).toHaveLength(2);
		expect(new Set(pruned.map((record) => record.panelKey)).size).toBe(2);
	});

	test("applies the global cap per kind", () => {
		const records = ingestAll(
			Array.from({ length: 30 }, (_, index) =>
				makeRecord({ id: index, name: `event-${index}` }),
			),
		);
		const pruned = pruneAndSortRecords(records, { maxRecords: 20 });
		expect(pruned).toHaveLength(20);
		// Newest survive the cap.
		expect(pruned[0]?.name).toBe("event-29");
	});

	test("applies per-kind overrides independently", () => {
		const records = ingestAll([
			...Array.from({ length: 5 }, (_, index) =>
				makeRecord({ id: index, kind: "event", name: `event-${index}` }),
			),
			...Array.from({ length: 5 }, (_, index) =>
				makeRecord({ id: index, kind: "error", name: `error-${index}` }),
			),
		]);
		const pruned = pruneAndSortRecords(records, {
			maxRecords: 20,
			maxRecordsByKind: { event: 20 },
		});
		expect(pruned.filter((record) => record.kind === "event")).toHaveLength(5);
		expect(pruned.filter((record) => record.kind === "error")).toHaveLength(5);
	});

	test("keeps an unrecognised kind bounded by the global cap", () => {
		const records = ingestAll(
			Array.from({ length: 40 }, (_, index) =>
				makeRecord({
					id: index,
					kind: "surprise" as InstrumentationDebugRecord["kind"],
				}),
			),
		);
		expect(pruneAndSortRecords(records, { maxRecords: 20 })).toHaveLength(20);
	});

	test("sorts records with an unparseable timestamp last", () => {
		const records = ingestAll([
			makeRecord({ id: 1, name: "broken", timestamp: "not-a-date" }),
			makeRecord({ id: 2, name: "dated" }),
		]);
		expect(
			pruneAndSortRecords(records, {}).map((record) => record.name),
		).toEqual(["dated", "broken"]);
	});
});

describe("resolveCap", () => {
	test("clamps to the supported range", () => {
		expect(resolveCap(5, 250)).toBe(20);
		expect(resolveCap(9000, 250)).toBe(2000);
		expect(resolveCap(120, 250)).toBe(120);
	});

	test("falls back when the cap is not a finite number", () => {
		expect(resolveCap(undefined, 300)).toBe(300);
		expect(resolveCap("nope", 300)).toBe(300);
	});
});

describe("getCapForKind", () => {
	test("prefers the per-kind override over the global cap", () => {
		expect(getCapForKind("error", { maxRecords: 100 })).toBe(100);
		expect(
			getCapForKind("error", {
				maxRecords: 100,
				maxRecordsByKind: { error: 40 },
			}),
		).toBe(40);
	});

	test("uses the default cap when no limits are supplied", () => {
		expect(getCapForKind("event", {})).toBe(250);
	});
});

describe("haveSamePanelKeys", () => {
	test("compares identity by panel key and order", () => {
		const records = ingestAll([makeRecord({ id: 1 }), makeRecord({ id: 1 })]);
		expect(haveSamePanelKeys(records, [...records])).toBe(true);
		expect(haveSamePanelKeys(records, [...records].reverse())).toBe(false);
		expect(haveSamePanelKeys(records, records.slice(1))).toBe(false);
	});

	test("does not treat colliding ids as the same record", () => {
		const [first, second] = ingestAll([
			makeRecord({ id: 1 }),
			makeRecord({ id: 1 }),
		]);
		expect(
			haveSamePanelKeys([first as PanelRecord], [second as PanelRecord]),
		).toBe(false);
	});
});
