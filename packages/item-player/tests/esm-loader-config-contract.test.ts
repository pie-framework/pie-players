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

	test("maps ESM author mode to expected config tags before registration verification", () => {
		const source = readFileSync(
			join(import.meta.dir, "../src/PieItemPlayer.svelte"),
			"utf8",
		);
		const resolveEffectiveEsmView = source.slice(
			source.indexOf("function resolveEffectiveEsmView"),
			source.indexOf("function tagsForConfig"),
		);
		const esmLoadBranch = source.slice(
			source.indexOf('stage = "esm-load"'),
			source.indexOf('stage = "set-item-config"'),
		);

		expect(resolveEffectiveEsmView).toContain('resolvedMode === "author"');
		expect(resolveEffectiveEsmView).toContain('"author"');
		expect(resolveEffectiveEsmView).toContain('"delivery"');
		expect(esmLoadBranch).toContain("mapEsmViewElements");
		expect(esmLoadBranch).toContain("resolveEffectiveEsmView()");
		expect(esmLoadBranch).toContain("await ensureRegistered(expectedElements");
	});
});
