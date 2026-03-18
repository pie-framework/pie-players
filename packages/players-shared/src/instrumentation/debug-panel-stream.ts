import type {
	ErrorAttributes,
	EventAttributes,
	MetricAttributes,
} from "./types.js";

export const INSTRUMENTATION_DEBUG_EVENT_NAME =
	"pie-instrumentation-debug-record";
const MAX_DEBUG_RECORDS = 500;

type DebugRecordKind =
	| "event"
	| "error"
	| "metric"
	| "user-context"
	| "global-attributes";

export type InstrumentationDebugRecord = {
	id: number;
	kind: DebugRecordKind;
	providerId: string;
	providerName: string;
	timestamp: string;
	name: string;
	attributes?: Record<string, unknown>;
	errorMessage?: string;
	errorStack?: string;
	value?: number;
};

export type InstrumentationDebugRecordInput = Omit<
	InstrumentationDebugRecord,
	"id"
>;

type DebugWindowState = {
	nextId: number;
	records: InstrumentationDebugRecord[];
};

type PieDebugWindow = Window & {
	__pieInstrumentationDebugState?: DebugWindowState;
};

function getDebugWindow(): PieDebugWindow | null {
	if (typeof window === "undefined") return null;
	return window as PieDebugWindow;
}

function getDebugState(debugWindow: PieDebugWindow): DebugWindowState {
	if (!debugWindow.__pieInstrumentationDebugState) {
		debugWindow.__pieInstrumentationDebugState = {
			nextId: 1,
			records: [],
		};
	}
	return debugWindow.__pieInstrumentationDebugState;
}

function cloneRecord(record: InstrumentationDebugRecord): InstrumentationDebugRecord {
	return {
		...record,
		attributes: record.attributes ? { ...record.attributes } : undefined,
	};
}

export function emitInstrumentationDebugRecord(
	record: InstrumentationDebugRecordInput,
): void {
	const debugWindow = getDebugWindow();
	if (!debugWindow) return;
	const state = getDebugState(debugWindow);
	const nextRecord: InstrumentationDebugRecord = {
		...record,
		id: state.nextId++,
	};
	state.records.push(nextRecord);
	if (state.records.length > MAX_DEBUG_RECORDS) {
		state.records.splice(0, state.records.length - MAX_DEBUG_RECORDS);
	}
	debugWindow.dispatchEvent(
		new CustomEvent<InstrumentationDebugRecord>(INSTRUMENTATION_DEBUG_EVENT_NAME, {
			detail: cloneRecord(nextRecord),
		}),
	);
}

export function getBufferedInstrumentationDebugRecords(): InstrumentationDebugRecord[] {
	const debugWindow = getDebugWindow();
	if (!debugWindow) return [];
	const state = getDebugState(debugWindow);
	return state.records.map(cloneRecord);
}

export function clearBufferedInstrumentationDebugRecords(): void {
	const debugWindow = getDebugWindow();
	if (!debugWindow) return;
	const state = getDebugState(debugWindow);
	state.records = [];
}

export function subscribeInstrumentationDebugRecords(args: {
	listener: (record: InstrumentationDebugRecord) => void;
	replayBuffered?: boolean;
}): () => void {
	const debugWindow = getDebugWindow();
	if (!debugWindow) return () => {};

	if (args.replayBuffered !== false) {
		const records = getBufferedInstrumentationDebugRecords();
		for (const record of records) {
			args.listener(record);
		}
	}

	const onDebugRecord = (event: Event) => {
		const customEvent = event as CustomEvent<InstrumentationDebugRecord>;
		if (!customEvent.detail) return;
		args.listener(cloneRecord(customEvent.detail));
	};
	debugWindow.addEventListener(INSTRUMENTATION_DEBUG_EVENT_NAME, onDebugRecord);
	return () => {
		debugWindow.removeEventListener(
			INSTRUMENTATION_DEBUG_EVENT_NAME,
			onDebugRecord,
		);
	};
}

export function createEventDebugRecord(args: {
	providerId: string;
	providerName: string;
	eventName: string;
	attributes: EventAttributes;
}): InstrumentationDebugRecordInput {
	return {
		kind: "event",
		providerId: args.providerId,
		providerName: args.providerName,
		name: args.eventName,
		timestamp: new Date().toISOString(),
		attributes: { ...(args.attributes as Record<string, unknown>) },
	};
}

export function createErrorDebugRecord(args: {
	providerId: string;
	providerName: string;
	error: Error;
	attributes: ErrorAttributes;
}): InstrumentationDebugRecordInput {
	return {
		kind: "error",
		providerId: args.providerId,
		providerName: args.providerName,
		name: args.attributes.errorType || "unknown-error",
		timestamp: new Date().toISOString(),
		attributes: { ...(args.attributes as Record<string, unknown>) },
		errorMessage: args.error?.message || "Unknown error",
		errorStack: args.error?.stack,
	};
}

export function createMetricDebugRecord(args: {
	providerId: string;
	providerName: string;
	metricName: string;
	value: number;
	attributes?: MetricAttributes;
}): InstrumentationDebugRecordInput {
	return {
		kind: "metric",
		providerId: args.providerId,
		providerName: args.providerName,
		name: args.metricName,
		timestamp: new Date().toISOString(),
		value: args.value,
		attributes: args.attributes
			? { ...(args.attributes as Record<string, unknown>) }
			: undefined,
	};
}
