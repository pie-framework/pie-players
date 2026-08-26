/**
 * Accessibility Tools Registrations
 *
 * Registers tools for visual accessibility and reading support:
 * - Line Reader (reading guide)
 * - Color Scheme (theme/contrast)
 * - Annotation Toolbar (text highlighting)
 *
 * Maps to QTI 3.0 standard access features from:
 * - visual category: highContrastDisplay, colorContrast
 * - reading category: readingMask, readingGuide, highlighting
 */

import type {
	ToolRegistration,
	ToolSurfaceRenderContext,
	ToolSurfaceRenderResult,
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import type { ToolContext } from "@pie-players/pie-assessment-toolkit/tools/internal";
import { hasReadableText } from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	createToolElement,
	resolveToolTag,
	type ToolComponentOverrides,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import {
	applyOverlaySurface,
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { buildSelectionActions } from "./selection-actions.js";
import { renderOverlayToolbar } from "./overlay-toolbar-render.js";

/**
 * Line Reader tool registration
 *
 * Provides a reading guide overlay to help track reading position.
 * Useful for text-heavy passages and questions.
 */
export const lineReaderToolRegistration: ToolRegistration = {
	toolId: "lineReader",
	name: "Line Reader",
	description: "Reading guide overlay",
	nameKey: "tools.lineReader.name",
	descriptionKey: "tools.lineReader.description",
	icon: "bars-3",

	// Line reader appears where there's text to read
	supportedLevels: ["section", "passage", "rubric", "item"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: readingMask, readingGuide, readingRuler
	pnpSupportIds: [
		"readingMask", // QTI 3.0 standard (reading.readingMask)
		"readingGuide", // QTI 3.0 standard (reading.readingGuide)
		"readingRuler", // QTI 3.0 standard (reading.readingRuler)
	],

	/**
	 * Pass 2: Line reader is relevant when readable text is present
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasReadableText(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		return renderOverlayToolbar(this, context, toolbarContext, {
			surface: "frameless",
			handsOverCoordinator: true,
		});
	},
};

/**
 * Theme tool registration
 *
 * Provides accessible theme and contrast controls.
 * Global tool that affects entire assessment.
 */
export const themeToolRegistration: ToolRegistration = {
	toolId: "theme",
	name: "Theme",
	description: "Accessible themes and contrast",
	nameKey: "tools.theme.name",
	descriptionKey: "tools.theme.description",
	icon: "swatch",

	// Color scheme is assessment-wide
	supportedLevels: ["assessment", "section"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: highContrastDisplay, colorContrast, invertColors
	pnpSupportIds: [
		"highContrastDisplay", // QTI 3.0 standard (visual.highContrastDisplay)
		"colorContrast", // QTI 3.0 standard (visual.colorContrast)
		"invertColors", // QTI 3.0 standard (visual.invertColors)
		"theme", // Canonical id, and this registration's toolId
	],

	/**
	 * Pass 2: Color scheme is always relevant when allowed
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return true; // Always show if allowed by orchestrator
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		return renderOverlayToolbar(this, context, toolbarContext, {
			shell: {
				resizable: false,
				initialWidth: 520,
				initialHeight: 380,
				minWidth: 420,
				minHeight: 300,
			},
			handsOverCoordinator: true,
		});
	},
};

/**
 * Annotation Toolbar registration
 *
 * Text highlighting with CSS Custom Highlight API.
 * Zero DOM mutation, optimal performance.
 */
export const annotationToolbarRegistration: ToolRegistration = {
	toolId: "annotationToolbar",
	name: "Highlighter",
	description: "Highlight and annotate text",
	nameKey: "tools.annotationToolbar.name",
	descriptionKey: "tools.annotationToolbar.description",
	icon: "highlighter",
	activation: "selection-gateway",
	singletonScope: "section",

	/**
	 * Section-scoped singleton surface. The gateway used to be mounted by
	 * `PieSectionPlayerBaseElement.svelte`, which named this tool id in three
	 * places — the policy check, the module load and the element — so no host
	 * could contribute a second section-scoped capability. Declaring the surface
	 * moves that wiring into this registration, and the renderer discovers it
	 * through `ToolRegistry.getToolsBySurface("section-overlay")`.
	 */
	surfaces: ["section-overlay"],

	// Annotation appears where there's text content
	supportedLevels: ["passage", "rubric", "item", "element"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: highlighting, annotations
	pnpSupportIds: [
		"highlighting", // QTI 3.0 standard (cognitive.highlighting / reading.wordHighlighting)
		"annotations", // QTI 3.0 standard (cognitive.annotations)
	],

	/**
	 * Pass 2: Annotation is relevant when readable text is present
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasReadableText(context);
	},

	/**
	 * Mount the section-scoped gateway. The element positions itself (`position:
	 * fixed` inside its shadow root) and finds its scope through the toolkit's
	 * context, which bubbles from wherever the host mounted it, so this needs to
	 * know nothing about the host's layout.
	 */
	renderSurface(context): ToolSurfaceRenderResult | null {
		const componentOverrides =
			(context.componentOverrides as ToolComponentOverrides | undefined) ?? {};
		const tagName = resolveToolTag(context.toolId, componentOverrides);
		if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
			// The host loads the module before mounting, so reaching here means the
			// optional package is absent. Declining is the right answer: mounting an
			// undefined element would render an empty box the learner cannot use.
			return null;
		}
		const element = document.createElement(tagName) as HTMLElement & {
			enabled?: boolean;
			ttsService?: unknown;
			highlightCoordinator?: unknown;
			selectionActions?: unknown;
		};
		// Reads the context it is handed. These were reactive props before the
		// gateway moved behind `renderSurface`, and a host calling
		// `updateAssessment(...)` mid-session swaps the coordinator without
		// remounting — closing over the render-time services would leave the gateway
		// highlighting into the previous session's coordinator.
		const applyServices = (current: ToolSurfaceRenderContext) => {
			element.enabled = true;
			element.ttsService = current.services.ttsService;
			element.highlightCoordinator =
				current.services.toolkitCoordinator?.highlightCoordinator ?? null;
			// The second door onto the dictionaries. The gateway renders these and
			// knows nothing of what they open; the pairing is composition's, which is
			// why the list is built in `selection-actions.ts` and not here.
			element.selectionActions = buildSelectionActions(current.services);
		};
		applyServices(context);
		return { element, sync: applyServices };
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		return renderOverlayToolbar(this, context, toolbarContext, {
			handsOverCoordinator: true,
		});
	},
};
