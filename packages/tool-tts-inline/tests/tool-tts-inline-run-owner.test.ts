import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { AccessibilityCatalogResolver, TTSService } = await import(
	"@pie-players/pie-assessment-toolkit"
);
await import("../tool-tts-inline.svelte");

type Service = InstanceType<typeof TTSService>;

const RUNTIME = Symbol.for("pie.assessmentToolkit.runtimeContext");
const SHELL = Symbol.for("pie.assessmentToolkit.shellContext");
const REGION = Symbol.for("pie.assessmentToolkit.regionScopeContext");

const settle = async (rounds = 4) => {
	for (let i = 0; i < rounds; i++) {
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
};

// Speaks until `finish()`, as a provider reading a long passage does.
class HeldImpl {
	speakCalls: string[] = [];
	private release: (() => void) | null = null;
	async speak(text: string): Promise<void> {
		this.speakCalls.push(text);
		await new Promise<void>((resolve) => {
			this.release = resolve;
		});
	}
	finish(): void {
		this.release?.();
		this.release = null;
	}
	pause(): void {}
	resume(): void {}
	stop(): void {
		this.finish();
	}
	isPlaying(): boolean {
		return this.release !== null;
	}
	isPaused(): boolean {
		return false;
	}
	updateSettings(): void {}
}

function providerFor(impl: HeldImpl) {
	return {
		providerId: "held",
		providerName: "Held",
		version: "1.0.0",
		initialize: async () => impl,
		getCapabilities: () => ({
			supportsPause: true,
			supportsResume: true,
			supportsWordBoundary: false,
			supportsVoiceSelection: false,
			supportsRateControl: true,
			supportsPitchControl: false,
		}),
		destroy() {},
	};
}

async function readyService(): Promise<{ service: Service; impl: HeldImpl }> {
	const impl = new HeldImpl();
	const service = new TTSService();
	await service.initialize(providerFor(impl) as never);
	return { service, impl };
}

function mount(service: Service, content: string, catalogId?: string) {
	const wrapper = document.createElement("div");
	const scope = document.createElement("div");
	scope.innerHTML = content;
	wrapper.append(scope);
	const runtime = { ttsService: service };
	const shell = {
		kind: "item",
		itemId: "item-1",
		canonicalItemId: "item-1",
		contentKind: "item",
		regionPolicy: "default",
		scopeElement: scope,
		item: {},
		contextVersion: 1,
	};
	const region = { scopeElement: scope };
	wrapper.addEventListener("context-request", (event: Event) => {
		const request = event as Event & {
			context: unknown;
			callback: (value: unknown) => void;
		};
		const value =
			request.context === RUNTIME
				? runtime
				: request.context === SHELL
					? shell
					: request.context === REGION
						? region
						: undefined;
		if (value === undefined) return;
		event.stopPropagation();
		request.callback(value);
	});
	const element = document.createElement("pie-tool-tts-inline");
	if (catalogId) element.setAttribute("catalog-id", catalogId);
	wrapper.append(element);
	document.body.append(wrapper);
	return element;
}

const trigger = (element: Element) =>
	element.shadowRoot?.querySelector(
		".pie-tool-tts-inline__trigger",
	) as HTMLElement;
const panelOpen = (element: Element) =>
	element.getAttribute("data-active") === "true";
const status = (element: Element) =>
	element.shadowRoot
		?.querySelector('[role="status"], [aria-live]')
		?.textContent?.trim();

async function play(element: Element): Promise<void> {
	await settle();
	trigger(element).click();
	await settle();
}

afterEach(async () => {
	document.body.replaceChildren();
	await settle();
});

test("a read carries the instance as owner, the selected rate and the catalog id", async () => {
	const { service, impl } = await readyService();
	const speak = service.speak.bind(service);
	const calls: Array<Record<string, unknown>> = [];
	service.speak = (target, options) => {
		calls.push({ ...options });
		return speak(target, options);
	};
	const element = mount(service, "<p>Read this passage aloud.</p>", "cat-1");

	await play(element);

	expect(calls).toHaveLength(1);
	expect(calls[0].catalogId).toBe("cat-1");
	expect(calls[0].rate).toBe(1);
	expect(typeof calls[0].ownerId).toBe("string");
	expect(service.getRunOwner()).toBe(calls[0].ownerId as string);
	expect(impl.speakCalls).toEqual(["Read this passage aloud."]);
	expect(panelOpen(element)).toBe(true);
	expect(status(element)).toBe("Reading started");
	impl.finish();
});

test("a selection read closes the panel and drops the inline highlight resolver", async () => {
	const { service, impl } = await readyService();
	const providers: Array<{ disposed: boolean }> = [];
	const install = service.setHighlightTargetResolverProvider.bind(service);
	service.setHighlightTargetResolverProvider = (provider) => {
		const entry = { disposed: false };
		providers.push(entry);
		const dispose = install(provider);
		return () => {
			entry.disposed = true;
			dispose();
		};
	};
	const element = mount(service, "<p>Read this passage aloud.</p>");
	await play(element);
	expect(service.getState()).toBe("playing");

	const selection = document.createElement("p");
	selection.textContent = "Only the selected words.";
	document.body.append(selection);
	void service.speak(selection);
	await settle();

	expect(panelOpen(element)).toBe(false);
	expect(status(element)).toBe("Reading switched to another section");
	expect(providers.map((entry) => entry.disposed)).toEqual([true]);
	expect(impl.speakCalls.at(-1)).toBe("Only the selected words.");
	impl.finish();
});

test("starting one instance closes the other's panel", async () => {
	const { service, impl } = await readyService();
	const first = mount(service, "<p>The first passage here.</p>");
	const second = mount(service, "<p>The second passage here.</p>");
	await play(first);
	expect(panelOpen(first)).toBe(true);

	await play(second);

	expect(panelOpen(first)).toBe(false);
	expect(panelOpen(second)).toBe(true);
	expect(status(second)).toBe("Reading started");
	expect(impl.speakCalls.at(-1)).toBe("The second passage here.");
	impl.finish();
});

test("an image carrying only a spoken card is read", async () => {
	const { service, impl } = await readyService();
	service.setCatalogResolver(
		new AccessibilityCatalogResolver([
			{
				identifier: "diagram",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content: "A diagram of the water cycle.",
					},
				],
			},
		]),
	);
	const element = mount(
		service,
		`<img data-catalog-idref="diagram" src="cycle.png" alt="">`,
	);

	await play(element);

	expect(impl.speakCalls).toEqual(["A diagram of the water cycle."]);
	expect(panelOpen(element)).toBe(true);
	impl.finish();
});

test("content with nothing to read closes the panel and says so", async () => {
	const { service, impl } = await readyService();
	const element = mount(service, "<p>   </p>");

	await play(element);

	expect(impl.speakCalls).toEqual([]);
	expect(panelOpen(element)).toBe(false);
	expect(status(element)).toBe("Nothing to read aloud here");

	await play(element);
	expect(status(element)).toBe("Nothing to read aloud here");
});

test("a readiness failure announces that text-to-speech could not initialize", async () => {
	const service = new TTSService();
	service.setReadinessGate(() => Promise.reject(new Error("provider down")));
	const element = mount(service, "<p>Read this passage aloud.</p>");

	await play(element);

	expect(panelOpen(element)).toBe(false);
	expect(status(element)).toBe(
		"Unable to initialize text-to-speech. Try again.",
	);
	expect(service.getState()).toBe("idle");
});

test("stop during a read closes the panel and keeps the stop announcement", async () => {
	const { service, impl } = await readyService();
	const element = mount(service, "<p>Read this passage aloud.</p>");
	await play(element);

	const stop = element.shadowRoot?.querySelector(
		"[data-pie-tts-stop]",
	) as HTMLButtonElement;
	stop.click();
	await settle();

	expect(panelOpen(element)).toBe(false);
	expect(status(element)).toBe("Reading stopped");
	expect(service.getState()).toBe("idle");
	expect(impl.isPlaying()).toBe(false);
});

test("a provider failure announces that reading could not start", async () => {
	const { service, impl } = await readyService();
	impl.speak = async () => {
		throw new Error("synthesis failed");
	};
	const element = mount(service, "<p>Read this passage aloud.</p>");

	await play(element);

	expect(panelOpen(element)).toBe(false);
	expect(status(element)).toBe("Unable to start reading");
});
