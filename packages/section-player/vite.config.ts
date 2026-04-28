import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { createHash } from "node:crypto";
import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

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
	const sourceHash = createHash("sha1").update(sourceKey).digest("hex").slice(0, 8);
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
	plugins: [
		svelte({
			preprocess: vitePreprocess(),
			compilerOptions: {
				customElement: true,
			},
			emitCss: false,
		}),
		dts({
			tsconfigPath: resolve(__dirname, "tsconfig.json"),
			outDir: "dist",
			insertTypesEntry: true,
		}),
		assertNoEvalRequireInOutput,
	],
	build: {
		lib: {
			entry: {
				"pie-section-player": resolve(__dirname, "src/pie-section-player.ts"),
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
				"@pie-players/pie-toolbars",
				"@pie-players/pie-toolbars/components/item-toolbar-element",
				"@pie-players/pie-toolbars/components/section-toolbar-element",
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
