import { describe, expect, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import {
	createFailingAuthProviderDescriptor,
	createTestToolRegistration,
} from "./fixtures/test-tool-registry.js";
import { ToolRegistry } from "../src/services/ToolRegistry.js";

describe("ToolkitCoordinator telemetry listeners", () => {
	test("subscribeTelemetry receives emitted telemetry payloads", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "telemetry-test",
			lazyInit: true,
		});

		const received: Array<{
			eventName: string;
			payload?: Record<string, unknown>;
		}> = [];
		const unsubscribe = coordinator.subscribeTelemetry((event) => {
			received.push(event);
		});

		await (coordinator as any).emitTelemetry("pie-tool-init-start", {
			toolId: "textToSpeech",
			backend: "polly",
		});
		unsubscribe();

		expect(received).toContainEqual({
			eventName: "pie-tool-init-start",
			payload: { toolId: "textToSpeech", backend: "polly" },
		});
	});

	test("forwards provider registry auth-fetch telemetry through coordinator listeners", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "telemetry-registry-forwarding-test",
			lazyInit: true,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "polly",
						apiEndpoint: "/api/tts",
						provider: {
							runtime: {
								authFetcher: async () => {
									throw new Error("expired-token");
								},
							},
						},
					},
				},
			},
			toolRegistry: (() => {
				// The provider registry keys off the registration's provider
				// descriptor, so the tool under test needs one. A stub whose auth fetch
				// throws is what this test actually needs; it used to reach the same
				// path through the real TTS descriptor, which is a capability and now
				// lives in the composition layer.
				const registry = new ToolRegistry();
				registry.register(
					createTestToolRegistration({
						toolId: "textToSpeech",
						supportedLevels: ["item", "passage"],
						provider: createFailingAuthProviderDescriptor("textToSpeech"),
					}),
				);
				return registry;
			})(),
		});

		const received: Array<{
			eventName: string;
			payload?: Record<string, unknown>;
		}> = [];
		const unsubscribe = coordinator.subscribeTelemetry((event) => {
			received.push(event);
		});

		await expect(coordinator.ensureProviderReady("textToSpeech")).rejects.toThrow(
			"Failed to fetch auth credentials for provider",
		);
		unsubscribe();

		const eventNames = received.map((entry) => entry.eventName);
		expect(eventNames).toContain("pie-tool-backend-call-start");
		expect(eventNames).toContain("pie-tool-backend-call-error");
		expect(
			received.some(
				(entry) =>
					entry.eventName === "pie-tool-backend-call-error" &&
					entry.payload?.toolId === "textToSpeech",
			),
		).toBe(true);
	});
});

describe("ToolkitCoordinator tool provider ids", () => {
	test("a tool's provider events and lifecycle hooks name the tool once, as toolId", async () => {
		const events: Array<{
			eventName: string;
			payload?: Record<string, unknown>;
		}> = [];
		const lifecycle: Array<[string, unknown]> = [];
		const registry = new ToolRegistry();
		registry.register(
			createTestToolRegistration({
				toolId: "calculator",
				supportedLevels: ["item"],
				provider: {
					createProvider: () => ({
						providerName: "Stub calculator provider",
						category: "calculator",
						version: "0.0.0",
						requiresAuth: false,
						// A provider's own telemetry reaches the host through the
						// reporter the coordinator adds to its init config.
						initialize: async (config: {
							onTelemetry?: (
								eventName: string,
								payload?: Record<string, unknown>,
							) => Promise<void>;
						}) => {
							await config.onTelemetry?.("pie-tool-library-load-start", {
								operation: "stub-load",
							});
						},
						createInstance: async () => ({}),
						getCapabilities: () => ({}) as never,
						isReady: () => true,
						destroy: () => undefined,
					}),
				},
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "telemetry-tool-ids",
			lazyInit: true,
			toolRegistry: registry,
			tools: {
				providers: { calculator: { enabled: true } },
				placement: { item: ["calculator"] },
			},
			hooks: {
				onTelemetry: (eventName, payload) => {
					events.push({ eventName, payload });
				},
				onProviderRegistered: (toolId, meta) => {
					lifecycle.push([toolId, meta]);
				},
				onProviderInitStart: (toolId, meta) => {
					lifecycle.push([toolId, meta]);
				},
				onProviderReady: (toolId, meta) => {
					lifecycle.push([toolId, meta]);
				},
			},
		});

		await coordinator.ensureProviderReady("calculator");

		const providerEvents = events.filter(({ eventName }) =>
			/^pie-tool(kit-provider)?-/.test(eventName),
		);
		expect(providerEvents.map(({ eventName }) => eventName)).toEqual([
			"pie-toolkit-provider-registered",
			"pie-tool-init-start",
			"pie-tool-library-load-start",
			"pie-tool-init-success",
			"pie-toolkit-provider-ready",
		]);
		for (const { payload } of providerEvents) {
			expect(payload?.toolId).toBe("calculator");
			expect(payload).not.toHaveProperty("providerId");
		}
		const meta = { providerName: "Stub calculator provider" };
		expect(lifecycle).toEqual([
			["calculator", meta],
			["calculator", meta],
			["calculator", meta],
		]);
	});
});
