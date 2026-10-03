import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
	deferMathRenderingModule,
	deferMathRenderingModuleEvaluation,
	MATH_RENDERING_MODULE_FILE,
} from "../math-rendering-module-deferral.mjs";

const moduleDirs: string[] = [];

afterAll(() => {
	for (const dir of moduleDirs) rmSync(dir, { recursive: true, force: true });
});

/**
 * Imports `code` as a fresh ES module, from a directory of its own: bun does
 * not find a file written into a directory it has already imported from.
 */
async function importModule(code: string): Promise<Record<string, any>> {
	const dir = mkdtempSync(join(tmpdir(), "math-rendering-deferral-"));
	moduleDirs.push(dir);
	const file = join(dir, "module.mjs");
	writeFileSync(file, code);
	return import(pathToFileURL(file).href);
}

/** The published module's shape: a body with side effects, then the export. */
const publishedShape = (body: string) => `${body}
var index = /*#__PURE__*/Object.freeze({ renderMath: () => {} });

export { index as _dll_pie_lib__math_rendering };
`;

describe("deferMathRenderingModule", () => {
	test("runs the body on the first factory call, not on import", async () => {
		const evaluations: string[] = [];
		(globalThis as any).deferralEvaluations = evaluations;
		const mod = await importModule(
			deferMathRenderingModule(
				publishedShape('globalThis.deferralEvaluations.push("body");'),
			),
		);

		expect(evaluations).toEqual([]);
		expect(Object.keys(mod)).toEqual(["evaluateMathRenderingModule"]);

		const renderer = mod.evaluateMathRenderingModule();
		expect(typeof renderer.renderMath).toBe("function");
		expect(mod.evaluateMathRenderingModule()).toBe(renderer);
		expect(evaluations).toEqual(["body"]);
		delete (globalThis as any).deferralEvaluations;
	});

	test("rethrows the body's error without evaluating it again", async () => {
		const evaluations: string[] = [];
		(globalThis as any).deferralEvaluations = evaluations;
		const mod = await importModule(
			deferMathRenderingModule(
				publishedShape(
					'globalThis.deferralEvaluations.push("body"); throw new Error("MathJax.loader.preLoad is not a function");',
				),
			),
		);

		let first: unknown;
		try {
			mod.evaluateMathRenderingModule();
		} catch (error) {
			first = error;
		}
		expect(first).toBeInstanceOf(Error);
		expect(() => mod.evaluateMathRenderingModule()).toThrow(first as Error);
		expect(evaluations).toEqual(["body"]);
		delete (globalThis as any).deferralEvaluations;
	});

	test("replaces eval(require) with the module's own commonjsRequire", () => {
		const deferred = deferMathRenderingModule(
			publishedShape(
				"function commonjsRequire() {}\nclass SystemExternal { static nodeRequire() { return eval('require'); } }",
			),
		);

		expect(deferred).not.toContain("eval(");
		expect(deferred).toContain("return commonjsRequire;");
	});

	test("fails on a module that no longer ends in the renderer export", () => {
		expect(() =>
			deferMathRenderingModule(
				"var index = {};\nexport { index as renderer };\n",
			),
		).toThrow(/cannot be deferred/);
	});

	test("defers the published module without touching the page's MathJax", async () => {
		const published = await Bun.file(
			Bun.resolveSync(MATH_RENDERING_MODULE_FILE, import.meta.dir),
		).text();
		const accessed: string[] = [];
		const descriptor = Object.getOwnPropertyDescriptor(globalThis, "MathJax");
		Object.defineProperty(globalThis, "MathJax", {
			configurable: true,
			get() {
				accessed.push("get");
				return { version: "4.0.0", loader: {} };
			},
			set() {
				accessed.push("set");
			},
		});
		try {
			const mod = await importModule(deferMathRenderingModule(published));

			expect(typeof mod.evaluateMathRenderingModule).toBe("function");
			expect(accessed).toEqual([]);
		} finally {
			if (descriptor) Object.defineProperty(globalThis, "MathJax", descriptor);
			else delete (globalThis as any).MathJax;
		}
	});
});

describe("deferMathRenderingModuleEvaluation", () => {
	const plugin = deferMathRenderingModuleEvaluation();

	test("transforms only the math-rendering module", () => {
		const code = publishedShape("");

		expect(plugin.transform(code, "/src/pie/math-rendering.ts")).toBeNull();
		expect(
			plugin.transform(
				code,
				`C:\\repo\\node_modules\\${MATH_RENDERING_MODULE_FILE.replaceAll("/", "\\")}`,
			)?.code,
		).toContain("export function evaluateMathRenderingModule()");
	});
});
