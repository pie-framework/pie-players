/**
 * The `renderToolbar` shape shared by every packaged capability that puts one
 * overlay behind one toolbar button.
 *
 * What varies between capabilities is the two options below: whether the overlay
 * paints its own chrome or takes a draggable window, and that window's size. The
 * visibility binding, the button, the component-override lookup, the `tool-id`
 * attribute and the sync are shared, so the shell title has one spelling.
 *
 * Catalog keys are derived from `toolId`: `tools.<toolId>.buttonA11y` and
 * `tools.<toolId>.tooltip`. A capability needing a different prefix — the
 * dictionary variants, which compose several capabilities off one element —
 * keeps its own renderer.
 */

import type { MessageKey } from "@pie-players/pie-players-shared/i18n/types";
import {
	applyOverlaySurface,
	createScopedVisibilityBinding,
	createToolElement,
	resolveToolRegistrationName,
	syncButtonAndOverlayVisibility,
	type ToolComponentOverrides,
	type ToolContext,
	type ToolRegistration,
	type ToolToolbarButtonDefinition,
	type ToolToolbarRenderResult,
	type ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/registration";
import { resolveOverlayElement } from "./overlay-element-cache.js";

/** A window's geometry. Absent for overlays that paint their own chrome. */
export interface OverlayToolShell {
	resizable: boolean;
	initialWidth: number;
	initialHeight: number;
	minWidth: number;
	minHeight: number;
}

export interface RenderOverlayToolbarOptions {
	/**
	 * `"frameless"` for an overlay that draws its own surface — a ruler or a line
	 * reader sits on the content rather than in a panel.
	 */
	surface?: "frameless";
	/** Present when the capability opens in a draggable, closeable window. */
	shell?: OverlayToolShell;
}

type OverlayElement = HTMLElement & {
	visible?: boolean;
	toolId?: string;
};

export function renderOverlayToolbar(
	registration: ToolRegistration,
	context: ToolContext,
	toolbarContext: ToolbarContext,
	options: RenderOverlayToolbarOptions = {},
): ToolToolbarRenderResult {
	const { toolId } = registration;
	const visibility = createScopedVisibilityBinding(toolId, toolbarContext);

	const button: ToolToolbarButtonDefinition = {
		toolId,
		label: registration.name,
		icon:
			typeof registration.icon === "function"
				? registration.icon(context)
				: registration.icon,
		disabled: false,
		ariaLabel: toolbarContext.i18n.t(
			`tools.${toolId}.buttonA11y` as MessageKey,
		),
		tooltip: toolbarContext.i18n.t(`tools.${toolId}.tooltip` as MessageKey),
		onClick: () => toolbarContext.toggleTool(toolId),
		active: visibility.isActive(),
	};

	const componentOverrides =
		(toolbarContext.componentOverrides as ToolComponentOverrides | undefined) ??
		{};
	const overlay = resolveOverlayElement(
		toolbarContext,
		visibility.fullToolId,
		() =>
			createToolElement(
				toolId,
				context,
				toolbarContext,
				componentOverrides,
			) as OverlayElement,
	);
	overlay.setAttribute("tool-id", visibility.fullToolId);
	if (options.surface === "frameless") {
		applyOverlaySurface(overlay, "frameless");
	}

	return {
		toolId,
		button,
		elements: [
			{
				element: overlay,
				mount: "after-buttons",
				// A frameless overlay draws its own surface over the content and
				// positions itself, so the content's box has to be its containing
				// block. A shelled tool is `position: fixed` and clamps to the
				// viewport, so it stays where the toolbar puts it.
				...(options.surface === "frameless"
					? { container: "content-boundary" as const }
					: {}),
				...(options.shell
					? {
							shell: {
								// Through `nameKey`, so a window's title tracks the interface
								// locale the way its button already does.
								title: resolveToolRegistrationName(
									registration,
									toolbarContext.i18n,
								),
								draggable: true,
								closeable: true,
								...options.shell,
							},
						}
					: {}),
			},
		],
		sync: () => {
			syncButtonAndOverlayVisibility({
				button,
				overlay,
				isActive: visibility.isActive,
			});
		},
		subscribeActive: visibility.subscribeActive,
	};
}
