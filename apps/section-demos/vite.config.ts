import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 5300,
		open: true,
	},
	resolve: {
		alias: {
			"@pie-players/tts-client-server": resolve(
				__dirname,
				"../../packages/tts-client-server/dist/index.js",
			),
			"@pie-players/pie-calculator-desmos": resolve(
				__dirname,
				"../../packages/calculator-desmos/dist/index.js",
			),
			"@pie-players/pie-tool-calculator": resolve(
				__dirname,
				"../../packages/tool-calculator/dist/pie-tool-calculator.js",
			),
			"@pie-players/pie-tool-calculator-inline": resolve(
				__dirname,
				"../../packages/tool-calculator-inline/dist/tool-calculator-inline.js",
			),
			"@pie-players/pie-tool-tts-inline": resolve(
				__dirname,
				"../../packages/tool-tts-inline/dist/tool-tts-inline.js",
			),
			"@pie-players/pie-tool-answer-eliminator": resolve(
				__dirname,
				"../../packages/tool-answer-eliminator/dist/tool-answer-eliminator.js",
			),
			"@pie-players/pie-tool-ruler": resolve(
				__dirname,
				"../../packages/tool-ruler/dist/tool-ruler.js",
			),
		},
	},
});
