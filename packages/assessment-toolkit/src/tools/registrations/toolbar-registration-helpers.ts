import type {
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";

export type ToolOverlaySurface = "default" | "frameless";

/**
 * The event a tool element dispatches, bubbling and composed, with
 * `{ active: boolean }` as its detail when it opens or closes its own panel.
 * A registration relays it as the toolbar button's active state.
 */
export const TOOL_ACTIVE_CHANGE_EVENT = "pie-tool-active-change";

export function createScopedVisibilityBinding(
	toolId: string,
	toolbarContext: ToolbarContext,
): {
	fullToolId: string;
	isActive: () => boolean;
	subscribeActive: ToolToolbarRenderResult["subscribeActive"];
} {
	const fullToolId = createScopedToolId(
		toolId,
		toolbarContext.scope.level,
		toolbarContext.scope.scopeId,
	);
	return {
		fullToolId,
		isActive: () => toolbarContext.isToolVisible(toolId),
		subscribeActive: (callback: (active: boolean) => void) => {
			if (!toolbarContext.subscribeVisibility) return () => {};
			return toolbarContext.subscribeVisibility(() => {
				callback(toolbarContext.isToolVisible(toolId));
			});
		},
	};
}

export function syncButtonAndOverlayVisibility(args: {
	button: ToolToolbarButtonDefinition;
	overlay: { visible?: boolean };
	isActive: () => boolean;
	onActiveChange?: (active: boolean) => void;
}): void {
	const active = args.isActive();
	args.button.active = active;
	args.overlay.visible = active;
	args.onActiveChange?.(active);
}

export function applyOverlaySurface(
	overlay: HTMLElement,
	surface: ToolOverlaySurface,
): void {
	overlay.setAttribute("data-pie-tool-surface", surface);
}
