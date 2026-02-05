/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./**/*.{svelte,js,ts,jsx,tsx}"],
	theme: {
		extend: {},
	},
	plugins: [require("daisyui")],
	daisyui: {
		themes: ["light", "dark", "auto"],
	},
};
