import { describe, expect, test } from "bun:test";

import { looksUnminified } from "../check-bundle-safety.mjs";
import {
	minifyChunk,
	minifyChunks,
} from "../../packages/players-shared/minify-chunks.mjs";

const source = `
/*! (c) Example Library, MIT */
/**
 * @license Apache-2.0
 * lit-html
 */
// a plain comment
export function add(first, second) {
	const total = first + second;
	return total;
}
export const label = /* @__PURE__ */ add(1, 2);
`;

const runHook = async (plugin, config) => {
	plugin.configResolved(config);
	return plugin;
};

describe("minifyChunk", () => {
	test("removes whitespace and ordinary comments", async () => {
		const out = await minifyChunk(source, "es2022");
		expect(out).not.toContain("a plain comment");
		expect(out).not.toContain("\t");
		expect(out.trim().split("\n").length).toBeLessThan(8);
	});

	test("keeps /*! and @license comments", async () => {
		const out = await minifyChunk(source, "es2022");
		expect(out).toContain("(c) Example Library, MIT");
		expect(out).toContain("@license Apache-2.0");
	});

	test("a large chunk passes the unminified check afterwards", async () => {
		const body = "var someReasonablyNamedIdentifier = 1;\n".repeat(1000);
		expect(looksUnminified(body)).toBe(true);
		expect(looksUnminified(await minifyChunk(body, "es2022"))).toBe(false);
	});

	test("lowers syntax the build target lacks and keeps the target's own", async () => {
		const code = "export class A { static #p = 1; static get() { return A.#p } }";
		expect(await minifyChunk(code, "es2020")).not.toMatch(/static\s*#/);
		expect(await minifyChunk(code, "es2022")).toMatch(/static\s*#/);
	});

	test("keeps dynamic import and import.meta, which a lib build relies on", async () => {
		const out = await minifyChunk(
			"export const load = () => import('./x.js'); export const here = import.meta.url;",
			"es2015",
		);
		expect(out).toContain("import(");
		expect(out).toContain("import.meta.url");
	});

	test("keeps source-map comment text escaped, which the minifier would print back", async () => {
		const code = "export const t = `//# sourceMappingURL\\x3dx` + '/*# sourceMappingURL' + '=y';";
		const out = await minifyChunk(code, "es2022");
		expect(out).not.toMatch(/sourceMappingURL\s*=/);
	});

	test("leaves non-ASCII text as written", async () => {
		const out = await minifyChunk('export const s = "caf\u00e9 \u2713";', "es2022");
		expect(out).toContain("caf\u00e9");
	});
});

describe("minifyChunks plugin", () => {
	test("runs only in a build, after the other plugins", () => {
		const plugin = minifyChunks();
		expect(plugin.enforce).toBe("post");
		expect(plugin.apply).toBe("build");
	});

	test("refuses a build that minifies on its own, so the work is not done twice", async () => {
		const plugin = minifyChunks();
		expect(() =>
			plugin.configResolved({ build: { minify: "esbuild", sourcemap: false } }),
		).toThrow(/build\.minify to false/);
	});

	test("refuses a build with a source map, which this pass does not chain", () => {
		const plugin = minifyChunks();
		expect(() =>
			plugin.configResolved({ build: { minify: false, sourcemap: true } }),
		).toThrow(/sourcemap/);
	});

	test("minifies each JavaScript chunk of the bundle with the build target and drops its map", async () => {
		const plugin = await runHook(minifyChunks(), {
			build: { minify: false, sourcemap: false, target: "es2022" },
		});
		const chunk = { type: "chunk", fileName: "chunks/a.js", code: source, map: {} };
		await plugin.generateBundle({}, { "chunks/a.js": chunk });
		expect(chunk.map).toBeNull();
		expect(chunk.code).toContain("@license Apache-2.0");
		expect(chunk.code.length).toBeLessThan(source.length);
	});

	test("leaves assets and stylesheets alone", async () => {
		const plugin = await runHook(minifyChunks(), {
			build: { minify: false, sourcemap: false, target: "es2022" },
		});
		const asset = { type: "asset", fileName: "a.js", source: "a  {  }" };
		const css = { type: "chunk", fileName: "style.css", code: "a  {  }" };
		await plugin.generateBundle({}, { "a.js": asset, "style.css": css });
		expect(asset.source).toBe("a  {  }");
		expect(css.code).toBe("a  {  }");
	});
});
