import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

/**
 * The two published entries need opposite Svelte handling, and one build cannot
 * give it to entries that share modules, so `build` runs this config twice.
 *
 * The root entry exports components that the vendor wrappers render inside
 * their own custom elements. It keeps `svelte` external, so each wrapper
 * bundles one runtime for its element and these components: a component
 * compiled against one runtime cannot attach effects beneath a parent running
 * another.
 *
 * Hosts resolve `./calculator-element` at runtime, through the packaged tool
 * loaders and the Desmos package, so `--mode calculator-element` bundles Svelte
 * into it and leaves nothing to resolve against the host's own copy.
 */
const CALCULATOR_ELEMENT_MODE = "calculator-element";

const pieExternals = [
	"@pie-players/pie-assessment-toolkit",
	"@pie-players/pie-assessment-toolkit/tools/client",
	"@pie-players/pie-players-shared",
	"@pie-players/pie-players-shared/i18n/provider",
	"@pie-players/pie-players-shared/i18n/types",
];

export default defineConfig(({ mode }) => {
	const elementBuild = mode === CALCULATOR_ELEMENT_MODE;
	return {
		plugins: [
			svelte({ compilerOptions: { customElement: true }, emitCss: false }),
			// The root build emits declarations for both entries.
			...(elementBuild
				? []
				: [
						dts({
							tsconfigPath: resolve(import.meta.dirname, "tsconfig.json"),
							outDirs: "dist",
							// `index.types.ts` is the root types entry. `insertTypesEntry` would
							// write a re-export of `index.ts` over it, and the components
							// `index.ts` exports declare as stubs importing `svelte`, which hosts
							// do not install.
							include: [
								"index.types.ts",
								"calculator-element.ts",
								"svelte-shims.d.ts",
							],
						}),
					]),
		],
		build: {
			lib: {
				entry: elementBuild
					? {
							"calculator-element": resolve(
								import.meta.dirname,
								"calculator-element.ts",
							),
						}
					: { index: resolve(import.meta.dirname, "index.ts") },
				name: "PieToolCalculatorShared",
				formats: ["es"],
			},
			outDir: "dist",
			// The element build runs second and keeps the root build's output.
			emptyOutDir: !elementBuild,
			target: "es2022",
			minify: "esbuild",
			sourcemap: false,
			rollupOptions: {
				external: elementBuild
					? pieExternals
					: [/^svelte(?:\/.*)?$/, ...pieExternals],
				output: elementBuild
					? { format: "es" }
					: {
							format: "es",
							// One module per component, so a wrapper bundles only the one it
							// renders. The names drop `.svelte`: vite-plugin-svelte compiles
							// any `*.svelte.js` it resolves as a runes module.
							preserveModules: true,
							entryFileNames: ({ name }) =>
								`${name.replace(/\.svelte$/, "")}.js`,
						},
			},
		},
	};
});
