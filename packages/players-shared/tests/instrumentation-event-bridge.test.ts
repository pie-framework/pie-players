import { describe, expect, test } from "bun:test";
import type {
	ErrorAttributes,
	EventAttributes,
	InstrumentationConfig,
	InstrumentationProvider,
	MetricAttributes,
} from "../src/instrumentation/types";
import { attachInstrumentationEventBridge } from "../src/pie/instrumentation-event-bridge";

class FakeInstrumentationProvider implements InstrumentationProvider {
	readonly providerId = "fake";
	readonly providerName = "Fake";
	readonly trackedEvents: Array<{
		name: string;
		attributes: EventAttributes;
	}> = [];
	readonly trackedErrors: Array<{
		error: Error;
		attributes: ErrorAttributes;
	}> = [];

	async initialize(_config?: InstrumentationConfig): Promise<void> {}

	trackError(error: Error, attributes: ErrorAttributes): void {
		this.trackedErrors.push({ error, attributes });
	}

	trackEvent(eventName: string, attributes: EventAttributes): void {
		this.trackedEvents.push({ name: eventName, attributes });
	}

	trackMetric?(
		_metricName: string,
		_value: number,
		_attributes?: MetricAttributes,
	): void {}

	destroy(): void {}

	isReady(): boolean {
		return true;
	}
}

describe("attachInstrumentationEventBridge", () => {
	test("attaches listeners and tracks mapped events", () => {
		const provider = new FakeInstrumentationProvider();
		const host = new EventTarget();
		const detach = attachInstrumentationEventBridge({
			host,
			instrumentationProvider: provider,
			component: "bridge-test",
			eventMap: [
				{
					sourceEventName: "session-changed",
					instrumentationEventName: "pie-toolkit-session-changed",
				},
			],
			staticAttributes: {
				assessmentId: "a1",
			},
		});

		host.dispatchEvent(
			new CustomEvent("session-changed", {
				detail: {
					itemId: "item-1",
				},
			}),
		);
		expect(provider.trackedEvents).toHaveLength(1);
		expect(provider.trackedEvents[0]?.name).toBe("pie-toolkit-session-changed");
		expect(provider.trackedEvents[0]?.attributes.component).toBe("bridge-test");
		expect(provider.trackedEvents[0]?.attributes.assessmentId).toBe("a1");
		expect(provider.trackedEvents[0]?.attributes.itemId).toBe("item-1");

		detach();
		host.dispatchEvent(
			new CustomEvent("session-changed", {
				detail: {
					itemId: "item-2",
				},
			}),
		);
		expect(provider.trackedEvents).toHaveLength(1);
	});

	test("ignores malformed providers", () => {
		const host = new EventTarget();
		const detach = attachInstrumentationEventBridge({
			host,
			instrumentationProvider: {
				providerId: "broken",
			},
			component: "bridge-test",
			eventMap: [
				{
					sourceEventName: "ready",
					instrumentationEventName: "pie-section-ready",
				},
			],
			debug: true,
		});
		host.dispatchEvent(new CustomEvent("ready"));
		detach();
		expect(typeof detach).toBe("function");
	});

	test("reports tracking errors via provider trackError", () => {
		const host = new EventTarget();
		const provider = new FakeInstrumentationProvider();
		provider.trackEvent = () => {
			throw new Error("track-event-failed");
		};
		const detach = attachInstrumentationEventBridge({
			host,
			instrumentationProvider: provider,
			component: "bridge-test",
			eventMap: [
				{
					sourceEventName: "ready",
					instrumentationEventName: "pie-section-ready",
				},
			],
		});

		host.dispatchEvent(new CustomEvent("ready", { detail: { phase: "ready" } }));
		expect(provider.trackedErrors.length).toBeGreaterThan(0);
		expect(provider.trackedErrors[0]?.attributes.errorType).toBe(
			"InstrumentationBridgeError",
		);
		detach();
	});

	test("keeps bridge metadata authoritative over event detail", () => {
		const provider = new FakeInstrumentationProvider();
		const host = new EventTarget();
		const detach = attachInstrumentationEventBridge({
			host,
			instrumentationProvider: provider,
			component: "bridge-owner",
			eventMap: [
				{
					sourceEventName: "runtime-error",
					instrumentationEventName: "pie-toolkit-runtime-error",
				},
			],
			staticAttributes: {
				assessmentId: "a1",
			},
		});
		host.dispatchEvent(
			new CustomEvent("runtime-error", {
				detail: {
					component: "override-attempt",
					sourceEventName: "override-attempt",
					timestamp: "1900-01-01T00:00:00.000Z",
				},
			}),
		);
		expect(provider.trackedEvents).toHaveLength(1);
		expect(provider.trackedEvents[0]?.attributes.component).toBe("bridge-owner");
		expect(provider.trackedEvents[0]?.attributes.sourceEventName).toBe("runtime-error");
		expect(provider.trackedEvents[0]?.attributes.timestamp).not.toBe(
			"1900-01-01T00:00:00.000Z",
		);
		detach();
	});

	test("deduplicates identical events in configured window", () => {
		const provider = new FakeInstrumentationProvider();
		const host = new EventTarget();
		const detach = attachInstrumentationEventBridge({
			host,
			instrumentationProvider: provider,
			component: "bridge-test",
			dedupeWindowMs: 1000,
			eventMap: [
				{
					sourceEventName: "session-changed",
					instrumentationEventName: "pie-section-session-changed",
				},
			],
			staticAttributes: {
				sectionId: "s1",
			},
		});
		host.dispatchEvent(
			new CustomEvent("session-changed", {
				detail: {
					itemId: "item-1",
				},
			}),
		);
		host.dispatchEvent(
			new CustomEvent("session-changed", {
				detail: {
					itemId: "item-1",
				},
			}),
		);
		expect(provider.trackedEvents).toHaveLength(1);
		detach();
	});
});
