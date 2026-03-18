/**
 * Default Tool Registry Factory
 *
 * Creates a ToolRegistry pre-populated with all PIE framework tools.
 * Integrators can use this as a starting point and customize as needed.
 */

import { ToolRegistry } from "./ToolRegistry.js";
import type { ToolRegistration } from "./ToolRegistry.js";
import type { ToolModuleLoader } from "./ToolRegistry.js";
import { calculatorToolRegistration } from "../tools/registrations/calculator.js";
import { ttsToolRegistration } from "../tools/registrations/tts.js";
import {
	rulerToolRegistration,
	protractorToolRegistration,
} from "../tools/registrations/measurement-tools.js";
import {
	answerEliminatorToolRegistration,
	highlighterToolRegistration,
} from "../tools/registrations/interaction-tools.js";
import {
	lineReaderToolRegistration,
	themeToolRegistration,
	annotationToolbarRegistration,
} from "../tools/registrations/accessibility-tools.js";
import {
	graphToolRegistration,
	periodicTableToolRegistration,
} from "../tools/registrations/subject-specific-tools.js";
import {
	DEFAULT_TOOL_TAG_MAP,
	type ToolComponentFactory,
	type ToolComponentFactoryMap,
	type ToolTagMap,
} from "../tools/tool-tag-map.js";
import {
	DEFAULT_TOOL_PLACEMENT,
	PACKAGED_TOOL_PLACEMENT,
} from "./tool-config-defaults.js";

const PACKAGED_TOOL_REGISTRATIONS = [
	calculatorToolRegistration,
	ttsToolRegistration,
	rulerToolRegistration,
	protractorToolRegistration,
	answerEliminatorToolRegistration,
	highlighterToolRegistration,
	lineReaderToolRegistration,
	themeToolRegistration,
	annotationToolbarRegistration,
	graphToolRegistration,
	periodicTableToolRegistration,
] as const;

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
	/**
	 * Optional lazy module loaders keyed by toolId.
	 * Hosts can inject default loaders from an external package.
	 */
	toolModuleLoaders?: Partial<Record<string, ToolModuleLoader>>;
	/**
	 * Register packaged PIE tools by default.
	 *
	 * @default false
	 */
	includePackagedTools?: boolean;
	/**
	 * Restrict registration to specific packaged tool IDs.
	 * Ignored when includePackagedTools is false.
	 */
	toolIds?: string[];
}

/**
 * Create a tool registry.
 *
 * By default, this creates an empty registry so hosts can explicitly opt in.
 * For convenience, pass { includePackagedTools: true } to register all packaged tools,
 * or use createPackagedToolRegistry().
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

	if (options.includePackagedTools) {
		registerPackagedTools(registry, {
			toolIds: options.toolIds,
			applyOverrides,
		});
	}

	if (options.toolModuleLoaders && Object.keys(options.toolModuleLoaders).length > 0) {
		registry.setToolModuleLoaders(options.toolModuleLoaders);
	}

	registry.setComponentOverrides(componentConfig);

	return registry;
}

export interface RegisterPackagedToolsOptions {
	toolIds?: string[];
	applyOverrides?: (registration: ToolRegistration) => ToolRegistration;
}

/**
 * Register packaged PIE tools onto an existing registry.
 */
export function registerPackagedTools(
	registry: ToolRegistry,
	options: RegisterPackagedToolsOptions = {},
): void {
	const selectedToolIds =
		options.toolIds && options.toolIds.length > 0
			? new Set(options.toolIds)
			: null;
	const applyOverrides = options.applyOverrides || ((registration: ToolRegistration) => registration);
	for (const registration of PACKAGED_TOOL_REGISTRATIONS) {
		if (selectedToolIds && !selectedToolIds.has(registration.toolId)) {
			continue;
		}
		registry.register(applyOverrides(registration));
	}
}

/**
 * Convenience factory that registers all packaged PIE tools.
 */
export function createPackagedToolRegistry(
	options: Omit<DefaultToolRegistryOptions, "includePackagedTools"> = {},
): ToolRegistry {
	return createDefaultToolRegistry({
		...options,
		includePackagedTools: true,
	});
}

/**
 * Default tool placement configuration
 *
 * Defines which tools appear at which levels by default.
 * Integrators can override this configuration.
 *
 * Categories:
 * - Global tools: theme (assessment/section level)
 * - Context-smart: calculator, graph, periodicTable (item/element, auto-detect)
 * - Reading aids: textToSpeech, lineReader, annotationToolbar (where text exists)
 * - Interaction-specific: answerEliminator (choice questions), highlighter (text)
 * - Measurement: ruler, protractor (element level, diagram/geometry)
 */
export { DEFAULT_TOOL_PLACEMENT };
export { PACKAGED_TOOL_PLACEMENT };

/**
 * Tool priority order for rendering
 * Tools will be rendered in this order when multiple tools are visible
 */
export const DEFAULT_TOOL_ORDER = [
	// Global accessibility first
	"theme",
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
