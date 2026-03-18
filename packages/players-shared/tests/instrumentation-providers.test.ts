import { afterEach, describe, expect, test } from "bun:test";
import {
	clearBufferedInstrumentationDebugRecords,
	getBufferedInstrumentationDebugRecords,
	subscribeInstrumentationDebugRecords,
} from "../src/instrumentation/debug-panel-stream";
import type {
	ErrorAttributes,
	EventAttributes,
	InstrumentationConfig,
	InstrumentationProvider,
	MetricAttributes,
} from "../src/instrumentation/types";
import { CompositeInstrumentationProvider } from "../src/instrumentation/providers/CompositeInstrumentationProvider";
import { DebugPanelInstrumentationProvider } from "../src/instrumentation/providers/DebugPanelInstrumentationProvider";

type MutableGlobal = typeof globalThis & {
	window?: Window;
};

class FakeReadyProvider implements InstrumentationProvider {
	readonly providerId: string;
	readonly providerName: string;
	ready = true;
	events: string[] = [];
	metrics: string[] = [];

	constructor(id: string) {
		this.providerId = id;
		this.providerName = id;
	}

	async initialize(_config?: InstrumentationConfig): Promise<void> {}
	isReady(): boolean {
		return this.ready;
	}
	destroy(): void {}
	trackError(_error: Error, _attributes: ErrorAttributes): void {}
	trackEvent(eventName: string, _attributes: EventAttributes): void {
		this.events.push(eventName);
	}
	trackMetric(metricName: string, _value: number, _attributes?: MetricAttributes): void {
		this.metrics.push(metricName);
	}
}

class EventOnlyProvider implements InstrumentationProvider {
	readonly providerId = "event-only";
	readonly providerName = "event-only";
	events: string[] = [];

	async initialize(_config?: InstrumentationConfig): Promise<void> {}
	isReady(): boolean {
		return true;
	}
	destroy(): void {}
	trackError(_error: Error, _attributes: ErrorAttributes): void {}
	trackEvent(eventName: string, _attributes: EventAttributes): void {
		this.events.push(eventName);
	}
}

const mutableGlobal = globalThis as MutableGlobal;
const originalWindow = mutableGlobal.window;

function setupWindowMock(): void {
	const eventTarget = new EventTarget();
	mutableGlobal.window = eventTarget as unknown as Window;
}

afterEach(() => {
	mutableGlobal.window = originalWindow;
});

describe("DebugPanelInstrumentationProvider", () => {
	test("forwards tracked events into debug stream", async () => {
		setupWindowMock();
		const provider = new DebugPanelInstrumentationProvider();
		await provider.initialize();
		const received: string[] = [];
		const unsubscribe = subscribeInstrumentationDebugRecords({
			listener: (record) => {
				received.push(record.name);
			},
			replayBuffered: false,
		});
		provider.trackEvent("pie-test-event", { component: "test" });
		unsubscribe();
		expect(received).toContain("pie-test-event");
	});

	test("clear removes buffered records", async () => {
		setupWindowMock();
		const provider = new DebugPanelInstrumentationProvider();
		await provider.initialize();
		provider.trackEvent("pie-test-event", { component: "test" });
		expect(getBufferedInstrumentationDebugRecords().length).toBeGreaterThan(0);
		clearBufferedInstrumentationDebugRecords();
		expect(getBufferedInstrumentationDebugRecords()).toEqual([]);
	});

	test("tracks metrics as production-parity event plus metric view", async () => {
		setupWindowMock();
		const provider = new DebugPanelInstrumentationProvider();
		await provider.initialize();

		provider.trackMetric("duration", 42, { unit: "ms", category: "performance" });
		const records = getBufferedInstrumentationDebugRecords();
		const metricEvent = records.find(
			(record) =>
				record.kind === "event" &&
				record.name === "metric:duration" &&
				record.attributes?.metricName === "duration" &&
				record.attributes?.metricValue === 42,
		);
		const metricRecord = records.find(
			(record) =>
				record.kind === "metric" &&
				record.name === "duration" &&
				record.value === 42,
		);
		expect(metricEvent).toBeDefined();
		expect(metricRecord).toBeDefined();
	});
});

describe("CompositeInstrumentationProvider", () => {
	test("fans out events to all child providers", async () => {
		const first = new FakeReadyProvider("first");
		const second = new FakeReadyProvider("second");
		const composite = new CompositeInstrumentationProvider([first, second]);
		await composite.initialize();
		composite.trackEvent("pie-fanout", { component: "test" });
		expect(first.events).toEqual(["pie-fanout"]);
		expect(second.events).toEqual(["pie-fanout"]);
	});

	test("falls back to event when child lacks metric API", async () => {
		const provider = new EventOnlyProvider();
		const composite = new CompositeInstrumentationProvider([provider]);
		await composite.initialize();
		composite.trackMetric("duration", 42, { unit: "ms" });
		expect(provider.events).toEqual(["metric:duration"]);
	});

	test("reports ready when at least one child is ready", async () => {
		const first = new FakeReadyProvider("first");
		const second = new FakeReadyProvider("second");
		second.ready = false;
		const composite = new CompositeInstrumentationProvider([first, second]);
		await composite.initialize();
		expect(composite.isReady()).toBe(true);
		first.ready = false;
		expect(composite.isReady()).toBe(false);
	});
});
