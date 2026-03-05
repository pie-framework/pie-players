export const PIE_REGISTER_EVENT = "pie-register";
export const PIE_UNREGISTER_EVENT = "pie-unregister";
export const PIE_INTERNAL_ITEM_SESSION_CHANGED_EVENT = "pie-item-session-changed";
export const PIE_ITEM_SESSION_CHANGED_EVENT = "item-session-changed";
export const PIE_INTERNAL_CONTENT_LOADED_EVENT = "pie-content-loaded";
export const PIE_INTERNAL_ITEM_PLAYER_ERROR_EVENT = "pie-item-player-error";

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

export interface InternalItemSessionChangedDetail {
	itemId: string;
	session: unknown;
}

export interface InternalContentLoadedDetail {
	itemId: string;
	canonicalItemId?: string;
	contentKind?: string;
	detail?: unknown;
}

export interface InternalItemPlayerErrorDetail {
	itemId: string;
	canonicalItemId?: string;
	contentKind?: string;
	error: unknown;
}
