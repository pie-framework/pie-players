/**
 * Tool Coordinator Store (Svelte-specific)
 *
 * @deprecated This Svelte-store-based floating-tool coordinator is the
 * second of two parallel implementations and has zero in-tree consumers.
 * It will be removed in the next major release of `@pie-players/*`. Use
 * the class-based `ToolCoordinator` from
 * `@pie-players/pie-assessment-toolkit` (re-exported via the package
 * root and instantiated by `ToolkitCoordinator`). The class exposes a
 * `subscribe()` method for reactive consumers; wrap that in a small
 * derived store at the call site if you need a Svelte store shape.
 *
 * Migration:
 * - `registerTool` / `unregisterTool` / `showTool` / `hideTool` /
 *   `toggleTool` / `bringToFront` / `updateToolElement` /
 *   `hideAllTools` / `getToolState` / `isToolVisible` are all available
 *   as methods on the class-based `ToolCoordinator`.
 * - `visibleTools` derived store → call
 *   `ToolCoordinator.getVisibleTools()` and re-derive in your
 *   component, or subscribe via `ToolCoordinator.subscribe()`.
 * - `activeTool` derived store → there is no direct equivalent; track
 *   in component state if needed (the class assigns z-index per layer
 *   instead of an explicit "active tool").
 *
 * Single-floating-tool-stack rationale: see M9 of the Coherent Options
 * Surface review (`.cursor/plans/coherent_options_surface_review_*.plan.md`).
 */

import { derived, get, writable } from "svelte/store";
import type { ToolCoordinator, ToolId, ToolState } from "./types.js";

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
 * Register a new tool with the coordinator.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
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
 * Unregister a tool.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
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
 * Show a tool.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
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
 * Hide a tool.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
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
 * Toggle a tool's visibility.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
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
 * Bring a tool to front (highest z-index).
 * Can be called with either a tool ID or an element directly.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
 */
export function bringToFront(idOrElement: ToolId | HTMLElement): void {
	update((state) => {
		// If given an element directly, just update its z-index
		if (idOrElement instanceof HTMLElement) {
			idOrElement.style.zIndex = String(++state.highestZIndex);
			return state;
		}

		// Otherwise, treat as tool ID
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
 * Update tool element reference.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
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
 * Hide all tools.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
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
 * Get tool state.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
 */
export function getToolState(id: ToolId): ToolState | undefined {
	const state = get({ subscribe });
	return state.tools.get(id);
}

/**
 * Check if a tool is visible.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
 */
export function isToolVisible(id: ToolId): boolean {
	return getToolState(id)?.isVisible ?? false;
}

/**
 * Derived store for getting all visible tools.
 *
 * @deprecated Use the class-based `ToolCoordinator.getVisibleTools()`.
 */
export const visibleTools = derived({ subscribe }, ($state) =>
	Array.from($state.tools.values()).filter((tool) => tool.isVisible),
);

/**
 * Derived store for getting the active tool.
 *
 * @deprecated The class-based `ToolCoordinator` does not track an
 * "active tool" — it assigns z-index per layer. Track active state in
 * component state if you need it.
 */
export const activeTool = derived({ subscribe }, ($state) =>
	$state.activeTool ? $state.tools.get($state.activeTool) : null,
);

/**
 * Main store with explicit type.
 *
 * @deprecated Use the class-based `ToolCoordinator` from the toolkit.
 */
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
