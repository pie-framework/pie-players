import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	HOST_SHARED_PACKAGE_DIRS,
	hostSharedExternals,
	publishedSpecifiers,
} from "../host-shared-externals.js";
import { PLAYERS_SHARED_SVELTE_SOURCE_RELATIVE } from "../svelte-source-aliases.js";

const PACKAGES_DIR = join(import.meta.dirname, "../..");
const isExternal = hostSharedExternals(PACKAGES_DIR);

describe("hostSharedExternals", () => {
	test("is external for the bare name and every published subpath of each package", () => {
		for (const specifier of [
			"@pie-players/pie-assessment-toolkit",
			"@pie-players/pie-assessment-toolkit/runtime/engine",
			"@pie-players/pie-assessment-toolkit/tools/registration",
			"@pie-players/pie-context",
			"@pie-players/pie-players-shared",
			"@pie-players/pie-players-shared/i18n/provider",
			"@pie-players/pie-players-shared/ui/attribute-coercion",
		]) {
			expect(isExternal(specifier)).toBe(true);
		}
	});

	test("bundles every players-shared subpath that resolves from source", () => {
		const sourceOnly = Object.keys(PLAYERS_SHARED_SVELTE_SOURCE_RELATIVE);
		expect(sourceOnly.length).toBeGreaterThan(0);
		for (const specifier of sourceOnly) {
			expect(isExternal(specifier)).toBe(false);
		}
	});

	test("bundles anything the package does not publish, including a deeper path of one it does", () => {
		for (const specifier of [
			"@pie-players/pie-players-shared/src/pie/logger",
			"@pie-players/pie-players-shared/i18n/provider/extra",
			"@pie-players/pie-context/dist/index.js",
			"@pie-players/pie-players-shared-extra",
		]) {
			expect(isExternal(specifier)).toBe(false);
		}
	});

	test("leaves other packages to the build's own externals", () => {
		for (const specifier of [
			"@pie-players/pie-item-player",
			"@pie-players/pie-default-tool-loaders",
			"@pie-players/pie-theme/components.css",
			"svelte",
		]) {
			expect(isExternal(specifier)).toBe(false);
		}
	});

	test("names a package directory that exists for every host-shared package", () => {
		expect(Object.keys(HOST_SHARED_PACKAGE_DIRS).sort()).toEqual([
			"@pie-players/pie-assessment-toolkit",
			"@pie-players/pie-context",
			"@pie-players/pie-players-shared",
		]);
	});
});

describe("publishedSpecifiers", () => {
	test("maps '.' to the bare name and skips ./package.json", () => {
		expect(
			publishedSpecifiers("@scope/pkg", {
				".": {},
				"./a/b": {},
				"./package.json": "./package.json",
			}),
		).toEqual(["@scope/pkg", "@scope/pkg/a/b"]);
	});

	test("refuses a pattern export, which an exact set cannot represent", () => {
		expect(() => publishedSpecifiers("@scope/pkg", { "./*": {} })).toThrow(
			/pattern/,
		);
	});
});
