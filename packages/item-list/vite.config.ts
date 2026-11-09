import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { hostSharedExternals } from "../players-shared/host-shared-externals.js";
import { sharedChunkFileNames, sharedResolve, sharedSveltePlugins } from "./vite.config.shared.js";

const isHostShared = hostSharedExternals(resolve(__dirname, ".."));

/**
 * Imports the npm build leaves to the host: the packages a host page shares
 * (toolkit, players-shared, pie-context) and the item player, which renders
 * expanded rows and is imported on the first expansion. `./browser` bundles
 * all of them.
 */
const external = (specifier: string): boolean =>
	isHostShared(specifier) ||
	/^@pie-players\/pie-item-player(?:\/|$)/.test(specifier);

export default defineConfig({
	resolve: sharedResolve(),
	plugins: [
		...sharedSveltePlugins(),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
			// No `.svelte`: a component declares as a stub that imports `svelte`,
			// which hosts do not install, and no type entry reaches one.
			include: ["src/**/*.ts", "src/**/*.d.ts"],
		}),
	],
	build: {
		lib: {
			entry: {
				"pie-item-list": resolve(__dirname, "src/pie-item-list.ts"),
				// Registers nothing and touches no DOM, so it imports in Node.
				summarize: resolve(__dirname, "src/summarize.ts"),
			},
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: false,
		sourcemap: false,
		rollupOptions: {
			external,
			output: {
				format: "es",
				entryFileNames: "[name].js",
				chunkFileNames: sharedChunkFileNames,
				assetFileNames: "assets/[name][extname]",
			},
		},
	},
});
