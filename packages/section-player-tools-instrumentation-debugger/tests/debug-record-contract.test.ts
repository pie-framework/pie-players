import { expect, test } from "bun:test";
import type { InstrumentationDebugRecord as SharedRecord } from "@pie-players/pie-players-shared";

import type { InstrumentationDebugRecord } from "../debug-record.js";

// Compile-time: each record type is assignable to the other. The panel reads
// records the shared stream emits, and tests and hosts hand it records typed
// with the local one. `typecheck` fails if either drifts.
const readsSharedRecord = (record: SharedRecord): InstrumentationDebugRecord =>
	record;
const emitsLocalRecord = (record: InstrumentationDebugRecord): SharedRecord =>
	record;

test("the panel's record type and players-shared's accept each other", () => {
	expect(typeof readsSharedRecord).toBe("function");
	expect(typeof emitsLocalRecord).toBe("function");
});
