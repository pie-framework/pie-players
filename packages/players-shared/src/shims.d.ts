declare module "@pie-lib/math-rendering-module/module" {
	import type { MathRenderingAPI } from "@pie-players/math-renderer-core";
	export const _dll_pie_lib__math_rendering: MathRenderingAPI;
	const mod: any;
	export default mod;
}

interface Window {
	"@pie-lib/math-rendering"?: import("@pie-players/math-renderer-core").MathRenderingAPI;
	_dll_pie_lib__math_rendering?: import("@pie-players/math-renderer-core").MathRenderingAPI;
	pie?: any;
	pieHelpers?: {
		loadingScripts: Record<string, boolean>;
	};
}
