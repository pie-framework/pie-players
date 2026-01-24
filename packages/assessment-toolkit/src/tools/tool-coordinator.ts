/**
 * Tool Coordinator Store (Svelte-specific)
 *
 * Svelte store-based implementation of tool coordination.
 * This is a framework-specific alternative to the class-based ToolCoordinator service.
 *
 * **When to use:**
 * - In Svelte components that need reactive tool state
 * - When you want automatic subscription/unsubscription
 *
 * **When NOT to use:**
 * - In framework-agnostic code
 * - When you need fine-grained control over service lifecycle
 * - In testing scenarios (prefer class-based ToolCoordinator with DI)
 *
 * For framework-agnostic code, use the class-based ToolCoordinator from services/.
 */

import { derived, get, writable } from "svelte/store";
import type { ToolCoordinator, ToolId, ToolState } from "./types";

interface ToolCoordinatorState {
	tools: Map<ToolId, ToolState>;
	highestZIndex: number;
	activeTool: ToolId | null;
}

const initialState: ToolCoordinatorState = {
	tools: new Map(),
	highestZIndex: 1000,
	activeTool: null,
};

// Create the writable store
const { subscribe, update } = writable<ToolCoordinatorState>(initialState);

/**
 * Register a new tool with the coordinator
 */
export function registerTool(
	id: ToolId,
	name: string,
	element?: HTMLElement,
): void {
	update((state) => {
		state.tools.set(id, {
			id,
			name,
			isVisible: false,
			isActive: false,
			zIndex: state.highestZIndex,
			element,
		});
		return state;
	});
}

/**
 * Unregister a tool
 */
export function unregisterTool(id: ToolId): void {
	update((state) => {
		state.tools.delete(id);
		if (state.activeTool === id) {
			state.activeTool = null;
		}
		return state;
	});
}

/**
 * Show a tool
 */
export function showTool(id: ToolId): void {
	update((state) => {
		const tool = state.tools.get(id);
		if (tool) {
			tool.isVisible = true;
			tool.isActive = true;
			tool.zIndex = ++state.highestZIndex;
			state.activeTool = id;

			// Update element z-index if available
			if (tool.element) {
				tool.element.style.zIndex = String(tool.zIndex);
			}
		}
		return state;
	});
}

/**
 * Hide a tool
 */
export function hideTool(id: ToolId): void {
	update((state) => {
		const tool = state.tools.get(id);
		if (tool) {
			tool.isVisible = false;
			tool.isActive = false;

			if (state.activeTool === id) {
				state.activeTool = null;
			}
		}
		return state;
	});
}

/**
 * Toggle a tool's visibility
 */
export function toggleTool(id: ToolId): void {
	const state = get({ subscribe });
	const tool = state.tools.get(id);

	if (tool?.isVisible) {
		hideTool(id);
	} else {
		showTool(id);
	}
}

/**
 * Bring a tool to front (highest z-index)
 * Can be called with either a tool ID or an element directly
 */
export function bringToFront(idOrElement: ToolId | HTMLElement): void {
	update((state) => {
		// If given an element directly, just update its z-index
		if (idOrElement instanceof HTMLElement) {
			idOrElement.style.zIndex = String(++state.highestZIndex);
			return state;
		}

		// Otherwise, treat as tool ID (legacy behavior)
		const id = idOrElement;
		const tool = state.tools.get(id);
		if (tool && tool.isVisible) {
			tool.zIndex = ++state.highestZIndex;
			tool.isActive = true;
			state.activeTool = id;

			// Update element z-index if available
			if (tool.element) {
				tool.element.style.zIndex = String(tool.zIndex);
			}

			// Deactivate other tools
			state.tools.forEach((t, tId) => {
				if (tId !== id) {
					t.isActive = false;
				}
			});
		}
		return state;
	});
}

/**
 * Update tool element reference
 */
export function updateToolElement(id: ToolId, element: HTMLElement): void {
	update((state) => {
		const tool = state.tools.get(id);
		if (tool) {
			tool.element = element;
			if (tool.isVisible && element) {
				element.style.zIndex = String(tool.zIndex);
			}
		}
		return state;
	});
}

/**
 * Hide all tools
 */
export function hideAllTools(): void {
	update((state) => {
		state.tools.forEach((tool) => {
			tool.isVisible = false;
			tool.isActive = false;
		});
		state.activeTool = null;
		return state;
	});
}

/**
 * Get tool state
 */
export function getToolState(id: ToolId): ToolState | undefined {
	const state = get({ subscribe });
	return state.tools.get(id);
}

/**
 * Check if a tool is visible
 */
export function isToolVisible(id: ToolId): boolean {
	return getToolState(id)?.isVisible ?? false;
}

// Derived store for getting all visible tools
export const visibleTools = derived({ subscribe }, ($state) =>
	Array.from($state.tools.values()).filter((tool) => tool.isVisible),
);

// Derived store for getting active tool
export const activeTool = derived({ subscribe }, ($state) =>
	$state.activeTool ? $state.tools.get($state.activeTool) : null,
);

// Export the main store with explicit type
// Renamed to toolCoordinatorStore to distinguish from class-based ToolCoordinator
export const toolCoordinatorStore: ToolCoordinator & {
	subscribe: typeof subscribe;
} = {
	subscribe,
	registerTool,
	unregisterTool,
	showTool,
	hideTool,
	toggleTool,
	bringToFront,
	updateToolElement,
	hideAllTools,
	getToolState,
	isToolVisible,
};

// Backward compatibility alias (deprecated - use toolCoordinatorStore)
/** @deprecated Use toolCoordinatorStore instead */
export const toolCoordinator = toolCoordinatorStore;
