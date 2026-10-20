import { describe, expect, test } from "bun:test";
import { loadBundledCatalog } from "../src/i18n/catalogs.js";
import enUS from "../src/i18n/messages/en-US.js";
import { localeDirection, SimpleI18n } from "../src/i18n/provider.js";
import {
	PSEUDO_LOCALE_EXPANDED,
	PSEUDO_LOCALE_RTL,
	pseudoLocalize,
} from "../src/i18n/pseudo.js";
import type { MessageCatalog, MessageNode } from "../src/i18n/types.js";

const PLACEHOLDER = /\{\w+\}/g;

function flatten(
	node: MessageNode,
	prefix = "",
	out = new Map<string, string>(),
): Map<string, string> {
	if (typeof node === "object") {
		for (const [key, child] of Object.entries(node)) {
			flatten(child, prefix ? `${prefix}.${key}` : key, out);
		}
		return out;
	}
	out.set(prefix, node);
	return out;
}

describe("pseudoLocalize", () => {
	test("every key of the shipped English catalog survives with its placeholder set", () => {
		const pseudo = flatten(pseudoLocalize(enUS));
		const english = flatten(enUS);
		expect([...pseudo.keys()].sort()).toEqual([...english.keys()].sort());
		for (const [key, source] of english) {
			const value = pseudo.get(key) ?? "";
			expect([...value.matchAll(PLACEHOLDER)].map((match) => match[0])).toEqual(
				[...source.matchAll(PLACEHOLDER)].map((match) => match[0]),
			);
		}
	});

	test("strings grow, carry accents and sit inside the brackets", () => {
		const pseudo = flatten(pseudoLocalize(enUS));
		for (const [key, source] of flatten(enUS)) {
			const value = pseudo.get(key) ?? "";
			expect(value.startsWith("["), key).toBe(true);
			expect(value.endsWith("]"), key).toBe(true);
			expect(value.length, key).toBeGreaterThan(source.length);
		}
	});

	test("plural categories are preserved verbatim", () => {
		const pseudo = pseudoLocalize({
			triesLeft: { one: "1 try left.", other: "{count} tries left." },
		});
		const group = pseudo.triesLeft as Record<string, string>;
		expect(Object.keys(group).sort()).toEqual(["one", "other"]);
		expect(group.other).toBe("[{count} ŧŕíéš ĺéƒŧ. ~~~~~]");
	});

	test("options turn the accents, the padding and the brackets off", () => {
		const pseudo = pseudoLocalize(
			{ close: "Close" },
			{ accents: false, brackets: false, expansion: 0 },
		);
		expect(pseudo.close).toBe("Close");
	});

	test("the pseudo tags resolve direction without a catalog", () => {
		expect(localeDirection(PSEUDO_LOCALE_EXPANDED)).toBe("ltr");
		expect(localeDirection(PSEUDO_LOCALE_RTL)).toBe("rtl");
	});

	test("serves through the provider as a customMessages-only locale", async () => {
		const i18n = new SimpleI18n({
			customMessages: { [PSEUDO_LOCALE_EXPANDED]: pseudoLocalize(enUS) },
		});
		await i18n.setLocale(PSEUDO_LOCALE_EXPANDED);
		expect(i18n.getLocale()).toBe(PSEUDO_LOCALE_EXPANDED);
		const rendered = i18n.t("common.close");
		expect(rendered.startsWith("[")).toBe(true);
		expect(rendered.endsWith("]")).toBe(true);
		// Placeholders the string carries still interpolate.
		const tries = i18n.plural("player.formative.triesLeft", { count: 3 });
		expect(tries).toContain("3");
		expect(tries.startsWith("[")).toBe(true);
	});

	test("the bundled loader serves the statically resident English catalog", async () => {
		// The pseudo-localized provider asks the loader for `en-US` by name like
		// any other locale; the one catalog that never had a chunk must not
		// throw for it.
		await expect(loadBundledCatalog("en-US")).resolves.toBe(enUS);
		await expect(loadBundledCatalog("zz")).rejects.toThrow(
			"No bundled i18n catalog for locale: zz",
		);
	});
});
