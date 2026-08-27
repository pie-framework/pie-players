/**
 * The one authored description of PIE's packaged capability composition.
 *
 * Registrations describe what a capability can do. This module owns the
 * deployment decisions around them: element tags, lazy module bootstrap sets,
 * placement presets, toolbar order and the explicit universal-support policy.
 * Public constants are projections of this composition so adding a capability
 * cannot leave a second hand-maintained catalogue silently behind.
 */

import {
	ToolRegistry,
	type ToolComponentFactory,
	type ToolComponentFactoryMap,
	type ToolRegistration,
	type ToolTagMap,
	type ToolProviderConfig,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { PersonalNeedsProfile } from "@pie-players/pie-players-shared/types";
import {
	annotationToolbarRegistration,
	lineReaderToolRegistration,
	themeToolRegistration,
} from "./registrations/accessibility-tools.js";
import { audioTranscriptRegistration } from "./registrations/audio-transcript.js";
import {
	calculatorToolRegistration,
	type CalculatorProviderId,
	resolveCalculatorProviderId,
} from "./registrations/calculator.js";
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

export type ToolModuleLoader = () => Promise<unknown>;

export interface ToolRegistryLike {
	setToolModuleLoaders(
		loaders: Partial<Record<string, ToolModuleLoader>>,
	): void;
}

export interface PackagedCalculatorCompositionOptions {
	/**
	 * The same calculator config supplied at `tools.providers.calculator`.
	 * Selects the matching packaged element and default loader. Omit it to retain
	 * the existing Desmos delivery.
	 */
	calculatorProviderConfig?: ToolProviderConfig;
}

export interface PackagedToolRegistryOptions
	extends PackagedCalculatorCompositionOptions {
	/** Override packaged registrations by toolId. */
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

export interface RegisterDefaultToolModuleLoadersOptions
	extends PackagedCalculatorCompositionOptions {
	loaders?: Partial<Record<string, ToolModuleLoader>>;
}

type LoaderTarget = "item" | "section";
type PackagedPlacementLevel =
	| "assessment"
	| "section"
	| "item"
	| "passage"
	| "rubric"
	| "element";
type PreferredPlacementLevel = "section" | "item" | "passage";
type OrderedLevels<Level extends string> = Partial<Record<Level, number>>;

interface PackagedCapabilityDefinition {
	registration: ToolRegistration;
	/** Element delivery. Region capabilities deliberately omit all three fields. */
	tagName?: string;
	loadModule?: ToolModuleLoader;
	loaderTargets?: readonly LoaderTarget[];
	/** Existing exhaustive placement preset, including its extended level names. */
	placementOrder?: OrderedLevels<PackagedPlacementLevel>;
	/** Recommended section-player toolbar placement. */
	preferredPlacementOrder?: OrderedLevels<PreferredPlacementLevel>;
	/** Order among capabilities that can render a toolbar affordance. */
	toolbarOrder?: number;
	/** Explicit program policy; never inferred from registry membership. */
	universalSupportIds: readonly string[];
}

const loadSideEffectModule = (load: () => Promise<unknown>): Promise<void> =>
	load().then(() => undefined);

function loadCalculatorElement(
	tagName: string,
	load: () => Promise<unknown>,
): Promise<unknown> {
	if (
		typeof globalThis !== "undefined" &&
		"customElements" in globalThis &&
		globalThis.customElements?.get(tagName)
	) {
		return Promise.resolve();
	}
	return loadSideEffectModule(load);
}

const loadDesmosCalculatorModule = () =>
	loadCalculatorElement(
		"pie-tool-calculator",
		() => import("@pie-players/pie-tool-calculator-desmos"),
	);
const loadGeoGebraCalculatorModule = () =>
	loadCalculatorElement(
		"pie-tool-calculator-geogebra",
		() => import("@pie-players/pie-tool-calculator-geogebra"),
	);

const CALCULATOR_DELIVERY: Record<
	CalculatorProviderId,
	{ tagName: string; loadModule: ToolModuleLoader }
> = {
	"calculator-desmos": {
		tagName: "pie-tool-calculator",
		loadModule: loadDesmosCalculatorModule,
	},
	"calculator-geogebra": {
		tagName: "pie-tool-calculator-geogebra",
		loadModule: loadGeoGebraCalculatorModule,
	},
};

function resolveCalculatorDelivery(config?: ToolProviderConfig) {
	return CALCULATOR_DELIVERY[resolveCalculatorProviderId(config)];
}

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
		tagName: CALCULATOR_DELIVERY["calculator-desmos"].tagName,
		loadModule: CALCULATOR_DELIVERY["calculator-desmos"].loadModule,
		loaderTargets: ["item", "section"],
		placementOrder: { element: 10 },
		preferredPlacementOrder: { item: 10 },
		toolbarOrder: 20,
		universalSupportIds: [
			"calculator",
			"graphingCalculator",
			"basicCalculator",
			"scientificCalculator",
		],
	},
	{
		registration: ttsToolRegistration,
		tagName: "pie-tool-text-to-speech",
		loadModule: loadTtsModule,
		loaderTargets: ["item"],
		placementOrder: { item: 10, passage: 10, rubric: 10, element: 30 },
		preferredPlacementOrder: { item: 20, passage: 10 },
		toolbarOrder: 30,
		universalSupportIds: ["textToSpeech", "readAloud", "tts", "speechOutput"],
	},
	{
		registration: rulerToolRegistration,
		tagName: "pie-tool-ruler",
		loadModule: loadRulerModule,
		loaderTargets: ["section"],
		placementOrder: { element: 40 },
		preferredPlacementOrder: { section: 50 },
		toolbarOrder: 80,
		universalSupportIds: ["ruler", "measurement"],
	},
	{
		registration: protractorToolRegistration,
		tagName: "pie-tool-protractor",
		loadModule: loadProtractorModule,
		loaderTargets: ["section"],
		placementOrder: { element: 50 },
		preferredPlacementOrder: { section: 60 },
		toolbarOrder: 90,
		universalSupportIds: ["protractor", "angleMeasurement"],
	},
	{
		registration: answerEliminatorToolRegistration,
		tagName: "pie-tool-answer-eliminator",
		loadModule: loadAnswerEliminatorModule,
		loaderTargets: ["item"],
		placementOrder: { element: 20 },
		preferredPlacementOrder: { item: 30 },
		toolbarOrder: 70,
		universalSupportIds: [
			"answerMasking",
			"answerEliminator",
			"strikethrough",
			"choiceMasking",
		],
	},
	{
		registration: lineReaderToolRegistration,
		tagName: "pie-tool-line-reader",
		loadModule: loadLineReaderModule,
		loaderTargets: ["section"],
		placementOrder: { passage: 40, rubric: 40 },
		preferredPlacementOrder: { section: 40 },
		toolbarOrder: 40,
		universalSupportIds: [
			"readingMask",
			"readingGuide",
			"readingRuler",
			"lineReader",
			"trackingGuide",
		],
	},
	{
		registration: themeToolRegistration,
		tagName: "pie-tool-theme",
		loadModule: loadThemeModule,
		loaderTargets: ["item"],
		placementOrder: { assessment: 10, section: 10 },
		preferredPlacementOrder: { section: 10 },
		toolbarOrder: 10,
		universalSupportIds: [
			"highContrastDisplay",
			"colorContrast",
			"invertColors",
			"theme",
			"highContrast",
			"customColors",
		],
	},
	{
		registration: annotationToolbarRegistration,
		tagName: "pie-tool-annotation-toolbar",
		loadModule: loadAnnotationToolbarModule,
		loaderTargets: ["item"],
		placementOrder: { item: 30, passage: 30, rubric: 30, element: 70 },
		preferredPlacementOrder: { item: 40, passage: 20 },
		toolbarOrder: 50,
		// The last three came from the `highlighter` capability, which mounted this
		// same element behind a second identically-labelled button. Kept here so a
		// profile granted one of the older ids still gets highlighting.
		universalSupportIds: [
			"highlighting",
			"annotations",
			"highlighter",
			"textHighlight",
			"annotation",
		],
	},
	{
		registration: graphToolRegistration,
		tagName: "pie-tool-graph",
		loadModule: loadGraphModule,
		loaderTargets: ["section"],
		placementOrder: { item: 40, element: 80 },
		preferredPlacementOrder: { section: 20 },
		toolbarOrder: 100,
		universalSupportIds: ["graph", "coordinatePlane", "graphingTool"],
	},
	{
		registration: periodicTableToolRegistration,
		tagName: "pie-tool-periodic-table",
		loadModule: loadPeriodicTableModule,
		loaderTargets: ["section"],
		placementOrder: { item: 50, element: 90 },
		preferredPlacementOrder: { section: 30 },
		toolbarOrder: 110,
		universalSupportIds: [
			"periodicTable",
			"chemistryReference",
			"elementReference",
		],
	},
	{
		registration: dictionaryToolRegistration,
		tagName: "pie-tool-dictionary",
		loadModule: loadDictionaryModule,
		loaderTargets: ["section"],
		placementOrder: { item: 60, element: 100 },
		preferredPlacementOrder: { section: 70 },
		toolbarOrder: 120,
		// Deliberately empty: a dictionary is a granted accommodation, and on a
		// vocabulary item it is construct-relevant, so it is never universal.
		universalSupportIds: [],
	},
	{
		registration: pictureDictionaryToolRegistration,
		tagName: "pie-tool-picture-dictionary",
		loadModule: loadPictureDictionaryModule,
		loaderTargets: ["section"],
		placementOrder: { item: 70, element: 110 },
		preferredPlacementOrder: { section: 80 },
		toolbarOrder: 130,
		universalSupportIds: [],
	},
	// The Spanish variants render the same elements under their own capability ids, so a
	// programme can grant a Spanish gloss beside the content-following dictionary or
	// instead of it. Ordered after both, since English-content delivery is the common case.
	{
		registration: spanishDictionaryToolRegistration,
		tagName: "pie-tool-dictionary",
		loadModule: loadDictionaryModule,
		loaderTargets: ["section"],
		placementOrder: { item: 80, element: 120 },
		preferredPlacementOrder: { section: 90 },
		toolbarOrder: 140,
		universalSupportIds: [],
	},
	{
		registration: spanishPictureDictionaryToolRegistration,
		tagName: "pie-tool-picture-dictionary",
		loadModule: loadPictureDictionaryModule,
		loaderTargets: ["section"],
		placementOrder: { item: 90, element: 130 },
		preferredPlacementOrder: { section: 100 },
		toolbarOrder: 150,
		universalSupportIds: [],
	},
	{
		registration: audioTranscriptRegistration,
		universalSupportIds: [],
	},
] as const satisfies readonly PackagedCapabilityDefinition[];

const PACKAGED_PLACEMENT_LEVELS = [
	"assessment",
	"section",
	"item",
	"passage",
	"rubric",
	"element",
] as const;
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
	const universalSupportIds = new Set<string>();
	const toolbarOrders = new Set<number>();

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
				definition.loaderTargets !== undefined ||
				definition.toolbarOrder !== undefined ||
				Object.keys(definition.placementOrder ?? {}).length > 0 ||
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
			if (
				typeof definition.loadModule !== "function" ||
				!definition.loaderTargets?.length
			) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": element-backed capabilities need a lazy loader and at least one bootstrap target.`,
				);
			}
			if (
				new Set(definition.loaderTargets).size !==
				definition.loaderTargets.length
			) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": loader bootstrap targets must be unique.`,
				);
			}
			if (definition.toolbarOrder === undefined) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": toolbar capabilities need an order.`,
				);
			}
		}

		if (definition.toolbarOrder !== undefined) {
			if (
				!Number.isSafeInteger(definition.toolbarOrder) ||
				definition.toolbarOrder < 0
			) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": toolbar order must be a non-negative integer.`,
				);
			}
			if (toolbarOrders.has(definition.toolbarOrder)) {
				throw new Error(
					`Invalid packaged capability composition: duplicate toolbar order ${definition.toolbarOrder}.`,
				);
			}
			toolbarOrders.add(definition.toolbarOrder);
		}

		const registrationSupportIds = new Set(
			registration.pnpSupportIds ?? [registration.toolId],
		);
		if (
			registration.requiresAuthoredContent &&
			definition.universalSupportIds.length > 0
		) {
			throw new Error(
				`Invalid packaged capability "${registration.toolId}": content-dependent support ids cannot be universally granted.`,
			);
		}
		for (const supportId of definition.universalSupportIds) {
			if (!supportId.trim()) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": universal support ids must be non-empty.`,
				);
			}
			if (!registrationSupportIds.has(supportId)) {
				throw new Error(
					`Invalid packaged capability "${registration.toolId}": universal support id "${supportId}" is not declared by its registration.`,
				);
			}
			if (universalSupportIds.has(supportId)) {
				throw new Error(
					`Invalid packaged capability composition: universal support id "${supportId}" has more than one owner.`,
				);
			}
			universalSupportIds.add(supportId);
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
		PACKAGED_PLACEMENT_LEVELS,
		(definition) => definition.placementOrder,
		"placementOrder",
	);
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
	readonly itemModuleLoaders: Readonly<Record<string, ToolModuleLoader>>;
	readonly sectionModuleLoaders: Readonly<Record<string, ToolModuleLoader>>;
	readonly defaultModuleLoaders: Readonly<Record<string, ToolModuleLoader>>;
	readonly placement: Readonly<
		Record<PackagedPlacementLevel, readonly string[]>
	>;
	readonly preferredPlacement: Readonly<
		Record<PreferredPlacementLevel, readonly string[]>
	>;
	readonly toolbarOrder: readonly string[];
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
		this.itemModuleLoaders = this.projectModuleLoaders("item");
		this.sectionModuleLoaders = this.projectModuleLoaders("section");
		this.defaultModuleLoaders = Object.freeze({
			...this.itemModuleLoaders,
			...this.sectionModuleLoaders,
		});
		this.placement = Object.freeze(
			Object.fromEntries(
				PACKAGED_PLACEMENT_LEVELS.map((level) => [
					level,
					Object.freeze(
						orderedToolIds(
							definitions,
							level,
							(definition) => definition.placementOrder,
						),
					),
				]),
			) as Record<PackagedPlacementLevel, readonly string[]>,
		);
		this.preferredPlacement = Object.freeze(
			Object.fromEntries(
				PREFERRED_PLACEMENT_LEVELS.map((level) => [
					level,
					Object.freeze(
						orderedToolIds(
							definitions,
							level,
							(definition) => definition.preferredPlacementOrder,
						),
					),
				]),
			) as Record<PreferredPlacementLevel, readonly string[]>,
		);
		this.toolbarOrder = Object.freeze(
			definitions
				.filter((definition) => definition.toolbarOrder !== undefined)
				.slice()
				.sort(
					(left, right) =>
						(left.toolbarOrder as number) - (right.toolbarOrder as number),
				)
				.map(({ registration }) => registration.toolId),
		);
		this.universalSupportIds = Object.freeze(
			definitions
				.flatMap(({ universalSupportIds }) => [...universalSupportIds])
				.sort(),
		);
	}

	private projectModuleLoaders(
		target: LoaderTarget,
	): Readonly<Record<string, ToolModuleLoader>> {
		return Object.freeze(
			Object.fromEntries(
				this.definitions.flatMap((definition) =>
					definition.loadModule && definition.loaderTargets?.includes(target)
						? [[definition.registration.toolId, definition.loadModule]]
						: [],
				),
			),
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

	registerTools(
		registry: ToolRegistry,
		options: RegisterPackagedToolsOptions = {},
	): void {
		const applyOverrides =
			options.applyOverrides ??
			((registration: ToolRegistration) => registration);
		for (const registration of this.selectRegistrations(options.toolIds)) {
			registry.register(applyOverrides(registration));
		}
	}

	createRegistry(options: PackagedToolRegistryOptions = {}): ToolRegistry {
		const registry = new ToolRegistry();
		this.registerTools(registry, {
			toolIds: options.toolIds,
			applyOverrides: (registration) =>
				options.overrides?.[registration.toolId] ?? registration,
		});

		// Loader installation remains opt-in. Some hosts preload tool elements or
		// provide their own tags; silently adding package loads here would change
		// their bundle/runtime behavior.
		if (
			options.toolModuleLoaders &&
			Object.keys(options.toolModuleLoaders).length > 0
		) {
			const toolModuleLoaders = { ...options.toolModuleLoaders };
			const calculatorDelivery = resolveCalculatorDelivery(
				options.calculatorProviderConfig,
			);
			// A host using the packaged default map gets a coherent provider-specific
			// loader. A genuinely custom calculator loader remains the host's override.
			if (
				options.calculatorProviderConfig &&
				toolModuleLoaders.calculator === this.defaultModuleLoaders.calculator
			) {
				toolModuleLoaders.calculator = calculatorDelivery.loadModule;
			}
			registry.setToolModuleLoaders(toolModuleLoaders);
		}

		const calculatorTagMap = options.calculatorProviderConfig
			? {
					calculator: resolveCalculatorDelivery(
						options.calculatorProviderConfig,
					).tagName,
				}
			: {};
		registry.setComponentOverrides({
			toolTagMap: {
				...this.toolTagMap,
				...calculatorTagMap,
				...(options.toolTagMap ?? {}),
			},
			toolComponentFactory: options.toolComponentFactory,
			toolComponentFactories: options.toolComponentFactories,
		});
		return registry;
	}

	createUniversalPersonalNeedsProfile(): PersonalNeedsProfile {
		return {
			supports: [...this.universalSupportIds],
			prohibitedSupports: [],
			activateAtInit: [],
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

export const PACKAGED_TOOL_REGISTRATIONS = [
	...packagedCapabilityComposition.registrations,
] as unknown as readonly [
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
	ToolRegistration,
];

export const PACKAGED_TOOL_TAG_MAP: ToolTagMap = {
	...packagedCapabilityComposition.toolTagMap,
};

export const ITEM_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	...packagedCapabilityComposition.itemModuleLoaders,
};

export const SECTION_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	...packagedCapabilityComposition.sectionModuleLoaders,
};

export const DEFAULT_TOOL_MODULE_LOADERS: Record<string, ToolModuleLoader> = {
	...packagedCapabilityComposition.defaultModuleLoaders,
};

/** Build the packaged loader map for a selected calculator provider. */
export function createDefaultToolModuleLoaders(
	options: PackagedCalculatorCompositionOptions = {},
): Record<string, ToolModuleLoader> {
	return {
		...DEFAULT_TOOL_MODULE_LOADERS,
		calculator: resolveCalculatorDelivery(options.calculatorProviderConfig)
			.loadModule,
	};
}

/** Build the section-bootstrap loader subset for a selected calculator provider. */
export function createSectionToolModuleLoaders(
	options: PackagedCalculatorCompositionOptions = {},
): Record<string, ToolModuleLoader> {
	return {
		...SECTION_TOOL_MODULE_LOADERS,
		calculator: resolveCalculatorDelivery(options.calculatorProviderConfig)
			.loadModule,
	};
}

export const PACKAGED_TOOL_PLACEMENT = {
	assessment: [...packagedCapabilityComposition.placement.assessment],
	section: [...packagedCapabilityComposition.placement.section],
	item: [...packagedCapabilityComposition.placement.item],
	passage: [...packagedCapabilityComposition.placement.passage],
	rubric: [...packagedCapabilityComposition.placement.rubric],
	element: [...packagedCapabilityComposition.placement.element],
} as unknown as {
	readonly assessment: readonly ["theme"];
	readonly section: readonly ["theme"];
	readonly item: readonly [
		"textToSpeech",
		"annotationToolbar",
		"graph",
		"periodicTable",
		"dictionary",
		"pictureDictionary",
		"dictionarySpanish",
		"pictureDictionarySpanish",
	];
	readonly passage: readonly [
		"textToSpeech",
		"annotationToolbar",
		"lineReader",
	];
	readonly rubric: readonly ["textToSpeech", "annotationToolbar", "lineReader"];
	readonly element: readonly [
		"calculator",
		"answerEliminator",
		"textToSpeech",
		"ruler",
		"protractor",
		"annotationToolbar",
		"graph",
		"periodicTable",
		"dictionary",
		"pictureDictionary",
		"dictionarySpanish",
		"pictureDictionarySpanish",
	];
};

export const SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT = {
	section: [...packagedCapabilityComposition.preferredPlacement.section],
	item: [...packagedCapabilityComposition.preferredPlacement.item],
	passage: [...packagedCapabilityComposition.preferredPlacement.passage],
};

export const PACKAGED_TOOL_ORDER = [
	...packagedCapabilityComposition.toolbarOrder,
] as unknown as readonly [
	"theme",
	"calculator",
	"textToSpeech",
	"lineReader",
	"annotationToolbar",
	"answerEliminator",
	"ruler",
	"protractor",
	"graph",
	"periodicTable",
	"dictionary",
	"pictureDictionary",
	"dictionarySpanish",
	"pictureDictionarySpanish",
];

export const UNIVERSAL_SUPPORTS_PRESET: readonly string[] =
	packagedCapabilityComposition.universalSupportIds;

/** Register packaged PIE capabilities onto an existing registry. */
export function registerPackagedTools(
	registry: ToolRegistry,
	options: RegisterPackagedToolsOptions = {},
): void {
	packagedCapabilityComposition.registerTools(registry, options);
}

/** Create a registry holding the packaged PIE capabilities. */
export function createPackagedToolRegistry(
	options: PackagedToolRegistryOptions = {},
): ToolRegistry {
	return packagedCapabilityComposition.createRegistry(options);
}

/** Build a fresh profile granting the explicit universal-support preset. */
export function createUniversalPersonalNeedsProfile(): PersonalNeedsProfile {
	return packagedCapabilityComposition.createUniversalPersonalNeedsProfile();
}

/** Register packaged lazy module loaders, followed by host overrides. */
export function registerDefaultToolModuleLoaders(
	registry: ToolRegistryLike,
	options: RegisterDefaultToolModuleLoadersOptions = {},
): void {
	registry.setToolModuleLoaders({
		...createDefaultToolModuleLoaders(options),
		...(options.loaders ?? {}),
	});
}

/** Register only the section-bootstrap loader subset, then host overrides. */
export function registerSectionToolModuleLoaders(
	registry: ToolRegistryLike,
	options: RegisterDefaultToolModuleLoadersOptions = {},
): void {
	registry.setToolModuleLoaders({
		...createSectionToolModuleLoaders(options),
		...(options.loaders ?? {}),
	});
}
