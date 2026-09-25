import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	ErrorAttributes,
	EventAttributes,
	InstrumentationConfig,
	InstrumentationProvider,
	MetricAttributes,
} from "../src/instrumentation/types";
import { resolveInstrumentationProvider } from "../src/pie/instrumentation-provider-resolution";
import {
	ResourceMonitor,
	type ResourceMonitorConfig,
	type ResourceMonitorEventDetail,
} from "../src/pie/resource-monitor";

class FakeInstrumentationProvider implements InstrumentationProvider {
	readonly providerId = "fake";
	readonly providerName = "Fake";
	initializeCalls = 0;
	destroyCalls = 0;
	events: string[] = [];
	errors: string[] = [];

	async initialize(_config?: InstrumentationConfig): Promise<void> {
		this.initializeCalls += 1;
	}

	trackError(error: Error, _attributes: ErrorAttributes): void {
		this.errors.push(error.message);
	}

	trackEvent(eventName: string, _attributes: EventAttributes): void {
		this.events.push(eventName);
	}

	trackMetric?(
		_metricName: string,
		_value: number,
		_attributes?: MetricAttributes,
	): void {}

	destroy(): void {
		this.destroyCalls += 1;
	}

	isReady(): boolean {
		return true;
	}
}

const MISSING_IMAGE = "https://example.org/missing.png";
const RETRY_ONCE = {
	maxRetries: 1,
	initialRetryDelay: 1,
	maxRetryDelay: 1,
} satisfies ResourceMonitorConfig;
const PERMANENT_FAILURE: ResourceMonitorEventDetail = {
	url: MISSING_IMAGE,
	resourceType: "img",
	retryCount: 1,
	maxRetries: 1,
	error: "Resource permanently failed after 1 retries",
};

/** Records what reaches the New Relic browser agent's global. */
function installNewRelicAgent(): string[] {
	const calls: string[] = [];
	(window as any).newrelic = {
		addPageAction: (name: string) => calls.push(`addPageAction ${name}`),
		noticeError: (error: Error) => calls.push(`noticeError ${error.message}`),
	};
	return calls;
}

/**
 * Fails an image in the monitor's container, lets the one retry fire, and fails
 * it again. Returns the `pie-resource-load-error` details the container saw.
 */
async function failImageLoad(
	monitor: ResourceMonitor,
): Promise<ResourceMonitorEventDetail[]> {
	const container = document.createElement("div");
	const image = document.createElement("img");
	image.src = MISSING_IMAGE;
	container.append(image);
	const loadErrors: ResourceMonitorEventDetail[] = [];
	container.addEventListener("pie-resource-load-error", (event) => {
		loadErrors.push((event as CustomEvent<ResourceMonitorEventDetail>).detail);
	});

	monitor.start(container);
	image.dispatchEvent(new Event("error"));
	await new Promise((resolve) => setTimeout(resolve, 15));
	image.dispatchEvent(new Event("error"));
	monitor.stop();
	return loadErrors;
}

describe("ResourceMonitor instrumentation provider wiring", () => {
	beforeAll(() => {
		if (typeof (globalThis as { window?: unknown }).window === "undefined") {
			GlobalRegistrator.register();
		}
	});

	afterEach(() => {
		delete (window as any).newrelic;
	});

	afterAll(() => {
		if (GlobalRegistrator.isRegistered) {
			GlobalRegistrator.unregister();
		}
	});

	test("sends nothing when loaderConfig sets instrumentationProvider: null", async () => {
		const agentCalls = installNewRelicAgent();
		const monitor = new ResourceMonitor({
			...RETRY_ONCE,
			trackPageActions: true,
			instrumentationProvider: resolveInstrumentationProvider({
				player: {
					loaderConfig: {
						trackPageActions: true,
						instrumentationProvider: null,
					},
				},
			}),
		});

		expect(await failImageLoad(monitor)).toEqual([PERMANENT_FAILURE]);
		expect(agentCalls).toEqual([]);
	});

	test("ignores a malformed provider rather than sending to New Relic", async () => {
		const agentCalls = installNewRelicAgent();
		const monitor = new ResourceMonitor({
			...RETRY_ONCE,
			trackPageActions: true,
			instrumentationProvider: {
				providerId: "broken",
				providerName: "Broken",
				trackEvent: () => {},
			} as unknown as InstrumentationProvider,
		});

		expect(await failImageLoad(monitor)).toEqual([PERMANENT_FAILURE]);
		expect(agentCalls).toEqual([]);
	});

	test("reports loads, retries and failures to the provider it is given", async () => {
		const provider = new FakeInstrumentationProvider();
		const monitor = new ResourceMonitor({
			...RETRY_ONCE,
			trackPageActions: true,
			instrumentationProvider: provider,
		});

		expect(await failImageLoad(monitor)).toEqual([PERMANENT_FAILURE]);
		expect(provider.events).toEqual([
			"pie-resource-load-error",
			"pie-resource-retry",
			"pie-resource-load-error",
		]);
		expect(provider.errors).toEqual([
			`Resource load error: ${MISSING_IMAGE}`,
			`Resource load error: ${MISSING_IMAGE}`,
			`Resource permanently failed after 1 retries: ${MISSING_IMAGE}`,
		]);
	});

	test("only retries when trackPageActions is off", async () => {
		const provider = new FakeInstrumentationProvider();
		const monitor = new ResourceMonitor({
			...RETRY_ONCE,
			instrumentationProvider: provider,
		});

		expect(await failImageLoad(monitor)).toEqual([PERMANENT_FAILURE]);
		expect(provider.events).toEqual([]);
		expect(provider.errors).toEqual([]);
	});

	test("leaves an injected provider's lifecycle to its owner", () => {
		const provider = new FakeInstrumentationProvider();
		const monitor = new ResourceMonitor({
			trackPageActions: true,
			instrumentationProvider: provider,
		});

		monitor.start(document.createElement("div"));
		monitor.stop();
		expect(provider.initializeCalls).toBe(0);
		expect(provider.destroyCalls).toBe(0);
	});

	test("can manage lifecycle for injected provider when requested", () => {
		const provider = new FakeInstrumentationProvider();
		const monitor = new ResourceMonitor({
			trackPageActions: true,
			instrumentationProvider: provider,
			manageProviderLifecycle: true,
		});

		expect(provider.initializeCalls).toBe(1);
		monitor.start(document.createElement("div"));
		monitor.stop();
		expect(provider.destroyCalls).toBe(1);
	});
});

describe("useResourceMonitor wiring contract", () => {
	const source = readFileSync(
		join(import.meta.dir, "../src/pie/use-resource-monitor.svelte.ts"),
		"utf8",
	);

	test("hands ResourceMonitor the provider resolved from loaderConfig", () => {
		expect(source).toContain("resolveInstrumentationProvider({");
		expect(source).toContain("player: { loaderConfig }");
		expect(source).toContain(
			"instrumentationProvider: resolvedInstrumentationProvider",
		);
	});

	test("reinitializes monitor when config or provider changes", () => {
		expect(source).toContain("shouldReinitialize");
		expect(source).toContain("monitor.stop()");
	});
});
