import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { TTSService } = await import("@pie-players/pie-assessment-toolkit");
await import("../tool-annotation-toolbar.svelte");

type Service = InstanceType<typeof TTSService>;
type Failure = { toolId: string; phase: string; error: unknown };

const RUNTIME = Symbol.for("pie.assessmentToolkit.runtimeContext");
const SHELL = Symbol.for("pie.assessmentToolkit.shellContext");

const settle = async (rounds = 4) => {
	for (let i = 0; i < rounds; i++) {
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const answer = (
	host: Element,
	key: symbol,
	value: unknown,
): void => {
	host.addEventListener("context-request", (event: Event) => {
		const request = event as Event & {
			context: unknown;
			callback: (value: unknown) => void;
		};
		if (request.context !== key) return;
		event.stopPropagation();
		request.callback(value);
	});
};

const shellFor = (itemId: string, scopeElement: Element) => ({
	kind: "item",
	itemId,
	canonicalItemId: `${itemId}-canonical`,
	contentKind: "item",
	regionPolicy: "default",
	scopeElement,
	item: {},
	contextVersion: 1,
});

// A section holding one item shell and the section-wide strip, which has no
// shell of its own.
function mount(ttsService: Service) {
	const failures: Failure[] = [];
	const section = document.createElement("section");
	const shellHost = document.createElement("div");
	shellHost.setAttribute("data-pie-shell-root", "");
	const content = document.createElement("div");
	content.setAttribute("data-region", "content");
	const paragraph = document.createElement("p");
	paragraph.textContent = "Read the selected words.";
	content.append(paragraph);
	shellHost.append(content);
	section.append(shellHost);
	answer(shellHost, SHELL, shellFor("item-2", shellHost));
	answer(section, RUNTIME, {
		ttsService,
		assessmentId: "assessment-1",
		sectionId: "section-1",
		contentLanguage: "es-MX",
		toolkitCoordinator: {
			canRequestTool: (toolId: string) => toolId === "textToSpeech",
			reportToolFailure: (toolId: string, phase: string, error: unknown) => {
				failures.push({ toolId, phase, error });
			},
		},
	});
	const toolbar = document.createElement("pie-tool-annotation-toolbar");
	section.append(toolbar);
	document.body.append(section);
	return { toolbar, content, paragraph, failures };
}

async function select(node: Node): Promise<void> {
	await settle();
	const range = document.createRange();
	range.selectNodeContents(node);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	document.dispatchEvent(new Event("selectionchange"));
	await settle();
}

const readAloud = (toolbar: Element) =>
	toolbar.shadowRoot?.querySelector(
		'button[aria-label="Read selected text aloud"]',
	) as HTMLButtonElement | null;
const status = (toolbar: Element) =>
	toolbar.shadowRoot?.querySelector('[role="status"]')?.textContent?.trim();

afterEach(async () => {
	window.getSelection()?.removeAllRanges();
	document.body.replaceChildren();
	await settle();
});

test("read-aloud speaks the selection in its content region, language and shell", async () => {
	const service = new TTSService();
	const calls: Array<{ target: unknown; options: Record<string, unknown> }> =
		[];
	service.speak = async (target, options) => {
		calls.push({ target, options: { ...options } });
	};
	const { toolbar, content, paragraph, failures } = mount(service);

	await select(paragraph);
	readAloud(toolbar)?.click();
	await settle();

	expect(calls).toHaveLength(1);
	expect(String(calls[0].target)).toBe("Read the selected words.");
	expect(calls[0].options.contentRoot).toBe(content);
	expect(calls[0].options.language).toBe("es-MX");
	expect(calls[0].options.catalogContext).toEqual({
		ownerKind: "itemModel",
		assessmentId: "assessment-1",
		sectionId: "section-1",
		itemId: "item-2",
		canonicalItemId: "item-2-canonical",
	});
	expect(failures).toEqual([]);
});

test("a start failure announces that text-to-speech could not initialize", async () => {
	const service = new TTSService();
	service.setReadinessGate(() => Promise.reject(new Error("provider down")));
	const { toolbar, paragraph, failures } = mount(service);

	await select(paragraph);
	readAloud(toolbar)?.click();
	await settle();

	expect(status(toolbar)).toBe(
		"Unable to initialize text-to-speech. Try again.",
	);
	expect(failures).toEqual([]);
});

test("a playback failure is reported as the speech tool's", async () => {
	const service = new TTSService();
	const failure = new Error("synthesis failed");
	service.speak = async () => {
		throw failure;
	};
	const { toolbar, paragraph, failures } = mount(service);

	await select(paragraph);
	readAloud(toolbar)?.click();
	await settle();

	expect(failures).toEqual([
		{ toolId: "textToSpeech", phase: "tool-playback", error: failure },
	]);
	expect(status(toolbar)).not.toBe(
		"Unable to initialize text-to-speech. Try again.",
	);
});
