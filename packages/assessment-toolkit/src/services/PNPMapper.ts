/**
 * PNP Mapper - Maps QTI 3.0 PNP support IDs to PIE tool identifiers
 *
 * Provides bidirectional mapping between QTI 3.0 Personal Needs Profile (PNP)
 * support identifiers and PIE tool IDs. Supports custom extensions via registration.
 *
 * Part of PIE Assessment Toolkit.
 */

/**
 * Standard QTI 3.0 PNP support → PIE tool ID mapping
 *
 * Maps industry-standard PNP support identifiers to corresponding PIE tools.
 * Based on IMS Global QTI 3.0 specification.
 */
export const PNP_TO_PIE_TOOL_MAP: Record<string, string> = {
	// Standard QTI 3.0 PNP supports
	textToSpeech: "pie-tool-text-to-speech",
	calculator: "pie-tool-calculator",
	ruler: "pie-tool-ruler",
	protractor: "pie-tool-protractor",
	highlighter: "pie-tool-annotation-toolbar",
	lineReader: "pie-tool-line-reader",
	magnifier: "pie-tool-magnifier",
	colorContrast: "pie-theme-contrast",
	answerMasking: "pie-tool-answer-eliminator",
	dictionaryLookup: "pie-tool-dictionary",

	// Common extensions (not in QTI standard but widely used)
	graphingCalculator: "pie-tool-calculator",
	scientificCalculator: "pie-tool-calculator",
	basicCalculator: "pie-tool-calculator",
};

/**
 * Reverse mapping for debugging/export (PIE tool ID → PNP support ID)
 */
export const PIE_TOOL_TO_PNP_MAP: Record<string, string> = Object.fromEntries(
	Object.entries(PNP_TO_PIE_TOOL_MAP).map(([pnp, tool]) => [tool, pnp]),
);

/**
 * Map PNP support ID to PIE tool ID
 *
 * @param supportId QTI 3.0 PNP support identifier
 * @returns PIE tool ID or null if no mapping exists
 *
 * @example
 * mapPNPSupportToToolId('textToSpeech') // Returns: 'pie-tool-text-to-speech'
 * mapPNPSupportToToolId('calculator')   // Returns: 'pie-tool-calculator'
 * mapPNPSupportToToolId('unknown')      // Returns: null
 */
export function mapPNPSupportToToolId(supportId: string): string | null {
	return PNP_TO_PIE_TOOL_MAP[supportId] || null;
}

/**
 * Map PIE tool ID back to PNP support ID
 *
 * Useful for exporting or debugging tool configurations.
 *
 * @param toolId PIE tool identifier
 * @returns QTI 3.0 PNP support ID or null if no mapping exists
 *
 * @example
 * mapToolIdToPNPSupport('pie-tool-text-to-speech') // Returns: 'textToSpeech'
 */
export function mapToolIdToPNPSupport(toolId: string): string | null {
	return PIE_TOOL_TO_PNP_MAP[toolId] || null;
}

/**
 * Register custom PNP support mapping
 *
 * Allows products to extend the standard PNP vocabulary with custom tools.
 * Custom supports should use 'x-' prefix per IMS convention.
 *
 * @param supportId PNP support identifier (e.g., 'x-pie-periodic-table')
 * @param toolId PIE tool identifier (e.g., 'pie-tool-periodic-table')
 *
 * @example
 * registerCustomPNPMapping('x-pie-periodic-table', 'pie-tool-periodic-table');
 * registerCustomPNPMapping('x-pie-graph', 'pie-tool-graphing');
 */
export function registerCustomPNPMapping(
	supportId: string,
	toolId: string,
): void {
	PNP_TO_PIE_TOOL_MAP[supportId] = toolId;
	PIE_TOOL_TO_PNP_MAP[toolId] = supportId;
}

/**
 * Get all registered PNP support IDs
 *
 * @returns Array of all PNP support identifiers (standard + custom)
 */
export function getAllPNPSupports(): string[] {
	return Object.keys(PNP_TO_PIE_TOOL_MAP);
}

/**
 * Check if a PNP support is registered
 *
 * @param supportId PNP support identifier to check
 * @returns true if mapping exists
 */
export function isPNPSupportRegistered(supportId: string): boolean {
	return supportId in PNP_TO_PIE_TOOL_MAP;
}
