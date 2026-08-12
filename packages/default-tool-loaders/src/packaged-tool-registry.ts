/**
 * The packaged PIE capability set, and the registry factory that composes it.
 *
 * This is the composition layer: which capabilities exist in a deployment. It
 * lived in `@pie-players/pie-assessment-toolkit`, where eleven concrete
 * registrations inside the generic package meant the policy and registry core
 * knew every capability by name and a host could not contribute one without a PR
 * against that package.
 *
 * The toolkit still owns `ToolRegistry`, `createDefaultToolRegistry` (which
 * builds an empty registry), the registration contract and the toolbar helpers.
 * It knows `featureId`, placement levels, activation kinds and precedence rules,
 * and knows no capability ids.
 */

import {
	ToolRegistry,
	type ToolComponentFactory,
	type ToolComponentFactoryMap,
	type ToolModuleLoader,
	type ToolRegistration,
	type ToolTagMap,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	annotationToolbarRegistration,
	lineReaderToolRegistration,
	themeToolRegistration,
} from "./registrations/accessibility-tools.js";
import { audioTranscriptRegistration } from "./registrations/audio-transcript.js";
import { calculatorToolRegistration } from "./registrations/calculator.js";
import {
	answerEliminatorToolRegistration,
	highlighterToolRegistration,
} from "./registrations/interaction-tools.js";
import {
	protractorToolRegistration,
	rulerToolRegistration,
} from "./registrations/measurement-tools.js";
import {
	graphToolRegistration,
	periodicTableToolRegistration,
} from "./registrations/subject-specific-tools.js";
import { ttsToolRegistration } from "./registrations/tts.js";
import { PACKAGED_TOOL_TAG_MAP } from "./tool-tag-map.js";

export const PACKAGED_TOOL_REGISTRATIONS = [
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
	audioTranscriptRegistration,
] as const;

export interface PackagedToolRegistryOptions {
	/**
	 * Override packaged registrations by toolId. Highest-precedence extension
	 * point.
	 */
	overrides?: Partial<Record<string, ToolRegistration>>;
	/** Override or extend the packaged element tag mapping. */
	toolTagMap?: Partial<ToolTagMap>;
	/** Override the component factory globally or per tool. */
	toolComponentFactory?: ToolComponentFactory;
	toolComponentFactories?: Partial<ToolComponentFactoryMap>;
	/** Lazy module loaders keyed by toolId. */
	toolModuleLoaders?: Partial<Record<string, ToolModuleLoader>>;
	/** Restrict registration to specific packaged tool ids. */
	toolIds?: string[];
}

export interface RegisterPackagedToolsOptions {
	toolIds?: string[];
	applyOverrides?: (registration: ToolRegistration) => ToolRegistration;
}

/**
 * Register packaged PIE capabilities onto an existing registry.
 */
export function registerPackagedTools(
	registry: ToolRegistry,
	options: RegisterPackagedToolsOptions = {},
): void {
	const selectedToolIds =
		options.toolIds && options.toolIds.length > 0
			? new Set(options.toolIds)
			: null;
	const applyOverrides =
		options.applyOverrides ??
		((registration: ToolRegistration) => registration);
	for (const registration of PACKAGED_TOOL_REGISTRATIONS) {
		if (selectedToolIds && !selectedToolIds.has(registration.toolId)) continue;
		registry.register(applyOverrides(registration));
	}
}

/**
 * Create a registry holding the packaged PIE capabilities.
 *
 * The tag map is installed through `setComponentOverrides` rather than read from
 * a core default, so a registry composed without it resolves no packaged tags —
 * which is the point: core no longer carries the catalogue.
 */
export function createPackagedToolRegistry(
	options: PackagedToolRegistryOptions = {},
): ToolRegistry {
	const registry = new ToolRegistry();

	registerPackagedTools(registry, {
		toolIds: options.toolIds,
		applyOverrides: (registration) =>
			options.overrides?.[registration.toolId] ?? registration,
	});

	if (
		options.toolModuleLoaders &&
		Object.keys(options.toolModuleLoaders).length > 0
	) {
		registry.setToolModuleLoaders(options.toolModuleLoaders);
	}

	registry.setComponentOverrides({
		toolTagMap: { ...PACKAGED_TOOL_TAG_MAP, ...(options.toolTagMap ?? {}) },
		toolComponentFactory: options.toolComponentFactory,
		toolComponentFactories: options.toolComponentFactories,
	});

	return registry;
}

/**
 * Render order when several capabilities are visible at once.
 */
export const PACKAGED_TOOL_ORDER = [
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
