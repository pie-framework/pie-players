import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";
import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";
import type { FrameworkErrorModel } from "../src/services/framework-error.js";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { ToolRegistry } from "../src/services/ToolRegistry.js";
import {
	createFailingAuthProviderDescriptor,
	createTestToolRegistration,
} from "./fixtures/test-tool-registry.js";
import { contentWith } from "./fixtures/read-aloud-content.js";

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

/**
 * A tool that fails to start degrades, reporting itself unavailable, unless
 * policy grants it as an accommodation; a granted tool's failure is fatal. A
 * failure a fallback absorbs is recoverable whatever the policy. `lazyInit`
 * defers text-to-speech to its first use unless policy grants it.
 */

const globals = globalThis as Record<string, unknown>;
const originalWindow = globals.window;
let warnSpy: ReturnType<typeof spyOn>;
let logSpy: ReturnType<typeof spyOn>;

const withBrowserSpeech = () => {
	globals.window = {
		setTimeout,
		clearTimeout,
		speechSynthesis: {
			getVoices: () => [{ name: "Test Voice", lang: "en-US" }],
		},
	};
};

beforeEach(() => {
	withBrowserSpeech();
	warnSpy = spyOn(console, "warn").mockImplementation(() => {});
	logSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	logSpy.mockRestore();
	if (originalWindow === undefined) {
		delete globals.window;
	} else {
		globals.window = originalWindow;
	}
});

const granting = (...supports: string[]) =>
	({
		id: "failure-policy",
		personalNeedsProfile: { supports },
	}) as AssessmentEntity;

const registryWith = (
	toolId: string,
	providerId: string,
	supportedLevels: ("item" | "passage" | "section")[] = ["item"],
) => {
	const registry = new ToolRegistry();
	registry.register(
		createTestToolRegistration({
			toolId,
			supportedLevels,
			provider: createFailingAuthProviderDescriptor(providerId),
		}),
	);
	return registry;
};

const collectErrors = (coordinator: ToolkitCoordinator) => {
	const errors: FrameworkErrorModel[] = [];
	coordinator.subscribeFrameworkErrors((model) => errors.push(model));
	return errors;
};

describe("tool start failures", () => {
	test("a provider failure degrades a tool policy does not grant", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "provider-degrades",
			eagerInit: false,
			toolRegistry: registryWith("calculator", "calculator-stub"),
			tools: { placement: { item: ["calculator"] } },
		});
		const errors = collectErrors(coordinator);

		await expect(
			coordinator.ensureProviderReady("calculator-stub"),
		).rejects.toThrow();

		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ kind: "provider-init", recoverable: true });
	});

	test("a provider failure is fatal for a granted tool", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "provider-granted",
			eagerInit: false,
			toolRegistry: registryWith("calculator", "calculator-stub"),
			tools: { placement: { item: ["calculator"] } },
		});
		coordinator.updateAssessment(granting("calculator"));
		const errors = collectErrors(coordinator);

		await expect(
			coordinator.ensureProviderReady("calculator-stub"),
		).rejects.toThrow();

		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ kind: "provider-init", recoverable: false });
	});

	test("a degraded tool that policy later grants is reported again as fatal", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "provider-granted-later",
			eagerInit: false,
			toolRegistry: registryWith("calculator", "calculator-stub"),
			tools: { placement: { item: ["calculator"] } },
		});
		const errors = collectErrors(coordinator);
		await coordinator.ensureProviderReady("calculator-stub").catch(() => {});

		coordinator.updateAssessment(granting("calculator"));
		coordinator.updateAssessment(granting("calculator"));

		expect(errors.map((model) => model.recoverable)).toEqual([true, false]);
	});

	test("a server speech provider that fails is recoverable while browser speech starts", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-fallback",
			eagerInit: false,
			toolRegistry: registryWith("textToSpeech", "tts", ["item", "passage"]),
			tools: {
				providers: {
					textToSpeech: { enabled: true, backend: "server", apiEndpoint: "/api/tts" },
				},
				placement: { item: ["textToSpeech"] },
			},
		});
		coordinator.updateAssessment(granting("textToSpeech"));
		const errors = collectErrors(coordinator);

		await coordinator.waitUntilReady();

		expect(coordinator.getInitStatus().tts).toBe(true);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ kind: "provider-init", recoverable: true });
	});

	test("speech that cannot start degrades and readiness settles", async () => {
		delete globals.window;
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-degrades",
			eagerInit: false,
			tools: {
				providers: { textToSpeech: { enabled: true, backend: "browser" } },
				placement: { item: ["textToSpeech"] },
			},
		});
		const errors = collectErrors(coordinator);

		await coordinator.waitUntilReady();

		expect(coordinator.isReady()).toBe(true);
		expect(coordinator.getInitStatus().tts).toBe(false);
		expect(errors.map((model) => [model.kind, model.recoverable])).toEqual([
			["tts-init", true],
		]);
	});

	test("granted speech that cannot start fails readiness", async () => {
		delete globals.window;
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-granted-fails",
			eagerInit: false,
			tools: {
				providers: { textToSpeech: { enabled: true, backend: "browser" } },
				placement: { item: ["textToSpeech"] },
			},
		});
		coordinator.updateAssessment(granting("textToSpeech"));
		const errors = collectErrors(coordinator);

		await expect(coordinator.waitUntilReady()).rejects.toThrow();

		expect(coordinator.isReady()).toBe(false);
		expect(errors.map((model) => [model.kind, model.recoverable])).toEqual([
			["tts-init", false],
		]);
	});
});

describe("text-to-speech start", () => {
	const browserSpeech = {
		providers: { textToSpeech: { enabled: true, backend: "browser" as const } },
		placement: { item: ["textToSpeech"] },
	};

	test("starts with the coordinator by default", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-eager",
			tools: browserSpeech,
		});
		const ready = new Promise<void>((resolve) => {
			coordinator.onReadyChange(() => {
				if (coordinator.isReady()) resolve();
			});
		});

		await ready;

		expect(coordinator.getInitStatus().tts).toBe(true);
	});

	test("eagerInit false leaves the start to waitUntilReady", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-not-eager",
			eagerInit: false,
			tools: browserSpeech,
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(coordinator.isReady()).toBe(false);
		expect(coordinator.getInitStatus().tts).toBe(false);

		await coordinator.waitUntilReady();
		expect(coordinator.getInitStatus().tts).toBe(true);
	});

	test("lazyInit defers it past readiness to the first speak", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-lazy",
			lazyInit: true,
			tools: browserSpeech,
		});

		await coordinator.waitUntilReady();
		expect(coordinator.isReady()).toBe(true);
		expect(coordinator.getInitStatus().tts).toBe(false);

		await coordinator
			.getServiceBundle()
			.ttsService.speak(contentWith("hello"))
			.catch(() => {});
		expect(coordinator.getInitStatus().tts).toBe(true);
	});

	test("lazyInit does not defer speech policy grants", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-lazy-granted",
			lazyInit: true,
			tools: browserSpeech,
		});
		coordinator.updateAssessment(granting("textToSpeech"));

		await coordinator.waitUntilReady();

		expect(coordinator.getInitStatus().tts).toBe(true);
	});
});
