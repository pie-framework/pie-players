import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import {
	assertNoEvalRequireInOutput,
	sharedAliases,
	sharedChunkFileNames,
	sharedSveltePlugins,
} from "./vite.config.shared.js";

/**
 * Source modules behind the `./contracts/*`, `./policies` and `./item-section`
 * exports.
 */
const CONTRACT_ENTRIES = [
	"contracts/runtime-host-contract",
	"contracts/host-hooks",
	"policies/index",
	"item-section/index",
];

export default defineConfig({
	resolve: {
		alias: sharedAliases(),
	},
	plugins: [
		...sharedSveltePlugins(),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDirs: "dist",
			insertTypesEntry: true,
		}),
		assertNoEvalRequireInOutput,
	],
	build: {
		lib: {
			entry: {
				"pie-section-player": resolve(__dirname, "src/pie-section-player.ts"),
				// Each contract subpath is its own entry, so importing one loads no
				// custom element and runs in Node.
				...Object.fromEntries(
					CONTRACT_ENTRIES.map((entry) => [
						entry,
						resolve(__dirname, `src/${entry}.ts`),
					]),
				),
			},
			name: "PieSectionPlayer",
			fileName: (_format, entryName) => `${entryName}.js`,
			formats: ["es"],
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2020",
		minify: "esbuild",
		sourcemap: false,
		rollupOptions: {
			external: [
				"@pie-players/pie-default-tool-loaders",
				// The host's one item player defines `pie-item-player` and installs
				// the math renderer, for this player's items and its own.
				/^@pie-players\/pie-item-player(?:\/|$)/,
				// speech-rule-engine and its locale tables resolve from the host's
				// node_modules, so every PIE bundle a host loads shares one copy.
				/^speech-rule-engine(?:\/|$)/,
			],
			output: {
				format: "es",
				entryFileNames: "[name].js",
				chunkFileNames: sharedChunkFileNames,
				assetFileNames: "assets/[name][extname]",
			},
		},
	},
});
