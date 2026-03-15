import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 5500,
		open: true,
	},
	resolve: {
		alias: {
			"@pie-players/pie-tool-calculator-desmos": resolve(
				__dirname,
				"../../packages/tool-calculator-desmos/dist/pie-tool-calculator.js",
			),
		},
	},
});
