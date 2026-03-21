declare module "@pie-lib/math-rendering-module/module" {
	type MathRenderer = (element: HTMLElement) => void | Promise<void>;
	interface MathRenderingAPI {
		renderMath: MathRenderer;
		wrapMath?: (latex: string) => string;
		unWrapMath?: (wrapped: string) => string;
		mmlToLatex?: (mathml: string) => string;
	}
	export const _dll_pie_lib__math_rendering: MathRenderingAPI;
	const mod: any;
	export default mod;
}

interface Window {
	"@pie-lib/math-rendering"?: {
		renderMath: (element: HTMLElement) => void | Promise<void>;
		wrapMath?: (latex: string) => string;
		unWrapMath?: (wrapped: string) => string;
		mmlToLatex?: (mathml: string) => string;
	};
	_dll_pie_lib__math_rendering?: {
		renderMath: (element: HTMLElement) => void | Promise<void>;
		wrapMath?: (latex: string) => string;
		unWrapMath?: (wrapped: string) => string;
		mmlToLatex?: (mathml: string) => string;
	};
	pie?: any;
	pieHelpers?: {
		loadingScripts: Partial<Record<string, boolean>>;
		loadingPromises: Partial<Record<string, Promise<void>>>;
		globalLoadQueue?: Promise<void>;
		activeBundleUrl?: string | null;
	};
}
