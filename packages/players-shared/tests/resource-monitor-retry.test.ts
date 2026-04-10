import { describe, expect, test } from "bun:test";
import type {
	ErrorAttributes,
	EventAttributes,
	InstrumentationConfig,
	InstrumentationProvider,
	MetricAttributes,
} from "../src/instrumentation/types";
import { ResourceMonitor } from "../src/pie/resource-monitor";

class FakeInstrumentationProvider implements InstrumentationProvider {
	readonly providerId = "fake";
	readonly providerName = "Fake";

	async initialize(_config?: InstrumentationConfig): Promise<void> {}
	trackError(_error: Error, _attributes: ErrorAttributes): void {}
	trackEvent(_eventName: string, _attributes: EventAttributes): void {}
	trackMetric?(
		_metricName: string,
		_value: number,
		_attributes?: MetricAttributes,
	): void {}
	destroy(): void {}
	isReady(): boolean {
		return false;
	}
}

function createMonitor(): ResourceMonitor {
	return new ResourceMonitor({
		instrumentationProvider: new FakeInstrumentationProvider(),
		manageProviderLifecycle: false,
		maxRetries: 3,
		initialRetryDelay: 1,
		maxRetryDelay: 2,
	});
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("ResourceMonitor retry state machine", () => {
	test("dedupes concurrent retry scheduling for the same URL", async () => {
		const monitor = createMonitor() as any;
		monitor.started = true;
		const target = { tagName: "IMG" } as any;
		let retryReloads = 0;
		monitor.performRetryLoadAttempt = () => {
			retryReloads += 1;
		};

		monitor.retryResourceLoad(target, "https://example.org/demo.png");
		monitor.retryResourceLoad(target, "https://example.org/demo.png");
		await sleep(15);

		expect(retryReloads).toBe(1);
		expect(monitor.retryAttempts.get("https://example.org/demo.png")).toBe(1);
	});

	test("cancels scheduled retries after stop", async () => {
		const monitor = createMonitor() as any;
		monitor.started = true;
		const target = { tagName: "IMG" } as any;
		let retryReloads = 0;
		monitor.performRetryLoadAttempt = () => {
			retryReloads += 1;
		};

		monitor.retryResourceLoad(target, "https://example.org/cancel.png");
		monitor.stop();
		await sleep(20);

		expect(retryReloads).toBe(0);
		expect(monitor.pendingRetryTimers.size).toBe(0);
		expect(monitor.retryAttempts.size).toBe(0);
	});

	test("routes retried media timing success through reconciliation", () => {
		const monitor = createMonitor() as any;
		monitor.retryAttempts.set("https://example.org/audio.wav", 1);
		let reconciliations = 0;
		let successEvents = 0;
		monitor.reconcileMediaRetrySuccess = () => {
			reconciliations += 1;
		};
		monitor.dispatchEvent = (name: string) => {
			if (name === "pie-resource-load-success") successEvents += 1;
		};

		monitor.handleSuccessfulLoad(
			"https://example.org/audio.wav",
			{ initiatorType: "audio" } as any,
			14,
			10,
			1,
			true,
		);

		expect(reconciliations).toBe(1);
		expect(successEvents).toBe(0);
	});

	test("finalizeRetrySuccess only emits once per retry cycle", () => {
		const monitor = createMonitor() as any;
		monitor.retryAttempts.set("https://example.org/success.wav", 1);
		let retrySuccessEvents = 0;
		let mediaReadyEvents = 0;
		monitor.dispatchEvent = (name: string) => {
			if (name === "pie-resource-retry-success") retrySuccessEvents += 1;
		};
		monitor.dispatchMediaRetryReady = () => {
			mediaReadyEvents += 1;
		};

		const detail = {
			url: "https://example.org/success.wav",
			resourceType: "audio",
			retryCount: 1,
			maxRetries: 3,
			duration: 10,
			size: 100,
		};
		monitor.finalizeRetrySuccess("https://example.org/success.wav", detail);
		monitor.finalizeRetrySuccess("https://example.org/success.wav", detail);

		expect(retrySuccessEvents).toBe(1);
		expect(mediaReadyEvents).toBe(1);
	});

	test("reconciliation timeout re-enters retry flow when attempts remain", () => {
		const monitor = createMonitor() as any;
		const url = "https://example.org/timeout.wav";
		monitor.retryAttempts.set(url, 1);
		monitor.retryTargets.set(url, new Set([{ tagName: "AUDIO" } as any]));
		let retryCalls = 0;
		monitor.retryResourceLoad = () => {
			retryCalls += 1;
		};

		monitor.handleMediaRetryReconciliationTimeout(url, {
			url,
			resourceType: "audio",
			retryCount: 1,
			maxRetries: 3,
		});

		expect(retryCalls).toBe(1);
	});
});
