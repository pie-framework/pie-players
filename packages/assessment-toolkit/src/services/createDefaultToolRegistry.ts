/**
 * Default Tool Registry Factory
 *
 * Creates a ToolRegistry pre-populated with all PIE framework tools.
 * Integrators can use this as a starting point and customize as needed.
 */

import { ToolRegistry } from "./ToolRegistry";
import { calculatorToolRegistration } from "../tools/registrations/calculator";
import { ttsToolRegistration } from "../tools/registrations/tts";
import {
	rulerToolRegistration,
	protractorToolRegistration,
} from "../tools/registrations/measurement-tools";
import {
	answerEliminatorToolRegistration,
	highlighterToolRegistration,
} from "../tools/registrations/interaction-tools";
import {
	magnifierToolRegistration,
	lineReaderToolRegistration,
	colorSchemeToolRegistration,
	annotationToolbarRegistration,
} from "../tools/registrations/accessibility-tools";
import {
	graphToolRegistration,
	periodicTableToolRegistration,
} from "../tools/registrations/subject-specific-tools";

/**
 * Create a tool registry with all default PIE tools registered
 *
 * Default tools include:
 * - Calculator (basic, scientific, graphing)
 * - Text-to-Speech (TTS)
 * - Ruler
 * - Protractor
 * - Answer Eliminator
 * - Highlighter
 * - Magnifier
 * - Line Reader
 * - Color Scheme
 * - Annotation Toolbar
 * - Graph
 * - Periodic Table
 *
 * @returns ToolRegistry with all default tools
 */
export function createDefaultToolRegistry(): ToolRegistry {
	const registry = new ToolRegistry();

	// Register all default PIE tools
	registry.register(calculatorToolRegistration);
	registry.register(ttsToolRegistration);
	registry.register(rulerToolRegistration);
	registry.register(protractorToolRegistration);
	registry.register(answerEliminatorToolRegistration);
	registry.register(highlighterToolRegistration);
	registry.register(magnifierToolRegistration);
	registry.register(lineReaderToolRegistration);
	registry.register(colorSchemeToolRegistration);
	registry.register(annotationToolbarRegistration);
	registry.register(graphToolRegistration);
	registry.register(periodicTableToolRegistration);

	return registry;
}

/**
 * Default tool placement configuration
 *
 * Defines which tools appear at which levels by default.
 * Integrators can override this configuration.
 *
 * Categories:
 * - Global tools: magnifier, colorScheme (assessment/section level)
 * - Context-smart: calculator, graph, periodicTable (item/element, auto-detect)
 * - Reading aids: textToSpeech, lineReader, annotationToolbar (where text exists)
 * - Interaction-specific: answerEliminator (choice questions), highlighter (text)
 * - Measurement: ruler, protractor (element level, diagram/geometry)
 */
export const DEFAULT_TOOL_PLACEMENT = {
	assessment: [
		// Global accessibility tools
		"magnifier",
		"colorScheme",
	],
	section: [
		// Global accessibility + common tools
		"magnifier",
		"colorScheme",
		"calculator",
		"textToSpeech",
	],
	item: [
		// Most common item-level tools
		"calculator",
		"textToSpeech",
		"answerEliminator",
		"highlighter",
		"annotationToolbar",
		"graph",
		"periodicTable",
	],
	passage: [
		// Reading-focused tools
		"textToSpeech",
		"highlighter",
		"annotationToolbar",
		"lineReader",
	],
	rubric: [
		// Similar to passage
		"textToSpeech",
		"highlighter",
		"annotationToolbar",
		"lineReader",
	],
	element: [
		// Element-specific tools
		"calculator",
		"textToSpeech",
		"ruler",
		"protractor",
		"highlighter",
		"annotationToolbar",
		"graph",
		"periodicTable",
	],
} as const;

/**
 * Tool priority order for rendering
 * Tools will be rendered in this order when multiple tools are visible
 */
export const DEFAULT_TOOL_ORDER = [
	// Global accessibility first
	"magnifier",
	"colorScheme",
	// Common tools
	"calculator",
	"textToSpeech",
	// Reading aids
	"lineReader",
	"annotationToolbar",
	"highlighter",
	// Interaction tools
	"answerEliminator",
	// Measurement tools
	"ruler",
	"protractor",
	// Subject-specific
	"graph",
	"periodicTable",
] as const;
