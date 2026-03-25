export interface ToolbarItemBase {
	id: string;
	label: string;
	ariaLabel?: string;
	icon?: string;
	tooltip?: string;
	active?: boolean;
	disabled?: boolean;
}

export interface ToolbarButtonItem extends ToolbarItemBase {
	onClick: () => void;
	href?: never;
	target?: never;
	rel?: never;
}

export interface ToolbarLinkItem extends ToolbarItemBase {
	href: string;
	target?: "_self" | "_blank" | "_parent" | "_top" | string;
	rel?: string;
	onClick?: never;
}

export type ToolbarItem = ToolbarButtonItem | ToolbarLinkItem;

export function isToolbarLinkItem(item: ToolbarItem): item is ToolbarLinkItem {
	return typeof (item as ToolbarLinkItem).href === "string";
}

export function isValidToolbarItemShape(value: unknown): value is ToolbarItem {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const item = value as Record<string, unknown>;
	if (typeof item.id !== "string" || item.id.trim().length === 0) return false;
	if (typeof item.label !== "string" || item.label.trim().length === 0) return false;
	if (item.ariaLabel !== undefined && typeof item.ariaLabel !== "string") return false;
	if (item.icon !== undefined && typeof item.icon !== "string") return false;
	if (item.tooltip !== undefined && typeof item.tooltip !== "string") return false;
	if (item.active !== undefined && typeof item.active !== "boolean") return false;
	if (item.disabled !== undefined && typeof item.disabled !== "boolean") return false;

	const hasHref = typeof item.href === "string";
	const hasOnClick = typeof item.onClick === "function";
	if (hasHref === hasOnClick) return false;
	if (hasHref) return true;
	return hasOnClick;
}

export function isInlineSvgIcon(icon: string | undefined): boolean {
	return typeof icon === "string" && icon.trimStart().startsWith("<svg");
}

export function isExternalIconUrl(icon: string | undefined): boolean {
	return typeof icon === "string" && icon.trimStart().startsWith("http");
}
