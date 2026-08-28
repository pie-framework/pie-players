/**
 * The token registry is published, not just used internally.
 *
 * A host rendering "what is this token for" needs the registry itself; deriving
 * the answer from token names, or copying the list, drifts the moment a token is
 * added here. So the JSON is a package export, and these tests hold the three
 * things that break that quietly: the export entry, the build step that puts the
 * file where the entry points, and the published types covering the data.
 */

import { describe, expect, test } from "bun:test";

import type {
	PieThemeSchemeParticipation,
	PieThemeTokenScope,
	PieThemeTokenStatus,
} from "../src/token-registry-types";

const REGISTRY_EXPORT = "./token-registry.json";

const manifest = (await Bun.file(
	new URL("../package.json", import.meta.url),
).json()) as {
	exports: Record<string, unknown>;
	scripts: Record<string, string>;
	files: string[];
};

const registry = (await Bun.file(
	new URL("../src/token-registry.json", import.meta.url),
).json()) as Array<{
	scope: string;
	status: string;
	category: string;
	schemeParticipation: string;
}>;

describe("the registry is reachable from outside the package", () => {
	test("the exports map names it", () => {
		expect(manifest.exports[REGISTRY_EXPORT]).toBe(
			"./dist/token-registry.json",
		);
	});

	test("the build copies it to where the export points", () => {
		// `tsc` emits only the TypeScript; a JSON file next to the sources is not
		// part of that output, so the copy is what makes the export resolve rather
		// than 404 for every consumer.
		expect(manifest.scripts.build).toContain(
			"cp src/token-registry.json dist/",
		);
	});

	test("dist is published", () => {
		expect(manifest.files).toContain("dist");
	});
});

describe("the published types describe the published data", () => {
	test("every scope in the registry is in the scope union", () => {
		const allowed = new Set<PieThemeTokenScope>([
			"canonical-semantic",
			"component-public",
			"package-private",
			"unsupported",
			"legacy",
		]);
		const unknown = [...new Set(registry.map((entry) => entry.scope))].filter(
			(scope) => !allowed.has(scope as PieThemeTokenScope),
		);
		expect(unknown).toEqual([]);
	});

	test("every status in the registry is in the status union", () => {
		const allowed = new Set<PieThemeTokenStatus>([
			"active",
			"deprecated",
			"intentional-gap",
			"planned",
		]);
		const unknown = [...new Set(registry.map((entry) => entry.status))].filter(
			(status) => !allowed.has(status as PieThemeTokenStatus),
		);
		expect(unknown).toEqual([]);
	});

	test("every scheme participation value is in the participation union", () => {
		const allowed = new Set<PieThemeSchemeParticipation>([
			"required",
			"optional",
			"excluded",
		]);
		const unknown = [
			...new Set(registry.map((entry) => entry.schemeParticipation)),
		].filter((value) => !allowed.has(value as PieThemeSchemeParticipation));

		expect(unknown).toEqual([]);
		expect(
			Object.fromEntries(
				[...allowed].map((value) => [
					value,
					registry.filter((entry) => entry.schemeParticipation === value)
						.length,
				]),
			),
		).toEqual({ required: 52, optional: 17, excluded: 27 });
	});

	test("category stays a plain string, and every entry has one", () => {
		// Not a union on purpose: a new component category arrives with the
		// component, and pinning the set would make adding one a change here.
		expect(registry.every((entry) => typeof entry.category === "string")).toBe(
			true,
		);
		expect(registry.every((entry) => entry.category.length > 0)).toBe(true);
	});
});
