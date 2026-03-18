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
});
