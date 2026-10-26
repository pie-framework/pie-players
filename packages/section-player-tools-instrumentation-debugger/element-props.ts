import type { RecordLimitOverrides } from "./panel-records.js";

/** Inputs shared by the component and its native element declaration. */
export interface InstrumentationDebuggerProps {
	maxRecords?: number;
	maxRecordsByKind?: RecordLimitOverrides;
	persistenceScope?: string;
	persistencePanelId?: string;
}
