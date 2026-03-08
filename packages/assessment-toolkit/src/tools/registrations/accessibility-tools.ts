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
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasReadableText } from "../../services/tool-context.js";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "../tool-tag-map.js";
import {
	createScopedVisibilityBinding,
	syncButtonAndOverlayVisibility,
} from "./toolbar-registration-helpers.js";

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
	icon: "bars-3",

	// Line reader appears where there's text to read
	supportedLevels: ["passage", "rubric", "item"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: readingMask, readingGuide, readingRuler
	pnpSupportIds: [
		"readingMask", // QTI 3.0 standard (reading.readingMask)
		"readingGuide", // QTI 3.0 standard (reading.readingGuide)
		"readingRuler", // QTI 3.0 standard (reading.readingRuler)
		"lineReader", // Common variant
		"trackingGuide", // Common variant
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
		const visibility = createScopedVisibilityBinding(this.toolId, toolbarContext);
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Line reader - Reading guide",
			tooltip: "Line Reader",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: visibility.isActive(),
		};
		const componentOverrides =
			(toolbarContext.componentOverrides as ToolComponentOverrides | undefined) ?? {};
		const overlay = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			componentOverrides,
		) as HTMLElement & {
			visible?: boolean;
			toolId?: string;
			toolkitCoordinator: unknown;
		};
		overlay.setAttribute("tool-id", visibility.fullToolId);
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
				if (toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
				}
			},
			subscribeActive: visibility.subscribeActive,
		};
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
	icon: "swatch",

	// Color scheme is assessment-wide
	supportedLevels: ["assessment", "section"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: highContrastDisplay, colorContrast, invertColors
	pnpSupportIds: [
		"highContrastDisplay", // QTI 3.0 standard (visual.highContrastDisplay)
		"colorContrast", // QTI 3.0 standard (visual.colorContrast)
		"invertColors", // QTI 3.0 standard (visual.invertColors)
		"colorScheme", // Legacy alias
		"theme", // Canonical id
		"highContrast", // Common variant
		"customColors", // Common variant
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
		const visibility = createScopedVisibilityBinding(this.toolId, toolbarContext);
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Theme - Change colors and contrast",
			tooltip: "Theme",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: visibility.isActive(),
		};
		const componentOverrides =
			(toolbarContext.componentOverrides as ToolComponentOverrides | undefined) ?? {};
		const overlay = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			componentOverrides,
		) as HTMLElement & {
			visible?: boolean;
			toolId?: string;
			toolkitCoordinator: unknown;
		};
		overlay.setAttribute("tool-id", visibility.fullToolId);
		return {
			toolId: this.toolId,
			button,
			elements: [
				{
					element: overlay,
					mount: "after-buttons",
					shell: {
						title: this.name,
						draggable: true,
						resizable: false,
						closeable: true,
						initialWidth: 520,
						initialHeight: 380,
						minWidth: 420,
						minHeight: 300,
					},
				},
			],
			sync: () => {
				syncButtonAndOverlayVisibility({
					button,
					overlay,
					isActive: visibility.isActive,
				});
				if (toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
				}
			},
			subscribeActive: visibility.subscribeActive,
		};
	},
};

/**
 * Backward-compatible export name used by existing imports.
 * Canonical toolId is `theme`; `colorScheme` remains an alias at config level.
 */
export const colorSchemeToolRegistration = themeToolRegistration;

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
	icon: "highlighter",
	activation: "selection-gateway",
	singletonScope: "section",

	// Annotation appears where there's text content
	supportedLevels: ["passage", "rubric", "item", "element"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: highlighting, annotations
	pnpSupportIds: [
		"highlighting", // QTI 3.0 standard (cognitive.highlighting / reading.wordHighlighting)
		"annotations", // QTI 3.0 standard (cognitive.annotations)
		"highlighter", // Common variant
		"textHighlight", // Common variant
		"annotation", // Common variant
	],

	/**
	 * Pass 2: Annotation is relevant when readable text is present
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return hasReadableText(context);
	},

	renderToolbar(
		context: ToolContext,
		toolbarContext: ToolbarContext,
	): ToolToolbarRenderResult {
		const visibility = createScopedVisibilityBinding(this.toolId, toolbarContext);
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Annotation toolbar - Highlight text",
			tooltip: "Highlight",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: visibility.isActive(),
		};
		const componentOverrides =
			(toolbarContext.componentOverrides as ToolComponentOverrides | undefined) ?? {};
		const overlay = createToolElement(
			this.toolId,
			context,
			toolbarContext,
			componentOverrides,
		) as HTMLElement & {
			visible?: boolean;
			toolId?: string;
			toolkitCoordinator: unknown;
		};
		overlay.setAttribute("tool-id", visibility.fullToolId);
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
				if (toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
				}
			},
			subscribeActive: visibility.subscribeActive,
		};
	},
};
