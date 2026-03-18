import { describe, expect, test } from "bun:test";
import type { InstrumentationProvider } from "../src/instrumentation/types";
import { resolveInstrumentationProvider } from "../src/pie/instrumentation-provider-resolution";

class FakeInstrumentationProvider implements InstrumentationProvider {
	readonly providerId = "fake";
	readonly providerName = "Fake Provider";

	async initialize(): Promise<void> {}
	isReady(): boolean {
		return true;
	}
	destroy(): void {}
	trackError(): void {}
	trackEvent(): void {}
	setUserContext(): void {}
	setGlobalAttributes(): void {}
}

describe("resolveInstrumentationProvider", () => {
	test("returns undefined when tracking is disabled and no provider is configured", () => {
		const provider = resolveInstrumentationProvider({
			runtimePlayer: {
				loaderConfig: {
					trackPageActions: false,
				},
			},
		});
		expect(provider).toBeUndefined();
	});

	test("returns default New Relic provider when tracking is enabled with no provider", () => {
		const provider = resolveInstrumentationProvider({
			runtimePlayer: {
				loaderConfig: {
					trackPageActions: true,
				},
			},
		}) as { providerId?: string } | undefined;
		expect(provider?.providerId).toBe("newrelic");
	});

	test("uses custom provider when configured", () => {
		const customProvider = new FakeInstrumentationProvider();
		const provider = resolveInstrumentationProvider({
			runtimePlayer: {
				loaderConfig: {
					trackPageActions: true,
					instrumentationProvider: customProvider,
				},
			},
		});
		expect(provider).toBe(customProvider);
	});

	test("treats explicit null provider as disabled instrumentation", () => {
		const provider = resolveInstrumentationProvider({
			runtimePlayer: {
				loaderConfig: {
					trackPageActions: true,
					instrumentationProvider: null,
				},
			},
			player: {
				loaderConfig: {
					trackPageActions: true,
					instrumentationProvider: new FakeInstrumentationProvider(),
				},
			},
		});
		expect(provider).toBeUndefined();
	});

	test("prefers runtime candidate over top-level candidate", () => {
		const runtimeProvider = new FakeInstrumentationProvider();
		const topLevelProvider = new FakeInstrumentationProvider();
		const provider = resolveInstrumentationProvider({
			runtimePlayer: {
				loaderConfig: {
					instrumentationProvider: runtimeProvider,
				},
			},
			player: {
				loaderConfig: {
					instrumentationProvider: topLevelProvider,
				},
			},
		});
		expect(provider).toBe(runtimeProvider);
	});

	test("falls back to top-level provider when runtime candidate is unset", () => {
		const topLevelProvider = new FakeInstrumentationProvider();
		const provider = resolveInstrumentationProvider({
			runtimePlayer: {
				loaderConfig: {
					trackPageActions: true,
				},
			},
			player: {
				loaderConfig: {
					instrumentationProvider: topLevelProvider,
				},
			},
		});
		expect(provider).toBe(topLevelProvider);
	});
});
