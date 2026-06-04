import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

describe("item-player ESM loader config contract", () => {
	test("passes instrumentation options through to the ESM backend", () => {
		const source = readFileSync(
			join(import.meta.dir, "../src/PieItemPlayer.svelte"),
			"utf8",
		);
		const buildEsmBackendConfig = source.slice(
			source.indexOf("function buildEsmBackendConfig"),
			source.indexOf("function tagsForConfig"),
		);

		expect(buildEsmBackendConfig).toContain(
			"trackPageActions: loaderConfig?.trackPageActions",
		);
		expect(buildEsmBackendConfig).toContain(
			"instrumentationProvider: resolvedInstrumentationProvider",
		);
		expect(buildEsmBackendConfig).toContain(
			"cdnProvider: loaderOptions?.esmCdnProvider",
		);
	});
});
