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

export function isInlineSvgIcon(icon: string | undefined): boolean {
	return typeof icon === "string" && icon.startsWith("<svg");
}

export function isExternalIconUrl(icon: string | undefined): boolean {
	return typeof icon === "string" && icon.startsWith("http");
}
