/**
 * Initialize PIE math rendering module
 *
 * PIE elements expect @pie-lib/math-rendering to be available on window.
 * This was previously loaded by pie-player, but our custom elements need to load it explicitly.
 *
 * IMPORTANT: This uses dynamic import to avoid SSR issues - the module is browser-only.
 */

/// <reference path="../shims.d.ts" />

const KEY = "@pie-lib/math-rendering";
const DLL_KEY = "_dll_pie_lib__math_rendering"; // SystemJS/DLL global name

/**
 * Initialize math rendering on the window object if not already present.
 * Call this before rendering any PIE elements that might use math.
 *
 * Uses lazy import to avoid SSR issues with the browser-only module.
 * Sets TWO globals: @pie-lib/math-rendering (standard) and _dll_pie_lib__math_rendering (SystemJS/DLL)
 */
export async function initializeMathRendering(): Promise<void> {
	// Only run in browser
	if (typeof window === "undefined") {
		return;
	}

	// Already initialized
	if ((window as any)[KEY]) {
		return;
	}

	try {
		// Lazy import - only loads when called, avoids SSR
		const { _dll_pie_lib__math_rendering } = await import(
			"@pie-lib/math-rendering-module/module"
		);

		// Set BOTH globals:
		// 1. Standard key: @pie-lib/math-rendering (used by pie-player, expected by some PIE elements)
		(window as any)[KEY] = _dll_pie_lib__math_rendering;

		// 2. SystemJS/DLL key: _dll_pie_lib__math_rendering (used by IIFE bundles built with pslb)
		(window as any)[DLL_KEY] = _dll_pie_lib__math_rendering;

		console.log(
			"[MathRendering] ✅ Math rendering module initialized (both globals set)",
		);
	} catch (error) {
		console.error(
			"[MathRendering] ❌ Failed to initialize math rendering:",
			error,
		);
		throw error;
	}
}

/**
 * Render math in the given element (typically called after PIE elements are rendered)
 */
export function renderMath(element: HTMLElement): void {
	const MR = (window as any)[KEY];

	if (MR && typeof MR.renderMath === "function") {
		MR.renderMath(element);
	}
}
