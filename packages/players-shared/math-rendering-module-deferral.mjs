/**
 * Defers the bundled MathJax 3 until the IIFE strategy asks for it.
 *
 * `@pie-lib/math-rendering-module` is one prebuilt ES module whose top level
 * sets MathJax 3 up on the page: it creates a `MathJax` global, or rewraps the
 * page's own, and calls `MathJax.loader.preLoad`, which MathJax 4's loader
 * lacks. `initializeMathRendering` imports it dynamically, for IIFE bundles
 * only, but a host build that inlines dynamic imports evaluates it at startup:
 * Rollup does, so Vite through 7 does. A page already running MathJax 4 then
 * throws while the host bundle evaluates, and a page without MathJax keeps a
 * MathJax 3 global that the ng elements' renderer reports as a conflict.
 *
 * `deferMathRenderingModuleEvaluation()` moves the module body into an
 * exported `evaluateMathRenderingModule()`, so the body runs on its first call,
 * which `initializeMathRendering` makes, and later calls return the same
 * renderer or rethrow the same error, as a module evaluates once. The
 * item-player build lists the plugin, the section player's browser build
 * bundles that output, and `check:bundle-safety` fails on a published chunk
 * that carries MathJax 3 without the factory.
 *
 * The transform also replaces the module's `eval("require")` with its own
 * `commonjsRequire`, since `check:bundle-safety` fails on the `eval` in a
 * published chunk.
 *
 * Lives at the package root beside `source-map-comment-text.mjs`, outside
 * `src/`, so it never lands in `dist`. Plain JavaScript, because
 * `check:bundle-safety` runs under Node without a TypeScript loader.
 */

/** The file `initializeMathRendering` imports. */
export const MATH_RENDERING_MODULE_FILE =
	"@pie-lib/math-rendering-module/module/index.js";

/** The export the deferred module carries in place of the renderer. */
export const MATH_RENDERING_MODULE_FACTORY = "evaluateMathRenderingModule";

/** Text only the MathJax 3 module carries: its TeX setup. */
export const MATHJAX_3_SETUP_TEXT = "MathJax.loader.preLoad";

/** The module's one export statement, which ends the file. */
const RENDERER_EXPORT =
	/\nexport\s*\{\s*index\s+as\s+_dll_pie_lib__math_rendering\s*\};?\s*$/;

const EVAL_REQUIRE = /return\s+eval\((["'])require\1\);/g;

/**
 * `code`, the module as published, with its body deferred into
 * `evaluateMathRenderingModule()`. Throws when the module no longer ends in
 * the one export this expects, so an upgraded module fails the build instead
 * of evaluating eagerly again.
 */
export function deferMathRenderingModule(code) {
	const rendererExport = RENDERER_EXPORT.exec(code);
	if (!rendererExport) {
		throw new Error(
			`${MATH_RENDERING_MODULE_FILE} no longer ends in \`export { index as _dll_pie_lib__math_rendering };\`, so its evaluation cannot be deferred. Update math-rendering-module-deferral.mjs for the new module.`,
		);
	}
	const body = code
		.slice(0, rendererExport.index)
		.replace(EVAL_REQUIRE, "return commonjsRequire;");
	return `let mathRenderingModule;
export function ${MATH_RENDERING_MODULE_FACTORY}() {
	if (!mathRenderingModule) {
		try {
			mathRenderingModule = { renderer: evaluate() };
		} catch (error) {
			mathRenderingModule = { error };
		}
	}
	if ("error" in mathRenderingModule) throw mathRenderingModule.error;
	return mathRenderingModule.renderer;
}
function evaluate() {
${body}
return index;
}
`;
}

/** Vite plugin applying `deferMathRenderingModule` to the module. */
export function deferMathRenderingModuleEvaluation() {
	return {
		name: "defer-math-rendering-module-evaluation",
		enforce: "pre",
		transform(code, id) {
			if (!id.replaceAll("\\", "/").includes(MATH_RENDERING_MODULE_FILE)) {
				return null;
			}
			return { code: deferMathRenderingModule(code), map: null };
		},
	};
}
