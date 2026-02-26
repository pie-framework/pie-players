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
		const fullToolId = `${this.toolId}-${toolbarContext.itemId}`;
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Line reader - Reading guide",
			tooltip: "Line Reader",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(fullToolId),
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
		overlay.setAttribute("tool-id", fullToolId);
		return {
			toolId: this.toolId,
			button,
			overlayElement: overlay,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				overlay.visible = active;
				if (toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
				}
			},
			subscribeActive: (callback: (active: boolean) => void) => {
				if (!toolbarContext.subscribeVisibility) return () => {};
				return toolbarContext.subscribeVisibility(() => {
					callback(toolbarContext.isToolVisible(fullToolId));
				});
			},
		};
	},
};

/**
 * Color Scheme tool registration
 *
 * Provides Learnosity-standard accessible color schemes and theme controls.
 * Global tool that affects entire assessment.
 */
export const colorSchemeToolRegistration: ToolRegistration = {
	toolId: "colorScheme",
	name: "Color Scheme",
	description: "Accessible color themes and contrast",
	icon: "swatch",

	// Color scheme is assessment-wide
	supportedLevels: ["assessment", "section"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: highContrastDisplay, colorContrast, invertColors
	pnpSupportIds: [
		"highContrastDisplay", // QTI 3.0 standard (visual.highContrastDisplay)
		"colorContrast", // QTI 3.0 standard (visual.colorContrast)
		"invertColors", // QTI 3.0 standard (visual.invertColors)
		"colorScheme", // Common variant
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
		const fullToolId = `${this.toolId}-${toolbarContext.itemId}`;
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Color scheme - Change colors and contrast",
			tooltip: "Color Scheme",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(fullToolId),
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
		overlay.setAttribute("tool-id", fullToolId);
		return {
			toolId: this.toolId,
			button,
			overlayElement: overlay,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				overlay.visible = active;
				if (toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
				}
			},
			subscribeActive: (callback: (active: boolean) => void) => {
				if (!toolbarContext.subscribeVisibility) return () => {};
				return toolbarContext.subscribeVisibility(() => {
					callback(toolbarContext.isToolVisible(fullToolId));
				});
			},
		};
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
	icon: "highlighter",

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
		const fullToolId = `${this.toolId}-${toolbarContext.itemId}`;
		const button: ToolToolbarButtonDefinition = {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: false,
			ariaLabel: "Annotation toolbar - Highlight text",
			tooltip: "Highlight",
			onClick: () => toolbarContext.toggleTool(this.toolId),
			active: toolbarContext.isToolVisible(fullToolId),
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
		overlay.setAttribute("tool-id", fullToolId);
		return {
			toolId: this.toolId,
			button,
			overlayElement: overlay,
			sync: () => {
				const active = toolbarContext.isToolVisible(fullToolId);
				button.active = active;
				overlay.visible = active;
				if (toolbarContext.toolkitCoordinator) {
					overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
				}
			},
			subscribeActive: (callback: (active: boolean) => void) => {
				if (!toolbarContext.subscribeVisibility) return () => {};
				return toolbarContext.subscribeVisibility(() => {
					callback(toolbarContext.isToolVisible(fullToolId));
				});
			},
		};
	},
};
