import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type ITTSProvider,
	type ITTSProviderImplementation,
	type TTSConfig,
	ToolkitCoordinator,
} from "@pie-players/pie-assessment-toolkit";
import { ToolRegistry } from "@pie-players/pie-assessment-toolkit/tools/registration";
import {
	createTTSToolRegistration,
	ttsToolRegistration,
} from "../src/registrations/tts.js";

type Recorded = { configs: TTSConfig[]; spoken: string[] };

const createHostProvider = (recorded: Recorded) =>
	class HostProvider implements ITTSProvider {
		readonly providerId = "host-tts";
		async initialize(config: TTSConfig): Promise<ITTSProviderImplementation> {
			recorded.configs.push(config);
			return {
				speak: async (text: string) => {
					recorded.spoken.push(text);
				},
				pause: () => {},
				resume: () => {},
				stop: () => {},
				updateSettings: () => {},
			};
		}
		getCapabilities() {
			return { supportsWordBoundary: false };
		}
		destroy() {}
	};

const createProvider = (
	registration: ReturnType<typeof createTTSToolRegistration>,
	config: Record<string, unknown>,
) => {
	const provider = registration.provider?.createProvider(config);
	if (!provider) throw new Error("no provider");
	return provider;
};

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

describe("createTTSToolRegistration host providers", () => {
	test("provider.id selects the host provider, which needs no apiEndpoint", async () => {
		const recorded: Recorded = { configs: [], spoken: [] };
		const registration = createTTSToolRegistration({
			providers: { "host-tts": { load: async () => createHostProvider(recorded) } },
		});
		const provider = createProvider(registration, {
			provider: { id: "host-tts" },
		});

		expect(provider.requiresAuth).toBe(false);
		await provider.initialize({ authToken: "t", rate: 1.25 });
		const instance = await provider.createInstance();
		expect(instance.providerId).toBe("host-tts");

		await instance.initialize({ rate: 1 });
		expect(recorded.configs[0]).toMatchObject({ authToken: "t", rate: 1.25 });
	});

	test("requiresAuth follows the descriptor", () => {
		const registration = createTTSToolRegistration({
			providers: {
				"host-tts": {
					load: async () => createHostProvider({ configs: [], spoken: [] }),
					requiresAuth: true,
				},
			},
		});
		expect(
			createProvider(registration, { provider: { id: "host-tts" } })
				.requiresAuth,
		).toBe(true);
	});

	test("an absent or unregistered provider.id keeps the configured backend", async () => {
		const registration = createTTSToolRegistration({
			providers: {
				"host-tts": {
					load: async () => createHostProvider({ configs: [], spoken: [] }),
				},
			},
		});
		for (const candidate of [
			registration,
			ttsToolRegistration,
		]) {
			for (const config of [
				{ backend: "server" },
				{ backend: "server", provider: { id: "other" } },
			]) {
				const provider = createProvider(candidate, config);
				expect(provider.requiresAuth).toBe(true);
				await expect(provider.initialize({})).rejects.toThrow(
					"apiEndpoint required",
				);
			}
			expect(createProvider(candidate, {}).requiresAuth).toBe(false);
		}
	});

	test("the coordinator reads aloud through the host provider", async () => {
		const recorded: Recorded = { configs: [], spoken: [] };
		const toolRegistry = new ToolRegistry();
		toolRegistry.register(
			createTTSToolRegistration({
				providers: {
					"host-tts": { load: async () => createHostProvider(recorded) },
				},
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-host-provider-test",
			toolConfigStrictness: "error",
			toolRegistry,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						language: "en-US",
						provider: { id: "host-tts" },
					},
				},
				placement: { item: ["textToSpeech"], passage: ["textToSpeech"] },
			},
		});
		await coordinator.waitUntilReady();
		const content = document.createElement("p");
		content.textContent = "Hello";
		document.body.append(content);
		await coordinator.ttsService.speak(content);

		expect(recorded.spoken.join(" ")).toContain("Hello");
		coordinator.dispose?.();
		content.remove();
	});
});
