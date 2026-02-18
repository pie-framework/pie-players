/**
 * PIE Types Module
 *
 * Pure type definitions, interfaces, and enums used across PIE utilities.
 * This module has NO runtime dependencies on other PIE modules.
 */

import type { ConfigEntity, Env, PieController, PieModel } from "../types/index.js";

/**
 * Player modes
 */
export type PlayerMode = "gather" | "view" | "evaluate" | "author";

/**
 * PIE custom element interface
 */
export interface PieElement extends HTMLElement {
	set model(m: PieModel | undefined);
	get model(): PieModel | undefined;
	set session(s: any);
	get session(): any;
	modelLoaded?: CustomEvent;
	onModelChanged: Function;
	configuration: object;
}

/**
 * Configure element interface (for authoring mode)
 */
export interface ConfigureElement extends HTMLElement {
	set model(m: any);
	get model(): any;
	set configuration(c: any);
	get configuration(): any;
}

/**
 * Authoring environment extends base Env
 */
export interface AuthoringEnv extends Env {
	mode: "author";
	configuration?: Record<string, any>;
}

/**
 * Asset upload handler interface (for images and sounds)
 */
export interface AssetHandler {
	cancel: () => void;
	done: (err?: Error, src?: string) => void;
	fileChosen: (file: File) => void;
	progress?: (percent: number, bytes: number, total: number) => void;
}

/**
 * PIE bundle types
 */
export enum BundleType {
	player = "player.js", // Elements only (no controllers)
	clientPlayer = "client-player.js", // Elements + controllers
	editor = "editor.js", // Editor UI
}

/**
 * Internal PIE registry entry status
 */
export enum Status {
	loading = "loading",
	loaded = "loaded",
}

/**
 * Internal PIE registry entry
 */
export interface Entry {
	package: string;
	status: Status;
	tagName: string;
	controller?: PieController;
	// Note: In practice these are not DOM Elements; they may be constructors, metadata, etc.
	// Keep them loose to support both IIFE and ESM loaders.
	config?: any;
	element?: any;
	bundleType?: BundleType; // Track which bundle type was used
}

/**
 * PIE registry - maps element names to their loaded data
 */
export interface PieRegistry {
	[key: string]: Entry;
}

/**
 * Event listeners map
 */
export interface EventListeners {
	[key: string]: (event: CustomEvent) => void;
}

/**
 * Options for updating PIE elements
 */
export interface UpdatePieElementOptions {
	config: ConfigEntity;
	session: any[];
	env?: Env;
	invokeControllerForModel?: boolean;
	eventListeners?: EventListeners;
	container?: Element | Document; // Optional container to scope querySelector (defaults to document)
}

/**
 * Default options for updatePieElement
 */
export const defaultPieElementOptions: Partial<UpdatePieElementOptions> = {
	invokeControllerForModel: true,
	env: { mode: "gather", role: "student", partialScoring: false },
	eventListeners: {},
};

/**
 * Event listeners map for multiple elements
 */
export interface EventListenersMap {
	[elementName: string]: EventListeners;
}

/**
 * Options for loading PIE elements
 */
export interface LoadPieElementsOptions {
	buildServiceBase?: string;
	bundleType?: BundleType;
	env?: Env;
	bundleUrl?: string;
	eventListeners?: EventListenersMap;
	container?: Element | Document; // Optional container to scope querySelector
}

/**
 * Type guard: Check if object has window.pie
 */
export function isPieAvailable(obj: any): obj is { pie: any } {
	return obj && typeof obj.pie === "object";
}

/**
 * Type guard: Check if object is a CustomElementConstructor
 */
export function isCustomElementConstructor(
	obj: any,
): obj is CustomElementConstructor {
	return (
		typeof obj === "function" &&
		"prototype" in obj &&
		obj.prototype instanceof HTMLElement
	);
}

/**
 * Type guard: Check if window has PIE_REGISTRY
 */
export function isPieRegistryAvailable(
	obj: any,
): obj is { PIE_REGISTRY: PieRegistry } {
	return obj && typeof obj.PIE_REGISTRY === "object";
}
