import { describe, expect, test } from "bun:test";
import {
	ToolProviderRegistry,
} from "../src/services/tool-providers/ToolProviderRegistry.js";
import type {
	ToolCategory,
	ToolProviderApi,
	ToolProviderCapabilities,
} from "../src/services/tool-providers/ToolProviderApi.js";

class FakeProvider implements ToolProviderApi<Record<string, unknown>, unknown> {
	readonly providerId = "fake-provider";
	readonly providerName = "Fake Provider";
	readonly category: ToolCategory = "tts";
	readonly version = "1.0.0";
	readonly requiresAuth: boolean;
	private ready = false;
	private shouldFailInit: boolean;

	constructor(args?: { requiresAuth?: boolean; shouldFailInit?: boolean }) {
		this.requiresAuth = args?.requiresAuth === true;
		this.shouldFailInit = args?.shouldFailInit === true;
	}

	async initialize(_config: Record<string, unknown>): Promise<void> {
		if (this.shouldFailInit) {
			throw new Error("forced-init-failure");
		}
		this.ready = true;
	}

	async createInstance(): Promise<unknown> {
		return {};
	}

	getCapabilities(): ToolProviderCapabilities {
		return {
			supportsOffline: true,
			requiresAuth: this.requiresAuth,
			maxInstances: 1,
			features: {},
		};
	}

	isReady(): boolean {
		return this.ready;
	}

	destroy(): void {
		this.ready = false;
	}
}

describe("ToolProviderRegistry telemetry", () => {
	test("emits auth and init telemetry for successful provider initialization", async () => {
		const registry = new ToolProviderRegistry();
		const events: Array<{ name: string; payload?: Record<string, unknown> }> = [];

		registry.register("tts-provider", {
			provider: new FakeProvider({ requiresAuth: true }),
			config: { backend: "polly" },
			authFetcher: async () => ({ authToken: "demo-token" }),
			onTelemetry: (name, payload) => {
				events.push({ name, payload });
			},
		});

		await registry.initialize("tts-provider");

		expect(events.map((entry) => entry.name)).toEqual(
			expect.arrayContaining([
				"pie-tool-init-start",
				"pie-tool-backend-call-start",
				"pie-tool-backend-call-success",
				"pie-tool-init-success",
			]),
		);
	});

	test("emits backend-call-error when auth fetch fails", async () => {
		const registry = new ToolProviderRegistry();
		const events: Array<{ name: string; payload?: Record<string, unknown> }> = [];

		registry.register("calc-provider", {
			provider: new FakeProvider({ requiresAuth: true }),
			config: { backend: "desmos" },
			authFetcher: async () => {
				throw new Error("auth-fetch-failed");
			},
			onTelemetry: (name, payload) => {
				events.push({ name, payload });
			},
		});

		await expect(registry.initialize("calc-provider")).rejects.toThrow();
		expect(events.map((entry) => entry.name)).toContain(
			"pie-tool-backend-call-error",
		);
	});

	test("emits init-error when provider initialize fails", async () => {
		const registry = new ToolProviderRegistry();
		const events: Array<{ name: string; payload?: Record<string, unknown> }> = [];

		registry.register("broken-provider", {
			provider: new FakeProvider({ shouldFailInit: true }),
			config: { backend: "server" },
			onTelemetry: (name, payload) => {
				events.push({ name, payload });
			},
		});

		await expect(registry.initialize("broken-provider")).rejects.toThrow(
			"forced-init-failure",
		);
		expect(events.map((entry) => entry.name)).toContain("pie-tool-init-error");
	});
});
