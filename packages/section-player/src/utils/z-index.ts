/**
 * Z-index layers for assessment components
 * Copied from assessment-toolkit to avoid build dependency
 */
export enum ZIndexLayer {
	BASE = 0, // PIE content, player chrome (0-999)
	TOOL = 1000, // Non-modal tools (ruler, protractor) (1000-1999)
	MODAL = 2000, // Modal tools (calculator, dictionary) (2000-2999)
	CONTROL = 3000, // Drag handles, resize controls (3000-3999)
	HIGHLIGHT = 4000, // TTS and annotation highlights (4000-4999)
}
