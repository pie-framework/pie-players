/**
 * Default Tool Registry Factory
 *
 * Creates a ToolRegistry pre-populated with all PIE framework tools.
 * Integrators can use this as a starting point and customize as needed.
 */

import { ToolRegistry } from "./ToolRegistry";
import type { ToolRegistration } from "./ToolRegistry";
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
import {
	DEFAULT_TOOL_TAG_MAP,
	type ToolComponentFactory,
	type ToolComponentFactoryMap,
	type ToolTagMap,
} from "../tools/tool-tag-map";

export interface DefaultToolRegistryOptions {
	/**
	 * Override default tool registrations by toolId.
	 * This is the highest-precedence extension point.
	 */
	overrides?: Partial<Record<string, ToolRegistration>>;
	/**
	 * Override default component tag mapping used by built-in registrations.
	 */
	toolTagMap?: Partial<ToolTagMap>;
	/**
	 * Override component factory globally (all tools) or per tool.
	 */
	toolComponentFactory?: ToolComponentFactory;
	toolComponentFactories?: Partial<ToolComponentFactoryMap>;
}

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
export function createDefaultToolRegistry(
	options: DefaultToolRegistryOptions = {},
): ToolRegistry {
	const registry = new ToolRegistry();
	const componentConfig = {
		toolTagMap: {
			...DEFAULT_TOOL_TAG_MAP,
			...(options.toolTagMap || {}),
		},
		toolComponentFactory: options.toolComponentFactory,
		toolComponentFactories: options.toolComponentFactories,
	};

	const applyOverrides = (registration: ToolRegistration): ToolRegistration =>
		options.overrides?.[registration.toolId] || registration;

	// Register all default PIE tools
	registry.register(applyOverrides(calculatorToolRegistration));
	registry.register(applyOverrides(ttsToolRegistration));
	registry.register(applyOverrides(rulerToolRegistration));
	registry.register(applyOverrides(protractorToolRegistration));
	registry.register(applyOverrides(answerEliminatorToolRegistration));
	registry.register(applyOverrides(highlighterToolRegistration));
	registry.register(applyOverrides(magnifierToolRegistration));
	registry.register(applyOverrides(lineReaderToolRegistration));
	registry.register(applyOverrides(colorSchemeToolRegistration));
	registry.register(applyOverrides(annotationToolbarRegistration));
	registry.register(applyOverrides(graphToolRegistration));
	registry.register(applyOverrides(periodicTableToolRegistration));

	registry.setComponentOverrides(componentConfig);

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
