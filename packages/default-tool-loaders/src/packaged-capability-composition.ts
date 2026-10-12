/**
 * The one authored description of PIE's packaged capability composition.
 *
 * Registrations describe what a capability can do. This module owns the
 * deployment decisions around them: element tags, lazy module loaders, the
 * section-player placement preset and the explicit universal-support policy.
 * Public constants are projections of this composition so adding a capability
 * cannot leave a second hand-maintained catalogue silently behind.
 */

import {
	ToolRegistry,
	type ToolComponentFactoryMap,
	type ToolModuleLoader,
	type ToolRegistration,
	type ToolTagMap,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { PersonalNeedsProfile } from "@pie-players/pie-players-shared/types";
import {
	annotationToolbarRegistration,
	lineReaderToolRegistration,
	themeToolRegistration,
} from "./registrations/accessibility-tools.js";
import { audioTranscriptRegistration } from "./registrations/audio-transcript.js";
import { calculatorToolRegistration } from "./registrations/calculator.js";
import {
	dictionaryToolRegistration,
	pictureDictionaryToolRegistration,
	spanishDictionaryToolRegistration,
	spanishPictureDictionaryToolRegistration,
} from "./registrations/dictionary-tools.js";
import { answerEliminatorToolRegistration } from "./registrations/interaction-tools.js";
import {
	protractorToolRegistration,
	rulerToolRegistration,
} from "./registrations/measurement-tools.js";
import {
	graphToolRegistration,
	periodicTableToolRegistration,
} from "./registrations/subject-specific-tools.js";
import { ttsToolRegistration } from "./registrations/tts.js";

export interface PackagedToolRegistryOptions {
	/** Override packaged registrations by toolId. */
	overrides?: Partial<Record<string, ToolRegistration>>;
	/** Override or extend the packaged element tag mapping. */
	toolTagMap?: Partial<ToolTagMap>;
	/** Override the component factory per tool. */
	toolComponentFactories?: Partial<ToolComponentFactoryMap>;
	/**
	 * Module loaders keyed by toolId, each loading its tool's element on first
	 * render. Defaults to `DEFAULT_TOOL_MODULE_LOADERS`; a map replaces it, so a
	 * host that defines its tool elements itself passes `{}`.
	 */
	toolModuleLoaders?: Partial<Record<string, ToolModuleLoader>>;
	/** Restrict registration to specific packaged tool ids. */
	toolIds?: string[];
}

type PreferredPlacementLevel = "section" | "item" | "passage";
type OrderedLevels<Level extends string> = Partial<Record<Level, number>>;

interface PackagedCapabilityDefinition {
	registration: ToolRegistration;
	/** Element delivery. Region capabilities omit both fields. */
	tagName?: string;
	loadModule?: ToolModuleLoader;
	/** Recommended section-player toolbar placement. */
	preferredPlacementOrder?: OrderedLevels<PreferredPlacementLevel>;
	/**
	 * Whether the universal-support preset grants this capability. Explicit
	 * program policy; never inferred from registry membership.
	 */
	universal: boolean;
}

const loadSideEffectModule = (load: () => Promise<unknown>): Promise<void> =>
	load().then(() => undefined);

// One element serves every calculator provider; the toolkit picks the provider
// from `tools.providers.calculator` when the element mounts.
const loadCalculatorModule = (): Promise<void> =>
	globalThis.customElements?.get("pie-tool-calculator")
		? Promise.resolve()
		: loadSideEffectModule(
				() => import("@pie-players/pie-tool-calculator-shared/calculator-element"),
			);

const loadTtsModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-tts-inline"));
const loadRulerModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-ruler"));
const loadProtractorModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-protractor"));
const loadAnswerEliminatorModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-answer-eliminator"));
const loadAnnotationToolbarModule = () =>
	loadSideEffectModule(
		() => import("@pie-players/pie-tool-annotation-toolbar"),
	);
const loadLineReaderModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-line-reader"));
const loadThemeModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-theme"));
const loadGraphModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-graph"));
const loadPeriodicTableModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-periodic-table"));
const loadDictionaryModule = () =>
	loadSideEffectModule(() => import("@pie-players/pie-tool-dictionary"));
const loadPictureDictionaryModule = () =>
	loadSideEffectModule(
		() => import("@pie-players/pie-tool-picture-dictionary"),
	);

const PACKAGED_CAPABILITY_DEFINITIONS = [
	{
		registration: calculatorToolRegistration,
		tagName: "pie-tool-calculator",
		loadModule: loadCalculatorModule,
		preferredPlacementOrder: { item: 10 },
		universal: true,
	},
	{
		registration: ttsToolRegistration,
		tagName: "pie-tool-tts-inline",
		loadModule: loadTtsModule,
		preferredPlacementOrder: { item: 20, passage: 10 },
		universal: true,
	},
	{
		registration: rulerToolRegistration,
		tagName: "pie-tool-ruler",
		loadModule: loadRulerModule,
		preferredPlacementOrder: { section: 50 },
		universal: true,
	},
	{
		registration: protractorToolRegistration,
		tagName: "pie-tool-protractor",
		loadModule: loadProtractorModule,
		preferredPlacementOrder: { section: 60 },
		universal: true,
	},
	{
		registration: answerEliminatorToolRegistration,
		tagName: "pie-tool-answer-eliminator",
		loadModule: loadAnswerEliminatorModule,
		preferredPlacementOrder: { item: 30 },
		universal: true,
	},
	{
		registration: lineReaderToolRegistration,
		tagName: "pie-tool-line-reader",
		loadModule: loadLineReaderModule,
		preferredPlacementOrder: { section: 40 },
		universal: true,
	},
	{
		registration: themeToolRegistration,
		tagName: "pie-tool-theme",
		loadModule: loadThemeModule,
		preferredPlacementOrder: { section: 10 },
		universal: true,
	},
	{
		registration: annotationToolbarRegistration,
		tagName: "pie-tool-annotation-toolbar",
		loadModule: loadAnnotationToolbarModule,
		preferredPlacementOrder: { item: 40, passage: 20 },
		universal: true,
	},
	{
		registration: graphToolRegistration,
		tagName: "pie-tool-graph",
		loadModule: loadGraphModule,
		preferredPlacementOrder: { section: 20 },
		universal: true,
	},
	{
		registration: periodicTableToolRegistration,
		tagName: "pie-tool-periodic-table",
		loadModule: loadPeriodicTableModule,
		preferredPlacementOrder: { section: 30 },
		universal: true,
	},
	{
		registration: dictionaryToolRegistration,
		tagName: "pie-tool-dictionary",
		loadModule: loadDictionaryModule,
		preferredPlacementOrder: { section: 70 },
		// A dictionary is a granted accommodation, and on a vocabulary item it is
		// construct-relevant, so it is never universal.
		universal: false,
	},
	{
		registration: pictureDictionaryToolRegistration,
		tagName: "pie-tool-picture-dictionary",
		loadModule: loadPictureDictionaryModule,
		preferredPlacementOrder: { section: 80 },
		universal: false,
	},
	// The Spanish variants render the same elements under their own capability ids, so a
	// programme can grant a Spanish gloss beside the content-following dictionary or
	// instead of it. Ordered after both, since English-content delivery is the common case.
	{
		registration: spanishDictionaryToolRegistration,
		tagName: "pie-tool-dictionary",
		loadModule: loadDictionaryModule,
		preferredPlacementOrder: { section: 90 },
		universal: false,
	},
	{
		registration: spanishPictureDictionaryToolRegistration,
		tagName: "pie-tool-picture-dictionary",
		loadModule: loadPictureDictionaryModule,
		preferredPlacementOrder: { section: 100 },
		universal: false,
	},
	{
		registration: audioTranscriptRegistration,
		universal: false,
	},
] as const satisfies readonly PackagedCapabilityDefinition[];

const PREFERRED_PLACEMENT_LEVELS = ["section", "item", "passage"] as const;

function assertUniqueWeights(
	definitions: readonly PackagedCapabilityDefinition[],
	levels: readonly string[],
	read: (
		definition: PackagedCapabilityDefinition,
	) => Partial<Record<string, number>> | undefined,
	field: string,
): void {
	for (const level of levels) {
		const seen = new Set<number>();
		for (const definition of definitions) {
			const weight = read(definition)?.[level];
			if (weight === undefined) continue;
			if (!Number.isSafeInteger(weight) || weight < 0) {
				throw new Error(
					`Invalid packaged capability "${definition.registration.toolId}": ${field}.${level} must be a non-negative integer.`,
				);
			}
			if (seen.has(weight)) {
				throw new Error(
					`Invalid packaged capability composition: duplicate ${field}.${level} order ${weight}.`,
				);
			}
			seen.add(weight);
		}
	}
}

function assertComposition(
	definitions: readonly PackagedCapabilityDefinition[],
): void {
	const toolIds = new Set<string>();

	for (const definition of definitions) {
		const { registration } = definition;
		if (!registration.toolId.trim()) {
			throw new Error(
				"Invalid packaged capability composition: tool ids must be non-empty.",
			);
		}
		if (toolIds.has(registration.toolId)) {
			throw new Error(
				`Invalid packaged capability composition: duplicate tool id "${registration.toolId}".`,
			);
		}
		toolIds.add(registration.toolId);

		const isRegion = registration.activation === "region";
		if (isRegion) {
			if (
				definition.tagName !== undefined ||
				definition.loadModule !== undefined ||
				Object.keys(definition.preferredPlacementOrder ?? {}).length > 0
			) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": a region capability is surface-hosted and cannot declare element delivery or toolbar placement.`,
				);
			}
		} else {
			if (!definition.tagName?.includes("-")) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": element-backed capabilities need a custom-element tag.`,
				);
			}
			if (typeof definition.loadModule !== "function") {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": element-backed capabilities need a lazy loader.`,
				);
			}
		}

		if (registration.requiresAuthoredContent && definition.universal) {
			throw new Error(
				`Invalid packaged capability "${registration.toolId}": a content-dependent capability cannot be universally granted.`,
			);
		}

		for (const level of PREFERRED_PLACEMENT_LEVELS) {
			if (
				definition.preferredPlacementOrder?.[level] !== undefined &&
				!registration.supportedLevels.includes(level)
			) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": preferred placement "${level}" is not supported by its registration.`,
				);
			}
		}
	}

	assertUniqueWeights(
		definitions,
		PREFERRED_PLACEMENT_LEVELS,
		(definition) => definition.preferredPlacementOrder,
		"preferredPlacementOrder",
	);
}

function orderedToolIds<Level extends string>(
	definitions: readonly PackagedCapabilityDefinition[],
	level: Level,
	read: (
		definition: PackagedCapabilityDefinition,
	) => Partial<Record<Level, number>> | undefined,
): string[] {
	return definitions
		.flatMap((definition) => {
			const order = read(definition)?.[level];
			return order === undefined ? [] : [{ definition, order }];
		})
		.sort((left, right) => left.order - right.order)
		.map(({ definition }) => definition.registration.toolId);
}

class PackagedCapabilityComposition {
	readonly registrations: readonly ToolRegistration[];
	readonly toolTagMap: Readonly<ToolTagMap>;
	readonly moduleLoaders: Readonly<Record<string, ToolModuleLoader>>;
	readonly preferredPlacement: Readonly<
		Record<PreferredPlacementLevel, readonly string[]>
	>;
	readonly universalSupportIds: readonly string[];

	constructor(
		private readonly definitions: readonly PackagedCapabilityDefinition[],
	) {
		this.registrations = Object.freeze(
			definitions.map(({ registration }) => registration),
		);
		this.toolTagMap = Object.freeze(
			Object.fromEntries(
				definitions.flatMap((definition) =>
					definition.tagName
						? [[definition.registration.toolId, definition.tagName]]
						: [],
				),
			),
		);
		this.moduleLoaders = Object.freeze(
			Object.fromEntries(
				definitions.flatMap((definition) =>
					definition.loadModule
						? [[definition.registration.toolId, definition.loadModule]]
						: [],
				),
			),
		);
		const preferredIds = (level: PreferredPlacementLevel) =>
			Object.freeze(
				orderedToolIds(
					definitions,
					level,
					({ preferredPlacementOrder }) => preferredPlacementOrder,
				),
			);
		this.preferredPlacement = Object.freeze({
			section: preferredIds("section"),
			item: preferredIds("item"),
			passage: preferredIds("passage"),
		});
		this.universalSupportIds = Object.freeze(
			definitions
				.filter((definition) => definition.universal)
				.map(({ registration }) => registration.toolId)
				.sort(),
		);
	}

	private selectRegistrations(
		toolIds?: readonly string[],
	): readonly ToolRegistration[] {
		// Preserve the established fail-soft host behavior: no selection means all,
		// and unknown ids are ignored rather than preventing known tools from loading.
		if (!toolIds?.length) return this.registrations;
		const selected = new Set(toolIds);
		return this.registrations.filter(({ toolId }) => selected.has(toolId));
	}

	createRegistry(options: PackagedToolRegistryOptions = {}): ToolRegistry {
		const registry = new ToolRegistry();
		for (const registration of this.selectRegistrations(options.toolIds)) {
			registry.register(options.overrides?.[registration.toolId] ?? registration);
		}

		registry.setToolModuleLoaders({
			...(options.toolModuleLoaders ?? this.moduleLoaders),
		});

		registry.setComponentOverrides({
			toolTagMap: {
				...this.toolTagMap,
				...(options.toolTagMap ?? {}),
			},
			toolComponentFactories: options.toolComponentFactories,
		});
		return registry;
	}

	createUniversalPersonalNeedsProfile(): PersonalNeedsProfile {
		return {
			supports: [...this.universalSupportIds],
			prohibitedSupports: [],
		};
	}
}

/**
 * Release/build gate for PIE-authored composition data.
 *
 * Deliberately not called by the browser runtime: an invariant regression must
 * stop the package before publication, not turn into an import-time exception
 * that prevents an otherwise usable assessment from rendering.
 */
export function assertPackagedCapabilityComposition(): void {
	assertComposition(PACKAGED_CAPABILITY_DEFINITIONS);
}

/** Internal deep-module instance. Root exports below are its stable facade. */
const packagedCapabilityComposition = new PackagedCapabilityComposition(
	PACKAGED_CAPABILITY_DEFINITIONS,
);

export const PACKAGED_TOOL_REGISTRATIONS: readonly ToolRegistration[] = [
	...packagedCapabilityComposition.registrations,
];

export const PACKAGED_TOOL_TAG_MAP: ToolTagMap = {
	...packagedCapabilityComposition.toolTagMap,
};

export const DEFAULT_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	...packagedCapabilityComposition.moduleLoaders,
};

export const SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT = {
	section: [...packagedCapabilityComposition.preferredPlacement.section],
	item: [...packagedCapabilityComposition.preferredPlacement.item],
	passage: [...packagedCapabilityComposition.preferredPlacement.passage],
};

/** Create a registry holding the packaged PIE capabilities. */
export function createPackagedToolRegistry(
	options: PackagedToolRegistryOptions = {},
): ToolRegistry {
	return packagedCapabilityComposition.createRegistry(options);
}

/**
 * A fresh profile granting the packaged set's universal capabilities, sorted by
 * tool id. Which capabilities are universal is program policy declared on each
 * definition; registry membership never implies it.
 */
export function createUniversalPersonalNeedsProfile(): PersonalNeedsProfile {
	return packagedCapabilityComposition.createUniversalPersonalNeedsProfile();
}

/**
 * A fresh profile granting and prohibiting nothing. The toolkit ships no
 * populated default: a deployment's universal set is program policy, which
 * `createUniversalPersonalNeedsProfile` carries as data for hosts that adopt it.
 */
export function createEmptyPersonalNeedsProfile(): PersonalNeedsProfile {
	return { supports: [], prohibitedSupports: [] };
}

