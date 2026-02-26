export const PIE_REGISTER_EVENT = "pie-register";
export const PIE_UNREGISTER_EVENT = "pie-unregister";
export const PIE_ITEM_SESSION_CHANGED_EVENT = "item-session-changed";

export type RuntimeRegistrationKind = "item" | "passage";

export interface RuntimeRegistrationDetail {
	kind: RuntimeRegistrationKind;
	itemId: string;
	canonicalItemId?: string;
	contentKind?: string;
	item?: unknown;
	element: HTMLElement;
}

export interface ItemSessionChangedDetail {
	itemId: string;
	canonicalItemId?: string;
	session: unknown;
	sourceRuntimeId?: string;
}
