import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { createPieI18n, loadBundledCatalog } = await import(
	"@pie-players/pie-players-shared/i18n"
);
await import("../tool-annotation-toolbar.svelte");

const RUNTIME = Symbol.for("pie.assessmentToolkit.runtimeContext");
const SHELL = Symbol.for("pie.assessmentToolkit.shellContext");

const settle = async (rounds = 4) => {
	for (let i = 0; i < rounds; i++) {
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

const answer = (host: Element, key: symbol, value: unknown): void => {
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

// A section holding one item shell and the section-wide strip.
function mount(i18n: unknown) {
	const section = document.createElement("section");
	const shellHost = document.createElement("div");
	shellHost.setAttribute("data-pie-shell-root", "");
	const content = document.createElement("div");
	content.setAttribute("data-region", "content");
	const paragraph = document.createElement("p");
	paragraph.textContent = "Photosynthesis";
	content.append(paragraph);
	shellHost.append(content);
	answer(shellHost, SHELL, {
		kind: "item",
		itemId: "item-1",
		canonicalItemId: "item-1",
		contentKind: "item",
		regionPolicy: "default",
		scopeElement: shellHost,
		item: {},
		contextVersion: 1,
	});
	answer(section, RUNTIME, { i18n, assessmentId: "a-1", sectionId: "s-1" });
	const toolbar = document.createElement("pie-tool-annotation-toolbar");
	section.append(shellHost, toolbar);
	document.body.append(section);
	return { toolbar, paragraph };
}

const status = (toolbar: Element) =>
	toolbar.shadowRoot?.querySelector('[role="status"]')?.textContent?.trim();

afterEach(async () => {
	window.getSelection()?.removeAllRanges();
	document.body.replaceChildren();
	await settle();
});

// The bundled set is `en-US` only, so the test composes a provider over a Dutch
// slice, as a host wiring the generated tier would.
const dutchCatalog = {
	tools: {
		annotationToolbar: {
			selectionAvailableA11y:
				"Werkbalk voor aantekeningen beschikbaar voor “{text}”. Druk op Shift+F10 voor de aantekeninghulpmiddelen.",
		},
	},
};
const dutchProvider = () =>
	createPieI18n({
		availableLocales: ["en-US", "nl-NL"],
		loadCatalog: async (locale) =>
			locale === "nl-NL" ? (dutchCatalog as never) : loadBundledCatalog(locale),
	});

test("a selection is announced in the interface locale", async () => {
	const i18n = dutchProvider();
	await i18n.setLocale("nl-NL");
	const { toolbar, paragraph } = mount(i18n);
	await settle();

	const range = document.createRange();
	range.selectNodeContents(paragraph);
	window.getSelection()?.addRange(range);
	document.dispatchEvent(new Event("selectionchange"));
	await settle();

	expect(status(toolbar)).toBe(
		"Werkbalk voor aantekeningen beschikbaar voor “Photosynthesis”. Druk op Shift+F10 voor de aantekeninghulpmiddelen.",
	);
});
