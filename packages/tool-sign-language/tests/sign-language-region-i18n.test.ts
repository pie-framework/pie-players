import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect, test } from "bun:test";
import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

await import("../src/SignLanguageMediaRegion.svelte");

const RUNTIME = Symbol.for("pie.assessmentToolkit.runtimeContext");

const settle = async (rounds = 4) => {
	for (let i = 0; i < rounds; i++) {
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
};

/** A provider that tags every message, so a rendered string shows its source. */
const taggedI18n = (tag: string): I18nProvider => ({
	getLocale: () => tag,
	setLocale: async () => {},
	t: (key, values) =>
		values?.language ? `${tag}:${key}(${values.language})` : `${tag}:${key}`,
});

const MEDIA = {
	catalogId: "sign-1",
	signLang: "ase",
	sources: [{ src: "https://example.test/asl.mp4", type: "video/mp4" }],
};

type Region = HTMLElement & { media?: typeof MEDIA | null };

/** Mount a region under an element that answers the runtime-context request. */
function mount(i18n: I18nProvider | null) {
	const scope = document.createElement("section");
	let publish: ((value: unknown) => void) | null = null;
	if (i18n) {
		scope.addEventListener("context-request", (event: Event) => {
			const request = event as Event & {
				context: unknown;
				callback: (value: unknown) => void;
			};
			if (request.context !== RUNTIME) return;
			event.stopPropagation();
			publish = request.callback;
			request.callback({ i18n });
		});
	}
	const region = document.createElement("pie-tool-sign-language") as Region;
	region.media = MEDIA;
	scope.append(region);
	document.body.append(scope);
	const read = () => ({
		label: region.shadowRoot?.querySelector("video")?.getAttribute("aria-label"),
		caption: region.shadowRoot?.querySelector("figcaption")?.textContent,
	});
	return { read, republish: (value: unknown) => publish?.(value) };
}

afterEach(() => {
	document.body.innerHTML = "";
});

test("labels come from the runtime context's provider", async () => {
	const { read } = mount(taggedI18n("nl"));
	await settle();

	expect(read()).toEqual({
		label: "nl:tools.signLanguage.regionA11y(nl:tools.signLanguage.ase)",
		caption: "nl:tools.signLanguage.ase",
	});
});

test("labels follow a republished provider", async () => {
	const { read, republish } = mount(taggedI18n("nl"));
	await settle();
	republish({ i18n: taggedI18n("fr") });
	await settle();

	expect(read().caption).toBe("fr:tools.signLanguage.ase");
});

test("outside a toolkit the English default names the language", async () => {
	const { read } = mount(null);
	await settle();

	expect(read().caption).toBe("American Sign Language");
});
