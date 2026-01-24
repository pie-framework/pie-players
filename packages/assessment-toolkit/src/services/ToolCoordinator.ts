/**
 * ToolCoordinator
 *
 * Manages z-index layering and visibility for floating tools.
 * Prevents conflicts between calculator, ruler, protractor, etc.
 *
 * Features:
 * - Centralized z-index management with defined layers
 * - Tool visibility state tracking
 * - Bring-to-front on interaction
 * - Framework-agnostic (works with any DOM element)
 *
 * Part of PIE Assessment Toolkit.
 */

import { createLogger } from "../utils/logger";
import type { IToolCoordinator, ToolState } from "./interfaces";

const log = createLogger("ToolCoordinator");

/**
 * Z-index layers for assessment components
 */
export enum ZIndexLayer {
	BASE = 0, // PIE content, player chrome (0-999)
	TOOL = 1000, // Non-modal tools (ruler, protractor) (1000-1999)
	MODAL = 2000, // Modal tools (calculator, dictionary) (2000-2999)
	CONTROL = 3000, // Drag handles, resize controls (3000-3999)
	HIGHLIGHT = 4000, // TTS and annotation highlights (4000-4999)
}

/**
 * Tool registration info
 */
interface ToolRegistration {
	id: string;
	name: string;
	element: HTMLElement | null;
	layer: ZIndexLayer;
	isVisible: boolean;
	baseZIndex: number;
	mouseDownHandler?: (e: MouseEvent) => void;
}

/**
 * Configuration for ToolCoordinator
 * Currently empty but allows future extension without breaking changes
 */
export type ToolCoordinatorConfig = Record<string, never>;

export class ToolCoordinator implements IToolCoordinator {
	private config: ToolCoordinatorConfig;
	private tools = new Map<string, ToolRegistration>();
	private layerCounters = new Map<ZIndexLayer, number>();
	private listeners = new Set<() => void>();

	constructor(config: ToolCoordinatorConfig = {}) {
		this.config = config;
		// Initialize layer counters
		this.layerCounters.set(ZIndexLayer.BASE, 0);
		this.layerCounters.set(ZIndexLayer.TOOL, 0);
		this.layerCounters.set(ZIndexLayer.MODAL, 0);
		this.layerCounters.set(ZIndexLayer.CONTROL, 0);
		this.layerCounters.set(ZIndexLayer.HIGHLIGHT, 0);
	}

	/**
	 * Subscribe to tool state changes
	 * Returns unsubscribe function
	 */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Notify all listeners of state change
	 */
	private notifyListeners(): void {
		this.listeners.forEach((listener) => listener());
	}

	/**
	 * Register a tool with the coordinator
	 *
	 * @param id Unique tool identifier
	 * @param name Display name
	 * @param element DOM element for the tool (optional for backward compatibility)
	 * @param layer Z-index layer (defaults to MODAL)
	 */
	registerTool(
		id: string,
		name: string,
		element?: HTMLElement,
		layer: ZIndexLayer = ZIndexLayer.MODAL,
	): void {
		log("registerTool called:", { id, name, hasElement: !!element, layer });

		if (this.tools.has(id)) {
			log(`Tool ${id} is already registered`);
			return;
		}

		// If no element provided, create a placeholder registration
		if (!element) {
			this.tools.set(id, {
				id,
				name,
				element: null,
				layer,
				isVisible: false,
				baseZIndex: layer,
			});
			log("Tool registered without element:", id);
			return;
		}

		// Calculate base z-index for this layer
		const baseZIndex = layer + this.getNextLayerOffset(layer);

		// Apply z-index
		element.style.zIndex = String(baseZIndex);

		// Create and store event handler to enable proper cleanup
		const mouseDownHandler = () => this.bringToFront(element);
		element.addEventListener("mousedown", mouseDownHandler);

		// Register tool with handler reference
		this.tools.set(id, {
			id,
			name,
			element,
			layer,
			isVisible: false,
			baseZIndex,
			mouseDownHandler,
		});

		log("Tool registered with element:", id);
	}

	/**
	 * Unregister a tool
	 *
	 * @param id Tool identifier
	 */
	unregisterTool(id: string): void {
		const tool = this.tools.get(id);
		if (!tool) return;

		// Remove event listeners using stored handler reference
		if (tool.element && tool.mouseDownHandler) {
			tool.element.removeEventListener("mousedown", tool.mouseDownHandler);
		}

		this.tools.delete(id);
	}

	/**
	 * Show a tool
	 *
	 * @param id Tool identifier
	 */
	showTool(id: string): void {
		const tool = this.tools.get(id);
		if (!tool) {
			log(`Tool ${id} not found`);
			return;
		}

		if (tool.element) {
			tool.element.style.display = "";
			this.bringToFront(tool.element);
		}
		tool.isVisible = true;
		this.notifyListeners();
	}

	/**
	 * Hide a tool
	 *
	 * @param id Tool identifier
	 */
	hideTool(id: string): void {
		const tool = this.tools.get(id);
		if (!tool) {
			log(`Tool ${id} not found`);
			return;
		}

		if (tool.element) {
			tool.element.style.display = "none";
		}
		tool.isVisible = false;
		this.notifyListeners();
	}

	/**
	 * Toggle tool visibility
	 *
	 * @param id Tool identifier
	 */
	toggleTool(id: string): void {
		log("toggleTool called for:", id);
		const tool = this.tools.get(id);
		if (!tool) {
			log(
				`Tool ${id} not found. Registered tools:`,
				Array.from(this.tools.keys()),
			);
			return;
		}

		log("Tool found, current visibility:", tool.isVisible);
		if (tool.isVisible) {
			this.hideTool(id);
		} else {
			this.showTool(id);
		}
	}

	/**
	 * Check if tool is visible
	 *
	 * @param id Tool identifier
	 * @returns true if tool is visible
	 */
	isToolVisible(id: string): boolean {
		const tool = this.tools.get(id);
		return tool?.isVisible ?? false;
	}

	/**
	 * Bring element to front of its layer
	 *
	 * @param element DOM element to bring forward
	 */
	bringToFront(element: HTMLElement): void {
		// Find tool registration
		const tool = Array.from(this.tools.values()).find(
			(t) => t.element === element,
		);
		if (!tool) return;

		// Calculate new z-index (highest in layer + 1)
		const maxZIndexInLayer = this.getMaxZIndexInLayer(tool.layer);
		const newZIndex = Math.max(maxZIndexInLayer + 1, tool.layer + 1);

		// Update z-index
		element.style.zIndex = String(newZIndex);
		tool.baseZIndex = newZIndex;
	}

	/**
	 * Get all registered tool IDs
	 */
	getRegisteredTools(): string[] {
		return Array.from(this.tools.keys());
	}

	/**
	 * Get tool element by ID
	 */
	getToolElement(id: string): HTMLElement | null {
		return this.tools.get(id)?.element ?? null;
	}

	/**
	 * Get next offset within a layer
	 */
	private getNextLayerOffset(layer: ZIndexLayer): number {
		const current = this.layerCounters.get(layer) ?? 0;
		this.layerCounters.set(layer, current + 1);
		return current;
	}

	/**
	 * Get maximum z-index currently in use in a layer
	 */
	private getMaxZIndexInLayer(layer: ZIndexLayer): number {
		let max = layer;

		for (const tool of this.tools.values()) {
			if (tool.layer === layer) {
				max = Math.max(max, tool.baseZIndex);
			}
		}

		return max;
	}

	/**
	 * Reset all tools to their base z-indices
	 */
	resetZIndices(): void {
		for (const tool of this.tools.values()) {
			if (tool.element) {
				tool.element.style.zIndex = String(tool.baseZIndex);
			}
		}
	}

	/**
	 * Update tool element reference (backward compatibility)
	 *
	 * @param id Tool identifier
	 * @param element New DOM element
	 */
	updateToolElement(id: string, element: HTMLElement): void {
		const tool = this.tools.get(id);
		if (!tool) {
			log(`Tool ${id} not found`);
			return;
		}

		// Remove old event listener using stored handler reference
		if (tool.element && tool.mouseDownHandler) {
			tool.element.removeEventListener("mousedown", tool.mouseDownHandler);
		}

		// Create new handler and add listener
		const mouseDownHandler = () => this.bringToFront(element);
		element.addEventListener("mousedown", mouseDownHandler);

		// Update element and handler reference
		tool.element = element;
		tool.mouseDownHandler = mouseDownHandler;

		// Apply z-index to new element
		element.style.zIndex = String(tool.baseZIndex);
		if (tool.isVisible) {
			element.style.display = "";
		} else {
			element.style.display = "none";
		}
	}

	/**
	 * Hide all tools (backward compatibility)
	 */
	hideAllTools(): void {
		for (const id of this.tools.keys()) {
			this.hideTool(id);
		}
		this.notifyListeners();
	}

	/**
	 * Get tool state (interface method)
	 *
	 * @param id Tool identifier
	 * @returns Tool state or undefined
	 */
	getToolState(id: string): ToolState | undefined {
		const tool = this.tools.get(id);
		if (!tool) return undefined;

		return {
			id: tool.id,
			name: tool.name,
			isVisible: tool.isVisible,
			element: tool.element ?? null,
			layer: tool.layer,
		};
	}

	/**
	 * Get all visible tools (interface method)
	 *
	 * @returns Array of visible tool states
	 */
	getVisibleTools(): ToolState[] {
		return Array.from(this.tools.values())
			.filter((tool) => tool.isVisible)
			.map((tool) => ({
				id: tool.id,
				name: tool.name,
				isVisible: tool.isVisible,
				element: tool.element ?? null,
				layer: tool.layer,
			}));
	}
}
