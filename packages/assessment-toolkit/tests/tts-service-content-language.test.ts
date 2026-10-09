import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";
import { TTSService } from "../src/services/TTSService";
import { contentWith } from "./fixtures/read-aloud-content";

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
 * A read's content language is the nearest `lang` between the content and its
 * shell, else the language the speak names, else a pinned `lang_id`. It reaches
 * the provider as `contentLanguage`; a read naming none restores the host's
 * locales, and text processing reads the host's locale, else en-US.
 */

const startService = async (providerOptions?: Record<string, unknown>) => {
	const settings: Array<Record<string, unknown>> = [];
	const impl: ITTSProviderImplementation & {
		updateSettings: (next: Partial<TTSConfig>) => void;
	} = {
		async speak() {},
		pause() {},
		resume() {},
		stop() {},
		isPlaying: () => false,
		isPaused: () => false,
		updateSettings(next) {
			settings.push({ ...(next.providerOptions as Record<string, unknown>) });
		},
	};
	const provider: ITTSProvider = {
		providerId: "mock",
		providerName: "Mock Provider",
		version: "1.0.0",
		initialize: async () => impl,
		getCapabilities: () =>
			({
				supportsPause: true,
				supportsResume: true,
				supportsWordBoundary: false,
				supportsVoiceSelection: false,
				supportsRateControl: false,
				supportsPitchControl: false,
			}) as TTSProviderCapabilities,
		destroy() {},
	};
	const service = new TTSService();
	await service.initialize(provider, { providerOptions });
	// The locale each read hands math speech and text processing.
	const locales: string[] = [];
	const generated = (service as any).resolveGeneratedSpeechContent.bind(service);
	(service as any).resolveGeneratedSpeechContent = (
		element: Element,
		text: string,
		locale: string,
		range?: Range,
	) => {
		locales.push(locale);
		return generated(element, text, locale, range);
	};
	return { service, settings, locales };
};

const shellWith = (html: string): HTMLElement => {
	const shell = document.createElement("pie-item-scope");
	shell.setAttribute("data-pie-shell-root", "");
	shell.innerHTML = html;
	document.body.append(shell);
	return shell;
};

const rangeOver = (element: Element): Range => {
	const range = document.createRange();
	range.selectNodeContents(element);
	return range;
};

describe("TTSService content language", () => {
	test("a named language reaches the provider as its content language", async () => {
		const { service, settings, locales } = await startService();

		await service.speak(contentWith("hola"), { language: "es-MX" });

		expect(settings.at(-1)).toMatchObject({
			contentLanguage: "es-MX",
			locale: "es-MX",
		});
		expect(locales).toEqual(["es-MX"]);
	});

	test("a read naming no language after a named one restores the host's locales", async () => {
		const { service, settings, locales } = await startService({
			locale: "en-GB",
			textNormalization: { locale: "en-GB" },
		});

		await service.speak(contentWith("hola"), { language: "es-MX" });
		await service.speak(contentWith("hello"));

		const last = settings.at(-1);
		expect("contentLanguage" in (last ?? {})).toBe(true);
		expect(last?.contentLanguage).toBeUndefined();
		expect(last).toMatchObject({
			locale: "en-GB",
			textNormalization: { locale: "en-GB" },
		});
		expect((last?.segmenter as { locale?: string } | undefined)?.locale).toBeUndefined();
		expect(locales).toEqual(["es-MX", "en-GB"]);
	});

	test("a read naming no language leaves the provider alone and reads en-US", async () => {
		const { service, settings, locales } = await startService();

		await service.speak(contentWith("hello"));

		expect(settings).toEqual([]);
		expect(locales).toEqual(["en-US"]);
	});

	test("a pinned lang_id is the content language when nothing else names one", async () => {
		const { service, settings, locales } = await startService({
			lang_id: "es-MX",
		});

		await service.speak(contentWith("hola"));
		expect(settings.at(-1)).toMatchObject({
			contentLanguage: "es-MX",
			locale: "es-MX",
		});

		const shell = shellWith("<p lang='fr-FR'>bonjour</p>");
		await service.speak(shell.querySelector("p") as Element, {
			language: "de-DE",
		});
		await service.speak(contentWith("hallo"), { language: "de-DE" });

		expect(locales).toEqual(["es-MX", "fr-FR", "de-DE"]);
	});

	test("an element read and a selection read of the same content read in the same language", async () => {
		for (const named of [undefined, "es-MX"]) {
			const { service, settings, locales } = await startService({
				locale: "en-GB",
			});
			const shell = shellWith("<p>same words</p>");
			const paragraph = shell.querySelector("p") as Element;

			await service.speak(paragraph, { language: named });
			const elementRead = { ...settings.at(-1) };
			await service.speak(rangeOver(paragraph), { language: named });

			expect(locales[0]).toBe(named ?? "en-GB");
			expect(locales[1]).toBe(locales[0]);
			expect({ ...settings.at(-1) }).toEqual(elementRead);
			shell.remove();
		}
	});
});
