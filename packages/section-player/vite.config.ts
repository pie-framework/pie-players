import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { hostSharedExternals } from "../players-shared/host-shared-externals.js";
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

const isHostShared = hostSharedExternals(resolve(__dirname, ".."));

/**
 * Imports the npm build leaves to the host: the packages a host page shares
 * (toolkit, players-shared, pie-context), the default tool loaders and the item
 * player. `./browser` bundles all of them. speech-rule-engine is the toolkit's
 * import and reaches the host through it.
 */
const external = (specifier: string): boolean =>
	isHostShared(specifier) ||
	specifier === "@pie-players/pie-default-tool-loaders" ||
	// The host's one item player defines `pie-item-player` and installs
	// the math renderer, for this player's items and its own.
	/^@pie-players\/pie-item-player(?:\/|$)/.test(specifier);

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
