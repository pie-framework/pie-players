/**
 * Resolves `@pie-players/*` via package `exports` → `dist/` (no Vite alias table).
 * Same dist-first contract as section-demos; see docs/development/demo-workspace-resolution.md
 */
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		port: 5301, // Different from section-demos (5300)
		open: true,
	},
});
