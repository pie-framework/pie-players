import { describe, expect, test } from "bun:test";
import type { ITTSProvider } from "@pie-players/pie-tts";
import { TTSToolProvider } from "../src/services/tool-providers/TTSToolProvider";

class StubServerProvider {
	readonly providerId = "server-tts";
	initialize = async () => ({}) as never;
	getCapabilities = () => ({}) as never;
	destroy = () => {};
}

describe("TTSToolProvider server adapter loader", () => {
	test("a server backend without a loader fails to initialize", async () => {
		const provider = new TTSToolProvider("server");

		await expect(
			provider.initialize({ apiEndpoint: "/api/tts" }),
		).rejects.toThrow("loadServerProvider");
		expect(provider.isReady()).toBe(false);
	});

	test("a server backend constructs the provider the loader resolves", async () => {
		const events: string[] = [];
		const provider = new TTSToolProvider("server", {
			loadServerProvider: async () =>
				StubServerProvider as unknown as new () => ITTSProvider,
		});

		await provider.initialize({
			apiEndpoint: "/api/tts",
			onTelemetry: (eventName) => {
				events.push(eventName);
			},
		});

		expect((await provider.createInstance()).providerId).toBe("server-tts");
		expect(events).toEqual([
			"pie-tool-library-load-start",
			"pie-tool-library-load-success",
		]);
	});

	test("a failing loader reports load-error telemetry and rethrows", async () => {
		const events: string[] = [];
		const provider = new TTSToolProvider("server", {
			loadServerProvider: async () => {
				throw new Error("chunk failed");
			},
		});

		await expect(
			provider.initialize({
				apiEndpoint: "/api/tts",
				onTelemetry: (eventName) => {
					events.push(eventName);
				},
			}),
		).rejects.toThrow("chunk failed");
		expect(events).toEqual([
			"pie-tool-library-load-start",
			"pie-tool-library-load-error",
		]);
	});
});
