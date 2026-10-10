import { resolve } from "path";
import { defineConfig } from "vite";
import { escapeSourceMapCommentTextInOutput } from "../players-shared/source-map-comment-text.mjs";

export default defineConfig({
	plugins: [escapeSourceMapCommentTextInOutput()],
	build: {
		lib: {
			entry: resolve(__dirname, "src/index.ts"),
			name: "PiePrintPlayer",
			fileName: "print-player",
			formats: ["es"],
		},
		sourcemap: false,
		// Target modern browsers
		target: "es2020",
		// Minify for production
		minify: "esbuild",
	},
	// Ensure proper module resolution
	resolve: {
		extensions: [".ts", ".js"],
	},
});
