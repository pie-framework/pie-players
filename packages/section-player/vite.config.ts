import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { createHash } from "node:crypto";
import { resolve } from "path";
import { defineConfig } from "vite";
import { playersSharedSvelteSourceAliases } from "../players-shared/svelte-source-aliases.js";
import dts from "vite-plugin-dts";
import { guardSvelteCustomElementDefines } from "../players-shared/svelte-custom-element-guard.js";

/** Source modules behind the `./contracts/*` and `./policies` exports. */
const CONTRACT_ENTRIES = [
	"contracts/layout-contract",
	"contracts/public-events",
	"contracts/runtime-host-contract",
	"contracts/layout-parity-metadata",
	"contracts/host-hooks",
	"policies/index",
];

const sanitizeChunkKey = (value: string) =>
	value
		.replace(/\\/g, "/")
		.replace(/^.*\/node_modules\//, "npm/")
		.replace(/^.*\/src\//, "src/")
		.replace(/-[a-f0-9]{8,}(?=\.js($|[/.]))/gi, "")
		.replace(/-[a-f0-9]{8,}(?=\/|$)/gi, "")
		.replace(/[^a-zA-Z0-9/_-]/g, "-")
		.replace(/\/+/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/$/, "")
		.replace(/\//g, "__");

const getChunkSourceKey = (chunkInfo: {
	name: string;
	facadeModuleId?: string | null;
	moduleIds?: string[];
}) => {
	const moduleSource =
		chunkInfo.facadeModuleId ??
		(Array.isArray(chunkInfo.moduleIds) ? chunkInfo.moduleIds[0] : undefined);
	const sourceKey = sanitizeChunkKey(moduleSource || chunkInfo.name || "chunk");
	const chunkName = sanitizeChunkKey(chunkInfo.name || "chunk");
	const sourceHash = createHash("sha1")
		.update(sourceKey)
		.digest("hex")
		.slice(0, 8);
	return `${chunkName}-${sourceHash}`;
};

const assertNoEvalRequireInOutput = {
	name: "assert-no-eval-require-in-output",
	generateBundle(_options: unknown, bundle: Record<string, any>) {
		const evalRequirePattern = /eval\((["'])require\1\)/;
		for (const output of Object.values(bundle)) {
			if (output?.type !== "chunk" || typeof output.code !== "string") {
				continue;
			}
			if (evalRequirePattern.test(output.code)) {
				throw new Error(
					`Unsafe dynamic require pattern found in output chunk: ${output.fileName}`,
				);
			}
		}
	},
};

export default defineConfig({
	resolve: {
		alias: {
			// Declared once in players-shared; see svelte-source-aliases.ts.
			...playersSharedSvelteSourceAliases(
				resolve(__dirname, "../players-shared"),
				resolve,
			),
		},
	},
	plugins: [
		svelte({
			preprocess: vitePreprocess(),
			compilerOptions: {
				customElement: true,
			},
			emitCss: false,
		}),
		guardSvelteCustomElementDefines(),
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
				chunkFileNames: (chunkInfo) =>
					`chunks/${getChunkSourceKey(chunkInfo)}.js`,
				assetFileNames: "assets/[name][extname]",
			},
		},
	},
});
