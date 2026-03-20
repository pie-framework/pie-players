import type {
	ToolToolbarButtonDefinition,
	ToolToolbarRenderResult,
	ToolbarContext,
} from "../../services/ToolRegistry.js";
import { createScopedToolId } from "../../services/tool-instance-id.js";

export type ToolOverlaySurface = "default" | "frameless";

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
		isActive: () => toolbarContext.isToolVisible(fullToolId),
		subscribeActive: (callback: (active: boolean) => void) => {
			if (!toolbarContext.subscribeVisibility) return () => {};
			return toolbarContext.subscribeVisibility(() => {
				callback(toolbarContext.isToolVisible(fullToolId));
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
