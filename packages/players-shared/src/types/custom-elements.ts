/**
 * TypeScript interfaces for custom PIE elements
 *
 * These interfaces provide type safety when working with custom elements
 * that are defined as Svelte components with customElement option.
 */

import type { ItemConfig } from "./index.js";

/**
 * PIE IIFE Player custom element interface
 *
 * @example
 * ```typescript
 * const player = document.querySelector('pie-iife-player') as PieIifePlayerElement;
 * player.config = itemConfig;
 * player.session = { id: 'session-1', data: [] };
 * ```
 */
export interface PieIifePlayerElement extends HTMLElement {
	/** PIE item configuration */
	config: ItemConfig;

	/** Session state containing response data */
	session: {
		id: string;
		data: any[];
	};

	/** Player environment (mode and role) */
	env: {
		mode: "gather" | "view" | "evaluate";
		role: "student" | "instructor";
	};

	/**
	 * Authoring mode toggle (separate from env.mode).
	 * - view: normal runtime rendering
	 * - author: loads editor bundles and enables configure/authoring flows
	 */
	mode?: "view" | "author";

	/**
	 * Authoring configuration passed through to PIE elements (e.g. configure settings).
	 * In authoring mode this typically influences the element's configure UI and emitted
	 * `model.updated` events.
	 */
	configuration?: Record<string, any>;

	/** Debug mode flag */
	debug?: boolean;
}

/**
 * PIE ESM Player custom element interface
 *
 * Mirrors the pie-iife-player contract, but loads PIE bundles via native ESM from an ESM CDN.
 */
export interface PieEsmPlayerElement extends HTMLElement {
	/** PIE item configuration */
	config: ItemConfig;

	/** Session state containing response data */
	session: {
		id: string;
		data: any[];
	};

	/** Player environment (mode and role) */
	env: {
		mode: "gather" | "view" | "evaluate";
		role: "student" | "instructor";
	};

	/** ESM CDN base URL (e.g. https://esm.sh) */
	esmCdnUrl?: string;

	/** Authoring mode toggle (separate from env.mode). */
	mode?: "view" | "author";

	/** Authoring configuration passed through to PIE elements. */
	configuration?: Record<string, any>;

	/** Debug mode flag */
	debug?: boolean;
}

/**
 * Tool Toolbar custom element interface
 */
export interface ToolToolbarElement extends HTMLElement {
	/** Comma-separated list of enabled tools */
	tools?: string;

	/** Whether toolbar is disabled */
	disabled?: boolean;

	/** Toolbar position */
	position?: "top" | "bottom" | "left" | "right";

	/** Whether to show tool labels */
	"show-labels"?: boolean;

	/** Organization ID for tool configuration */
	"organization-id"?: string;

	/** Base URL for tool resources */
	"base-url"?: string;

	/** Tool coordinator instance (passed as property, not attribute) */
	toolCoordinator?: any; // ToolCoordinator type

	/** Highlight coordinator instance */
	highlightCoordinator?: any; // HighlightCoordinator type
}

/**
 * Base tool element interface
 *
 * All tool custom elements share these properties
 */
export interface BaseToolElement extends HTMLElement {
	/** Whether the tool is visible */
	visible?: boolean;

	/** Unique tool identifier */
	"tool-id"?: string;

	/** Tool coordinator instance (passed as property) */
	coordinator?: any; // ToolCoordinator type
}

/**
 * Calculator tool element
 */
export interface ToolCalculatorElement extends BaseToolElement {
	/** Calculator type */
	"calculator-type"?: "basic" | "scientific" | "graphing";
}

/**
 * Color Scheme tool element
 */
export interface ToolColorSchemeElement extends BaseToolElement {
	// No additional properties beyond BaseToolElement
}

/**
 * Graph tool element
 */
export interface ToolGraphElement extends BaseToolElement {
	// No additional properties beyond BaseToolElement
}

/**
 * Periodic Table tool element
 */
export interface ToolPeriodicTableElement extends BaseToolElement {
	// No additional properties beyond BaseToolElement
}

/**
 * Ruler tool element
 */
export interface ToolRulerElement extends BaseToolElement {
	/** Initial units (cm or in) */
	units?: "cm" | "in";
}

/**
 * Protractor tool element
 */
export interface ToolProtractorElement extends BaseToolElement {
	// No additional properties beyond BaseToolElement
}

/**
 * Line Reader tool element
 */
export interface ToolLineReaderElement extends BaseToolElement {
	// No additional properties beyond BaseToolElement
}

/**
 * Text-to-Speech tool element
 */
export interface ToolTextToSpeechElement extends BaseToolElement {
	// No additional properties beyond BaseToolElement
}

/**
 * Answer Eliminator tool element
 */
export interface ToolAnswerEliminatorElement extends BaseToolElement {
	// No additional properties beyond BaseToolElement
}

/**
 * Helper type to get element interface by tag name
 *
 * @example
 * ```typescript
 * const player = document.querySelector('pie-iife-player') as CustomElementByTag<'pie-iife-player'>;
 * ```
 */
export type CustomElementByTag<T extends string> = T extends "pie-iife-player"
	? PieIifePlayerElement
	: T extends "pie-tool-toolbar"
		? ToolToolbarElement
		: T extends "pie-tool-calculator"
			? ToolCalculatorElement
			: T extends "pie-tool-color-scheme"
				? ToolColorSchemeElement
				: T extends "pie-tool-graph"
					? ToolGraphElement
					: T extends "pie-tool-periodic-table"
						? ToolPeriodicTableElement
						: T extends "pie-tool-ruler"
							? ToolRulerElement
							: T extends "pie-tool-protractor"
								? ToolProtractorElement
								: T extends "pie-tool-line-reader"
									? ToolLineReaderElement
									: T extends "pie-tool-text-to-speech"
										? ToolTextToSpeechElement
										: T extends "pie-tool-answer-eliminator"
											? ToolAnswerEliminatorElement
											: HTMLElement;

/**
 * Declare custom elements in global namespace for TypeScript
 */
declare global {
	interface HTMLElementTagNameMap {
		"pie-iife-player": PieIifePlayerElement;
		"pie-tool-toolbar": ToolToolbarElement;
		"pie-tool-calculator": ToolCalculatorElement;
		"pie-tool-color-scheme": ToolColorSchemeElement;
		"pie-tool-graph": ToolGraphElement;
		"pie-tool-periodic-table": ToolPeriodicTableElement;
		"pie-tool-ruler": ToolRulerElement;
		"pie-tool-protractor": ToolProtractorElement;
		"pie-tool-line-reader": ToolLineReaderElement;
		"pie-tool-text-to-speech": ToolTextToSpeechElement;
		"pie-tool-answer-eliminator": ToolAnswerEliminatorElement;
	}
}
