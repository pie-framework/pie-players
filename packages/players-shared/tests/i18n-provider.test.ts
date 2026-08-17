/**
 * Provider behaviour that adoption depends on, and that a refactor would break
 * silently: locale resolution across tag syntaxes, the fallback chain, plural
 * categories beyond one/other, direction, and per-locale views sharing catalogs.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BUNDLED_LOCALES, loadBundledCatalog } from "../src/i18n/catalogs.js";
import {
	DEFAULT_LOCALE,
	getDefaultI18n,
	localeDirection,
	SimpleI18n,
} from "../src/i18n/provider.js";
import type { MessageCatalog } from "../src/i18n/types.js";

// A DOM only so the "does not touch documentElement" assertion can be real.
beforeAll(() => {
	if (typeof globalThis.document === "undefined") GlobalRegistrator.register();
});
afterAll(async () => {
	if (GlobalRegistrator.isRegistered) await GlobalRegistrator.unregister();
});

function createProvider(locale?: string) {
	return new SimpleI18n({
		locale,
		loadCatalog: loadBundledCatalog,
		availableLocales: ["en-US", "nl-NL"],
	});
}

/**
 * A provider over a deliberately incomplete catalog.
 *
 * Partial coverage is a supported state — a host may supply its own messages for
 * a locale we ship nothing for, and a locale mid-translation has gaps — so the
 * fallback chain has to be tested against one. Synthesised rather than taken from
 * a shipped catalog: a test that depends on `es-ES` lacking a key breaks the day
 * someone finishes translating it.
 */
function createPartialProvider(locale: string, catalog: MessageCatalog) {
	return new SimpleI18n({
		availableLocales: ["en-US", locale],
		loadCatalog: (requested) =>
			requested === locale
				? Promise.resolve(catalog)
				: Promise.reject(new Error(`no catalog: ${requested}`)),
	});
}

describe("locale resolution", () => {
	test("defaults to en-US and never detects the browser locale", () => {
		// Behaviour-preservation under lockstep patch-only releases: a host that
		// supplies nothing must render exactly what it rendered before.
		expect(createProvider().getLocale()).toBe(DEFAULT_LOCALE);
		expect(new SimpleI18n().getLocale()).toBe(DEFAULT_LOCALE);
	});

	test.each([
		["nl-NL", "nl-NL"],
		["nl_NL", "nl-NL"],
		["nl", "nl-NL"],
		["NL-nl", "nl-NL"],
		["nl-BE", "nl-NL"],
		["nl_NL.UTF-8", "nl-NL"],
	])("%s resolves to %s", async (requested, expected) => {
		const i18n = createProvider();
		await i18n.setLocale(requested);
		expect(i18n.getLocale()).toBe(expected);
	});

	test("a locale with no shipped catalog is honoured, not rejected", async () => {
		// A host may supply its own messages for a locale we do not ship. Refusing
		// the tag would make that impossible.
		const i18n = createProvider();
		await i18n.setLocale("cy-GB");
		expect(i18n.getLocale()).toBe("cy-GB");
		// Every key still resolves, through English.
		expect(i18n.t("common.close")).toBe("Close");
	});
});

describe("fallback chain", () => {
	test("a key the locale lacks falls back to English", async () => {
		const i18n = createPartialProvider("es-ES", {
			common: { close: "Cerrar" },
		});
		await i18n.setLocale("es-ES");
		expect(i18n.t("common.close")).toBe("Cerrar");
		expect(i18n.t("debug.pnp.title")).toBe("PNP Profile");
	});

	test("an unknown key returns the key and reports once", async () => {
		const missing: string[] = [];
		const i18n = new SimpleI18n({ onMissingKey: (key) => missing.push(key) });
		expect(i18n.t("nope.not.here")).toBe("nope.not.here");
		expect(missing).toEqual(["nope.not.here"]);
	});

	test("a key landing on a namespace is a miss, not an object", () => {
		const i18n = new SimpleI18n();
		// Returning the branch would put an object where a string is expected, and
		// interpolating one throws.
		expect(i18n.t("common")).toBe("common");
	});

	test("host messages override the shipped catalog for the same locale", async () => {
		const i18n = createProvider();
		await i18n.setLocale("nl-NL");
		i18n.addCustomMessages("nl-NL", { common: { close: "Dicht" } });
		expect(i18n.t("common.close")).toBe("Dicht");
		// A sibling key the override does not mention is untouched.
		expect(i18n.t("common.cancel")).toBe("Annuleren");
	});
});

describe("interpolation and plurals", () => {
	test("placeholders substitute, and an unsupplied one is left visible", () => {
		const i18n = new SimpleI18n();
		expect(i18n.t("tools.ruler.switchedTo", { unit: "Inches" })).toBe(
			"Switched to Inches",
		);
		expect(i18n.t("tools.ruler.switchedTo")).toBe("Switched to {unit}");
	});

	test("English selects one/other", () => {
		const i18n = new SimpleI18n();
		expect(i18n.plural("player.formative.triesLeft", { count: 1 })).toBe(
			"1 try left.",
		);
		expect(i18n.plural("player.formative.triesLeft", { count: 3 })).toBe(
			"3 tries left.",
		);
	});

	test("a locale needing a category the catalog lacks falls back to other", async () => {
		// Arabic selects `two` at count 2. A catalog carrying only one/other — what
		// a translator hands back when they work from the English forms — must still
		// render, not resolve to nothing.
		const i18n = createPartialProvider("ar-SA", {
			tools: {
				textToSpeech: {
					charactersSelected: { one: "حرف واحد", other: "{count} حرف" },
				},
			},
		});
		await i18n.setLocale("ar-SA");
		expect(
			i18n.plural("tools.textToSpeech.charactersSelected", { count: 2 }),
		).toBe("2 حرف");
	});

	test("plural falls back to t() for a key that is not a plural group", () => {
		const i18n = new SimpleI18n();
		expect(i18n.plural("common.close", { count: 2 })).toBe("Close");
	});
});

describe("direction", () => {
	test.each([
		["en-US", "ltr"],
		["nl-NL", "ltr"],
		["ar-SA", "rtl"],
		["he-IL", "rtl"],
		["ckb", "rtl"],
		["not-a-tag-at-all", "ltr"],
	])("%s is %s", (locale, expected) => {
		expect(localeDirection(locale)).toBe(expected);
	});

	test("the provider reports its active locale's direction", async () => {
		const i18n = createProvider();
		expect(i18n.getDirection()).toBe("ltr");
		await i18n.setLocale("ar-SA");
		expect(i18n.getDirection()).toBe("rtl");
	});

	test("no locale change writes to the document root", async () => {
		// An embedded player has no business setting the host page's `lang`/`dir`;
		// components stamp their own subtree instead.
		const root = document.documentElement;
		const before = {
			lang: root.getAttribute("lang"),
			dir: root.getAttribute("dir"),
		};
		const i18n = createProvider();
		await i18n.setLocale("ar-SA");
		expect(root.getAttribute("lang")).toBe(before.lang);
		expect(root.getAttribute("dir")).toBe(before.dir);
	});
});

describe("change signal", () => {
	test("subscribers fire after the catalog is resident, not before", async () => {
		const i18n = createProvider();
		const seen: string[] = [];
		i18n.subscribe(() => {
			// Reading inside the listener is the whole point: a subscriber that fires
			// before the catalog lands would re-render the previous locale.
			seen.push(i18n.t("common.close"));
		});
		await i18n.setLocale("nl-NL");
		expect(seen).toEqual(["Sluiten"]);
	});

	test("unsubscribing stops notifications", async () => {
		const i18n = createProvider();
		let calls = 0;
		const off = i18n.subscribe(() => {
			calls += 1;
		});
		await i18n.setLocale("nl-NL");
		off();
		await i18n.setLocale("en-US");
		expect(calls).toBe(1);
	});

	test("concurrent setLocale calls for one locale share a single load", async () => {
		const i18n = createProvider();
		await Promise.all([
			i18n.setLocale("nl-NL"),
			i18n.setLocale("nl-NL"),
			i18n.setLocale("nl-NL"),
		]);
		expect(i18n.getLocale()).toBe("nl-NL");
		expect(i18n.isLocaleLoaded("nl-NL")).toBe(true);
	});
});

describe("withLocale", () => {
	test("a view renders another locale without moving the provider's", async () => {
		// Two players on one page: the locale is per-view, the catalogs per-provider.
		const i18n = createProvider();
		await i18n.setLocale("nl-NL");
		const view = i18n.withLocale("en-US");
		expect(i18n.getLocale()).toBe("nl-NL");
		expect(view.getLocale()).toBe("en-US");
		expect(i18n.t("common.close")).toBe("Sluiten");
	});

	test("a view shares catalogs by reference, so one load serves both", async () => {
		const i18n = createProvider();
		const view = i18n.withLocale("nl-NL") as SimpleI18n;
		await view.setLocale("nl-NL");
		// Loaded through the view; visible to the parent without a second fetch.
		expect(i18n.isLocaleLoaded("nl-NL")).toBe(true);
	});

	test("a view of the active locale is the provider itself", () => {
		const i18n = createProvider();
		expect(i18n.withLocale(DEFAULT_LOCALE)).toBe(i18n);
	});
});

describe("packaging", () => {
	test("the default provider needs no publisher and never leaks keys", () => {
		// The graceful default `composition-context.md` requires.
		const i18n = getDefaultI18n();
		expect(i18n.getLocale()).toBe(DEFAULT_LOCALE);
		expect(i18n.t("common.close")).toBe("Close");
		expect(i18n.getAvailableLocales()).toEqual([DEFAULT_LOCALE]);
	});

	test("the default provider is shared, so tools do not each parse a catalog", () => {
		expect(getDefaultI18n()).toBe(getDefaultI18n());
	});

	test("every shipped catalog loads under plain Node ESM", async () => {
		// A `with { type: "json" }` omission once made English work and every other
		// locale throw. TS catalogs remove the class of failure; this pins it.
		for (const locale of BUNDLED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
			const catalog: MessageCatalog = await loadBundledCatalog(locale);
			expect(Object.keys(catalog).length).toBeGreaterThan(0);
		}
	});

	test("a catalog load failure is reported, not swallowed", async () => {
		const i18n = new SimpleI18n({
			availableLocales: ["en-US", "nl-NL"],
			loadCatalog: () => Promise.reject(new Error("chunk 404")),
		});
		await expect(i18n.setLocale("nl-NL")).rejects.toThrow(
			"Failed to load i18n catalog for locale: nl-NL",
		);
		// And the provider still renders: the previous locale stands.
		expect(i18n.t("common.close")).toBe("Close");
	});
});
