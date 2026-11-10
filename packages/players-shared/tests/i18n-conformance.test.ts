/**
 * Conformance of the players-shared i18n engine to the cross-repository spec.
 *
 * `i18n-conformance-fixtures.json` is the semantics the two PIE engines share:
 * this one and pie-elements-ng's `@pie-element/shared-i18n`, which ports it and
 * shares no code. Each repository runs the same file against its own engine, so
 * a case one engine passes and the other fails is drift made visible. The copies
 * are kept byte-identical; the fixture file's `$comment` names both paths.
 */

import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { languageTagLookupSequence } from "../src/i18n/language-tags.js";
import { dynamicMessageKey, localeDirection, SimpleI18n } from "../src/i18n/provider.js";
import type { MessageCatalog } from "../src/i18n/types.js";

interface Fixtures {
	lookupSequence: { tag: string; expected: string[] }[];
	catalogMatch: { locale: string; available: string[]; expected: string }[];
	direction: { tag: string; expected: "ltr" | "rtl" }[];
	plural: {
		catalogs: Record<string, MessageCatalog>;
		cases: { locale: string; count: number; expected: string }[];
	};
	interpolation: {
		locale: string;
		template: string;
		values: Record<string, unknown>;
		expected: string;
	}[];
	fallbackChain: {
		locale: string;
		source: MessageCatalog;
		shipped: MessageCatalog;
		hostMessages: MessageCatalog;
		expected: Record<string, string>;
	};
	scenarios: {
		name: string;
		locale: string;
		source: MessageCatalog;
		shipped: Record<string, MessageCatalog>;
		hostMessages: Record<string, MessageCatalog>;
		expected: {
			locale: string;
			direction: "ltr" | "rtl";
			t: Record<string, string>;
			plural: { key: string; count: number; expected: string }[];
		};
	}[];
}

const fixtures: Fixtures = JSON.parse(
	readFileSync(new URL("./i18n-conformance-fixtures.json", import.meta.url), "utf8"),
);

/**
 * A provider serving the fixture catalogs. `shipped` enters through the loader,
 * which declares its tags, as a shipped catalog would; `hostMessages` through
 * `customMessages`, which a catalog match never considers. The
 * fixture's `en-US` text always enters as host messages: this engine's shipped
 * `en-US` is the real players catalog and is resident from the start, so
 * `setLocale("en-US")` never calls the loader, and the conformance chain only
 * needs an English rung above the key.
 */
async function providerFor(
	locale: string,
	shipped: Record<string, MessageCatalog>,
	hostMessages: Record<string, MessageCatalog> = {},
): Promise<SimpleI18n> {
	const i18n = new SimpleI18n({
		availableLocales: [...new Set([...Object.keys(shipped), "en-US"])],
		loadCatalog: async (tag) => shipped[tag] ?? {},
		customMessages: hostMessages,
	});
	await i18n.setLocale(locale);
	return i18n;
}

describe("i18n conformance", () => {
	test("lookup sequence", () => {
		for (const { tag, expected } of fixtures.lookupSequence) {
			expect(languageTagLookupSequence(tag), tag).toEqual(expected);
		}
	});

	test("catalog match: script-aware lookup, then widening within the script", async () => {
		// Loaded, because `getLocale` names a catalog only once it is resident.
		for (const { locale, available, expected } of fixtures.catalogMatch) {
			const i18n = new SimpleI18n({
				availableLocales: available,
				loadCatalog: async () => ({}),
			});
			await i18n.setLocale(locale);
			expect(i18n.getLocale(), `${locale} in ${available.join(", ")}`).toBe(
				expected,
			);
		}
	});

	test("direction", () => {
		for (const { tag, expected } of fixtures.direction) {
			expect(localeDirection(tag), tag).toBe(expected);
		}
	});

	test("plural category routing and locale numerals", async () => {
		for (const { locale, count, expected } of fixtures.plural.cases) {
			const i18n = await providerFor(locale, {}, fixtures.plural.catalogs);
			expect(
				i18n.plural(dynamicMessageKey("items"), { count }),
				`${locale} ${count}`,
			).toBe(expected);
		}
	});

	test("interpolation", async () => {
		for (const { locale, template, values, expected } of fixtures.interpolation) {
			const i18n = await providerFor(locale, {}, { [locale]: { tpl: template } });
			expect(
				i18n.t(dynamicMessageKey("tpl"), values as Record<string, string | number>),
				template,
			).toBe(expected);
		}
	});

	test("fallback chain: host locale, shipped locale, English, then the key", async () => {
		const { locale, source, shipped, hostMessages, expected } =
			fixtures.fallbackChain;
		const i18n = await providerFor(
			locale,
			{ [locale]: shipped, "en-US": {} },
			{ "en-US": source, [locale]: hostMessages },
		);
		for (const [key, value] of Object.entries(expected)) {
			expect(i18n.t(dynamicMessageKey(key)), key).toBe(value);
		}
	});

	for (const { name, locale, source, shipped, hostMessages, expected } of fixtures.scenarios) {
		test(`scenario: ${name}`, async () => {
			// `source` is the fixture's `en-US`, registered first so a scenario's own
			// `en-US` host messages layer over it; every other host-message tag is
			// registered as the fixture writes it.
			const i18n = await providerFor(locale, shipped, { "en-US": source });
			for (const [tag, messages] of Object.entries(hostMessages)) {
				i18n.addCustomMessages(tag, messages);
			}
			expect(i18n.getLocale(), "locale").toBe(expected.locale);
			expect(i18n.getDirection(), "direction").toBe(expected.direction);
			for (const [key, value] of Object.entries(expected.t)) {
				expect(i18n.t(dynamicMessageKey(key)), key).toBe(value);
			}
			for (const { key, count, expected: text } of expected.plural) {
				expect(
					i18n.plural(dynamicMessageKey(key), { count }),
					`${key} ${count}`,
				).toBe(text);
			}
		});
	}
});
