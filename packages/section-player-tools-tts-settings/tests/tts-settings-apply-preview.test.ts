import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeEach, expect, test } from "bun:test";

// The panel's custom element is defined once per test process, in the window
// registered first, so this file leaves happy-dom registered for the next one.
if (typeof window === "undefined") GlobalRegistrator.register();

const { PlaybackState } = await import("@pie-players/pie-assessment-toolkit");
await import("../TtsSettingsPanel.svelte");

// The panel resolves voice URLs against the page origin, which is "null" in a
// fresh happy-dom window.
(window as any).happyDOM.setURL("http://tts.test/");
const API_ENDPOINT = "http://tts.test/api/tts";
const STORAGE_KEY = "test:tts-settings";

const settle = async () => {
	for (let round = 0; round < 4; round += 1) {
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
};

// Server routes the panel calls: voice lists and the preview synthesis.
const serverVoices: Record<"polly" | "google", unknown[]> = {
	polly: [{ id: "Joanna", name: "Joanna", languageCode: "en-US" }],
	google: [{ id: "en-US-Wavenet-A", name: "en-US-Wavenet-A", languageCode: "en-US" }],
};
const savedFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
	const url = String(input);
	const json = (body: unknown) =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	if (url.includes("/polly/voices")) return json({ voices: serverVoices.polly });
	if (url.includes("/google/voices")) return json({ voices: serverVoices.google });
	if (url.endsWith("/synthesize")) {
		return json({ audio: btoa("audio"), contentType: "audio/mpeg" });
	}
	return new Response("{}", { status: 404 });
}) as typeof fetch;

// Plays until the test ends it; clearing `src` fires `error`, as browsers do.
class FakeAudio {
	static instances: FakeAudio[] = [];
	onended: (() => void) | null = null;
	onerror: (() => void) | null = null;
	paused = true;
	duration = Number.NaN;
	#src: string;
	constructor(src = "") {
		this.#src = src;
		FakeAudio.instances.push(this);
	}
	get src() {
		return this.#src;
	}
	set src(value: string) {
		this.#src = value;
		if (!value) this.onerror?.();
	}
	play() {
		this.paused = false;
		return Promise.resolve();
	}
	pause() {
		this.paused = true;
	}
	addEventListener() {}
	removeEventListener() {}
}
const savedAudio = (globalThis as any).Audio;
(globalThis as any).Audio = FakeAudio;

const createdUrls: string[] = [];
const revokedUrls: string[] = [];
const savedCreateObjectURL = URL.createObjectURL;
const savedRevokeObjectURL = URL.revokeObjectURL;
URL.createObjectURL = () => {
	const url = `blob:preview-${createdUrls.length + 1}`;
	createdUrls.push(url);
	return url;
};
URL.revokeObjectURL = (url: string) => {
	revokedUrls.push(url);
};

afterAll(() => {
	globalThis.fetch = savedFetch;
	(globalThis as any).Audio = savedAudio;
	URL.createObjectURL = savedCreateObjectURL;
	URL.revokeObjectURL = savedRevokeObjectURL;
});

beforeEach(async () => {
	// Unmounting settles a preview the last test left running, so its cleanup
	// lands before the records reset.
	document.body.replaceChildren();
	await settle();
	window.localStorage.clear();
	FakeAudio.instances = [];
	createdUrls.length = 0;
	revokedUrls.length = 0;
});

type Coordinator = ReturnType<typeof createCoordinator>;

function createCoordinator(
	config: Record<string, unknown>,
	ensureTTSReady: () => Promise<void> = async () => {},
) {
	const updates: Record<string, unknown>[] = [];
	const ttsListeners = new Set<(state: string) => void>();
	const tts = { stops: 0, unsubscribes: 0 };
	return {
		updates,
		tts,
		announce: (state: string) => {
			for (const listener of [...ttsListeners]) listener(state);
		},
		api: {
			getToolConfig: () => config,
			updateToolConfig: (_toolId: string, update: Record<string, unknown>) => {
				updates.push(update);
			},
			ensureTTSReady,
			ttsService: {
				stop: () => {
					tts.stops += 1;
				},
				onStateChange: (listener: (state: string) => void) => {
					ttsListeners.add(listener);
					return () => {
						tts.unsubscribes += 1;
						ttsListeners.delete(listener);
					};
				},
			},
		},
	};
}

type Panel = HTMLElement & {
	toolkitCoordinator: unknown;
	apiEndpoint: string;
	storageKey: string;
	customProviders: unknown;
};

async function mountPanel(
	coordinator: Coordinator,
	customProviders: unknown[] = [],
): Promise<Panel> {
	const panel = document.createElement(
		"pie-section-player-tools-tts-settings",
	) as Panel;
	panel.toolkitCoordinator = coordinator.api;
	panel.apiEndpoint = API_ENDPOINT;
	panel.storageKey = STORAGE_KEY;
	panel.customProviders = customProviders;
	document.body.append(panel);
	await settle();
	return panel;
}

const actionButton = (panel: Element, index: 1 | 2) =>
	panel.querySelectorAll<HTMLButtonElement>(".pie-tts-actions button")[index];
const previewButton = (panel: Element) => actionButton(panel, 1);
const tabButton = (panel: Element, label: string) =>
	Array.from(panel.querySelectorAll<HTMLButtonElement>(".pie-tts-tabs button")).find(
		(button) => button.textContent?.trim() === label,
	);
const errorAlerts = (panel: Element) =>
	Array.from(panel.querySelectorAll(".alert-error")).map((alert) =>
		alert.textContent?.trim(),
	);
const storedSettings = () =>
	JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");

const SHARED_PROVIDER_OPTIONS = { locale: "en-GB", engine: "standard", lang_id: "es-ES" };

const pollyConfig = () => ({
	backend: "server",
	serverProvider: "polly",
	apiEndpoint: API_ENDPOINT,
	defaultVoice: "Joanna",
	providerOptions: { ...SHARED_PROVIDER_OPTIONS },
});

async function apply(panel: Element) {
	actionButton(panel, 2).click();
	await settle();
}

test("a Polly apply sends top-level engine fields and keeps only shared provider options", async () => {
	const coordinator = createCoordinator(pollyConfig());
	const panel = await mountPanel(coordinator);

	await apply(panel);

	expect(coordinator.updates).toHaveLength(1);
	expect(coordinator.updates[0]).toMatchObject({
		enabled: true,
		backend: "server",
		serverProvider: "polly",
		apiEndpoint: API_ENDPOINT,
		transportMode: "pie",
		endpointMode: "synthesizePath",
		endpointValidationMode: "voices",
		defaultVoice: "Joanna",
		engine: "neural",
		sampleRate: 24000,
		format: "mp3",
		speechMarksMode: "word",
	});
	expect(coordinator.updates[0].providerOptions).toEqual({
		locale: "en-GB",
		speechMarkTypes: ["word"],
	});
	const stored = storedSettings();
	expect(stored).toMatchObject({
		tab: "polly",
		backend: "server",
		serverProvider: "polly",
		defaultVoice: "Joanna",
		engine: "neural",
		sampleRate: 24000,
		format: "mp3",
	});
	expect(stored.providerOptions).toEqual({ speechMarkTypes: ["word"] });
	expect(stored).not.toHaveProperty("enabled");
	expect(stored).not.toHaveProperty("googleVoiceType");
});

test("a Google apply leaves an unlisted voice to the server and stores the voice-list filters", async () => {
	const coordinator = createCoordinator({
		backend: "server",
		serverProvider: "google",
		apiEndpoint: API_ENDPOINT,
		defaultVoice: "en-US-Missing",
		providerOptions: { ...SHARED_PROVIDER_OPTIONS },
	});
	const panel = await mountPanel(coordinator);

	await apply(panel);

	expect(coordinator.updates).toHaveLength(1);
	const [update] = coordinator.updates;
	expect(update).toMatchObject({
		backend: "server",
		serverProvider: "google",
		defaultVoice: undefined,
		engine: undefined,
		sampleRate: undefined,
		format: undefined,
	});
	expect(update.providerOptions).toEqual({ locale: "en-GB" });
	expect(update).not.toHaveProperty("googleVoiceType");
	expect(update).not.toHaveProperty("googleGender");
	const stored = storedSettings();
	expect(stored).toMatchObject({
		tab: "google",
		serverProvider: "google",
		googleVoiceType: "wavenet",
		googleGender: "",
	});
	expect(stored).not.toHaveProperty("defaultVoice");
	expect(stored).not.toHaveProperty("providerOptions");
});

test("a custom provider's apply config merges over the shared provider options", async () => {
	const coordinator = createCoordinator(pollyConfig());
	const panel = await mountPanel(coordinator, [
		{
			id: "demo",
			label: "Demo",
			buildApplyConfig: ({ apiEndpoint }: { apiEndpoint: string }) => ({
				config: {
					backend: "server",
					serverProvider: "custom",
					apiEndpoint: `${apiEndpoint}/demo`,
					providerOptions: { voice: "demo-a" },
				},
			}),
		},
	]);
	tabButton(panel, "Demo")?.click();
	await settle();

	await apply(panel);

	expect(coordinator.updates).toHaveLength(1);
	const [update] = coordinator.updates;
	expect(update).toMatchObject({
		backend: "server",
		serverProvider: "custom",
		apiEndpoint: `${API_ENDPOINT}/demo`,
		defaultVoice: undefined,
		engine: undefined,
	});
	expect(update.providerOptions).toEqual({ locale: "en-GB", voice: "demo-a" });
	const stored = storedSettings();
	expect(stored).toMatchObject({
		tab: "demo",
		serverProvider: "custom",
		apiEndpoint: `${API_ENDPOINT}/demo`,
	});
	expect(stored.providerOptions).toEqual({ voice: "demo-a" });
});

test("stored settings win over the coordinator's on the next open", async () => {
	const first = createCoordinator({ ...pollyConfig(), engine: "standard" });
	const firstPanel = await mountPanel(first);
	await apply(firstPanel);
	firstPanel.remove();
	await settle();

	const second = createCoordinator({ backend: "browser" });
	const secondPanel = await mountPanel(second);
	const pressed = Array.from(
		secondPanel.querySelectorAll<HTMLButtonElement>(".pie-tts-tabs button"),
	)
		.filter((button) => button.getAttribute("aria-pressed") === "true")
		.map((button) => button.textContent?.trim());
	expect(pressed).toEqual(["Polly"]);
	await apply(secondPanel);

	expect(first.updates).toHaveLength(1);
	expect(first.updates[0]).toMatchObject({ engine: "standard", defaultVoice: "Joanna" });
	expect(second.updates).toHaveLength(1);
	// A restored speed list comes back normalized, so compare it by rate.
	const rates = (options: unknown) =>
		(options as Array<number | { rate: number }>).map((option) =>
			typeof option === "number" ? option : option.rate,
		);
	const {
		providerOptions: firstOptions,
		speedOptions: firstSpeeds,
		...firstUpdate
	} = first.updates[0];
	const {
		providerOptions: secondOptions,
		speedOptions: secondSpeeds,
		...secondUpdate
	} = second.updates[0];
	expect(secondUpdate).toEqual(firstUpdate);
	expect(rates(secondSpeeds)).toEqual(rates(firstSpeeds));
	expect(firstOptions).toEqual({ locale: "en-GB", speechMarkTypes: ["word"] });
	expect(secondOptions).toEqual({ speechMarkTypes: ["word"] });
});

test("a backend that fails to start reports the failure and keeps the panel open", async () => {
	const coordinator = createCoordinator(pollyConfig(), async () => {
		throw new Error("Polly backend refused the connection.");
	});
	const panel = await mountPanel(coordinator);
	let closes = 0;
	panel.addEventListener("close", () => {
		closes += 1;
	});

	await apply(panel);

	expect(coordinator.updates).toHaveLength(1);
	expect(errorAlerts(panel)).toEqual(["Polly backend refused the connection."]);
	expect(closes).toBe(0);
});

async function startPollyPreview(coordinator: Coordinator): Promise<Panel> {
	const panel = await mountPanel(coordinator);
	previewButton(panel).click();
	await settle();
	expect(previewButton(panel).textContent?.trim()).toBe("Stop preview");
	expect(FakeAudio.instances).toHaveLength(1);
	expect(FakeAudio.instances[0].paused).toBe(false);
	expect(coordinator.tts.stops).toBe(1);
	return panel;
}

function expectPreviewEndedQuietly(panel: Element, coordinator: Coordinator) {
	expect(FakeAudio.instances[0].paused).toBe(true);
	expect(revokedUrls).toEqual(createdUrls);
	expect(createdUrls).toHaveLength(1);
	// The run's own cleanup ran, so its promise settled.
	expect(coordinator.tts.unsubscribes).toBe(1);
	expect(errorAlerts(panel)).toEqual([]);
}

test("stopping a preview ends it without an error and releases its audio", async () => {
	const coordinator = createCoordinator(pollyConfig());
	const panel = await startPollyPreview(coordinator);

	previewButton(panel).click();
	await settle();

	expectPreviewEndedQuietly(panel, coordinator);
	expect(previewButton(panel).textContent?.trim()).toBe("Preview voice");
});

test("switching tabs mid-preview ends it without an error and releases its audio", async () => {
	const coordinator = createCoordinator(pollyConfig());
	const panel = await startPollyPreview(coordinator);

	tabButton(panel, "Google")?.click();
	await settle();

	expectPreviewEndedQuietly(panel, coordinator);
});

test("the toolkit reader starting ends the panel preview", async () => {
	const coordinator = createCoordinator(pollyConfig());
	const panel = await startPollyPreview(coordinator);

	coordinator.announce(PlaybackState.IDLE);
	await settle();
	expect(FakeAudio.instances[0].paused).toBe(false);

	coordinator.announce(PlaybackState.LOADING);
	await settle();

	expectPreviewEndedQuietly(panel, coordinator);
	expect(previewButton(panel).textContent?.trim()).toBe("Preview voice");
});
