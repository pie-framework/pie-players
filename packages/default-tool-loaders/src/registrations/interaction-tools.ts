/**
 * Interaction Tools Registrations
 *
 * Registers tools for interacting with question content:
 * - Answer Eliminator (strike through answer choices)
 */

import type {
	ToolConfigDiagnostic,
	ToolProviderConfig,
	ToolRegistration,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/registration";
import { elementSupports } from "@pie-players/pie-assessment-toolkit/tools/registration";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import {
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import { resolveOverlayElement } from "./overlay-element-cache.js";

type EliminationStrategy = "strikethrough" | "mask";

/** The policy parameters' `strategy`, defaulting to strikethrough. */
const normalizeEliminationStrategy = (value: unknown): EliminationStrategy =>
	value === "mask" ? "mask" : "strikethrough";

/** The AfA PNP 3.0 support term an element declares to take the eliminator. */
const ANSWER_MASKING = "answer-masking";

/**
 * The answer eliminator's `tools.providers.answerEliminator` entry.
 */
export interface AnswerEliminatorToolConfig extends ToolProviderConfig {
	/**
	 * The elements the eliminator acts on, by the name `<name>` of their
	 * `@pie-element/<name>` package, such as `["multiple-choice"]`. An element
	 * must also support answer masking. Omitted, every element that supports it
	 * takes the eliminator; empty, none does. A host lists the elements whose
	 * support it has vetted.
	 */
	elements?: readonly string[];
}

/**
 * pie-item contract compatibility: legacy pie-elements, and pie-elements-ng
 * releases from before elements declared their supports, render the markup the
 * eliminator's built-in adapters read for these two. An element that declares
 * its supports is decided by its declaration, these two included.
 */
const UNDECLARED_ANSWER_MASKING_ELEMENTS = new Set(["multiple-choice", "ebsr"]);

function elementName(tag: string): string {
	return tag
		.toLowerCase()
		.replace(/--version-[0-9a-z-]+$/, "")
		.replace(/^pie-(element-)?/, "");
}

// Content names one element several ways: `multiple-choice`,
// `pie-multiple-choice`, `pie-element-multiple-choice`, a runtime `--version-*`
// tag, or any tag the item's `elements` map binds to `@pie-element/multiple-choice`.
function elementNames(tag: string, packageSpec: string | undefined): string[] {
	const names = [elementName(tag)];
	const packageName = pieElementPackageName(packageSpec);
	if (packageName) names.push(packageName);
	return names;
}

function pieElementPackageName(packageSpec: string | undefined): string | null {
	return packageSpec?.match(/^@pie-element\/([^@]+)/)?.[1]?.toLowerCase() ?? null;
}

/**
 * The name an `elements` list matches: the `@pie-element/<name>` package the
 * item binds the tag to, else the tag's own name. A tag bound to another
 * package matches no name, whatever the tag says.
 */
function listedName(tag: string, packageSpec: string | undefined): string | null {
	return packageSpec ? pieElementPackageName(packageSpec) : elementName(tag);
}

/**
 * The element names `config.elements` allows, or `null` for every element. An
 * `elements` that is not a list allows none: validation reports it, and an
 * element a host has not vetted stays without the eliminator.
 */
function allowedElementNames(
	config: ToolProviderConfig | null | undefined,
): Set<string> | null {
	const elements = (config as AnswerEliminatorToolConfig | null | undefined)
		?.elements;
	if (elements === undefined) return null;
	if (!Array.isArray(elements)) return new Set();
	return new Set(
		elements
			.filter((name): name is string => typeof name === "string")
			.map(elementName),
	);
}

/**
 * The model ids of the context's elements that support answer masking and the
 * host config allows.
 */
function answerMaskingElementIds(
	context: ToolContext,
	config: ToolProviderConfig | null | undefined,
): string[] {
	const allowed = allowedElementNames(config);
	return elementSupports(context)
		.filter(({ supports, tag, packageSpec }) => {
			if (allowed) {
				const name = listedName(tag, packageSpec);
				if (name === null || !allowed.has(name)) return false;
			}
			return supports
				? supports.includes(ANSWER_MASKING)
				: elementNames(tag, packageSpec).some((name) =>
						UNDECLARED_ANSWER_MASKING_ELEMENTS.has(name),
					);
		})
		.flatMap(({ elementId }) => (elementId ? [elementId] : []));
}

function validateAnswerEliminatorConfig(
	config: ToolProviderConfig,
): ToolConfigDiagnostic[] {
	const { elements } = config as AnswerEliminatorToolConfig;
	if (elements === undefined) return [];
	if (
		Array.isArray(elements) &&
		elements.every((name) => typeof name === "string" && name.trim() !== "")
	) {
		return [];
	}
	return [
		{
			code: "tools.invalidProviderConfig",
			severity: "error",
			path: "providers.answerEliminator.elements",
			message:
				'`elements` must be a list of element names, such as ["multiple-choice"].',
		},
	];
}

/** The state-store key of each PIE element in the item, by model id. */
function resolveElementStateKeys(
	context: ToolContext,
	toolbarContext: ToolbarContext,
): Record<string, string> {
	const keys: Record<string, string> = {};
	if (!("item" in context) || !toolbarContext.getGlobalElementId) return keys;
	for (const model of context.item?.config?.models ?? []) {
		const elementId = model?.id;
		if (typeof elementId !== "string" || !elementId) continue;
		const key = toolbarContext.getGlobalElementId(elementId);
		if (key) keys[elementId] = key;
	}
	return keys;
}

/**
 * Answer Eliminator tool registration
 *
 * Allows students to strike through incorrect answer choices.
 * Only appears on items with an element that supports answer masking.
 */
export const answerEliminatorToolRegistration: ToolRegistration = {
	toolId: "answerEliminator",
	name: "Answer Eliminator",
	description: "Strike through answer choices",
	nameKey: "tools.answerEliminator.name",
	descriptionKey: "tools.answerEliminator.description",
	icon: "strikethrough",

	supportedLevels: ["item"],

	validateConfig: validateAnswerEliminatorConfig,

	/**
	 * Pass 2: relevant where an element supports answer masking. An element
	 * declares it on its class, and the answer eliminator's README says what the
	 * element then supplies.
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return answerMaskingElementIds(context, null).length > 0;
	},

	/**
	 * Pass 3: the same question, asked as a capability and narrowed to the
	 * elements the host config allows. Elimination controls are rendered per
	 * choice, so an item none of whose allowed elements supports answer masking
	 * gives this tool nothing to act on. Answering the relevance gate alone left
	 * the button on such items for any learner whose profile grants answer
	 * masking.
	 */
	isApplicableToContent(
		context: ToolContext,
		config?: ToolProviderConfig,
	): boolean {
		return answerMaskingElementIds(context, config).length > 0;
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const visibility = createScopedVisibilityBinding(
			this.toolId,
			toolbarContext,
		);
		const componentOverrides =
			(toolbarContext.componentOverrides as
				| ToolComponentOverrides
				| undefined) ?? {};
		const overlay = resolveOverlayElement(
			toolbarContext,
			visibility.fullToolId,
			() =>
				createToolElement(
					this.toolId,
					context,
					toolbarContext,
					componentOverrides,
				) as HTMLElement & {
					visible?: boolean;
					elementStateKeys?: Record<string, string>;
					elementIds?: readonly string[];
				},
		);
		overlay.setAttribute("button-alignment", "inline");
		overlay.setAttribute(
			"strategy",
			normalizeEliminationStrategy(
				toolbarContext.getToolParameters?.("answerEliminator")?.strategy,
			),
		);

		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M19,3H16.3H7.7H5A2,2 0 0,0 3,5V7.7V16.4V19A2,2 0 0,0 5,21H7.7H16.4H19A2,2 0 0,0 21,19V16.3V7.7V5A2,2 0 0,0 19,3M15.6,17L12,13.4L8.4,17L7,15.6L10.6,12L7,8.4L8.4,7L12,10.6L15.6,7L17,8.4L13.4,12L17,15.6L15.6,17Z"/></svg>',
			disabled: false,
			ariaLabel: toolbarContext.i18n.t("tools.answerEliminator.buttonA11y"),
			tooltip: toolbarContext.i18n.t("tools.answerEliminator.tooltip"),
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: visibility.isActive(),
		};

		return {
			toolId: this.toolId,
			button,
			elements: [{ element: overlay, mount: "after-buttons" }],
			sync: () => {
				syncButtonAndOverlayVisibility({
					button,
					overlay,
					isActive: visibility.isActive,
				});
				overlay.elementStateKeys = resolveElementStateKeys(
					context,
					toolbarContext,
				);
				const config =
					toolbarContext.toolkitCoordinator?.getToolConfig(this.toolId) ??
					null;
				overlay.elementIds =
					allowedElementNames(config) === null
						? undefined
						: answerMaskingElementIds(context, config);
			},
			subscribeActive: visibility.subscribeActive,
		};
	},
};
