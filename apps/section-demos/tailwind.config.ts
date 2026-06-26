// @ts-nocheck
// NOTE: With Tailwind v4 + daisyUI v5, this file is NOT loaded unless an
// `@config` directive references it. The active configuration lives in
// `src/app.css` (`@plugin "daisyui" { themes: all; }`). This file is kept
// only for editor/tooling references; keep `themes` in sync to avoid
// implying that only light/dark are compiled.
import daisyui from "daisyui";
import type { Config } from "tailwindcss";

export default {
	content: ["./src/**/*.{html,js,svelte,ts}"],
	theme: {
		extend: {},
	},
	plugins: [daisyui],
	daisyui: {
		themes: true,
		darkTheme: "dark",
		base: true,
		styled: true,
		utils: true,
		logs: false,
	},
} satisfies Config;
