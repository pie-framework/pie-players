/**
 * Dictionary Tool Registrations
 *
 * Word lookup and picture (symbol) lookup, each a floating panel opened from the
 * toolbar.
 *
 * Neither declares a universal support id. A dictionary is a granted accommodation,
 * not a universal affordance: on a vocabulary item it is construct-relevant, so
 * handing it to every learner by default would change what the item measures. A
 * programme grants it through the PNP like any other accommodation.
 *
 * Both panels also accept a `term` from whatever selection affordance a host offers,
 * but neither depends on one. A sighted keyboard-only learner cannot originate a text
 * selection in non-editable content — Chromium does not extend one with Shift+Arrow
 * there without caret browsing, an OS toggle absent on mobile — so a selection-only
 * dictionary is unreachable for them. The panel's own field is the keyboard route.
 */

import type {
	ToolContext,
	ToolRegistration,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
	ToolComponentOverrides,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	createScopedVisibilityBinding,
	createToolElement,
	hasReadableText,
	syncButtonAndOverlayVisibility,
} from "@pie-players/pie-assessment-toolkit/tools/internal";

/** The element props these panels read for their host-supplied lookup. */
type DictionaryPanelElement = HTMLElement & {
	visible?: boolean;
	toolId?: string;
	term?: string;
	endpoint?: string;
	language?: string;
	lookup?: unknown;
};

/**
 * Apply the host's per-tool render params to the panel.
 *
 * `lookup` wins over `endpoint` when a host supplies both, matching the element's own
 * precedence: a host that already has a client should not also have to describe its
 * HTTP shape. Absent both, the panel renders its unconfigured state — PIE ships no
 * dictionary endpoint, because the corpus behind one is licensed per programme.
 */
function applyLookupParams(
	element: DictionaryPanelElement,
	toolId: string,
	toolbarContext: ToolbarContext,
): void {
	const params = toolbarContext.getToolRenderParams?.(toolId) ?? {};
	if (typeof params.endpoint === "string") element.endpoint = params.endpoint;
	if (typeof params.lookup === "function") element.lookup = params.lookup;
	// The reading language comes from the toolbar's own scope unless the host names one
	// for this tool, so a service returning localised entries gets the right tag without
	// the host having to repeat itself.
	const language =
		typeof params.language === "string" ? params.language : toolbarContext.language;
	if (typeof language === "string" && language) element.language = language;
}

function renderDictionaryPanel(args: {
	registration: ToolRegistration;
	context: ToolContext;
	toolbarContext: ToolbarContext;
	ariaLabel: string;
	shellTitle: string;
	initialWidth: number;
	initialHeight: number;
	minWidth: number;
	minHeight: number;
}): ToolToolbarRenderResult {
	const { registration, context, toolbarContext } = args;
	const visibility = createScopedVisibilityBinding(
		registration.toolId,
		toolbarContext,
	);
	const button: ToolToolbarButtonDefinition = {
		toolId: registration.toolId,
		label: registration.name,
		icon:
			typeof registration.icon === "function"
				? registration.icon(context)
				: registration.icon,
		disabled: false,
		ariaLabel: args.ariaLabel,
		tooltip: registration.name,
		onClick: () => toolbarContext.toggleTool(registration.toolId),
		active: visibility.isActive(),
	};
	const componentOverrides =
		(toolbarContext.componentOverrides as ToolComponentOverrides | undefined) ??
		{};
	const overlay = createToolElement(
		registration.toolId,
		context,
		toolbarContext,
		componentOverrides,
	) as DictionaryPanelElement;
	overlay.setAttribute("tool-id", visibility.fullToolId);
	applyLookupParams(overlay, registration.toolId, toolbarContext);

	return {
		toolId: registration.toolId,
		button,
		elements: [
			{
				element: overlay,
				mount: "after-buttons",
				shell: {
					title: args.shellTitle,
					draggable: true,
					resizable: true,
					closeable: true,
					initialWidth: args.initialWidth,
					initialHeight: args.initialHeight,
					minWidth: args.minWidth,
					minHeight: args.minHeight,
				},
			},
		],
		// Re-read params on sync rather than closing over them: a host calling
		// `updateToolConfig` mid-session changes the endpoint without remounting, and a
		// remount would discard the learner's current lookup.
		sync: () => {
			syncButtonAndOverlayVisibility({
				button,
				overlay,
				isActive: visibility.isActive,
			});
			applyLookupParams(overlay, registration.toolId, toolbarContext);
		},
		subscribeActive: visibility.subscribeActive,
	};
}

/**
 * Dictionary tool registration
 *
 * Word definitions from a host-supplied service.
 */
export const dictionaryToolRegistration: ToolRegistration = {
	toolId: "dictionary",
	name: "Dictionary",
	description: "Look up word definitions",
	icon: "book-open",

	// Text can appear at any of these; the panel itself floats at section scope.
	supportedLevels: ["section", "item", "passage", "rubric"],

	// PNP support IDs
	// Maps to AfA PNP 3.0 / QTI 3.0 dictionary support, plus the common variants a
	// host profile is likely to carry.
	pnpSupportIds: [
		"dictionary", // Canonical id
		"englishDictionary", // Common variant
		"glossary", // Common variant
		"definitions", // Common variant
	],

	/** Pass 2: a dictionary is relevant wherever there is text to look words up from. */
	isVisibleInContext(context: ToolContext): boolean {
		return hasReadableText(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		return renderDictionaryPanel({
			registration: this,
			context,
			toolbarContext,
			ariaLabel: "Dictionary - Look up word definitions",
			shellTitle: this.name,
			initialWidth: 420,
			initialHeight: 380,
			minWidth: 300,
			minHeight: 240,
		});
	},
};

/**
 * Picture Dictionary tool registration
 *
 * Symbol or picture lookup from a host-supplied service. Sized wider than the word
 * dictionary because its results are a grid rather than a column of text.
 */
export const pictureDictionaryToolRegistration: ToolRegistration = {
	toolId: "pictureDictionary",
	name: "Picture Dictionary",
	description: "Look up pictures for words",
	icon: "photo",

	supportedLevels: ["section", "item", "passage", "rubric"],

	// PNP support IDs
	// AfA PNP 3.0 names an illustrated equivalent of a glossary; the variants cover
	// what host profiles call it in practice.
	pnpSupportIds: [
		"pictureDictionary", // Canonical id
		"illustratedGlossary", // Common variant
		"symbolDictionary", // Common variant
		"pictureSupport", // Common variant
	],

	isVisibleInContext(context: ToolContext): boolean {
		return hasReadableText(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		return renderDictionaryPanel({
			registration: this,
			context,
			toolbarContext,
			ariaLabel: "Picture Dictionary - Look up pictures for words",
			shellTitle: this.name,
			initialWidth: 520,
			initialHeight: 460,
			minWidth: 340,
			minHeight: 300,
		});
	},
};
