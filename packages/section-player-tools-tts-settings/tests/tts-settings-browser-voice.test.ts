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
const { assessmentToolkitRuntimeContext } = await import(
	"@pie-players/pie-assessment-toolkit"
);
await import("../TtsSettingsPanel.svelte");

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
