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
 */

import {
	createPieLogger,
	isGlobalDebugEnabled,
} from "@pie-players/pie-players-shared/pie";
import type {
	ToolCoordinatorApi,
	ToolState,
	ToolStateFilter,
} from "./interfaces.js";
import { parseScopedToolId } from "./tool-instance-id.js";

const logger = createPieLogger("ToolCoordinator", isGlobalDebugEnabled);

/**
 * Z-index layers for assessment components
 */
export enum ZIndexLayer {
	BASE = 0, // PIE content, player chrome (0-999)
	TOOL = 1000, // Floating tools and their windows (1000-1999)
	MODAL = 2000, // Modal tool surfaces (2000-2999)
	CONTROL = 3000, // Drag handles, resize controls (3000-3999)
	HIGHLIGHT = 4000, // TTS and annotation highlights (4000-4999)
}

/**
 * A tool the coordinator knows. An entry outlives its element registration: a
 * tool's element unregisters and re-registers as its item re-renders, and the
 * tool's on/off state belongs to the entry, so a toggle made while no element is
 * registered still lands. Only {@link ToolCoordinator.releaseTool} removes it.
 */
interface ToolEntry {
	id: string;
	name: string;
	/** Whether an element registration currently holds the entry. */
	registered: boolean;
	element: HTMLElement | null;
	layer: ZIndexLayer;
	/**
	 * Whether a registration named the layer. A toolbar registers a tool it
	 * activates before the tool's own element registers; the tool's layer
	 * replaces the toolbar's when it arrives.
	 */
	layerDeclared: boolean;
	isVisible: boolean;
	baseZIndex: number;
	mouseDownHandler?: (e: MouseEvent) => void;
}

function matchesFilter(id: string, filter?: ToolStateFilter): boolean {
	if (!filter?.baseId) return true;
	return (parseScopedToolId(id)?.baseToolId ?? id) === filter.baseId;
}

function toToolState(entry: ToolEntry): ToolState {
	return {
		id: entry.id,
		name: entry.name,
		isVisible: entry.isVisible,
		element: entry.element,
		layer: entry.layer,
	};
}

export class ToolCoordinator implements ToolCoordinatorApi {
	private tools = new Map<string, ToolEntry>();
	private listeners = new Set<() => void>();

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
	 * Register a tool with the coordinator. Registering a known id keeps its
	 * on/off state and takes the name, the element when one is given, and the
	 * layer when none was declared before. Without a `layer` the tool stacks on
	 * TOOL until a registration names one.
	 */
	registerTool(
		id: string,
		name: string,
		element?: HTMLElement,
		layer?: ZIndexLayer,
	): void {
		logger.debug("registerTool called:", {
			id,
			name,
			hasElement: !!element,
			layer,
		});

		let entry = this.tools.get(id);
		if (entry) {
			entry.name = name;
			const wasRegistered = entry.registered;
			entry.registered = true;
			if (layer !== undefined && !entry.layerDeclared) {
				entry.layer = layer;
				entry.layerDeclared = true;
				this.stackOnTop(entry);
			} else if (!wasRegistered) {
				this.stackOnTop(entry);
			}
		} else {
			entry = {
				id,
				name,
				registered: true,
				element: null,
				layer: layer ?? ZIndexLayer.TOOL,
				layerDeclared: layer !== undefined,
				isVisible: false,
				baseZIndex: 0,
			};
			this.tools.set(id, entry);
			this.stackOnTop(entry);
		}
		if (element) this.updateToolElement(id, element);
	}

	/**
	 * Unregister a tool's element binding, keeping its on/off state so a
	 * re-registration of the same id (an item re-render) restores it. Use
	 * {@link releaseTool} on genuine teardown.
	 */
	unregisterTool(id: string): void {
		const entry = this.tools.get(id);
		if (!entry?.registered) return;
		this.detachElement(entry);
		entry.registered = false;
	}

	/**
	 * Fully release a tool: unregister its element binding and discard its
	 * on/off state. Call this on genuine teardown (leaving the item or section
	 * that owns the tool).
	 */
	releaseTool(id: string): void {
		const entry = this.tools.get(id);
		if (!entry) return;
		this.detachElement(entry);
		this.tools.delete(id);
		if (entry.isVisible) this.notifyListeners();
	}

	showTool(id: string): void {
		const entry = this.tools.get(id);
		if (!entry) {
			logger.debug(`Tool ${id} not found`);
			return;
		}
		if (entry.element) this.bringToFront(entry.element);
		this.setVisible(entry, true);
	}

	hideTool(id: string): void {
		const entry = this.tools.get(id);
		if (!entry) {
			logger.debug(`Tool ${id} not found`);
			return;
		}
		this.setVisible(entry, false);
	}

	toggleTool(id: string): void {
		const entry = this.tools.get(id);
		if (!entry) {
			logger.debug(`Tool ${id} not found`);
			return;
		}
		if (entry.isVisible) {
			this.hideTool(id);
		} else {
			this.showTool(id);
		}
	}

	isToolVisible(id: string): boolean {
		return this.tools.get(id)?.isVisible ?? false;
	}

	/**
	 * Bring a bound element to the front of its tool's layer. An element no tool
	 * is bound to is left alone.
	 */
	bringToFront(element: HTMLElement): void {
		const entry = Array.from(this.tools.values()).find(
			(t) => t.element === element,
		);
		if (!entry) return;

		this.stackOnTop(entry);
	}

	/**
	 * Release every tool, registered or not, and drop the subscribers. The
	 * owning toolkit coordinator calls this when it is disposed.
	 */
	destroy(): void {
		const anyVisible = Array.from(this.tools.values()).some(
			(entry) => entry.isVisible,
		);
		for (const entry of this.tools.values()) this.detachElement(entry);
		this.tools.clear();
		if (anyVisible) this.notifyListeners();
		this.listeners.clear();
	}

	private setVisible(entry: ToolEntry, visible: boolean): void {
		if (entry.isVisible === visible) return;
		entry.isVisible = visible;
		this.notifyListeners();
	}

	private detachElement(entry: ToolEntry): void {
		if (entry.element && entry.mouseDownHandler) {
			entry.element.removeEventListener("mousedown", entry.mouseDownHandler);
		}
		entry.element = null;
		entry.mouseDownHandler = undefined;
	}

	/**
	 * Put `entry` in front of its layer. The layer is renumbered from its base on
	 * every move, so its z-indices stay within it however often tools are raised.
	 */
	private stackOnTop(entry: ToolEntry): void {
		const others = Array.from(this.tools.values())
			.filter(
				(other) =>
					other.registered && other.layer === entry.layer && other !== entry,
			)
			.sort((a, b) => a.baseZIndex - b.baseZIndex);
		const top = entry.layer + others.length + 1;
		if (
			entry.baseZIndex === top &&
			others.every((other) => other.baseZIndex < top)
		) {
			return;
		}
		[...others, entry].forEach((stacked, index) => {
			stacked.baseZIndex = entry.layer + 1 + index;
			if (stacked.element) {
				stacked.element.style.zIndex = String(stacked.baseZIndex);
			}
		});
	}

	/**
	 * Bind the element a tool stacks by. It takes the tool's z-index and comes to
	 * the front of the layer when pressed, and when bound while the tool is shown.
	 *
	 * The outermost element stacks: binding an element inside the bound one keeps
	 * the binding, so a tool rendered inside a toolbar's floating window stacks
	 * by that window whichever binds first.
	 */
	updateToolElement(id: string, element: HTMLElement): void {
		const entry = this.tools.get(id);
		if (!entry?.registered) {
			logger.debug(`Tool ${id} not found`);
			return;
		}
		if (entry.element === element) return;
		if (entry.element?.isConnected && entry.element.contains(element)) return;

		this.detachElement(entry);
		const mouseDownHandler = () => this.bringToFront(element);
		element.addEventListener("mousedown", mouseDownHandler);
		entry.element = element;
		entry.mouseDownHandler = mouseDownHandler;

		element.style.zIndex = String(entry.baseZIndex);
		if (entry.isVisible) this.bringToFront(element);
	}

	/**
	 * Hide every visible tool, or every instance of one tool with
	 * `{ baseId }`, notifying subscribers once.
	 */
	hideAllTools(filter?: ToolStateFilter): void {
		let changed = false;
		for (const entry of this.tools.values()) {
			if (!entry.isVisible || !matchesFilter(entry.id, filter)) continue;
			entry.isVisible = false;
			changed = true;
		}
		if (changed) this.notifyListeners();
	}

	/** State of a tool an element registration holds. */
	getToolState(id: string): ToolState | undefined {
		const entry = this.tools.get(id);
		return entry?.registered ? toToolState(entry) : undefined;
	}

	/**
	 * Every visible tool, or every visible instance of one tool with
	 * `{ baseId }`. A tool shown while its element re-renders counts, as
	 * {@link isToolVisible} counts it.
	 */
	getVisibleTools(filter?: ToolStateFilter): ToolState[] {
		return Array.from(this.tools.values())
			.filter((entry) => entry.isVisible && matchesFilter(entry.id, filter))
			.map(toToolState);
	}
}
