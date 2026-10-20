import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { BundleType } from "@pie-players/pie-players-shared";
import {
	itemPlayerBackend,
	itemPlayerElementTags,
	itemPlayerEsmBackend,
	itemPlayerEsmView,
	itemPlayerIifeBackend,
	itemPlayerIifeElements,
} from "../src/element-preload.js";

describe("item-player loader backends", () => {
	test("passes instrumentation options through to the ESM backend", () => {
		const provider = { name: "custom" } as never;
		const instrumentationProvider = {} as never;
		const backend = itemPlayerEsmBackend(
			{
				loaderOptions: { esmCdnUrl: "https://cdn.test/npm", esmCdnProvider: provider },
				loaderConfig: { trackPageActions: true },
			},
			{ instrumentationProvider },
		);
		expect(backend).toMatchObject({
			kind: "esm",
			cdnBaseUrl: "https://cdn.test/npm",
			cdnProvider: provider,
			trackPageActions: true,
			instrumentationProvider,
			view: "delivery",
		});
	});

	test("maps author mode to the author view unless loaderOptions names one", () => {
		expect(itemPlayerEsmView({ mode: "author" })).toBe("author");
		expect(itemPlayerEsmView({})).toBe("delivery");
		expect(itemPlayerEsmView({ mode: "author", loaderOptions: { view: "print" } })).toBe("print");
	});

	test("loads controllers unless a hosted player's server runs them", () => {
		expect(itemPlayerIifeBackend({}).needsControllers).toBe(true);
		expect(itemPlayerIifeBackend({ hosted: true })).toMatchObject({
			bundleType: BundleType.player,
			needsControllers: false,
		});
		expect(itemPlayerIifeBackend({ mode: "author", hosted: true })).toMatchObject({
			bundleType: BundleType.editor,
			needsControllers: true,
		});
	});

	test("expects each element's editor under `<tag>-config` from an editor bundle", () => {
		const elements = { "mc--version-1-0-0": "@pie-element/mc@1.0.0" };
		expect(itemPlayerIifeElements(elements, BundleType.editor)).toEqual({
			"mc--version-1-0-0-config": "@pie-element/mc@1.0.0",
		});
		expect(itemPlayerIifeElements(elements, BundleType.clientPlayer)).toBe(elements);
	});

	test("picks the strategy's backend, with a host's instrumentation and retry hook", () => {
		const instrumentationProvider = {} as never;
		const onBundleRetryStatus = () => {};
		expect(itemPlayerBackend({}, { instrumentationProvider, onBundleRetryStatus })).toMatchObject({
			kind: "iife",
			instrumentationProvider,
			onBundleRetryStatus,
		});
		expect(itemPlayerBackend({ strategy: "esm" }, { instrumentationProvider })).toMatchObject({
			kind: "esm",
			instrumentationProvider,
		});
		expect(itemPlayerBackend({ strategy: "preloaded" })).toBeNull();
	});

	test("names the tags each strategy registers or asserts", () => {
		const elements = { "mc--version-1-0-0": "@pie-element/mc@1.0.0" };
		const tags = (inputs: Parameters<typeof itemPlayerElementTags>[1]) =>
			Object.keys(itemPlayerElementTags(elements, inputs));
		expect(tags({})).toEqual(["mc--version-1-0-0"]);
		expect(tags({ mode: "author" })).toEqual(["mc--version-1-0-0-config"]);
		expect(tags({ strategy: "esm", mode: "author" })).toEqual(["mc--version-1-0-0-config"]);
		expect(tags({ strategy: "esm", loaderOptions: { view: "print" } })).toEqual(["mc--version-1-0-0-print"]);
		expect(tags({ strategy: "preloaded", mode: "author" })).toEqual(["mc--version-1-0-0-config"]);
		expect(tags({ strategy: "preloaded" })).toEqual(["mc--version-1-0-0"]);
	});

	test("the player's ESM load registers the view's tags through the shared builders", () => {
		const source = readFileSync(join(import.meta.dir, "../src/PieItemPlayer.svelte"), "utf8");
		const esmLoadBranch = source.slice(
			source.indexOf('stage = "esm-load"'),
			source.indexOf('stage = "set-item-config"'),
		);
		expect(esmLoadBranch).toContain("mapEsmViewElements");
		expect(esmLoadBranch).toContain("resolveEffectiveEsmView()");
		expect(esmLoadBranch).toContain("await ensureRegistered(expectedElements");
		expect(source).toContain("return itemPlayerEsmBackend(loadInputs");
	});
});
