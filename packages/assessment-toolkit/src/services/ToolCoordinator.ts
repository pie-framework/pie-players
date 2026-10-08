/**
 * ToolCoordinator
 *
 * Holds the visibility state of floating tools and stacks their elements.
 *
 * Visibility is state: the coordinator records it and notifies subscribers, and
 * whoever renders a tool shows or hides it from that state. Stacking is the
 * coordinator's alone: an element bound to a tool (`registerTool` with an
 * element, or `updateToolElement`) takes a z-index in the tool's layer and comes
 * to the front of that layer when shown or pressed.
 *
 * Part of PIE Assessment Toolkit.
 */

import { createLogger } from "../utils/logger.js";
import type { ToolCoordinatorApi, ToolState } from "./interfaces.js";

const log = createLogger("ToolCoordinator");

/**
 * Z-index layers for assessment components
 */
export enum ZIndexLayer {
	BASE = 0, // PIE content, player chrome (0-999)
	TOOL = 1000, // Non-modal tools (ruler, protractor) (1000-1999)
	MODAL = 2000, // Modal tools (calculator) (2000-2999)
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
	/**
	 * Whether a registration named the layer. A toolbar registers a tool it
	 * activates before the tool's own element registers, and names none; the
	 * tool's layer replaces the default when it arrives.
	 */
	layerDeclared: boolean;
	isVisible: boolean;
	baseZIndex: number;
	mouseDownHandler?: (e: MouseEvent) => void;
}

export class ToolCoordinator implements ToolCoordinatorApi {
	private tools = new Map<string, ToolRegistration>();
	private listeners = new Set<() => void>();
	/**
	 * Activation (on/off) state keyed by tool id, kept independent of the
	 * element registration lifecycle. A tool's DOM element can be unregistered
	 * and re-registered as the item re-renders (e.g. a model change re-mounts
	 * the toolbar overlay); when that happens the on/off state must survive so
	 * that only an explicit toggle — the toolbar button — turns a tool off.
	 * Cleared on genuine teardown via {@link releaseTool}.
	 */
	private visibilityState = new Map<string, boolean>();

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
		for (const listener of this.listeners) {
			try {
				listener();
			} catch (error) {
				console.warn("[ToolCoordinator] listener failed:", error);
			}
		}
	}

	/**
	 * Register a tool with the coordinator
	 *
	 * @param id Unique tool identifier
	 * @param name Display name
	 * @param element DOM element to stack (optional)
	 * @param layer Z-index layer. Without one the tool stacks on MODAL until a
	 * registration names one.
	 */
	registerTool(
		id: string,
		name: string,
		element?: HTMLElement,
		layer?: ZIndexLayer,
	): void {
		log("registerTool called:", { id, name, hasElement: !!element, layer });

		const existing = this.tools.get(id);
		if (existing) {
			if (layer !== undefined && !existing.layerDeclared) {
				existing.layer = layer;
				existing.layerDeclared = true;
				this.stackOnTop(existing);
			}
			log(`Tool ${id} is already registered`);
			return;
		}

		// Restore prior on/off state. A re-registration (e.g. after an item
		// re-render unmounts and re-mounts the tool element) must preserve the
		// tool's activation state so only an explicit toggle can turn it off.
		const isVisible = this.visibilityState.get(id) ?? false;
		const registration: ToolRegistration = {
			id,
			name,
			element: null,
			layer: layer ?? ZIndexLayer.MODAL,
			layerDeclared: layer !== undefined,
			isVisible,
			baseZIndex: 0,
		};
		this.tools.set(id, registration);
		this.stackOnTop(registration);
		if (element) this.updateToolElement(id, element);
		log("Tool registered:", id);
	}

	/**
	 * Unregister a tool
	 *
	 * Detaches the element binding (listeners, registration) but intentionally
	 * preserves the tool's activation state in {@link visibilityState}, so a
	 * subsequent re-registration of the same id (e.g. after an item re-render)
	 * restores whether the tool was on or off. Use {@link releaseTool} to also
	 * discard the activation state on genuine teardown.
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
	 * Fully release a tool: unregister its element binding AND discard its
	 * preserved activation state. Call this on genuine teardown (e.g. leaving
	 * the item/section that owns the tool) rather than {@link unregisterTool},
	 * which keeps the on/off state alive across element re-registration.
	 *
	 * @param id Tool identifier
	 */
	releaseTool(id: string): void {
		this.unregisterTool(id);
		this.visibilityState.delete(id);
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

		if (tool.element) this.bringToFront(tool.element);
		tool.isVisible = true;
		this.visibilityState.set(id, true);
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

		tool.isVisible = false;
		this.visibilityState.set(id, false);
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
		if (tool) return tool.isVisible;
		// No live element registration (e.g. mid re-render, between unmount and
		// re-mount): fall back to the preserved activation state so the tool
		// doesn't read as "off" during the gap.
		return this.visibilityState.get(id) ?? false;
	}

	/**
	 * Bring a bound element to the front of its tool's layer. An element no tool
	 * is bound to is left alone.
	 *
	 * @param element DOM element to bring forward
	 */
	bringToFront(element: HTMLElement): void {
		const tool = Array.from(this.tools.values()).find(
			(t) => t.element === element,
		);
		if (!tool) return;

		this.stackOnTop(tool);
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
	 * Put `tool` in front of its layer. The layer is renumbered from its base on
	 * every move, so its z-indices stay within it however often tools are raised.
	 */
	private stackOnTop(tool: ToolRegistration): void {
		const others = Array.from(this.tools.values())
			.filter((other) => other.layer === tool.layer && other !== tool)
			.sort((a, b) => a.baseZIndex - b.baseZIndex);
		const top = tool.layer + others.length + 1;
		if (
			tool.baseZIndex === top &&
			others.every((other) => other.baseZIndex < top)
		) {
			return;
		}
		[...others, tool].forEach((entry, index) => {
			entry.baseZIndex = tool.layer + 1 + index;
			if (entry.element) entry.element.style.zIndex = String(entry.baseZIndex);
		});
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
	 * Bind the element a tool stacks by. It takes the tool's z-index and comes to
	 * the front of the layer when pressed, and when bound while the tool is shown.
	 *
	 * The outermost element stacks: binding an element inside the bound one keeps
	 * the binding, so a tool rendered inside a toolbar's floating window stacks
	 * by that window whichever binds first.
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
		if (tool.element === element) return;
		if (tool.element?.isConnected && tool.element.contains(element)) return;

		if (tool.element && tool.mouseDownHandler) {
			tool.element.removeEventListener("mousedown", tool.mouseDownHandler);
		}
		const mouseDownHandler = () => this.bringToFront(element);
		element.addEventListener("mousedown", mouseDownHandler);
		tool.element = element;
		tool.mouseDownHandler = mouseDownHandler;

		element.style.zIndex = String(tool.baseZIndex);
		if (tool.isVisible) this.bringToFront(element);
	}

	/**
	 * Hide all tools
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
