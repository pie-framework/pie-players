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

const ttsStarted = (coordinator: ToolkitCoordinator): boolean =>
	(coordinator as unknown as { ttsInitialized: boolean }).ttsInitialized;

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
	supportedLevels: ("item" | "passage" | "section")[] = ["item"],
) => {
	const registry = new ToolRegistry();
	registry.register(
		createTestToolRegistration({
			toolId,
			supportedLevels,
			provider: createFailingAuthProviderDescriptor(toolId),
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
			toolRegistry: registryWith("calculator"),
			tools: { placement: { item: ["calculator"] } },
		});
		const errors = collectErrors(coordinator);

		await expect(
			coordinator.ensureProviderReady("calculator"),
		).rejects.toThrow();

		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ kind: "provider-init", recoverable: true });
	});

	test("a provider failure is fatal for a granted tool", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "provider-granted",
			eagerInit: false,
			toolRegistry: registryWith("calculator"),
			tools: { placement: { item: ["calculator"] } },
		});
		coordinator.updateAssessment(granting("calculator"));
		const errors = collectErrors(coordinator);

		await expect(
			coordinator.ensureProviderReady("calculator"),
		).rejects.toThrow();

		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ kind: "provider-init", recoverable: false });
	});

	test("a degraded tool that policy later grants is reported again as fatal", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "provider-granted-later",
			eagerInit: false,
			toolRegistry: registryWith("calculator"),
			tools: { placement: { item: ["calculator"] } },
		});
		const errors = collectErrors(coordinator);
		await coordinator.ensureProviderReady("calculator").catch(() => {});

		coordinator.updateAssessment(granting("calculator"));
		coordinator.updateAssessment(granting("calculator"));

		expect(errors.map((model) => model.recoverable)).toEqual([true, false]);
	});

	test("a provider registration failure degrades the tool until policy grants it", async () => {
		const register = async (assessmentId: string, grant: boolean) => {
			const errors: FrameworkErrorModel[] = [];
			const coordinator = new ToolkitCoordinator({
				assessmentId,
				eagerInit: false,
				toolRegistry: registryWith("calculator"),
				tools: { placement: { item: ["calculator"] } },
				hooks: {
					onProviderRegistered: () => {
						throw new Error("register hook failed");
					},
					onFrameworkError: (model) => errors.push(model),
				},
			});
			await coordinator.waitUntilReady().catch(() => {});
			if (grant) coordinator.updateAssessment(granting("calculator"));
			return errors.filter((model) => model.kind === "provider-register");
		};

		const recoverable = async (assessmentId: string, grant: boolean) =>
			(await register(assessmentId, grant)).map((model) => model.recoverable);
		expect(await recoverable("register-degrades", false)).toEqual([true]);
		expect(await recoverable("register-granted-later", true)).toEqual([true, false]);
	});

	test("a tool module failure degrades the tool, once however many toolbars report it", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "module-degrades",
			eagerInit: false,
			toolRegistry: registryWith("calculator"),
			tools: { placement: { item: ["calculator"] } },
		});
		const errors = collectErrors(coordinator);
		let targetChanges = 0;
		coordinator.onToolRequestTargetsChange(() => {
			targetChanges += 1;
		});
		const failure = new Error("chunk missing");

		coordinator.reportToolFailure("calculator", "tool-module-load", failure);
		coordinator.reportToolFailure("calculator", "tool-module-load", failure);

		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({
			kind: "tool-module-load",
			recoverable: true,
			message: 'Tool "calculator" failed to load: chunk missing',
		});
		expect((errors[0].cause as Error).cause).toBe(failure);
		// Each reporting toolbar stopped hosting the tool.
		expect(targetChanges).toBe(2);
	});

	test("a tool module failure is fatal for a granted tool, including one granted later", () => {
		const granted = new ToolkitCoordinator({
			assessmentId: "module-granted",
			eagerInit: false,
			toolRegistry: registryWith("calculator"),
			tools: { placement: { item: ["calculator"] } },
		});
		granted.updateAssessment(granting("calculator"));
		const grantedErrors = collectErrors(granted);
		granted.reportToolFailure("calculator", "tool-module-load", new Error("chunk missing"));
		expect(grantedErrors.map((model) => model.recoverable)).toEqual([false]);

		const later = new ToolkitCoordinator({
			assessmentId: "module-granted-later",
			eagerInit: false,
			toolRegistry: registryWith("calculator"),
			tools: { placement: { item: ["calculator"] } },
		});
		const laterErrors = collectErrors(later);
		later.reportToolFailure("calculator", "tool-module-load", new Error("chunk missing"));
		later.updateAssessment(granting("calculator"));
		expect(laterErrors.map((model) => model.recoverable)).toEqual([true, false]);
	});

	test("a tool callback failure is recoverable for a granted tool, once per phase, after the caller returns", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "callback-granted",
			eagerInit: false,
			toolRegistry: registryWith("calculator"),
			tools: { placement: { item: ["calculator"] } },
		});
		coordinator.updateAssessment(granting("calculator"));
		const errors = collectErrors(coordinator);
		const failure = new Error("predicate threw");

		coordinator.reportToolFailure("calculator", "tool-visibility", failure);
		coordinator.reportToolFailure("calculator", "tool-visibility", failure);
		coordinator.reportToolFailure("calculator", "tool-applicability", failure);
		// Reported from inside a toolbar's derived state, so delivered later.
		expect(errors).toEqual([]);
		await Promise.resolve();

		expect(errors.map(({ kind, recoverable }) => ({ kind, recoverable }))).toEqual([
			{ kind: "tool-registration", recoverable: true },
			{ kind: "tool-registration", recoverable: true },
		]);
		expect(errors[0].message).toBe(
			'Tool "calculator" failed its relevance check: predicate threw',
		);
		expect((errors[0].cause as Error).cause).toBe(failure);

		// A recoverable callback failure leaves the tool undegraded, so a later
		// grant has nothing to escalate.
		coordinator.updateAssessment(granting("calculator", "textToSpeech"));
		await Promise.resolve();
		expect(errors).toHaveLength(2);
	});

	test("a toolbar that throws answering or opening a request is reported and passed by", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "request-throws",
			eagerInit: false,
			toolRegistry: registryWith("calculator"),
			tools: { placement: { item: ["calculator"] } },
		});
		const errors = collectErrors(coordinator);
		const release = coordinator.registerToolRequestTarget({
			level: "section",
			hostsTool: () => {
				throw new Error("host check threw");
			},
			open: () => {},
		});
		expect(coordinator.canRequestTool("calculator")).toBe(false);
		release();
		coordinator.registerToolRequestTarget({
			level: "section",
			hostsTool: () => true,
			open: () => {
				throw new Error("open threw");
			},
		});
		expect(coordinator.requestTool({ toolId: "calculator" })).toBe(false);
		await Promise.resolve();

		expect(errors.map(({ kind, recoverable, message }) => ({ kind, recoverable, message }))).toEqual([
			{
				kind: "tool-request",
				recoverable: true,
				message: `Tool "calculator" failed its toolbar's host check: host check threw`,
			},
			{
				kind: "tool-request",
				recoverable: true,
				message: 'Tool "calculator" failed to open on request: open threw',
			},
		]);
	});

	test("a tool's state and playback failures are recoverable", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tool-runtime-failures",
			eagerInit: false,
			toolRegistry: registryWith("annotationToolbar"),
			tools: { placement: { item: ["annotationToolbar"] } },
		});
		coordinator.updateAssessment(granting("annotationToolbar", "textToSpeech"));
		const errors = collectErrors(coordinator);

		coordinator.reportToolFailure("annotationToolbar", "tool-state-load", new Error("corrupt"));
		coordinator.reportToolFailure("annotationToolbar", "tool-state-save", new Error("quota"));
		coordinator.reportToolFailure("textToSpeech", "tool-playback", new Error("audio fetch failed"));
		await Promise.resolve();

		expect(errors.map(({ kind, recoverable }) => ({ kind, recoverable }))).toEqual([
			{ kind: "tool-state-load", recoverable: true },
			{ kind: "tool-state-save", recoverable: true },
			{ kind: "tool-playback", recoverable: true },
		]);
	});

	test("a server speech provider that fails is recoverable while browser speech starts", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-fallback",
			eagerInit: false,
			toolRegistry: registryWith("textToSpeech", ["item", "passage"]),
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

		expect(ttsStarted(coordinator)).toBe(true);
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
		expect(ttsStarted(coordinator)).toBe(false);
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

		expect(ttsStarted(coordinator)).toBe(true);
	});

	test("eagerInit false leaves the start to waitUntilReady", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-not-eager",
			eagerInit: false,
			tools: browserSpeech,
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(coordinator.isReady()).toBe(false);
		expect(ttsStarted(coordinator)).toBe(false);

		await coordinator.waitUntilReady();
		expect(ttsStarted(coordinator)).toBe(true);
	});

	test("lazyInit defers it past readiness to the first speak", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-lazy",
			lazyInit: true,
			tools: browserSpeech,
		});

		await coordinator.waitUntilReady();
		expect(coordinator.isReady()).toBe(true);
		expect(ttsStarted(coordinator)).toBe(false);

		await coordinator.ttsService
			.speak(contentWith("hello"))
			.catch(() => {});
		expect(ttsStarted(coordinator)).toBe(true);
	});

	test("lazyInit does not defer speech policy grants", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-lazy-granted",
			lazyInit: true,
			tools: browserSpeech,
		});
		coordinator.updateAssessment(granting("textToSpeech"));

		await coordinator.waitUntilReady();

		expect(ttsStarted(coordinator)).toBe(true);
	});
});
