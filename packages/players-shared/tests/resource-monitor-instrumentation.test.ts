import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NewRelicInstrumentationProvider } from "../src/instrumentation/providers/NewRelicInstrumentationProvider";
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
	initializeCalls = 0;
	destroyCalls = 0;

	async initialize(_config?: InstrumentationConfig): Promise<void> {
		this.initializeCalls += 1;
	}

	trackError(_error: Error, _attributes: ErrorAttributes): void {}

	trackEvent(_eventName: string, _attributes: EventAttributes): void {}

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

describe("ResourceMonitor instrumentation provider wiring", () => {
	test("uses provided custom instrumentation provider", () => {
		const customProvider = new FakeInstrumentationProvider();
		const monitor = new ResourceMonitor({
			trackPageActions: true,
			instrumentationProvider: customProvider,
		});

		expect((monitor as any).provider).toBe(customProvider);
		expect(customProvider.initializeCalls).toBe(0);
	});

	test("falls back to New Relic provider when custom provider is not passed", () => {
		const monitor = new ResourceMonitor({
			trackPageActions: true,
		});

		expect((monitor as any).provider).toBeInstanceOf(NewRelicInstrumentationProvider);
	});

	test("falls back to New Relic provider when custom provider is malformed", () => {
		const malformedProvider = {
			providerId: "broken",
			providerName: "Broken",
			trackEvent: () => {},
		};
		const monitor = new ResourceMonitor({
			trackPageActions: true,
			instrumentationProvider:
				malformedProvider as unknown as InstrumentationProvider,
		});

		expect((monitor as any).provider).toBeInstanceOf(NewRelicInstrumentationProvider);
	});

	test("can manage lifecycle for injected provider when requested", () => {
		const customProvider = new FakeInstrumentationProvider();
		const monitor = new ResourceMonitor({
			trackPageActions: true,
			instrumentationProvider: customProvider,
			manageProviderLifecycle: true,
		});

		expect(customProvider.initializeCalls).toBe(1);
		(monitor as any).started = true;
		monitor.stop();
		expect(customProvider.destroyCalls).toBe(1);
	});
});

describe("useResourceMonitor wiring contract", () => {
	test("forwards loaderConfig.instrumentationProvider to ResourceMonitor", () => {
		const useResourceMonitorPath = join(
			import.meta.dir,
			"../src/pie/use-resource-monitor.svelte.ts",
		);
		const source = readFileSync(useResourceMonitorPath, "utf8");

		expect(source).toContain("isInstrumentationProviderLike");
		expect(source).toContain(
			"instrumentationProvider: resolvedInstrumentationProvider",
		);
	});

	test("reinitializes monitor when config or provider changes", () => {
		const useResourceMonitorPath = join(
			import.meta.dir,
			"../src/pie/use-resource-monitor.svelte.ts",
		);
		const source = readFileSync(useResourceMonitorPath, "utf8");

		expect(source).toContain("shouldReinitialize");
		expect(source).toContain("monitor.stop()");
	});
});
