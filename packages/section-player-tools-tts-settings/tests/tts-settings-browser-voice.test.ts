import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

// The panel's custom element is defined once per test process, in the window
// registered first, so this file leaves happy-dom registered for the next one.
if (typeof window === "undefined") GlobalRegistrator.register();

const voices = [
	{
		voiceURI: "en-voice",
		name: "English",
		lang: "en-US",
		localService: true,
		default: true,
	},
	{
		voiceURI: "es-voice",
		name: "Spanish",
		lang: "es-ES",
		localService: true,
		default: false,
	},
];
const previewVoices: Array<string | null> = [];
const savedSpeechSynthesis = Object.getOwnPropertyDescriptor(
	window,
	"speechSynthesis",
);
const savedUtterance = (globalThis as any).SpeechSynthesisUtterance;
(globalThis as any).SpeechSynthesisUtterance = class {
	voice: { name: string } | null = null;
	onstart: (() => void) | null = null;
	onend: (() => void) | null = null;
	constructor(readonly text: string) {}
};
Object.defineProperty(window, "speechSynthesis", {
	configurable: true,
	value: {
		getVoices: () => voices,
		speak: (utterance: any) => {
			previewVoices.push(utterance.voice?.name ?? null);
			utterance.onstart?.();
			utterance.onend?.();
		},
		cancel: () => {},
		pause: () => {},
		resume: () => {},
	},
});

// After happy-dom registers: pie-context's events extend the global Event.
await import("../TtsSettingsPanel.svelte");

// The toolkit's runtime-context key; pie-context keys are the value passed in.
const assessmentToolkitRuntimeContext = Symbol.for(
	"pie.assessmentToolkit.runtimeContext",
);

const settle = async () => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

// Stands in for the toolkit: answers the panel's runtime-context request.
const mountPanelReading = async (
	contentLanguage: string,
): Promise<HTMLElement> => {
	const toolkit = document.createElement("div");
	toolkit.addEventListener("context-request", (event: any) => {
		if (event.context !== assessmentToolkitRuntimeContext) return;
		event.stopPropagation();
		event.callback({ contentLanguage }, () => {});
	});
	const panel = document.createElement("pie-section-player-tools-tts-settings");
	toolkit.append(panel);
	document.body.append(toolkit);
	await settle();
	await settle();
	return panel;
};

afterEach(async () => {
	document.body.replaceChildren();
	await settle();
});

afterAll(() => {
	if (savedSpeechSynthesis)
		Object.defineProperty(window, "speechSynthesis", savedSpeechSynthesis);
	else delete (window as unknown as Record<string, unknown>).speechSynthesis;
	(globalThis as any).SpeechSynthesisUtterance = savedUtterance;
});

test("the automatic browser voice and the recommendations follow the content language", async () => {
	const panel = await mountPanelReading("es-ES");

	expect(panel.querySelector("#tts-browser-auto-voice")?.textContent).toContain(
		"Spanish (es-ES",
	);
	const recommended = Array.from(
		panel.querySelectorAll("#tts-browser-voice optgroup:first-of-type option"),
	).map((option) => option.textContent);
	expect(recommended).toEqual(["Spanish (es-ES, local)"]);
});

test("the browser preview speaks with the voice for the content language", async () => {
	const panel = await mountPanelReading("es-ES");
	const preview = panel.querySelectorAll<HTMLButtonElement>(
		".pie-tts-actions button",
	)[1];

	preview?.click();
	await settle();

	expect(previewVoices).toEqual(["Spanish"]);
});

test("a browser apply replaces the fields a server backend set", async () => {
	const config: Record<string, unknown> = {
		backend: "browser",
		language: "es-ES",
		engine: "neural",
		providerOptions: { engine: "neural", lang_id: "es-ES", locale: "en-GB" },
	};
	const updates: Record<string, unknown>[] = [];
	const panel = document.createElement(
		"pie-section-player-tools-tts-settings",
	) as HTMLElement & { toolkitCoordinator: unknown };
	panel.toolkitCoordinator = {
		getToolConfig: () => config,
		updateToolConfig: (_toolId: string, update: Record<string, unknown>) => {
			updates.push(update);
		},
		ensureTTSReady: async () => {},
	};
	document.body.append(panel);
	await settle();
	await settle();

	panel
		.querySelectorAll<HTMLButtonElement>(".pie-tts-actions button")[2]
		?.click();
	await settle();

	expect(updates).toHaveLength(1);
	expect(updates[0]).toMatchObject({
		backend: "browser",
		language: undefined,
		engine: undefined,
		providerOptions: { locale: "en-GB" },
	});
	expect(updates[0].providerOptions).toEqual({ locale: "en-GB" });
});

test("a server backend opens the tab of its server provider", async () => {
	// Settings an earlier apply persisted would win over the coordinator's.
	window.localStorage.clear();
	const voiceRequests: string[] = [];
	const savedFetch = globalThis.fetch;
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		voiceRequests.push(String(input));
		return new Response(JSON.stringify({ voices: [] }), { status: 200 });
	}) as typeof fetch;
	const panel = document.createElement(
		"pie-section-player-tools-tts-settings",
	) as HTMLElement & { toolkitCoordinator: unknown; apiEndpoint: string };
	// The panel resolves voice URLs against the page origin, which is "null" in a
	// fresh happy-dom window.
	(window as any).happyDOM.setURL("http://tts.test/");
	panel.apiEndpoint = "http://tts.test/api/tts";
	panel.toolkitCoordinator = {
		getToolConfig: () => ({ backend: "server", serverProvider: "google" }),
		updateToolConfig: () => {},
		ensureTTSReady: async () => {},
	};
	try {
		document.body.append(panel);
		await settle();
		await settle();
	} finally {
		globalThis.fetch = savedFetch;
	}

	expect(voiceRequests).toHaveLength(1);
	expect(voiceRequests[0]).toStartWith("http://tts.test/api/tts/google/voices");

	const pressed = Array.from(
		panel.querySelectorAll<HTMLButtonElement>(".pie-tts-tabs button"),
	)
		.filter((button) => button.getAttribute("aria-pressed") === "true")
		.map((button) => button.textContent?.trim());
	expect(pressed).toEqual(["Google"]);
});
