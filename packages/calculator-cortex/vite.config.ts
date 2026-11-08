import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";
import { svelteRootDir } from "../players-shared/svelte-root-dir.js";
import { preserveLegalComments } from "../players-shared/legal-comments.mjs";
import { minifyChunks } from "../players-shared/minify-chunks.mjs";

const WORKER_SOURCE = resolve(import.meta.dirname, "src/evaluation-worker.ts");
const WORKER_URL = 'new URL("./evaluation-worker.ts", import.meta.url)';

/**
 * Emits the evaluation worker as a second entry of this build. Vite bundles a
 * `new Worker(new URL(...))` worker in a build of its own, which carries a
 * second copy of the Compute Engine; as an entry of this build the worker
 * imports the shared `compute-engine` chunk. `vite dev` keeps Vite's own worker
 * handling, because the plugin applies to builds only.
 */
function evaluationWorkerEntry(): Plugin {
	return {
		name: "pie-calculator-cortex-worker-entry",
		apply: "build",
		enforce: "pre",
		transform(code, id) {
			if (!id.endsWith("/src/evaluation-client.ts")) return null;
			if (!code.includes(WORKER_URL)) {
				throw new Error(
					`evaluation-client.ts no longer contains ${WORKER_URL}, which pie-calculator-cortex-worker-entry replaces`,
				);
			}
			const reference = this.emitFile({
				type: "chunk",
				id: WORKER_SOURCE,
				name: "evaluation-worker",
			});
			return code.replace(
				WORKER_URL,
				`new URL(import.meta.ROLLUP_FILE_URL_${reference})`,
			);
		},
	};
}

export default defineConfig({
	base: "./",
	plugins: [
		evaluationWorkerEntry(),
		preserveLegalComments(),
		minifyChunks(),
		svelte({
			compilerOptions: { rootDir: svelteRootDir(import.meta.dirname) },
			emitCss: false,
		}),
		dts({
			tsconfigPath: resolve(import.meta.dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
			// No `.svelte`: a component declares as a stub that imports `svelte`,
			// which hosts do not install, and no type entry reaches one.
			include: ["src/**/*.ts", "svelte-shims.d.ts"],
		}),
	],
	build: {
		lib: {
			entry: resolve(import.meta.dirname, "src/index.ts"),
			name: "PieCalculatorCortex",
			fileName: () => "index.js",
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
		minify: false,
		sourcemap: false,
		rollupOptions: {
			external: ["@pie-players/pie-calculator"],
			output: {
				format: "es",
				// Rolldown names the worker entry by chunkFileNames.
				chunkFileNames: (chunk) =>
					chunk.name === "evaluation-worker"
						? "assets/evaluation-worker-[hash].js"
						: "chunks/[name]-[hash].js",
				assetFileNames: "assets/[name]-[hash][extname]",
				// MathLive and the Compute Engine each get a chunk of their own. A
				// Vite 7 host tests every module against
				// /new\s+URL.+import\.meta\.url/s, which in a large build on Node 26
				// overflows V8's regexp stack once about 4M characters follow a
				// module's first `new URL`; as one runtime chunk, 5.9M followed
				// MathLive's. scripts/check-bundle-safety.mjs holds every dist module
				// to half that.
				codeSplitting: {
					groups: [
						{
							name: "mathlive",
							test: /[\\/]node_modules[\\/]mathlive[\\/].+\.m?js$/,
						},
						{
							name: "compute-engine",
							test: /[\\/]node_modules[\\/]@cortex-js[\\/]compute-engine[\\/]/,
						},
					],
				},
			},
		},
	},
});
