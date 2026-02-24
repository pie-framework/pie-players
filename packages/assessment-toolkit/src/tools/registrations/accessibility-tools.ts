/**
 * Accessibility Tools Registrations
 *
 * Registers tools for visual accessibility and reading support:
 * - Magnifier (zoom lens)
 * - Line Reader (reading guide)
 * - Color Scheme (theme/contrast)
 * - Annotation Toolbar (text highlighting)
 *
 * Maps to QTI 3.0 standard access features from:
 * - visual category: magnification, highContrastDisplay, colorContrast
 * - reading category: readingMask, readingGuide, highlighting
 */

import type {
	ToolRegistration,
	ToolButtonDefinition,
	ToolButtonOptions,
	ToolInstanceOptions,
} from "../../services/ToolRegistry.js";
import type { ToolContext } from "../../services/tool-context.js";
import { hasReadableText } from "../../services/tool-context.js";
import {
	createToolElement,
	type ToolComponentOverrides,
} from "../tool-tag-map.js";

/**
 * Magnifier tool registration
 *
 * Provides a draggable zoom lens for visual accessibility.
 * Global tool that works across entire assessment.
 */
export const magnifierToolRegistration: ToolRegistration = {
	toolId: "magnifier",
	name: "Magnifier",
	description: "Zoom lens for visual accessibility",
	icon: "magnifying-glass",

	// Magnifier is assessment-wide (global)
	supportedLevels: ["assessment", "section"],

	// PNP support IDs
	// Maps to QTI 3.0 standard features: magnification, screenMagnifier, zoomable
	pnpSupportIds: [
		"magnification", // QTI 3.0 standard (visual.magnification)
		"screenMagnifier", // QTI 3.0 standard (visual.screenMagnifier)
		"zoomable", // QTI 3.0 standard (visual.zoomable)
		"magnifier", // Common variant
		"zoom", // Common variant
		"visualZoom", // Common variant
	],

	/**
	 * Pass 2: Magnifier is always relevant when allowed
	 */
	isVisibleInContext(context: ToolContext): boolean {
		return true; // Always show if allowed by orchestrator
	},

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel: options.ariaLabel || "Magnifier - Zoom in on content",
			tooltip: options.tooltip || "Magnifier",
			onClick: options.onClick || (() => {}),
			className: options.className,
		};
	},

	createToolInstance(
		context: ToolContext,
		options: ToolInstanceOptions,
	): HTMLElement {
		const componentOverrides =
			(options.config as ToolComponentOverrides | undefined) ?? {};
		const magnifier = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolkitCoordinator: unknown;
		};

		magnifier.visible = true;

		const magnifierCoordinator = options.config?.toolkitCoordinator;
		if (!magnifierCoordinator) {
			throw new Error(
				"[magnifierToolRegistration] toolkitCoordinator is required in ToolInstanceOptions.config",
			);
		}
		magnifier.toolkitCoordinator = magnifierCoordinator;

		if (options.onClose) {
			magnifier.addEventListener("close", options.onClose);
		}

		return magnifier;
	},
};

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

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel: options.ariaLabel || "Line reader - Reading guide",
			tooltip: options.tooltip || "Line Reader",
			onClick: options.onClick || (() => {}),
			className: options.className,
		};
	},

	createToolInstance(
		context: ToolContext,
		options: ToolInstanceOptions,
	): HTMLElement {
		const componentOverrides =
			(options.config as ToolComponentOverrides | undefined) ?? {};
		const lineReader = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolkitCoordinator: unknown;
		};

		lineReader.visible = true;

		const lineReaderCoordinator = options.config?.toolkitCoordinator;
		if (!lineReaderCoordinator) {
			throw new Error(
				"[lineReaderToolRegistration] toolkitCoordinator is required in ToolInstanceOptions.config",
			);
		}
		lineReader.toolkitCoordinator = lineReaderCoordinator;

		if (options.onClose) {
			lineReader.addEventListener("close", options.onClose);
		}

		return lineReader;
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

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel:
				options.ariaLabel || "Color scheme - Change colors and contrast",
			tooltip: options.tooltip || "Color Scheme",
			onClick: options.onClick || (() => {}),
			className: options.className,
		};
	},

	createToolInstance(
		context: ToolContext,
		options: ToolInstanceOptions,
	): HTMLElement {
		const componentOverrides =
			(options.config as ToolComponentOverrides | undefined) ?? {};
		const colorScheme = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolkitCoordinator: unknown;
		};

		colorScheme.visible = true;

		const colorSchemeCoordinator = options.config?.toolkitCoordinator;
		if (!colorSchemeCoordinator) {
			throw new Error(
				"[colorSchemeToolRegistration] toolkitCoordinator is required in ToolInstanceOptions.config",
			);
		}
		colorScheme.toolkitCoordinator = colorSchemeCoordinator;

		if (options.onClose) {
			colorScheme.addEventListener("close", options.onClose);
		}

		return colorScheme;
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

	createButton(
		context: ToolContext,
		options: ToolButtonOptions,
	): ToolButtonDefinition {
		return {
			toolId: this.toolId,
			label: this.name,
			icon: typeof this.icon === "function" ? this.icon(context) : this.icon,
			disabled: options.disabled || false,
			ariaLabel: options.ariaLabel || "Annotation toolbar - Highlight text",
			tooltip: options.tooltip || "Highlight",
			onClick: options.onClick || (() => {}),
			className: options.className,
		};
	},

	createToolInstance(
		context: ToolContext,
		options: ToolInstanceOptions,
	): HTMLElement {
		const componentOverrides =
			(options.config as ToolComponentOverrides | undefined) ?? {};
		const toolbar = createToolElement(
			this.toolId,
			context,
			options,
			componentOverrides,
		) as HTMLElement & {
			visible: boolean;
			toolkitCoordinator: unknown;
		};

		toolbar.visible = true;

		const annotationCoordinator = options.config?.toolkitCoordinator;
		if (!annotationCoordinator) {
			throw new Error(
				"[annotationToolbarRegistration] toolkitCoordinator is required in ToolInstanceOptions.config",
			);
		}
		toolbar.toolkitCoordinator = annotationCoordinator;

		if (options.onClose) {
			toolbar.addEventListener("close", options.onClose);
		}

		return toolbar;
	},
};
