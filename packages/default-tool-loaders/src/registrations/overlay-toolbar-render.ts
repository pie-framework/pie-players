/**
 * The `renderToolbar` shape shared by every packaged capability that puts one
 * overlay behind one toolbar button.
 *
 * Seven registrations had this inline. What actually varies between them is the
 * three options below and nothing else: whether the overlay paints its own chrome
 * or takes a draggable window, that window's size, and whether the overlay needs
 * the coordinator re-handed on each sync. Everything else — the visibility
 * binding, the button, the component-override lookup, the `tool-id` attribute, the
 * sync — was identical, which is why one rule landing in three spellings was
 * possible: the shell title was `resolveToolRegistrationName` in two files,
 * `displayName` in a third and a raw `t(key)` in a fourth.
 *
 * Catalog keys are derived from `toolId`, which held at all seven sites:
 * `tools.<toolId>.buttonA11y` and `tools.<toolId>.tooltip`. A capability needing a
 * different prefix — the dictionary variants, which compose several capabilities
 * off one element — keeps its own renderer.
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
} from "@pie-players/pie-assessment-toolkit/tools/internal";

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
	/**
	 * Re-hand the toolkit coordinator on every sync. Overlays that take part in
	 * stacking or visibility restore need it; the two that only render their own
	 * model do not, and giving them a property they ignore is not free to assume.
	 */
	handsOverCoordinator?: boolean;
}

type OverlayElement = HTMLElement & {
	visible?: boolean;
	toolId?: string;
	toolkitCoordinator?: unknown;
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
	const overlay = createToolElement(
		toolId,
		context,
		toolbarContext,
		componentOverrides,
	) as OverlayElement;
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
			if (options.handsOverCoordinator && toolbarContext.toolkitCoordinator) {
				overlay.toolkitCoordinator = toolbarContext.toolkitCoordinator;
			}
		},
		subscribeActive: visibility.subscribeActive,
	};
}
