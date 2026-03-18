import { describe, expect, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";

describe("ToolkitCoordinator telemetry listeners", () => {
	test("subscribeTelemetry receives emitted telemetry payloads", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "telemetry-test",
			lazyInit: true,
		});

		const received: Array<{ eventName: string; payload?: Record<string, unknown> }> =
			[];
		const unsubscribe = coordinator.subscribeTelemetry((event) => {
			received.push(event);
		});

		await (coordinator as any).emitTelemetry("pie-tool-init-start", {
			toolId: "tts",
			backend: "polly",
		});
		unsubscribe();

		expect(received).toContainEqual({
			eventName: "pie-tool-init-start",
			payload: { toolId: "tts", backend: "polly" },
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
		});

		const received: Array<{ eventName: string; payload?: Record<string, unknown> }> =
			[];
		const unsubscribe = coordinator.subscribeTelemetry((event) => {
			received.push(event);
		});

		await expect(coordinator.ensureProviderReady("tts")).rejects.toThrow(
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
					entry.payload?.toolId === "textToSpeech" &&
					entry.payload?.providerId === "tts",
			),
		).toBe(true);
	});
});
