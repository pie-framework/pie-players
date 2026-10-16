import { describe, expect, test } from "bun:test";

import { GENERATED_LOCALES, loadGeneratedCatalog } from "../src/index";

describe("generated catalog loaders", () => {
	test("every generated locale loads and carries the catalog namespaces", async () => {
		expect(GENERATED_LOCALES).toContain("th-TH");
		for (const locale of GENERATED_LOCALES) {
			const catalog = await loadGeneratedCatalog(locale);
			for (const namespace of ["common", "player", "toolkit", "tools", "debug"]) {
				expect(catalog[namespace]).toBeObject();
			}
		}
	});

	test("a generated catalog resolves keys and keeps plural groups", async () => {
		const catalog = await loadGeneratedCatalog("th-TH");
		expect((catalog.common as Record<string, string>).close).toBe("ปิด");
		const triesLeft = (
			(catalog.player as Record<string, unknown>).formative as Record<
				string,
				unknown
			>
		).triesLeft as Record<string, string>;
		expect(triesLeft.other).toContain("{count}");
	});

	test("a locale with no generated catalog throws for the fallback chain", async () => {
		await expect(loadGeneratedCatalog("fr-FR")).rejects.toThrow(/fr-FR/);
	});
});
